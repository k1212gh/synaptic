export default function ConnectPage() {
  return (
    <main className="max-w-md mx-auto mt-20 text-center">
      <h1 className="text-2xl font-bold mb-3">노션 워크스페이스 연결</h1>
      <p className="text-gray-500 text-sm mb-8">
        연결하면 워크스페이스의 페이지를 읽기 전용으로 가져옵니다.
        <br />
        데이터는 암호화되어 저장됩니다.
      </p>
      <a
        href="/api/auth/notion/start"
        className="inline-block px-8 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        노션으로 연결하기
      </a>
      <p className="text-xs text-gray-400 mt-4">
        쓰기 권한은 요청하지 않습니다.
      </p>
    </main>
  );
}
