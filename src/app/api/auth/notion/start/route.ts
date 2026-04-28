import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/db/server";
import { logInfo, logWarn } from "@/lib/logger";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await logWarn("auth", "notion_oauth_start_unauth");
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?next=/connect`
    );
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  // 쿠키엔 nonce + userId, Notion으로는 nonce만 보냄
  const cookieValue = `${nonce}.${user.id}`;

  (await cookies()).set("notion_oauth_state", cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  await logInfo("auth", "notion_oauth_start", { userId: user.id });

  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", env.NOTION_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set(
    "redirect_uri",
    `${env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`
  );
  url.searchParams.set("state", nonce);

  return NextResponse.redirect(url.toString());
}
