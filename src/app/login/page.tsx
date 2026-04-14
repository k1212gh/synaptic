"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/app/connect`,
      },
    });

    setLoading(false);
    if (error) {
      setError("이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } else {
      setSent(true);
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">Synaptic</h1>
        <p className="text-gray-500 text-center text-sm mb-8">
          이메일로 로그인 링크를 받습니다
        </p>

        {sent ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="text-green-700 text-sm font-medium">
              {email} 로 로그인 링크를 보냈습니다.
            </p>
            <p className="text-green-600 text-xs mt-1">
              메일함을 확인해 링크를 클릭하세요.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            {error && (
              <p className="text-red-500 text-xs">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "전송 중..." : "로그인 링크 받기"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
