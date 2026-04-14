"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// react-force-graph-2d는 window 참조로 SSR 불가 → 클라이언트 전용 로드
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">
      그래프 로딩 중...
    </div>
  ),
});

type Node = { id: string; name: string; val: number };
type Link = { source: string; target: string; similarity: number };
type GraphData = { nodes: Node[]; links: Link[] };

export default function KnowledgeGraph() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/graph/data")
      .then((r) => r.json())
      .then((data: GraphData) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400 text-sm">
        그래프 데이터 불러오는 중...
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <p className="text-gray-500 text-sm mb-4">아직 동기화된 데이터가 없습니다.</p>
        <a
          href="/api/sync/start"
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          지금 동기화하기
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-950 rounded-xl overflow-hidden">
      <ForceGraph2D
        graphData={graphData}
        nodeLabel="name"
        nodeColor={() => "#6366f1"}
        linkColor={() => "rgba(255,255,255,0.15)"}
        linkWidth={(link) => (link as Link).similarity * 3}
        onNodeClick={(node) => setSelectedNode(node as Node)}
        backgroundColor="#030712"
        width={containerRef.current?.clientWidth ?? 800}
        height={containerRef.current?.clientHeight ?? 600}
      />
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-white rounded-xl shadow-lg p-4 w-64">
          <p className="font-medium text-sm text-gray-900 mb-1">{selectedNode.name}</p>
          <p className="text-xs text-gray-400">청크 수: {selectedNode.val}</p>
          <button
            onClick={() => setSelectedNode(null)}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
