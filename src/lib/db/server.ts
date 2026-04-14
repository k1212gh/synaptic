import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// 쿠키 기반 클라이언트 — 세션(로그인) 읽기용. API 라우트와 Server Component에서 사용.
export async function createServerClient() {
  const cookieStore = await cookies();
  return _createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출 시 set 불가 — 무시
          }
        },
      },
    }
  );
}

// 서비스 롤 클라이언트 — RLS 우회, DB 쓰기 전용.
// ⚠️ 절대 클라이언트 번들에 포함 금지. server-only 컨텍스트에서만 사용.
export function createServiceClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
