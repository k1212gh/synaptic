import KnowledgeGraph from "@/components/KnowledgeGraph";
import QAPanel from "@/components/QAPanel";

export default function GraphPage() {
  return (
    <div className="flex gap-4 h-[calc(100vh-5rem)]">
      {/* 그래프 영역 */}
      <div className="flex-1 relative">
        <KnowledgeGraph />
      </div>

      {/* Q&A 사이드바 */}
      <div className="w-80 shrink-0">
        <QAPanel />
      </div>
    </div>
  );
}
