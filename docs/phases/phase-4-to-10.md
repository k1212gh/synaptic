# Phase 4. Notion OAuth 연동

> Phase 3이 완료된 상태에서 시작하세요.
> 예상 소요 시간: 2~3시간

---

## 이 Phase에서 할 일

- 로그인 페이지 만들기 (Supabase Auth)
- Notion 연결 버튼 구현
- OAuth 플로우 완성 (연결 → 토큰 저장)

---

## Step 1. Supabase Auth 설정

Supabase 대시보드에서:

1. **Authentication → Providers**
2. **Email** 활성화 (기본값)
3. **Site URL**: `http://localhost:3000`
4. **Redirect URLs** 추가: `http://localhost:3000/auth/callback`

---

## Step 2. 로그인 페이지

`src/app/(auth)/login/page.tsx` 생성:

```typescript
"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (!error) setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">이메일을 확인하세요</h1>
          <p className="text-gray-500">
            {email}로 로그인 링크를 보냈습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center">Synaptic</h1>
        <p className="text-gray-500 text-center">
          Notion 지식베이스를 그래프로 탐색하세요
        </p>
        <input
          type="email"
          placeholder="이메일 입력"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <button
          onClick={handleLogin}
          className="w-full bg-black text-white rounded py-2"
        >
          로그인 링크 받기
        </button>
      </div>
    </div>
  );
}
```

---

## Step 3. 로그인 콜백 처리

`src/app/auth/callback/route.ts` 생성:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
```

---

## Step 4. Notion OAuth 플로우

### OAuth 시작

`src/app/api/auth/notion/start/route.ts` 생성:

```typescript
import { NextResponse } from "next/server";
import { env } from "@/env";

export async function GET() {
  const params = new URLSearchParams({
    client_id: env.NOTION_CLIENT_ID,
    response_type: "code",
    owner: "user",
    redirect_uri: env.NOTION_REDIRECT_URI,
  });

  return NextResponse.redirect(
    `https://api.notion.com/v1/oauth/authorize?${params.toString()}`
  );
}
```

### OAuth 콜백

`src/app/api/auth/notion/callback/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { env } from "@/env";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/settings?error=notion_oauth_failed`
    );
  }

  // 1. 현재 로그인한 사용자 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login`);
  }

  // 2. code → access_token 교환
  const credentials = Buffer.from(
    `${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.NOTION_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/settings?error=token_exchange_failed`
    );
  }

  const { access_token, workspace_id, workspace_name, bot_id } =
    await tokenRes.json();

  // 3. 토큰 암호화 후 저장
  const encryptedToken = await encrypt(access_token);

  await supabaseAdmin.from("notion_connections").upsert({
    user_id: user.id,
    access_token_encrypted: encryptedToken,
    workspace_id,
    workspace_name,
    bot_id,
  });

  return NextResponse.redirect(
    `${env.NEXT_PUBLIC_APP_URL}/dashboard?connected=true`
  );
}
```

---

## Step 5. 설정 페이지 (Notion 연결 버튼)

`src/app/(dashboard)/settings/page.tsx` 생성:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: connection } = await supabase
    .from("notion_connections")
    .select("workspace_name, connected_at")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="max-w-lg mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <div className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Notion 연결</h2>

        {connection ? (
          <div className="space-y-2">
            <p className="text-green-600">
              ✅ {connection.workspace_name} 연결됨
            </p>
            <p className="text-sm text-gray-500">
              연결일: {new Date(connection.connected_at).toLocaleDateString("ko-KR")}
            </p>
            <a
              href="/api/auth/notion/start"
              className="inline-block text-sm text-blue-600 underline"
            >
              다른 워크스페이스 연결
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-500">Notion이 연결되지 않았습니다.</p>
            <a
              href="/api/auth/notion/start"
              className="inline-block bg-black text-white px-4 py-2 rounded"
            >
              Notion 연결하기
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Step 6. 빌드 확인 및 커밋

```bash
pnpm build
git add .
git commit -m "feat: notion oauth integration and auth setup"
git push
```

### 로컬 테스트

```bash
pnpm dev
```

1. `http://localhost:3000/login` 접속
2. 이메일 입력 → 로그인 링크 받기
3. 이메일에서 링크 클릭
4. `http://localhost:3000/settings` 접속
5. "Notion 연결하기" 클릭
6. Notion 페이지에서 승인
7. 대시보드로 돌아오면 성공

---

## ✅ Phase 4 완료 조건

- [ ] 로그인 페이지 동작 (이메일 OTP)
- [ ] Notion 연결 플로우 E2E 동작
- [ ] `notion_connections` 테이블에 암호화된 토큰 저장됨
- [ ] `pnpm build` 에러 없음
- [ ] GitHub 커밋 완료

---

---

# Phase 4.5. 온보딩 인터뷰

