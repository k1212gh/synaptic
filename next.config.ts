import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // QStash 웹훅 수신용 외부 패키지 서버 번들 허용
  serverExternalPackages: ["@notionhq/client"],
};

export default nextConfig;
