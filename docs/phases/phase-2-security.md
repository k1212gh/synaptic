# Phase 2. 보안 기반 세팅

> Phase 1이 완료된 상태에서 시작하세요.
> 예상 소요 시간: 2~3시간

---

## 이 Phase에서 할 일

- 환경변수 타입 검증 (오타 방지)
- API Rate Limit (과도한 요청 차단)
- 쿼터 가드 (무료/유료 한도 관리)
- 모든 API 라우트에 공통 보안 로직 적용

---

## Step 1. 환경변수 타입 검증

환경변수가 하나라도 빠지면 빌드가 실패하도록 설정합니다.
실수로 API 키 없이 배포하는 걸 방지합니다.

`src/env.ts` 파일 생성:

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Supabase
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    // AI
    ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
    VOYAGE_API_KEY: z.string().min(1),

    // Redis
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

    // Notion
    NOTION_CLIENT_ID: z.string().min(1),
    NOTION_CLIENT_SECRET: z.string().min(1),
    NOTION_REDIRECT_URI: z.string().url(),

    // Stripe
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
    STRIPE_WEBHOOK_SECRET: z.string().optional(), // Phase 8.5에서 추가

    // 암호화
    TOKEN_ENCRYPTION_KEY: z.string().min(40),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  },
  runtimeEnv: {
    // Server
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID,
    NOTION_CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET,
    NOTION_REDIRECT_URI: process.env.NOTION_REDIRECT_URI,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    // Client
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
});
```

### 테스트

환경변수 하나를 임시로 지워보고:

```bash
pnpm build
```

에러가 나면 정상입니다. 지운 환경변수를 다시 추가하세요.

---

## Step 2. Rate Limiter 설정

같은 사람이 API를 너무 많이 호출하는 걸 막습니다.

`src/lib/rate-limit.ts` 파일 생성:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const rateLimiters = {
  // 검색: 분당 30회
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1m"),
    prefix: "rl:search",
  }),

  // 동기화: 시간당 10회
  sync: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1h"),
    prefix: "rl:sync",
  }),

  // 일반 API: 분당 60회
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1m"),
    prefix: "rl:api",
  }),
};
```

---

## Step 3. 에러 클래스 정의

API에서 일관된 에러를 보내기 위한 클래스입니다.

`src/lib/errors.ts` 파일 생성:

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "로그인이 필요합니다.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = "사용 한도를 초과했습니다. 플랜을 업그레이드해주세요.") {
    super(message, 402, "QUOTA_EXCEEDED");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}
```

---

## Step 4. 쿼터 가드

무료/유료 사용자의 한도를 체크하는 함수입니다.

`src/lib/limits/guard.ts` 파일 생성:

```typescript
import { createClient } from "@/lib/supabase/server";
import { QuotaExceededError } from "@/lib/errors";

// 티어별 한도 정의
const TIER_LIMITS = {
  free: {
    pages: 1000,
    dailyQueries: 20,
  },
  pro: {
    pages: 20000,
    dailyQueries: Infinity,
  },
  team: {
    pages: 100000,
    dailyQueries: Infinity,
  },
  enterprise: {
    pages: Infinity,
    dailyQueries: Infinity,
  },
} as const;

// 쿼리 한도 체크
export async function assertQueryQuota(userId: string) {
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, queries_used_today, daily_queries_limit")
    .eq("user_id", userId)
    .single();

  if (!sub) {
    // 구독 정보 없으면 무료 티어로 처리
    return;
  }

  if (sub.queries_used_today >= sub.daily_queries_limit) {
    throw new QuotaExceededError(
      `오늘의 질의 한도(${sub.daily_queries_limit}회)를 초과했습니다. Pro 플랜으로 업그레이드하면 무제한으로 사용할 수 있습니다.`
    );
  }
}

