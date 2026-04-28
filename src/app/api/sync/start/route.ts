import { NextResponse } from "next/server";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { createServerClient, createServiceClient } from "@/lib/db/server";
import { syncLimiter } from "@/lib/ratelimit";
import { getNotionClient, listAllPages } from "@/lib/notion/fetcher";
import { enqueueSync } from "@/lib/queue";
import { logInfo, logWarn } from "@/lib/logger";

function extractTitle(page: PageObjectResponse): string | null {
  // 모든 properties에서 type === "title" 찾기 (보통 "title" 또는 "Name")
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title" && Array.isArray(prop.title)) {
      const text = prop.title.map((t) => t.plain_text).join("").trim();
      if (text) return text;
    }
  }
  return null;
}

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

  const notionClient = getNotionClient(userData.notion_access_token_encrypted, user.id);
  const pages = await listAllPages(notionClient);

  const jobs = pages.map((page) => ({
    pageId: page.id,
    userId: user.id,
    title: extractTitle(page),
    url: page.url ?? null,
  }));
  const result = await enqueueSync(jobs);

  await logInfo("sync", "sync_enqueued", {
    userId: user.id,
    pageCount: pages.length,
  });

  return NextResponse.json(result);
}
