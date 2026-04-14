"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

export default function QAPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    const answerText =
      res.ok
        ? (data.answer?.[0]?.text ?? "응답을 받지 못했습니다.")
        : `오류: ${data.error ?? "알 수 없는 오류"}`;

    setMessages((prev) => [...prev, { role: "assistant", text: answerText }]);
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-100">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">AI 질의응답</h2>
        <p className="text-xs text-gray-400">내 노션 데이터 기반</p>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">
            노션 내용에 대해 무엇이든 물어보세요.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm px-3 py-2 rounded-lg max-w-full ${
              m.role === "user"
                ? "bg-black text-white ml-auto max-w-[80%]"
                : "bg-gray-50 text-gray-800"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-gray-400 animate-pulse">답변 생성 중...</div>
        )}
      </div>

      {/* 입력창 */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
        >
          전송
        </button>
      </form>
    </div>
  );
}
