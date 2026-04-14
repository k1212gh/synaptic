import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { encrypt } from "@/lib/crypto/token";
import { createServerClient, createServiceClient } from "@/lib/db/server";
import { logInfo, logWarn, logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("notion_oauth_state")?.value;

  // CSRF 검증
  if (!code || !state || state !== savedState) {
    await logWarn("security", "notion_oauth_csrf_fail", {
      hasCode: !!code,
      hasState: !!state,
    });
    return NextResponse.json({ error: "ERR_INVALID_STATE" }, { status: 400 });
  }
  cookieStore.delete("notion_oauth_state");

  // Notion 토큰 교환
  const basic = Buffer.from(
    `${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`,
    }),
  });

  if (!tokenRes.ok) {
    await logError("auth", "notion_token_exchange_fail", `HTTP ${tokenRes.status}`, {
      status: tokenRes.status,
    });
    return NextResponse.json(
      { error: "ERR_NOTION_TOKEN_EXCHANGE" },
      { status: 400 }
    );
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    workspace_id: string;
    bot_id: string;
  };

  // 쿠키 기반 클라이언트로 현재 로그인 사용자 확인
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login`);
  }

  // 서비스 롤로 Notion 토큰 저장 (RLS 우회)
  const serviceClient = createServiceClient();
  const { error } = await serviceClient.from("users").upsert({
    id: user.id,
    email: user.email!,
    notion_workspace_id: data.workspace_id,
    notion_access_token_encrypted: encrypt(data.access_token),
    notion_bot_id: data.bot_id,
  });

  if (error) {
    await logError("auth", "notion_token_db_upsert_fail", error.message, {
      userId: user.id,
    });
    return NextResponse.json({ error: "ERR_DB_UPSERT" }, { status: 500 });
  }

  await logInfo("auth", "notion_oauth_complete", { userId: user.id });
  return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/app/onboarding`);
}