> Phase 4 완료 후 진행하세요.
> 예상 소요 시간: 1시간

---

## 이 Phase에서 할 일

첫 로그인 사용자에게 3가지 질문을 하고, 답변을 저장해서 이후 검색/답변을 개인화합니다.

---

## Step 1. 온보딩 페이지

`src/app/(dashboard)/onboarding/page.tsx` 생성:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const QUESTIONS = [
  {
    key: "role",
    question: "주로 어떤 일을 하시나요?",
    placeholder: "예: 소프트웨어 개발자, 연구자, 마케터, 학생 등",
  },
  {
    key: "purpose",
    question: "Notion을 주로 어떤 목적으로 사용하시나요?",
    placeholder: "예: 프로젝트 관리, 학습 기록, 아이디어 정리 등",
  },
  {
    key: "interests",
    question: "자주 다루는 주제나 분야는 무엇인가요?",
    placeholder: "예: AI, 마케팅, 요리, 역사 등 (쉼표로 구분)",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const router = useRouter();
  const supabase = createClient();

  const current = QUESTIONS[step];

  async function handleNext() {
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }

    // 마지막 질문 → 저장
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_context").update({
      role: answers.role,
      purpose: answers.purpose,
      interests: answers.interests?.split(",").map((s) => s.trim()),
      onboarding_completed: true,
    }).eq("user_id", user.id);

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-sm text-gray-400">
          {step + 1} / {QUESTIONS.length}
        </div>
        <h2 className="text-2xl font-bold">{current.question}</h2>
        <textarea
          rows={3}
          placeholder={current.placeholder}
          value={answers[current.key] ?? ""}
          onChange={(e) =>
            setAnswers((prev) => ({ ...prev, [current.key]: e.target.value }))
          }
          className="w-full border rounded px-3 py-2 resize-none"
        />
        <button
          onClick={handleNext}
          className="w-full bg-black text-white rounded py-2"
        >
          {step < QUESTIONS.length - 1 ? "다음" : "시작하기"}
        </button>
      </div>
    </div>
  );
}
```

---

## Step 2. 온보딩 체크 미들웨어

`src/middleware.ts` 생성:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // 로그인 안 된 상태에서 대시보드 접근 → 로그인 페이지
  if (!user && path.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 로그인 된 상태에서 대시보드 접근 → 온보딩 체크
  if (user && path.startsWith("/dashboard") && path !== "/dashboard/onboarding") {
    const { data: ctx } = await supabase
      .from("user_context")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single();

    if (!ctx?.onboarding_completed) {
      return NextResponse.redirect(new URL("/dashboard/onboarding", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

---

## ✅ Phase 4.5 완료 조건

- [ ] 첫 로그인 시 온보딩 페이지 자동 표시
- [ ] 답변 완료 후 `user_context` 저장됨
- [ ] 이미 완료한 사용자는 온보딩 건너뜀

---

---

# Phase 5. 데이터 수집 파이프라인

> Phase 4.5 완료 후 진행하세요.
> 예상 소요 시간: 3~4시간

---

## 이 Phase에서 할 일

- Notion에서 페이지 목록과 내용 가져오기
- 내용을 청크(조각)로 쪼개기
- 각 청크를 벡터로 변환 (임베딩)
- Supabase에 저장

---

## Step 1. Notion 클라이언트

`src/lib/notion/client.ts` 생성:

```typescript
import { decrypt } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

// 사용자의 복호화된 토큰 가져오기
async function getAccessToken(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("notion_connections")
    .select("access_token_encrypted")
    .eq("user_id", userId)
    .single();

  if (!data) throw new Error("Notion 연결을 찾을 수 없습니다.");

  return await decrypt(data.access_token_encrypted);
}

// Notion API 기본 요청 함수
async function notionFetch(
  path: string,
  token: string,
  options: RequestInit = {}
) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) throw new Error(`Notion API 오류: ${res.status}`);
  return res.json();
}

// 모든 페이지 목록 가져오기 (Notion Search API)
export async function getAllPages(userId: string) {
  const token = await getAccessToken(userId);
  const pages: any[] = [];
  let cursor: string | undefined;

  while (true) {
    const res = await notionFetch("/search", token, {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        page_size: 100,
        start_cursor: cursor,
      }),
    });

    pages.push(...res.results);

    if (!res.has_more) break;
    cursor = res.next_cursor;
  }

  return pages;
}

// 페이지 내용 가져오기 (블록 재귀 조회)
export async function getPageContent(
  pageId: string,
  userId: string
): Promise<string> {
  const token = await getAccessToken(userId);
  return extractTextFromBlocks(pageId, token);
}

