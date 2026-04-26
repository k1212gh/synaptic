import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/connect", "/graph", "/settings"];
const PROTECTED_API_PREFIXES = [
  "/api/sync/start",
  "/api/query",
  "/api/graph",
  "/api/auth/notion/disconnect",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtectedPage = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtectedPage && !isProtectedApi) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "ERR_UNAUTHORIZED" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/connect/:path*",
    "/graph/:path*",
    "/settings/:path*",
    "/api/sync/start",
    "/api/query/:path*",
    "/api/graph/:path*",
    "/api/auth/notion/disconnect",
  ],
};
