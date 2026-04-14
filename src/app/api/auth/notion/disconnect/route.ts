import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/db/server";
import { logInfo } from "@/lib/logger";

export async function DELETE() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("unauth", { status: 401 });

  const service = createServiceClient();

  // pages를 지우면 cascade로 chunks, semantic_edges, query_logs 전부 삭제
  await service.from("pages").delete().eq("user_id", user.id);

  // Notion 토큰 초기화
  await service
    .from("users")
    .update({
      notion_access_token_encrypted: null,
      notion_workspace_id: null,
      notion_bot_id: null,
    })
    .eq("id", user.id);

  await logInfo("auth", "notion_disconnect", { userId: user.id });
  return NextResponse.json({ ok: true });
}
