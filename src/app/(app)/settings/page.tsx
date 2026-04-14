"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSync() {
    setSyncing(true);
    setSyncResult("");
    const res = await fetch("/api/sync/start", { method: "POST" });
    const data = await res.json();
    setSyncing(false);
    if (res.ok) {
      setSyncResult(`${data.queued}개 페이지 동기화 큐에 추가됨 (전체 ${data.total}개)`);
    } else {
      setSyncResult(`오류: ${data.error}`);
    }
  }

  async function handleDisconnect() {
    if (!confirm("노션 연결을 해제하면 모든 데이터가 삭제됩니다. 계속하시겠습니까?")) {
      return;
    }
    setDisconnecting(true);
    await fetch("/api/auth/notion/disconnect", { method: "DELETE" });
    setDisconnecting(false);
    router.push("/app/connect");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="max-w-lg mx-auto py-10 space-y-6">
      <h1 className="text-xl font-bold">설정</h1>

      {/* 동기화 */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-sm text-gray-900 mb-1">노션 동기화</h2>
        <p className="text-xs text-gray-400 mb-4">
          워크스페이스의 변경된 페이지를 다시 임베딩합니다.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {syncing ? "동기화 중..." : "지금 동기화"}
        </button>
        {syncResult && (
          <p className="text-xs text-gray-500 mt-2">{syncResult}</p>
        )}
      </section>

      {/* 연결 해제 */}
      <section className="bg-white rounded-xl border border-red-100 p-5">
        <h2 className="font-semibold text-sm text-red-600 mb-1">연결 해제</h2>
        <p className="text-xs text-gray-400 mb-4">
          노션 토큰, 모든 페이지 데이터, 임베딩, 엣지가 삭제됩니다.
        </p>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {disconnecting ? "해제 중..." : "노션 연결 해제"}
        </button>
      </section>

      {/* 로그아웃 */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          로그아웃
        </button>
      </section>
    </div>
  );
}
