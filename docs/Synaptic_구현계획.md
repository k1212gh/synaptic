# Synaptic (노션 시맨틱 그래프) 초급자용 뇌빼고 구현 가이드

> 대상: Next.js/Supabase 처음 써보는 신입 개발자
> 목표: 보안 사고 없이, 서비스 운영 가능한 수준의 MVP를 3~6주 안에 완성
> 원칙: 각 단계 **왜 → 어떻게 → 검증** 순서로. 막히면 이전 단계로 돌아가 검증부터 다시.

---

## Phase 0. 환경 세팅 (1일)

### 왜?
설치 실수 하나가 3일을 날린다. 버전 고정이 제일 중요.

### 체크리스트
1. **Node.js 20.x LTS** 설치 (`nvm install 20 && nvm use 20`)
2. **pnpm** 설치 (`npm i -g pnpm`) — npm보다 빠르고 디스크 아낌
3. **Git** + **GitHub 계정** + **SSH 키** 등록
4. 계정 가입 (전부 무료 티어)
   - Vercel (배포)
   - Supabase (DB + Auth)
   - Upstash (Redis, 캐시/큐)
   - Anthropic Console (Claude API)
   - Voyage AI (임베딩, 무료 200M 토큰)
   - Sentry (에러 추적, 무료 5K 이벤트/월)
   - Notion Developer (`https://www.notion.so/my-integrations`)
5. **도메인 하나 미리 구입** (Cloudflare Registrar 추천, $10/년)
   - OAuth 리다이렉트 URI는 나중에 바꾸기 귀찮음

### 검증
```bash
node -v    # v20.x.x
pnpm -v    # 9.x
git --version
```

---

## Phase 1. 레포지토리 구조 (반나절)

### 왜?
뒤에 기능 붙일 때 파일 어디에 둘지 고민하면 망한다. 처음에 구조 박는다.

### 초기화
```bash
pnpm create next-app@latest synaptic --ts --app --tailwind --eslint --src-dir --import-alias "@/*"
cd synaptic
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add @anthropic-ai/sdk voyageai
pnpm add zod @t3-oss/env-nextjs
pnpm add -D prettier prettier-plugin-tailwindcss
git init && git add . && git commit -m "chore: init"
```

### 폴더 구조
```
synaptic/
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── (marketing)/        # 랜딩, 가격, 약관
│   │   ├── (app)/              # 로그인 후 대시보드
│   │   ├── api/                # API 라우트
│   │   │   ├── auth/notion/    # OAuth 콜백
│   │   │   ├── sync/           # 페이지 동기화
│   │   │   ├── query/          # 질의응답
│   │   │   └── webhook/        # Notion 웹훅
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── db/                 # Supabase 클라이언트
│   │   ├── notion/             # Notion API 래퍼
│   │   ├── embedding/          # 임베딩 생성
│   │   ├── graph/              # 엣지 계산, 커뮤니티 탐지
│   │   ├── crypto/             # 토큰 암복호화
│   │   ├── llm/                # Claude 호출
│   │   └── env.ts              # 타입세이프 환경변수
│   ├── components/
│   └── types/
├── supabase/
│   └── migrations/             # SQL 마이그레이션
├── scripts/
│   └── seed.ts                 # 로컬 시드
├── .env.local                  # ⚠️ 절대 커밋 금지
├── .env.example                # 예시만 커밋
├── .gitignore
└── README.md
```

### 초급자 실수 방지
- **`.env.local`은 `.gitignore`에 이미 포함됨. 절대 풀지 말기.**
- 커밋 전 항상 `git status`로 `.env*` 안 섞였는지 확인
- `pre-commit` 훅 설치 권장: `pnpm add -D husky lint-staged` + `npx husky init`

### 검증
```bash
pnpm dev  # http://localhost:3000 접속 → 기본 Next.js 화면
```

---

## Phase 2. 보안 기초 공사 (1일)

이 단계를 건너뛰면 나중에 돈과 평판을 다 잃는다. **꼭 먼저 한다.**

