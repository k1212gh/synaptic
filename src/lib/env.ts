import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NOTION_CLIENT_ID: z.string().min(1),
    NOTION_CLIENT_SECRET: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().startsWith("sk-"),
    VOYAGE_API_KEY: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().length(64),

    // 드라이버 선택 (기본값: memory / direct → 로컬/VPS용)
    RATE_LIMIT_DRIVER: z.enum(["memory", "upstash"]).default("memory"),
    QUEUE_DRIVER: z.enum(["direct", "qstash"]).default("direct"),

    // Upstash — RATE_LIMIT_DRIVER=upstash 일 때만 필요
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

    // QStash — QUEUE_DRIVER=qstash 일 때만 필요
    QSTASH_TOKEN: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID,
    NOTION_CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    RATE_LIMIT_DRIVER: process.env.RATE_LIMIT_DRIVER,
    QUEUE_DRIVER: process.env.QUEUE_DRIVER,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
