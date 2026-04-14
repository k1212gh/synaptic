import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/db/server";
import { syncLimiter } from "@/lib/ratelimit";
import { getNotionClient, listAllPages } from "@/lib/notion/fetcher";
import { enqueueSync } from "@/lib/queue";
import { logInfo, logWarn } from "@/lib/logger";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauth", { status: 401 });

  const { success } = await syncLimiter.limit(user.id);
  if (!success) {
    await logWarn("sync", "sync_rate_limit", { userId: user.id });
    return new Response("rate_limit", { status: 429 });
  }

  const serviceClient = createServiceClient();
  const { data: userData } = await serviceClient
    .from("users")
    .select("notion_access_token_encrypted")
    .eq("id", user.id)
    .single();

  if (!userData?.notion_access_token_encrypted) {
    return NextResponse.json({ error: "ERR_NO_NOTION_TOKEN" }, { status: 400 });
  }

  const notionClient = getNotionClient(userData.notion_access_token_encrypted);
  const pages = await listAllPages(notionClient);

  const jobs = pages.map((page) => ({ pageId: page.id, userId: user.id }));
  const result = await enqueueSync(jobs);

  await logInfo("sync", "sync_enqueued", {
    userId: user.id,
    pageCount: pages.length,
  });

  return NextResponse.json(result);
}