### 2-1. 환경변수 타입세이프화
`src/lib/env.ts`:
```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    NOTION_CLIENT_ID: z.string().min(1),
    NOTION_CLIENT_SECRET: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().startsWith("sk-"),
    VOYAGE_API_KEY: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().length(64), // hex 32바이트
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
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
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
```
**왜?** 환경변수 오타로 프로덕션 터지는 사고를 막아줌. `env.FOO`만 쓰면 자동완성 + 런타임 검증.

### 2-2. 토큰 암호화 유틸
`src/lib/crypto/token.ts`:
```ts
import crypto from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) + tag(16) + ciphertext → base64
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
```
**핵심 규칙**
- `TOKEN_ENCRYPTION_KEY` 생성: `openssl rand -hex 32` — 절대 코드에 하드코딩 금지
- 키 유출 시 전체 사용자 재인증 필요하므로 Vercel 환경변수 + 로컬 `.env.local`에만 저장
- 키는 **절대 로그에 찍지 않는다**. `console.log(env)` 금지.

### 2-3. Supabase RLS (Row Level Security)
Supabase 대시보드 > Authentication > Policies에서 **모든 테이블 RLS 활성화 필수**.

```sql
-- supabase/migrations/0001_enable_rls.sql
alter table users enable row level security;
alter table pages enable row level security;
alter table chunks enable row level security;
alter table semantic_edges enable row level security;
alter table query_logs enable row level security;

-- 본인 데이터만 읽기
create policy "users_self_read" on users
  for select using (auth.uid() = id);

create policy "pages_self_read" on pages
  for select using (auth.uid() = user_id);

create policy "chunks_self_read" on chunks
  for select using (
    exists (select 1 from pages p where p.id = chunks.page_id and p.user_id = auth.uid())
  );
```
**쓰기는 서비스 역할 키(service_role)로만** 하고, 클라이언트에서는 절대 service_role 노출 금지.

### 2-4. Rate limit
`src/lib/ratelimit.ts`:
```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });

export const queryLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"), // 분당 20회
  analytics: true,
});
```
모든 `/api/*`에서 `userId` 기준으로 `await queryLimiter.limit(userId)` 먼저 호출.

### 2-5. 입력 검증 (Zod 필수)
모든 API 라우트 시작을 Zod 스키마 파싱으로. `any`는 이 프로젝트에서 금지어로 취급.

### 보안 체크리스트
- [ ] `.env.local` 커밋 안 됨
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 브라우저 코드에 없음 (grep으로 확인)
- [ ] RLS 모든 테이블 활성화
- [ ] 토큰은 암호화 후 DB 저장
- [ ] 모든 API에 rate limit
- [ ] CORS: Next.js API 라우트는 기본 동일 오리진만 허용 (따로 설정 X)

---

## Phase 3. 데이터베이스 스키마 (반나절)

### 마이그레이션 파일
`supabase/migrations/0002_schema.sql`:
```sql
-- 확장 활성화
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- 사용자
create table users (
  id uuid primary key default auth.uid(),
  email text unique not null,
  notion_workspace_id text,
  notion_access_token_encrypted text,     -- Phase 2 암호화 결과
  notion_bot_id text,
  plan text not null default 'free',      -- free / pro
  created_at timestamptz default now()
);

-- 동기화된 Notion 페이지
create table pages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  notion_page_id text not null,
  title text,
  url text,
  content_hash text,                       -- 변경 감지용
  last_synced_at timestamptz,
  unique(user_id, notion_page_id)
);
create index pages_user_idx on pages(user_id);

-- 텍스트 청크 + 임베딩
create table chunks (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references pages(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1024) not null,         -- Voyage-3: 1024 dim
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index chunks_page_idx on chunks(page_id);
create index chunks_embedding_idx on chunks
  using hnsw (embedding vector_cosine_ops);

-- 의미 연결선
create table semantic_edges (
  from_chunk_id uuid references chunks(id) on delete cascade,
  to_chunk_id uuid references chunks(id) on delete cascade,
  similarity float not null,
  discovered_at timestamptz default now(),
  primary key (from_chunk_id, to_chunk_id)
);

-- 질의 로그 (디버깅/개선용)
create table query_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  query text not null,
  result_chunk_ids uuid[],
  feedback int,                            -- -1, 0, 1
  latency_ms int,
  created_at timestamptz default now()
);
```

