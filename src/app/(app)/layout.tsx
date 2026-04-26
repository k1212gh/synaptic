import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <Link href="/graph" className="text-lg font-bold tracking-tight">
          Synaptic
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <Link href="/graph" className="hover:text-gray-900 transition-colors">
            그래프
          </Link>
          <Link href="/settings" className="hover:text-gray-900 transition-colors">
            설정
          </Link>
        </div>
      </nav>
      <div className="p-6">{children}</div>
    </div>
  );
}
