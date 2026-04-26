import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/db/server";
import { logInfo, logWarn } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/connect";

  if (!code) {
    await logWarn("auth", "oauth_callback_no_code");
    return NextResponse.redirect(new URL("/login?error=no_code", url.origin));
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await logWarn("auth", "oauth_exchange_fail", { message: error.message });
    return NextResponse.redirect(
      new URL("/login?error=exchange_failed", url.origin)
    );
  }

  await logInfo("auth", "oauth_login_success");
  return NextResponse.redirect(new URL(next, url.origin));
}