### 실행
Supabase 대시보드 > SQL Editor에 붙여넣고 Run. 또는 `supabase CLI`:
```bash
pnpm add -D supabase
npx supabase link --project-ref <your-ref>
npx supabase db push
```

---

## Phase 4. Notion OAuth 연결 (1~2일)

### 왜 가장 조심해야 하나?
사용자의 **전체 워크스페이스 접근 권한**을 다룬다. 실수하면 타인 데이터에 접근되거나 토큰이 유출된다.

### 4-1. Notion 통합 등록
1. https://www.notion.so/my-integrations > **New integration** > Type: **Public**
2. Redirect URI: `https://synaptic.yourdomain.com/api/auth/notion/callback` + `http://localhost:3000/...` 둘 다 등록
3. Scopes: read content, read user info (쓰기 **절대 요청 X**)
4. Client ID / Secret → `.env.local`에 복사

### 4-2. OAuth 시작 엔드포인트
`src/app/api/auth/notion/start/route.ts`:
```ts
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { cookies } from "next/headers";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  // CSRF 방어: state를 httpOnly 쿠키에 저장
  (await cookies()).set("notion_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600,
  });

  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", env.NOTION_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", `${env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}
```

### 4-3. OAuth 콜백 엔드포인트
`src/app/api/auth/notion/callback/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { encrypt } from "@/lib/crypto/token";
import { createServiceClient } from "@/lib/db/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("notion_oauth_state")?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }
  cookieStore.delete("notion_oauth_state");

  // 토큰 교환
  const basic = Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/auth/notion/callback`,
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "token_exchange_failed" }, { status: 400 });
  const data = await res.json();
  // data.access_token, data.workspace_id, data.bot_id 존재

  // 로그인한 Supabase 사용자에 연결
  const supabase = createServiceClient();
  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login`);

  await supabase.from("users").upsert({
    id: authUser.user.id,
    email: authUser.user.email!,
    notion_workspace_id: data.workspace_id,
    notion_access_token_encrypted: encrypt(data.access_token),
    notion_bot_id: data.bot_id,
  });

  return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/app/onboarding`);
}
```

### 초급자 실수 방지
- **state 검증 없이 구현하는 글이 많음.** CSRF 뚫린다. 위 코드대로 쿠키 비교 필수.
- 토큰은 **raw 상태로 DB에 절대 넣지 말 것**. `encrypt()` 씌워서.
- 에러 응답에 토큰/시크릿 포함 금지.

---

## Phase 5. 데이터 수집 파이프라인 (2~3일)

### 흐름
```
Notion → (fetch) → raw pages → (chunk) → text blocks →
(embed) → vectors → (store) → Supabase → (edge 계산) → graph
```

### 5-1. Notion 페이지 가져오기
`src/lib/notion/fetcher.ts`:
```ts
import { Client } from "@notionhq/client";
import { decrypt } from "@/lib/crypto/token";

export function getNotionClient(encryptedToken: string) {
  return new Client({ auth: decrypt(encryptedToken) });
}

export async function listAllPages(client: Client) {
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.search({
      filter: { property: "object", value: "page" },
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    // Rate limit: 3 req/sec
    await new Promise(r => setTimeout(r, 350));
  } while (cursor);
  return pages;
}

export async function getPageText(client: Client, pageId: string): Promise<string> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
    await new Promise(r => setTimeout(r, 350));
  } while (cursor);
  return blocks.map(extractText).filter(Boolean).join("\n");
}

function extractText(block: any): string {
  const rich = block[block.type]?.rich_text;
  if (!Array.isArray(rich)) return "";
  return rich.map((r: any) => r.plain_text).join("");
}
```

### 5-2. 청킹 전략
```ts
// src/lib/embedding/chunk.ts
export function chunkText(text: string, maxChars = 1500, overlap = 200): string[] {
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + p).length > maxChars && buf) {
      chunks.push(buf);
      buf = buf.slice(-overlap) + "\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}
```
**규칙**: 1500자/청크 + 200자 오버랩. 문단 단위 분할. 너무 짧은(<100자) 청크는 버림.

