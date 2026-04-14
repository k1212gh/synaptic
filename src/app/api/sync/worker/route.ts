import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processPage } from "@/lib/sync/processPage";
import { logInfo, logError } from "@/lib/logger";

const bodySchema = z.object({
  pageId: z.string().min(1),
  userId: z.string().uuid(),
});

// QUEUE_DRIVER=qstash 일 때 QStash가 이 엔드포인트를 호출
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ERR_INVALID_INPUT" }, { status: 400 });
  }

  const { pageId, userId } = parsed.data;
  const result = await processPage(pageId, userId);

  if (result.status === "error") {
    await logError("sync", "sync_page_fail", result.error, {
      userId,
      pageId,
    });
    return NextResponse.json(result, { status: 500 });
  }

  await logInfo("sync", `sync_page_${result.status}`, {
    userId,
    pageId,
    ...(result.status === "synced" ? { chunks: result.chunks } : {}),
  });

  return NextResponse.json(result);
}
