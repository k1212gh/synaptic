import { Anthropic } from "@anthropic-ai/sdk";
import { z } from "zod";
import { embed } from "@/lib/embedding/voyage";
import { queryLimiter } from "@/lib/ratelimit";
import { env } from "@/lib/env";
import { createServerClient } from "@/lib/db/server";
import { logInfo, logWarn, startTimer } from "@/lib/logger";

const schema = z.object({ question: z.string().min(3).max(500) });

type ContextChunk = { id: string; chunk_text: string; similarity: number };

export async function POST(req: Request) {
  const elapsed = startTimer();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauth", { status: 401 });

  const { success } = await queryLimiter.limit(user.id);
  if (!success) {
    await logWarn("query", "query_rate_limit", { userId: user.id });
    return new Response("rate_limit", { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "ERR_INVALID_INPUT" }, { status: 400 });
  }
  const { question } = parsed.data;

  // 질문 임베딩
  const [qvec] = await embed([question]);

  // 유사 청크 검색
  const { data: contexts } = await supabase.rpc("match_chunks", {
    query_embedding: qvec,
    user_id: user.id,
    k: 8,
    threshold: 0.5,
  });

  const ctxList = (contexts ?? []) as ContextChunk[];

  // Claude 질의
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system:
      "당신은 사용자의 노션 워크스페이스 전용 리서치 어시스턴트입니다. " +
      "제공된 컨텍스트 밖의 정보는 추측하지 마세요. " +
      "답변에 [인용 번호]를 반드시 붙이세요.",
    messages: [
      {
        role: "user",
        content:
          `컨텍스트:\n` +
          ctxList
            .map((c, i) => `[${i + 1}] ${c.chunk_text}`)
            .join("\n---\n") +
          `\n\n질문: ${question}`,
      },
    ],
  });

  const durationMs = elapsed();

  // 질의 로그 저장 (query_logs 테이블)
  await supabase.from("query_logs").insert({
    user_id: user.id,
    query: question,
    result_chunk_ids: ctxList.map((c) => c.id),
    latency_ms: durationMs,
  });

  // 구조화 로거
  await logInfo("query", "query_complete", {
    userId: user.id,
    durationMs,
    contextCount: ctxList.length,
  });

  return Response.json({ answer: msg.content, sources: ctxList });
}