### 5-3. 임베딩 생성
```ts
// src/lib/embedding/voyage.ts
import { VoyageAIClient } from "voyageai";
import { env } from "@/lib/env";

const client = new VoyageAIClient({ apiKey: env.VOYAGE_API_KEY });

export async function embed(texts: string[]): Promise<number[][]> {
  const BATCH = 128;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const res = await client.embed({ input: texts.slice(i, i + BATCH), model: "voyage-3" });
    all.push(...res.data.map(d => d.embedding!));
  }
  return all;
}
```
**비용 추정**: 10,000개 청크 ≈ 500만 토큰 ≈ Voyage 무료 티어 내.

### 5-4. 큐 기반 동기화
단일 요청에서 전체 워크스페이스 처리는 Vercel Serverless 10초 제한에 걸림. **큐로 분리 필수.**

옵션 A (간단): Upstash QStash
```ts
// /api/sync/start → 각 페이지 ID를 QStash로 하나씩 publish
// /api/sync/worker?pageId=... → 단일 페이지 처리
```
옵션 B: Supabase의 `pg_cron` + 작업 테이블

**초급자는 옵션 A 추천.** `@upstash/qstash` 설치.

### 5-5. 증분 동기화
- `pages.content_hash`에 블록 ID + `last_edited_time` 해시 저장
- 다시 sync 시 해시 다르면 re-embed, 같으면 skip
- Notion 웹훅(beta) 받으면 해당 페이지만 큐에 넣어 갱신

---

## Phase 6. 코어 로직 (3~5일)

### 6-1. 시맨틱 엣지 계산
```ts
// src/lib/graph/edges.ts
// 각 청크마다 상위 K=8개 유사 청크와 연결. 임계값 0.78 이상.
export async function computeEdges(userId: string) {
  const supabase = createServiceClient();
  const { data: chunks } = await supabase.rpc("user_chunks", { uid: userId });
  for (const c of chunks) {
    const { data: neighbors } = await supabase.rpc("match_chunks", {
      query_embedding: c.embedding, user_id: userId, k: 8, threshold: 0.78,
    });
    const rows = neighbors
      .filter(n => n.id !== c.id)
      .map(n => ({ from_chunk_id: c.id, to_chunk_id: n.id, similarity: n.similarity }));
    await supabase.from("semantic_edges").upsert(rows);
  }
}
```
Supabase RPC 함수:
```sql
create or replace function match_chunks(
  query_embedding vector, user_id uuid, k int, threshold float
) returns table(id uuid, similarity float) language sql stable as $$
  select c.id, 1 - (c.embedding <=> query_embedding) as similarity
  from chunks c join pages p on p.id = c.page_id
  where p.user_id = match_chunks.user_id
    and 1 - (c.embedding <=> query_embedding) > threshold
  order by c.embedding <=> query_embedding
  limit k;
$$;
```

### 6-2. 커뮤니티 탐지 (주제 클러스터)
`graphology` + `graphology-communities-louvain` 사용. 페이지 단위로 집계해서 "이 주제에 속한 페이지 N개" 같은 인사이트.

### 6-3. Claude 질의응답
```ts
// src/app/api/query/route.ts
import { Anthropic } from "@anthropic-ai/sdk";
import { z } from "zod";
import { embed } from "@/lib/embedding/voyage";
import { queryLimiter } from "@/lib/ratelimit";

const schema = z.object({ question: z.string().min(3).max(500) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("unauth", { status: 401 });
  const { success } = await queryLimiter.limit(user.id);
  if (!success) return new Response("rate_limit", { status: 429 });

  const { question } = schema.parse(await req.json());
  const [qvec] = await embed([question]);
  const { data: contexts } = await supabase.rpc("match_chunks", {
    query_embedding: qvec, user_id: user.id, k: 8, threshold: 0.5,
  });

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: "당신은 사용자의 노션 워크스페이스 전용 리서치 어시스턴트입니다. 제공된 컨텍스트 밖의 정보는 추측하지 마세요. 답변에 [인용 번호]를 반드시 붙이세요.",
    messages: [{
      role: "user",
      content: `컨텍스트:\n${contexts.map((c, i) => `[${i+1}] ${c.chunk_text}`).join("\n---\n")}\n\n질문: ${question}`,
    }],
  });

  await supabase.from("query_logs").insert({
    user_id: user.id, query: question,
    result_chunk_ids: contexts.map(c => c.id),
    latency_ms: Date.now() - t0,
  });
  return Response.json({ answer: msg.content, sources: contexts });
}
```

