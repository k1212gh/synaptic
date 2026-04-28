import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { encryptForUser } from "@/lib/crypto/token";
import { createServerClient, createServiceClient } from "@/lib/db/server";
import { logInfo, logWarn, logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedCookie = cookieStore.get("notion_oauth_state")?.value;

  // 쿠키는 `nonce.userId` 형태. nonce는 state로 검증, userId는 현재 세션과 비교.
  const [savedNonce, savedUserId] = (savedCookie ?? "").split(".");

  // 쿠키는 시도와 무관하게 항상 1회용으로 즉시 폐기 (재사용 공격 방지)
  cookieStore.delete("notion_oauth_state");

  if (!code || !state || !savedNonce || state !== savedNonce) {
    await logWarn("security", "notion_oauth_csrf_fail", {
      hasCode: !!code,
      hasState: !!state,
      hasCookie: !!savedNonce,
    });
    return NextResponse.json({ error: "ERR_INVALID_STATE" }, { status: 400 });
  }

  // 현재 세션 사용자 확인
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login`);
  }

  // state에 묶인 userId가 현재 세션 userId와 같아야 함 (세션 하이재킹 차단)
  if (savedUserId !== user.id) {
    await logWarn("security", "notion_oauth_user_mismatch", {
      cookieUserId: savedUserId,
      sessionUserId: user.id,
    });
    return NextResponse.json({ error: "ERR_USER_MISMATCH" }, { status: 400 });
  }

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

  // 서비스 롤로 Notion 토큰 저장 (RLS 우회)
  const serviceClient = createServiceClient();
  const { error } = await serviceClient.from("users").upsert({
    id: user.id,
    email: user.email!,
    notion_workspace_id: data.workspace_id,
    notion_access_token_encrypted: encryptForUser(data.access_token, user.id),
    notion_bot_id: data.bot_id,
  });

  if (error) {
    await logError("auth", "notion_token_db_upsert_fail", error.message, {
      userId: user.id,
    });
    return NextResponse.json({ error: "ERR_DB_UPSERT" }, { status: 500 });
  }

  await logInfo("auth", "notion_oauth_complete", { userId: user.id });
  return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/graph`);
}
