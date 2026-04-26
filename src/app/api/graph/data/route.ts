import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/server";

type PageRow = { id: string; title: string | null };

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauth", { status: 401 });

  // 페이지 목록
  const { data: pages } = await supabase
    .from("pages")
    .select("id, title")
    .eq("user_id", user.id);

  if (!pages || pages.length === 0) {
    return NextResponse.json({ nodes: [], links: [] });
  }

  // 페이지별 청크 수
  const { data: chunkCounts } = await supabase
    .from("chunks")
    .select("page_id")
    .in("page_id", (pages as PageRow[]).map((p) => p.id));

  const countMap = new Map<string, number>();
  (chunkCounts ?? []).forEach((c: { page_id: string }) => {
    countMap.set(c.page_id, (countMap.get(c.page_id) ?? 0) + 1);
  });

  const nodes = (pages as PageRow[]).map((p) => ({
    id: p.id,
    name: p.title ?? "제목 없음",
    val: countMap.get(p.id) ?? 1,
  }));

  // 엣지 (페이지 단위로 집계 — 평균 유사도)
  const { data: edges } = await supabase
    .from("semantic_edges")
    .select(
      "from_chunk_id, to_chunk_id, similarity, chunks_from:chunks!from_chunk_id(page_id), chunks_to:chunks!to_chunk_id(page_id)"
    );

  const edgeMap = new Map<string, { sum: number; count: number }>();
  // Supabase join 결과는 배열로 올 수 있으므로 any로 받아 처리
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (edges ?? []).forEach((e: any) => {
    const fromChunk = Array.isArray(e.chunks_from) ? e.chunks_from[0] : e.chunks_from;
    const toChunk = Array.isArray(e.chunks_to) ? e.chunks_to[0] : e.chunks_to;
    const fromPage: string | undefined = fromChunk?.page_id;
    const toPage: string | undefined = toChunk?.page_id;
    if (!fromPage || !toPage || fromPage === toPage) return;
    const key = [fromPage, toPage].sort().join(":");
    const cur = edgeMap.get(key) ?? { sum: 0, count: 0 };
    edgeMap.set(key, { sum: cur.sum + e.similarity, count: cur.count + 1 });
  });

  const links = Array.from(edgeMap.entries())
    .map(([key, { sum, count }]) => {
      const [source, target] = key.split(":");
      return { source, target, similarity: sum / count };
    })
    .filter((l) => l.similarity >= 0.6);

  return NextResponse.json({ nodes, links });
}