### 6-4. 보안 체크포인트
- 다른 유저 청크가 절대 섞이지 않도록 모든 RPC에 `user_id` 필터 **이중 확인**
- Claude 응답에 사용자 토큰/이메일 같은 PII가 들어가지 않게 시스템 프롬프트에 명시
- 질문 입력 길이 제한(500자), 멀티라인 공격 방지

---

## Phase 7. 프론트엔드 (2~3일)

### 7-1. 그래프 시각화
`react-force-graph-2d` 사용. 노드 = 페이지, 엣지 = 평균 유사도.
```tsx
"use client";
import ForceGraph2D from "react-force-graph-2d";
// SSR 비활성화: next/dynamic + ssr:false
```

### 7-2. 주요 화면
1. `/` 랜딩 (혜택 3개 + 데모 GIF + 가격)
2. `/login` 이메일 로그인 (Supabase Auth magic link)
3. `/app/connect` "노션 연결하기" 버튼 하나
4. `/app/graph` 그래프 + 사이드바에 Q&A
5. `/app/settings` 연결 해제 / 데이터 삭제

### 7-3. 필수 UX
- 동기화 진행률 실시간 표시 (WebSocket은 복잡하니 3초마다 polling으로 충분)
- "연결 해제" 버튼: 토큰/청크/엣지 전부 hard delete 확인 다이얼로그

---

## Phase 8. MCP 서버 랩핑 (선택, 1~2일)

취업 어필용으로 강력. `@modelcontextprotocol/sdk`로 같은 Q&A를 MCP tool로 노출.

```ts
// mcp-server/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
// tool: search_notion_graph(query) → 내 서비스의 /api/query 호출
```
Claude Desktop에서 "내 노션에서 X 찾아줘" 하면 바로 동작하게.

---

## Phase 9. 배포 & 운영 (1일)

### Vercel 배포
1. GitHub에 push
2. Vercel 대시보드 > Import > 환경변수 전부 등록 (프로덕션/프리뷰 구분!)
3. 도메인 연결 → **HTTPS 자동**
4. Notion Integration의 Redirect URI를 프로덕션 도메인으로 업데이트

### 모니터링
- Sentry: `pnpm add @sentry/nextjs && npx @sentry/wizard@latest -i nextjs`
- Vercel Analytics: 기본 탑재
- Supabase: Dashboard > Logs에서 SQL 에러 감시

### 백업
- Supabase 유료($25/월) 이전이라도 **daily pg_dump 스크립트 작성**해서 R2/S3에 넣기
- 또는 Supabase Dashboard > Database > Backups (유료 필수)

### 비용 상한선 방어
- Anthropic: Console에서 **monthly limit** 설정 ($20 등)
- Voyage, OpenAI도 동일
- Supabase 유료 자동 전환 **꺼두기** 처음엔

---

## Phase 10. 런칭 체크리스트

런칭 D-Day 전날 **반드시 전부 체크**:

### 보안
- [ ] `.env.local` 깃에 없음 (`git log --all -- .env.local` 빈 결과)
- [ ] `grep -r "SUPABASE_SERVICE_ROLE" src/app/(?!api)` 없음
- [ ] Notion OAuth state 쿠키 검증 확인
- [ ] 모든 API에 Zod 입력 검증
- [ ] 모든 API에 rate limit
- [ ] 타 유저 데이터 접근 테스트: 다른 계정 만들어서 user_id 바꿔 요청 → 403 확인
- [ ] 토큰 DB에서 raw로 읽히지 않음 (복호화 없이는 무의미)

### 기능
- [ ] 신규 가입 → Notion 연결 → 100개 페이지 동기화 → 그래프 표시 → 질문 답변 전체 플로우 수동 테스트
- [ ] 연결 해제 시 데이터 완전 삭제 확인
- [ ] 모바일에서 그래프 화면 최소 작동 (완벽하진 않아도 됨)

