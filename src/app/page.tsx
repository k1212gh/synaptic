import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <span className="text-xl font-bold tracking-tight">Synaptic</span>
        <Link
          href="/login"
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          시작하기
        </Link>
      </header>

      {/* 히어로 */}
      <section className="max-w-3xl mx-auto px-8 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          노션을 의미 그래프로
        </h1>
        <p className="text-xl text-gray-500 mb-10">
          워크스페이스의 모든 페이지를 임베딩해 숨겨진 연결을 시각화하고,
          <br />
          AI로 질문에 답합니다.
        </p>
        <Link
          href="/login"
          className="inline-block px-8 py-3 bg-black text-white rounded-xl text-base font-medium hover:bg-gray-800 transition-colors"
        >
          무료로 시작하기
        </Link>
      </section>

      {/* 핵심 기능 3가지 */}
      <section className="max-w-4xl mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            title: "의미 기반 검색",
            desc: "키워드가 아닌 의미로 연관 페이지를 찾습니다.",
          },
          {
            title: "그래프 시각화",
            desc: "페이지 간 유사도를 인터랙티브 그래프로 탐색합니다.",
          },
          {
            title: "AI Q&A",
            desc: "내 노션 데이터만 참조해 Claude가 답변합니다.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="p-6 rounded-2xl border border-gray-100 bg-gray-50"
          >
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
