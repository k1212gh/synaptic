import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // QStash 웹훅 수신용 외부 패키지 서버 번들 허용
  serverExternalPackages: ["@notionhq/client"],
  // pnpm 심볼릭 링크 환경에서 Turbopack이 workspace root 잘못 추론하는 거 방지
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