### 법률/정책
- [ ] 개인정보처리방침 페이지 작성 (Notion 데이터 처리 명시)
- [ ] 이용약관 (책임 제한, 환불 규정)
- [ ] 데이터 삭제 요청 응대 프로세스 문서화

### 관측
- [ ] Sentry에 테스트 에러 발생시켜 수신 확인
- [ ] 가격/청구 대시보드(Stripe 등) 연동 전이면, 대기자 리스트 이메일 수집부터

### 런칭
- [ ] ProductHunt / HackerNews Show HN / r/Notion / r/SaaS / 한국 커뮤니티 3곳 선정
- [ ] 런칭 포스트 초안 (문제 → 해결 → 기술 스택 → 데모 → 가격)
- [ ] 첫 10명은 피드백 받는 대가로 무료 Pro

---

## 부록 A. 자주 하는 실수

1. **service_role 키를 클라이언트에 노출**: `NEXT_PUBLIC_` 접두어가 붙은 환경변수는 브라우저에 내려간다. 절대 `NEXT_PUBLIC_SERVICE_ROLE_KEY` 같은 거 만들지 말 것.
2. **RLS 안 키고 배포**: Supabase는 기본 비활성. 공격자가 anon 키로 전체 테이블 덤프 가능.
3. **OAuth state 미검증**: 로그인 세션 탈취 위험.
4. **임베딩 실패 시 재시도 없이 throw**: 일부 청크 누락. 최소 3회 지수백오프 재시도 로직 필수.
5. **rate limit 없이 Claude 호출 노출**: 1명이 수천 번 호출해서 월 한도 소진.
6. **대용량 동기화를 HTTP 한 요청에 처리**: 타임아웃. 큐로 쪼개기.
7. **에러 메시지에 스택트레이스 그대로 반환**: 내부 경로/시크릿 유출. `Sentry에만 보내고 사용자에겐 "ERR_123" 같은 코드`.

---

## 부록 B. 주차별 로드맵 (3~6주)

| 주차 | 목표 | 산출물 |
|---|---|---|
| W1 | Phase 0-2 완료 | 빈 앱 배포, RLS 활성화된 DB |
| W2 | Phase 3-4 완료 | OAuth 로그인 → 내 노션 1페이지 조회 성공 |
| W3 | Phase 5 완료 | 전체 워크스페이스 청크/임베딩 Supabase에 적재 |
| W4 | Phase 6 완료 | Q&A API 동작, 그래프 엣지 테이블 생성 |
| W5 | Phase 7 완료 | 그래프 UI + 기본 UX, 본인 데이터로 드래그 테스트 |
| W6 | Phase 8-10 완료 | Sentry 켜고 도메인 연결, 3명 베타 테스터 초대 |

**매주 금요일 30분 회고**: 뭐 했는지 / 뭐 막혔는지 / 다음 주 한 가지 목표. 블로그로 공개 발행하면 취업 어필 + 피드백 + 백링크 3마리 토끼.

---

## 부록 C. 취업 포트폴리오로 만드는 기록법

이 프로젝트를 신입 AI 서비스 엔지니어 취업에 쓰려면 **코드보다 의사결정 기록이 중요**하다.

- `docs/ADR/` 폴더에 결정 기록 (예: "왜 Voyage-3 대신 OpenAI 말고?")
- README에 아키텍처 다이어그램 (Mermaid)
- 측정 수치를 블로그에 게시: "p95 질의 응답 지연 1.8초 → 0.9초로 단축한 과정"
- 면접 대비 한 문장 요약: "사용자의 노션 워크스페이스를 임베딩하여 의미 기반 그래프로 재구성하고 Claude로 질의응답하는 서비스. 1명의 DAU 대비 월 $3의 인프라로 운영."

---

**최종 권장사항**: Phase 2 보안 기초를 절대 건너뛰지 말 것. 나머지는 틀려도 복구 가능하지만, 토큰 유출 사고 한 번이면 이 프로젝트 자체가 이력서에 마이너스가 된다.
