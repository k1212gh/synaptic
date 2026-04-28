"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NavSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [tip, setTip] = useState("");
  const router = useRouter();

  async function handleClick() {
    if (syncing) return;
    setSyncing(true);
    setTip("");
    try {
      const res = await fetch("/api/sync/start", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTip(`${data.queued ?? 0}/${data.total ?? 0} 페이지 큐에 추가됨`);
        // 결과 반영을 위해 잠깐 후 그래프 데이터 새로고침
        setTimeout(() => router.refresh(), 1500);
      } else {
        setTip(`오류: ${data.error ?? res.status}`);
      }
    } catch (err) {
      setTip(`네트워크 오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setTip(""), 6000);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={syncing}
        className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        {syncing ? "동기화 중..." : "지금 동기화"}
      </button>
      {tip && (
        <div className="absolute right-0 top-full mt-2 px-3 py-2 bg-white border border-gray-100 rounded-lg shadow-sm text-xs text-gray-600 whitespace-nowrap z-10">
          {tip}
        </div>
      )}
    </div>
  );
}