// 페이지 한도 체크
export async function assertPageQuota(userId: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from("pages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("pages_limit")
    .eq("user_id", userId)
    .single();

  const limit = sub?.pages_limit ?? TIER_LIMITS.free.pages;

  if ((count ?? 0) >= limit) {
    throw new QuotaExceededError(
      `페이지 한도(${limit}개)에 도달했습니다. Pro 플랜으로 업그레이드하면 20,000개까지 저장할 수 있습니다.`
    );
  }
}

// 쿼리 횟수 증가
export async function incrementQueryCount(userId: string) {
  const supabase = await createClient();

  await supabase.rpc("increment_query_count", { p_user_id: userId });
}
```

---

## Step 5. API 핸들러 래퍼

모든 API 라우트에서 공통으로 사용하는 함수입니다.
인증 → Rate Limit → 실제 로직 순서를 강제합니다.

`src/lib/api-handler.ts` 파일 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimiters } from "@/lib/rate-limit";
import { AppError, UnauthorizedError, RateLimitError } from "@/lib/errors";

type HandlerFn = (
  request: NextRequest,
  userId: string
) => Promise<NextResponse>;

type Options = {
  rateLimit?: keyof typeof rateLimiters;
};

export function withAuth(handler: HandlerFn, options: Options = {}) {
  return async (request: NextRequest) => {
    try {
      // 1. 인증 확인
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new UnauthorizedError();
      }

      // 2. Rate Limit 체크
      if (options.rateLimit) {
        const limiter = rateLimiters[options.rateLimit];
        const { success } = await limiter.limit(user.id);

        if (!success) {
          throw new RateLimitError();
        }
      }

      // 3. 실제 핸들러 실행
      return await handler(request, user.id);
    } catch (error) {
      // 에러 처리
      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      console.error("API Error:", error);
      return NextResponse.json(
        { error: "서버 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  };
}
```

### 사용 예시

```typescript
// src/app/api/search/route.ts
import { withAuth } from "@/lib/api-handler";

export const POST = withAuth(async (request, userId) => {
  // 여기서는 userId가 이미 검증된 상태
  const body = await request.json();
  // ... 실제 로직
}, { rateLimit: "search" });
```

---

## Step 6. 암호화 유틸리티

Notion 액세스 토큰을 안전하게 저장하기 위한 암호화 함수입니다.

`src/lib/crypto.ts` 파일 생성:

```typescript
import { env } from "@/env";

// 문자열 → Uint8Array 변환
function strToBuffer(str: string) {
  return new TextEncoder().encode(str);
}

// Uint8Array → Base64 변환
function bufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

// Base64 → Uint8Array 변환
function base64ToBuffer(base64: string) {
  return Buffer.from(base64, "base64");
}

// 암호화 키 가져오기
async function getCryptoKey() {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    base64ToBuffer(env.TOKEN_ENCRYPTION_KEY),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return keyMaterial;
}

// 암호화
export async function encrypt(text: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96비트 IV
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    strToBuffer(text)
  );

  // IV + 암호문을 합쳐서 Base64로 반환
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);

  return bufferToBase64(combined.buffer);
}

// 복호화
export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = base64ToBuffer(ciphertext);

  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}
```

---

## Step 7. 빌드 확인 및 커밋

```bash
# 빌드 테스트
pnpm build

# 성공하면 커밋
git add .
git commit -m "feat: add security foundation (env validation, rate limit, quota guard, crypto)"
git push
```

---

## ✅ Phase 2 완료 조건

- [ ] `pnpm build` 에러 없음
- [ ] `src/env.ts` 생성됨 (환경변수 검증)
- [ ] `src/lib/rate-limit.ts` 생성됨
- [ ] `src/lib/limits/guard.ts` 생성됨
- [ ] `src/lib/api-handler.ts` 생성됨
- [ ] `src/lib/crypto.ts` 생성됨
- [ ] GitHub에 커밋 올라감

모두 체크되면 **Phase 3**으로 이동하세요.
