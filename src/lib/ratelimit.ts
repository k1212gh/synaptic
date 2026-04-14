import { env } from "@/lib/env";

export type RateLimitResult = { success: boolean; remaining: number };

interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

// ── Memory 드라이버 (로컬/VPS) ──────────────────────────────────────────────
// 슬라이딩 윈도우 방식: windowMs 내 요청 수를 Map으로 추적
function createMemoryLimiter(max: number, windowMs: number): RateLimiter {
  const store = new Map<string, number[]>();

  return {
    async limit(key: string) {
      const now = Date.now();
      const timestamps = (store.get(key) ?? []).filter(
        (t) => now - t < windowMs
      );
      if (timestamps.length >= max) {
        store.set(key, timestamps);
        return { success: false, remaining: 0 };
      }
      timestamps.push(now);
      store.set(key, timestamps);
      return { success: true, remaining: max - timestamps.length };
    },
  };
}

// ── Upstash 드라이버 (Vercel managed) ──────────────────────────────────────
async function createUpstashLimiter(
  max: number,
  window: string,
  prefix: string
): Promise<RateLimiter> {
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "RATE_LIMIT_DRIVER=upstash 이지만 UPSTASH_REDIS_REST_URL/TOKEN 이 없습니다."
    );
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window as `${number} ${"s" | "m" | "h" | "d"}`),
    analytics: true,
    prefix,
  });

  return {
    async limit(key: string) {
      const result = await limiter.limit(key);
      return { success: result.success, remaining: result.remaining };
    },
  };
}

// ── 팩토리 함수 ─────────────────────────────────────────────────────────────
function createLimiter(
  max: number,
  windowMs: number,
  upstashWindow: string,
  prefix: string
): RateLimiter {
  if (env.RATE_LIMIT_DRIVER === "upstash") {
    // Upstash는 비동기 초기화 필요 → 첫 호출 시 lazy init
    let instance: RateLimiter | null = null;
    return {
      async limit(key: string) {
        if (!instance) instance = await createUpstashLimiter(max, upstashWindow, prefix);
        return instance.limit(key);
      },
    };
  }
  return createMemoryLimiter(max, windowMs);
}

// ── 공개 리미터 인스턴스 ────────────────────────────────────────────────────
export const queryLimiter = createLimiter(20, 60_000, "1 m", "rl:query");
export const syncLimiter = createLimiter(5, 60_000, "1 m", "rl:sync");