async function extractTextFromBlocks(
  blockId: string,
  token: string,
  depth = 0
): Promise<string> {
  if (depth > 5) return ""; // 너무 깊이 들어가지 않음

  const res = await notionFetch(`/blocks/${blockId}/children`, token);
  const texts: string[] = [];

  for (const block of res.results) {
    const text = extractTextFromBlock(block);
    if (text) texts.push(text);

    // 하위 블록이 있으면 재귀 조회
    if (block.has_children) {
      const childText = await extractTextFromBlocks(block.id, token, depth + 1);
      if (childText) texts.push(childText);
    }
  }

  return texts.join("\n");
}

function extractTextFromBlock(block: any): string {
  const type = block.type;
  const content = block[type];

  if (!content?.rich_text) return "";

  return content.rich_text
    .map((rt: any) => rt.plain_text)
    .join("");
}
```

---

## Step 2. 텍스트 청크 분할기

`src/lib/chunker.ts` 생성:

```typescript
// 텍스트를 일정 크기의 조각으로 나눕니다
// 조각 간 오버랩(겹침)을 두어 문맥이 끊기지 않게 합니다

const MAX_CHARS = 1500;  // 약 512 토큰
const OVERLAP_CHARS = 150; // 약 50 토큰

export function chunkText(text: string): string[] {
  if (!text.trim()) return [];
  if (text.length <= MAX_CHARS) return [text.trim()];

  const chunks: string[] = [];

  // 문장 단위로 분리
  const sentences = text.split(/(?<=[.!?。])\s+/);
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHARS) {
      if (current.trim()) {
        chunks.push(current.trim());
      }
      // 오버랩: 이전 청크의 마지막 부분을 다음 청크 시작에 포함
      const overlap = current.slice(-OVERLAP_CHARS);
      current = overlap + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
```

---

## Step 3. Voyage AI 임베딩 클라이언트

`src/lib/voyage/client.ts` 생성:

```typescript
import { env } from "@/env";

const BATCH_SIZE = 128; // Voyage AI 배치 최대 크기

// 여러 텍스트를 벡터로 변환
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const allEmbeddings: number[][] = [];

  // 배치로 나눠서 처리
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedSingleBatch(batch);
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

async function embedSingleBatch(
  texts: string[],
  retries = 3
): Promise<number[][]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "voyage-3",
          input: texts,
        }),
      });

      if (!res.ok) throw new Error(`Voyage AI 오류: ${res.status}`);

      const data = await res.json();
      return data.data.map((item: any) => item.embedding);
    } catch (error) {
      if (attempt === retries - 1) throw error;
      // 재시도 전 대기 (지수 백오프)
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error("임베딩 생성 실패");
}
```

---

## Step 4. 동기화 API

`src/app/api/sync/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { getAllPages, getPageContent } from "@/lib/notion/client";
import { chunkText } from "@/lib/chunker";
import { embedBatch } from "@/lib/voyage/client";
import { assertPageQuota } from "@/lib/limits/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

