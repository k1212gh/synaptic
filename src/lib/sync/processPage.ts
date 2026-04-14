import crypto from "node:crypto";
import { createServiceClient } from "@/lib/db/server";
import { getNotionClient, getPageText } from "@/lib/notion/fetcher";
import { chunkText } from "@/lib/embedding/chunk";
import { embed } from "@/lib/embedding/voyage";
import { logInfo, logError, startTimer } from "@/lib/logger";

export type ProcessResult =
  | { status: "skipped"; pageId: string }
  | { status: "no_chunks"; pageId: string }
  | { status: "synced"; pageId: string; chunks: number }
  | { status: "error"; pageId: string; error: string };

export async function processPage(
  pageId: string,
  userId: string
): Promise<ProcessResult> {
  const elapsed = startTimer();
  const serviceClient = createServiceClient();

  const { data: userData } = await serviceClient
    .from("users")
    .select("notion_access_token_encrypted")
    .eq("id", userId)
    .single();

  if (!userData?.notion_access_token_encrypted) {
    return { status: "error", pageId, error: "ERR_NO_TOKEN" };
  }

  const notionClient = getNotionClient(userData.notion_access_token_encrypted);
  const pageText = await getPageText(notionClient, pageId);
  const newHash = crypto.createHash("sha256").update(pageText).digest("hex");

  const { data: existingPage } = await serviceClient
    .from("pages")
    .select("id, content_hash")
    .eq("user_id", userId)
    .eq("notion_page_id", pageId)
    .maybeSingle();

  if (existingPage?.content_hash === newHash) {
    await logInfo("sync", "sync_page_skipped", { userId, pageId });
    return { status: "skipped", pageId };
  }

  const { data: upsertedPage, error: pageError } = await serviceClient
    .from("pages")
    .upsert(
      {
        user_id: userId,
        notion_page_id: pageId,
        content_hash: newHash,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,notion_page_id" }
    )
    .select("id")
    .single();

  if (pageError || !upsertedPage) {
    await logError("sync", "sync_page_upsert_fail", pageError?.message ?? "no data", {
      userId,
      pageId,
    });
    return { status: "error", pageId, error: "ERR_PAGE_UPSERT" };
  }

  await serviceClient.from("chunks").delete().eq("page_id", upsertedPage.id);

  const chunks = chunkText(pageText);
  if (chunks.length === 0) {
    await logInfo("sync", "sync_page_no_chunks", { userId, pageId });
    return { status: "no_chunks", pageId };
  }

  const embeddings = await embed(chunks);
  const rows = chunks.map((chunk_text, idx) => ({
    page_id: upsertedPage.id,
    chunk_index: idx,
    chunk_text,
    embedding: JSON.stringify(embeddings[idx]),
  }));

  const { error: chunkError } = await serviceClient.from("chunks").insert(rows);
  if (chunkError) {
    await logError("sync", "sync_chunk_insert_fail", chunkError.message, {
      userId,
      pageId,
      chunks: chunks.length,
    });
    return { status: "error", pageId, error: "ERR_CHUNK_INSERT" };
  }

  await logInfo("sync", "sync_page_complete", {
    userId,
    pageId,
    chunks: chunks.length,
    durationMs: elapsed(),
  });

  return { status: "synced", pageId, chunks: chunks.length };
}
