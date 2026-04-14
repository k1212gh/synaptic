import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { cookies } from "next/headers";
import { logInfo } from "@/lib/logger";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  (await cookies()).set("notion_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  await logInfo("auth", "notion_oauth_start");

  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", env.NOTION_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set(
    "redirect_uri",
    `${env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`
  );
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