export const POST = withAuth(async (request: NextRequest, userId: string) => {
  const results = {
    processed: 0,
    skipped: 0,
    failed: 0,
  };

  // 1. Notion 페이지 목록 가져오기
  const pages = await getAllPages(userId);

  for (const page of pages) {
    try {
      // 2. 페이지 한도 체크
      await assertPageQuota(userId);

      const title = extractTitle(page);
      const notionPageId = page.id;
      const lastEditedAt = page.last_edited_time;

      // 3. content_hash로 변경 감지 (변경 없으면 스킵)
      const { data: existing } = await supabaseAdmin
        .from("pages")
        .select("id, content_hash, last_edited_at")
        .eq("user_id", userId)
        .eq("notion_page_id", notionPageId)
        .single();

      if (existing?.last_edited_at === lastEditedAt) {
        results.skipped++;
        continue;
      }

      // 4. 페이지 내용 가져오기
      const content = await getPageContent(notionPageId, userId);
      if (!content.trim()) {
        results.skipped++;
        continue;
      }

      // 5. content_hash 계산
      const contentHash = crypto
        .createHash("md5")
        .update(content)
        .digest("hex");

      // 6. 청크 분할
      const chunks = chunkText(content);

      // 7. 임베딩 생성 (배치)
      const embeddings = await embedBatch(chunks);

      // 8. DB 저장 (트랜잭션처럼 처리)
      const { data: savedPage } = await supabaseAdmin
        .from("pages")
        .upsert({
          user_id: userId,
          notion_page_id: notionPageId,
          title,
          url: page.url,
          content_hash: contentHash,
          last_edited_at: lastEditedAt,
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!savedPage) continue;

      // 9. 기존 청크 삭제 후 새로 저장
      await supabaseAdmin
        .from("chunks")
        .delete()
        .eq("page_id", savedPage.id);

      await supabaseAdmin.from("chunks").insert(
        chunks.map((content, index) => ({
          page_id: savedPage.id,
          user_id: userId,
          content,
          embedding: embeddings[index],
          chunk_index: index,
          token_count: Math.ceil(content.length / 4),
        }))
      );

      results.processed++;
    } catch (error) {
      console.error(`페이지 처리 실패: ${page.id}`, error);
      results.failed++;
    }
  }

  return NextResponse.json({
    message: "동기화 완료",
    ...results,
  });
}, { rateLimit: "sync" });

function extractTitle(page: any): string {
  const titleProp = Object.values(page.properties ?? {}).find(
    (p: any) => p.type === "title"
  ) as any;

  return titleProp?.title?.[0]?.plain_text ?? "제목 없음";
}
```

---

## ✅ Phase 5 완료 조건

- [ ] 동기화 실행 후 `chunks` 테이블에 데이터 쌓임
- [ ] 재동기화 시 변경 없는 페이지 스킵됨
- [ ] 페이지 한도 초과 시 402 반환
- [ ] `pnpm build` 에러 없음
- [ ] GitHub 커밋 완료

---

---

# Phase 6. 코어 로직

> Phase 5 완료 후 진행하세요.
> 예상 소요 시간: 3~4시간

---

## 이 Phase에서 할 일

- 문서 간 유사도 계산 (엣지 생성)
- 커뮤니티 자동 탐지 (Leiden 알고리즘)
- 시맨틱 검색 API

---

## Step 1. 엣지 계산

`src/lib/graph/edges.ts` 생성:

```typescript
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function computeEdges(userId: string) {
  // Supabase에서 유사도 계산 (pgvector)
  const { data: similarities, error } = await supabaseAdmin.rpc(
    "compute_page_similarities",
    {
      p_user_id: userId,
      p_threshold: 0.75,
    }
  );

  if (error) throw error;
  if (!similarities || similarities.length === 0) return;

  // semantic_edges 테이블에 저장
  await supabaseAdmin.from("semantic_edges").upsert(
    similarities.map((s: any) => ({
      user_id: userId,
      source_page_id: s.source_page_id,
      target_page_id: s.target_page_id,
      similarity: s.similarity,
    })),
    { onConflict: "source_page_id,target_page_id" }
  );

  return similarities.length;
}
```

---

## Step 2. 커뮤니티 탐지

`src/lib/graph/community.ts` 생성:

```typescript
import { supabaseAdmin } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// 간단한 Leiden 알고리즘 (그리디 모듈러리티 최적화)
function detectCommunitiesSimple(
  edges: { source: string; target: string; weight: number }[]
): Map<string, number> {
  const nodeToCluster = new Map<string, number>();
  const nodes = new Set<string>();

  edges.forEach((e) => {
    nodes.add(e.source);
    nodes.add(e.target);
  });

  // 초기화: 각 노드가 자기 자신의 클러스터
  let clusterId = 0;
  nodes.forEach((node) => {
    nodeToCluster.set(node, clusterId++);
  });

  // 그리디 합병: 유사도 높은 노드끼리 같은 클러스터로
  const sortedEdges = [...edges].sort((a, b) => b.weight - a.weight);

  for (const edge of sortedEdges) {
    const srcCluster = nodeToCluster.get(edge.source)!;
    const tgtCluster = nodeToCluster.get(edge.target)!;

    if (srcCluster !== tgtCluster && edge.weight >= 0.8) {
      // 두 클러스터 합병
      const minCluster = Math.min(srcCluster, tgtCluster);
      const maxCluster = Math.max(srcCluster, tgtCluster);

      nodeToCluster.forEach((cluster, node) => {
        if (cluster === maxCluster) {
          nodeToCluster.set(node, minCluster);
        }
      });
    }
  }

  return nodeToCluster;
}

// Claude로 커뮤니티 이름 생성
async function generateClusterLabel(pageTitles: string[]): Promise<string> {
  const sample = pageTitles.slice(0, 10).join(", ");

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 30,
    messages: [
      {
        role: "user",
        content: `다음 문서 제목들을 보고 이 그룹을 나타내는 짧은 카테고리명을 한국어로 하나만 답하세요 (최대 10자): ${sample}`,
      },
    ],
  });

  return (res.content[0] as any).text.trim();
}

export async function detectAndSaveCommunities(userId: string) {
  // 1. 엣지 조회
  const { data: edges } = await supabaseAdmin
    .from("semantic_edges")
    .select("source_page_id, target_page_id, similarity")
    .eq("user_id", userId);

  if (!edges || edges.length === 0) return;

  // 2. 커뮤니티 탐지
  const edgeList = edges.map((e) => ({
    source: e.source_page_id,
    target: e.target_page_id,
    weight: e.similarity,
  }));

  const nodeToCluster = detectCommunitiesSimple(edgeList);

  // 3. 클러스터별 그룹화
  const clusters = new Map<number, string[]>();
  nodeToCluster.forEach((clusterId, pageId) => {
    if (!clusters.has(clusterId)) clusters.set(clusterId, []);
    clusters.get(clusterId)!.push(pageId);
  });

  // 4. 기존 클러스터 삭제
  await supabaseAdmin
    .from("graph_clusters")
    .delete()
    .eq("user_id", userId);

  // 5. 새 클러스터 저장
  for (const [, pageIds] of clusters) {
    if (pageIds.length < 2) continue;

    // 페이지 제목 가져오기
    const { data: pages } = await supabaseAdmin
      .from("pages")
      .select("id, title")
      .in("id", pageIds);

    const titles = pages?.map((p) => p.title ?? "제목 없음") ?? [];
    const label = await generateClusterLabel(titles);

    const { data: cluster } = await supabaseAdmin
      .from("graph_clusters")
      .insert({
        user_id: userId,
        level: 1,
        label,
        member_count: pageIds.length,
      })
      .select("id")
      .single();

    if (!cluster) continue;

    // 멤버 저장
    await supabaseAdmin.from("cluster_members").insert(
      pageIds.map((pageId) => ({
        cluster_id: cluster.id,
        page_id: pageId,
      }))
    );
  }
}
```

---

## Step 3. 검색 API

`src/app/api/search/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-handler";
import { assertQueryQuota, incrementQueryCount } from "@/lib/limits/guard";
import { embedBatch } from "@/lib/voyage/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
});

export const POST = withAuth(async (request: NextRequest, userId: string) => {
  const body = await request.json();
  const { query } = SearchSchema.parse(body);

  // 1. 쿼터 체크
  await assertQueryQuota(userId);

  // 2. 쿼리 임베딩
  const [queryEmbedding] = await embedBatch([query]);

  // 3. 벡터 검색
  const { data: results } = await supabaseAdmin.rpc("semantic_search", {
    p_user_id: userId,
    p_query_embedding: queryEmbedding,
    p_limit: 10,
  });

  // 4. 사용자 맥락 가져오기
  const { data: ctx } = await supabaseAdmin
    .from("user_context")
    .select("role, purpose")
    .eq("user_id", userId)
    .single();

  // 5. Claude로 답변 생성
  const context = results
    ?.slice(0, 5)
    .map((r: any, i: number) => `[${i + 1}] ${r.title}\n${r.content}`)
    .join("\n\n");

  const systemPrompt = ctx
    ? `당신은 ${ctx.role ?? "사용자"}의 Notion 지식베이스 검색 도우미입니다. 사용자는 주로 ${ctx.purpose ?? "지식 관리"}에 Notion을 활용합니다.`
    : "당신은 Notion 지식베이스 검색 도우미입니다.";

  const aiRes = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `다음 검색 결과를 바탕으로 질문에 답하세요.\n\n검색 결과:\n${context}\n\n질문: ${query}`,
      },
    ],
  });

  const answer = (aiRes.content[0] as any).text;

  // 6. 쿼터 사용량 증가
  await incrementQueryCount(userId);

  return NextResponse.json({ results, answer });
}, { rateLimit: "search" });
```

---

## Step 4. 그래프 계산 트리거 API

`src/app/api/graph/compute/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { computeEdges } from "@/lib/graph/edges";
import { detectAndSaveCommunities } from "@/lib/graph/community";

export const POST = withAuth(async (request: NextRequest, userId: string) => {
  // 1. 엣지 계산
  const edgeCount = await computeEdges(userId);

  // 2. 커뮤니티 탐지
  await detectAndSaveCommunities(userId);

  return NextResponse.json({
    message: "그래프 계산 완료",
    edges: edgeCount,
  });
});
```

---

## ✅ Phase 6 완료 조건

- [ ] 검색 API 동작 확인 (`/api/search`)
- [ ] 그래프 계산 후 `semantic_edges` 테이블에 데이터 생성
- [ ] `graph_clusters` 테이블에 커뮤니티 라벨 생성
- [ ] 쿼터 초과 시 402 반환
- [ ] `pnpm build` 에러 없음

---

---

# Phase 7. 프론트엔드 (그래프 + 검색 UI)

> Phase 6 완료 후 진행하세요.
> 예상 소요 시간: 3~4일

---

## 이 Phase에서 할 일

- 그래프 시각화 (Sigma.js)
- 검색 UI
- 대시보드 레이아웃

---

## Step 1. 그래프 데이터 API

`src/app/api/graph/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const GET = withAuth(async (request: NextRequest, userId: string) => {
  const { searchParams } = new URL(request.url);
  const level = parseInt(searchParams.get("level") ?? "1");
  const clusterId = searchParams.get("cluster_id");

  if (level === 1) {
    // 전체 커뮤니티 허브 (50~100개)
    const { data: clusters } = await supabaseAdmin
      .from("graph_clusters")
      .select("id, label, member_count, color")
      .eq("user_id", userId)
      .eq("level", 1);

    const nodes = clusters?.map((c) => ({
      id: c.id,
      label: c.label,
      size: Math.sqrt(c.member_count) * 5,
      color: c.color ?? "#6366f1",
      type: "cluster",
    }));

    return NextResponse.json({ nodes, edges: [] });
  }

  if (level === 2 && clusterId) {
    // 특정 클러스터 내부 페이지
    const { data: members } = await supabaseAdmin
      .from("cluster_members")
      .select("page_id, pages(id, title, url)")
      .eq("cluster_id", clusterId);

    const pageIds = members?.map((m) => m.page_id) ?? [];

    const { data: edges } = await supabaseAdmin
      .from("semantic_edges")
      .select("source_page_id, target_page_id, similarity")
      .eq("user_id", userId)
      .in("source_page_id", pageIds)
      .in("target_page_id", pageIds);

    const nodes = members?.map((m: any) => ({
      id: m.page_id,
      label: m.pages?.title ?? "제목 없음",
      url: m.pages?.url,
      size: 8,
      color: "#818cf8",
      type: "page",
    }));

    const edgeList = edges?.map((e) => ({
      id: `${e.source_page_id}-${e.target_page_id}`,
      source: e.source_page_id,
      target: e.target_page_id,
      weight: e.similarity,
    }));

    return NextResponse.json({ nodes, edges: edgeList });
  }

  return NextResponse.json({ nodes: [], edges: [] });
});
```

---

## Step 2. 그래프 컴포넌트

`src/components/graph/GraphView.tsx` 생성:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import { Sigma } from "sigma";

interface Node {
  id: string;
  label: string;
  size: number;
  color: string;
  url?: string;
  type: "cluster" | "page";
}

interface Edge {
  id: string;
  source: string;
  target: string;
  weight: number;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [level, setLevel] = useState<1 | 2>(1);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGraph();
    return () => {
      sigmaRef.current?.kill();
    };
  }, [level, selectedCluster]);

  async function loadGraph() {
    setLoading(true);
    const url = level === 1
      ? "/api/graph?level=1"
      : `/api/graph?level=2&cluster_id=${selectedCluster}`;

    const res = await fetch(url);
    const data: GraphData = await res.json();

    renderGraph(data);
    setLoading(false);
  }

  function renderGraph(data: GraphData) {
    if (!containerRef.current) return;

    sigmaRef.current?.kill();

    const graph = new Graph();

    data.nodes?.forEach((node) => {
      graph.addNode(node.id, {
        label: node.label,
        size: node.size,
        color: node.color,
        x: Math.random(),
        y: Math.random(),
      });
    });

    data.edges?.forEach((edge) => {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdge(edge.source, edge.target, {
          weight: edge.weight,
          color: "#e2e8f0",
        });
      }
    });

    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultEdgeColor: "#e2e8f0",
    });

    // 클릭 이벤트
    sigma.on("clickNode", ({ node }) => {
      const nodeData = data.nodes.find((n) => n.id === node);
      if (!nodeData) return;

      if (nodeData.type === "cluster") {
        setSelectedCluster(node);
        setLevel(2);
      } else if (nodeData.url) {
        window.open(nodeData.url, "_blank");
      }
    });

    sigmaRef.current = sigma;
  }

  return (
    <div className="relative w-full h-full">
      {/* 뒤로가기 */}
      {level === 2 && (
        <button
          onClick={() => { setLevel(1); setSelectedCluster(null); }}
          className="absolute top-4 left-4 z-10 bg-white border rounded px-3 py-1 text-sm shadow"
        >
          ← 전체 보기
        </button>
      )}

      {/* 레벨 표시 */}
      <div className="absolute top-4 right-4 z-10 bg-white border rounded px-3 py-1 text-sm shadow">
        {level === 1 ? "📡 커뮤니티 전체 뷰" : "🔍 클러스터 내부 뷰"}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
          <p>그래프 로딩 중...</p>
        </div>
      )}

      {/* 그래프 캔버스 */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
```

---

## Step 3. 검색 컴포넌트

`src/components/search/SearchBar.tsx` 생성:

```typescript
"use client";

import { useState, useCallback } from "react";

interface SearchResult {
  page_id: string;
  title: string;
  content: string;
  similarity: number;
  url: string;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (res.status === 402) {
        setError("오늘의 검색 한도에 도달했습니다. Pro 플랜으로 업그레이드하세요.");
        return;
      }

      const data = await res.json();
      setResults(data.results ?? []);
      setAnswer(data.answer ?? "");
    } catch {
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="내 Notion에서 검색..."
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "검색 중..." : "검색"}
        </button>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      {answer && (
        <div className="bg-indigo-50 border border-indigo-200 rounded p-4">
          <p className="text-sm font-medium text-indigo-800 mb-2">AI 답변</p>
          <p className="text-sm">{answer}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">관련 문서 {results.length}개</p>
          {results.map((result) => (
            <a
              key={result.page_id}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border rounded p-3 hover:bg-gray-50"
            >
              <p className="font-medium">{result.title}</p>
              <p className="text-sm text-gray-500 line-clamp-2">{result.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                유사도: {(result.similarity * 100).toFixed(0)}%
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 4. 대시보드 페이지

`src/app/(dashboard)/dashboard/page.tsx` 생성:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GraphView } from "@/components/graph/GraphView";
import { SearchBar } from "@/components/search/SearchBar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("tier, queries_used_today, daily_queries_limit, pages_limit")
    .eq("user_id", user.id)
    .single();

  const { count: pageCount } = await supabase
    .from("pages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="flex flex-col h-screen">
      {/* 상단 바 */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">Synaptic</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>페이지 {pageCount ?? 0} / {sub?.pages_limit ?? 1000}</span>
          <span>검색 {sub?.queries_used_today ?? 0} / {sub?.daily_queries_limit ?? 20}</span>
          <a href="/settings" className="hover:text-black">설정</a>
          <a href="/pricing" className="hover:text-black">업그레이드</a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 검색 패널 */}
        <aside className="w-96 border-r p-4 overflow-y-auto">
          <div className="mb-4 flex gap-2">
            <a
              href="/api/sync"
              className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
            >
              🔄 동기화
            </a>
            <a
              href="/api/graph/compute"
              className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
            >
              ✨ 그래프 계산
            </a>
          </div>
          <SearchBar />
        </aside>

        {/* 그래프 뷰 */}
        <main className="flex-1">
          <GraphView />
        </main>
      </div>
    </div>
  );
}
```

---

## ✅ Phase 7 완료 조건

- [ ] 대시보드에서 그래프 시각화 확인
- [ ] 클러스터 클릭 시 내부 노드 표시
- [ ] 검색 → AI 답변 + 관련 문서 표시
- [ ] 쿼터 표시 (페이지/검색 사용량)
- [ ] `pnpm build` 에러 없음

---

---

# Phase 8.5. 결제 (Stripe)

> Phase 7 완료 후 진행하세요.
> 예상 소요 시간: 1~2일

---

## Step 1. Stripe 가격 생성

Stripe 대시보드에서:

1. **Products** → **Add product**
2. 제품명: `Synaptic Pro`
3. 가격 추가:
   - **Monthly**: $15/월 (recurring)
   - **Annual**: $132/년 (recurring)
4. 각 가격의 **Price ID** 복사

`.env.local`에 추가:

```bash
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_ANNUAL=price_xxx
```

---

## Step 2. Checkout API

`src/app/api/billing/checkout/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const POST = withAuth(async (request: NextRequest, userId: string) => {
  const { period } = await request.json(); // "monthly" | "annual"

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  const priceId = period === "annual"
    ? process.env.STRIPE_PRICE_PRO_ANNUAL!
    : process.env.STRIPE_PRICE_PRO_MONTHLY!;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
    customer_email: user?.email,
    metadata: { userId },
  });

  return NextResponse.json({ url: session.url });
});
```

---

## Step 3. Stripe 웹훅

`src/app/api/webhook/stripe/route.ts` 생성:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const userId = (event.data.object as any).metadata?.userId;
  if (!userId) return NextResponse.json({ received: true });

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const isAnnual = sub.items.data[0].price.recurring?.interval === "year";

      await supabaseAdmin.from("subscriptions").update({
        tier: "pro",
        pages_limit: 20000,
        daily_queries_limit: 999999,
        billing_period: isAnnual ? "annual" : "monthly",
        stripe_subscription_id: sub.id,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }).eq("user_id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      // 7일 grace period 후 free로 전환 (간단하게 바로 전환)
      await supabaseAdmin.from("subscriptions").update({
        tier: "free",
        pages_limit: 1000,
        daily_queries_limit: 20,
        stripe_subscription_id: null,
      }).eq("user_id", userId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## Step 4. 가격 페이지

`src/app/pricing/page.tsx` 생성:

```typescript
export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold text-center mb-12">가격 안내</h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Free */}
        <div className="border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-bold">Free</h2>
          <p className="text-3xl font-bold">$0</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✓ 페이지 1,000개</li>
            <li>✓ 일 검색 20회</li>
            <li>✓ 그래프 시각화</li>
            <li>✓ 주 1회 그래프 갱신</li>
          </ul>
          <a href="/login" className="block text-center border rounded py-2">
            시작하기
          </a>
        </div>

        {/* Pro */}
        <div className="border-2 border-indigo-500 rounded-xl p-6 space-y-4 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs px-3 py-1 rounded-full">
            추천
          </div>
          <h2 className="text-xl font-bold">Pro</h2>
          <p className="text-3xl font-bold">$15<span className="text-base font-normal">/월</span></p>
          <p className="text-sm text-gray-500">연간 결제 시 $11/월 ($132/년)</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✓ 페이지 20,000개</li>
            <li>✓ 무제한 검색</li>
            <li>✓ 일 1회 그래프 갱신</li>
            <li>✓ 그래프 내보내기</li>
          </ul>
          <CheckoutButton period="monthly" />
        </div>

        {/* Enterprise */}
        <div className="border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-bold">Enterprise</h2>
          <p className="text-3xl font-bold">문의</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✓ 무제한 페이지</li>
            <li>✓ 팀 협업</li>
            <li>✓ SSO</li>
            <li>✓ 전담 지원</li>
          </ul>
          <a
            href="mailto:hello@synaptic.app"
            className="block text-center border rounded py-2"
          >
            문의하기
          </a>
        </div>
      </div>
    </div>
  );
}

function CheckoutButton({ period }: { period: string }) {
  async function handleCheckout() {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <button
      onClick={handleCheckout}
      className="w-full bg-indigo-500 text-white rounded py-2"
    >
      Pro 시작하기
    </button>
  );
}
```

---

## ✅ Phase 8.5 완료 조건

- [ ] Free → Pro 업그레이드 플로우 동작
- [ ] Stripe 웹훅으로 구독 상태 자동 업데이트
- [ ] 가격 페이지 완성
- [ ] Enterprise 문의 링크 동작

---

---

# Phase 9. 배포

> Phase 8.5 완료 후 진행하세요.
> 예상 소요 시간: 1일

---

## Step 1. Sentry 설정

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

물어보는 것들:
- Sentry 계정 연결 → 브라우저에서 승인
- `synaptic` 프로젝트 선택

---

## Step 2. Vercel 배포

```bash
# Vercel CLI 설치
pnpm add -g vercel

# 배포
vercel
```

물어보는 것들:
- GitHub 연결 → 기존 `synaptic` 레포 선택
- 프로젝트 이름: `synaptic`

### 환경변수 추가

Vercel 대시보드 → Settings → Environment Variables에 `.env.local`의 모든 키 추가.

> ⚠️ `NEXT_PUBLIC_APP_URL`은 배포 URL로 변경 (예: `https://synaptic.vercel.app`)

### 프로덕션 배포

```bash
vercel --prod
```

---

## Step 3. Stripe 웹훅 엔드포인트 등록

1. Stripe 대시보드 → **Developers → Webhooks**
2. **Add endpoint** 클릭
3. URL: `https://synaptic.vercel.app/api/webhook/stripe`
4. 이벤트 선택:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. **Signing secret** 복사 → `STRIPE_WEBHOOK_SECRET`으로 Vercel에 추가

---

## Step 4. Notion OAuth Redirect URI 추가

1. https://www.notion.so/my-integrations 접속
2. Synaptic Integration 클릭
3. **OAuth Domain & URIs** 탭
4. 추가: `https://synaptic.vercel.app/api/auth/notion/callback`

---

## ✅ Phase 9 완료 조건

- [ ] `https://synaptic.vercel.app` 접속 가능
- [ ] 로그인 → Notion 연결 → 동기화 → 그래프 플로우 동작
- [ ] Stripe 결제 플로우 동작
- [ ] Sentry 에러 캡처 확인

---

---

# Phase 10. 런칭 체크리스트

> 모든 Phase 완료 후 진행하세요.

---

## 보안 체크

- [ ] 모든 API 라우트에 인증 체크 (`withAuth` 사용)
- [ ] RLS 정책 전 테이블 적용됨
- [ ] `access_token` DB에 암호화 저장됨
- [ ] `.env*` 파일 GitHub에 없음
- [ ] Stripe 웹훅 서명 검증 동작
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 컴포넌트에서 안 쓰임

## 기능 체크

- [ ] 회원가입 → 로그인 → 온보딩 흐름
- [ ] Notion 연결 → 동기화 → 청크 저장
- [ ] 검색 → AI 답변 표시
- [ ] 그래프 계산 → 시각화 표시
- [ ] 클러스터 클릭 → 내부 노드 표시
- [ ] Free 한도 초과 시 업그레이드 유도
- [ ] Stripe 결제 → 구독 상태 업데이트

## 성능 체크

```bash
# Lighthouse 성능 점수 확인
npx lighthouse https://synaptic.vercel.app --view
```

- [ ] 벡터 검색 응답 < 3초
- [ ] 그래프 렌더링 부드러움 (끊김 없음)

## 런칭

- [ ] 도메인 연결 (선택: Vercel에서 커스텀 도메인 추가)
- [ ] Product Hunt / X(트위터)에 런칭 공유

---

**🎉 모든 체크리스트 완료 = Synaptic 런칭!**
