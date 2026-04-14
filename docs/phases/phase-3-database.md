# Phase 3. 데이터베이스 스키마

> Phase 2가 완료된 상태에서 시작하세요.
> 예상 소요 시간: 2~3시간

---

## 이 Phase에서 할 일

- Supabase에 테이블 생성
- 보안 정책(RLS) 설정
- 벡터 검색 인덱스 생성
- Next.js에서 Supabase 연결

---

## Step 1. Supabase 확장 기능 활성화

Supabase 대시보드에 로그인하고:

1. 좌측 메뉴 → **Database** → **Extensions**
2. 검색창에 `vector` 입력
3. `vector` 확장 활성화 (토글 ON)
4. 검색창에 `uuid-ossp` 입력
5. `uuid-ossp` 확장 활성화

---

## Step 2. 마이그레이션 파일 생성

`supabase/migrations/001_initial_schema.sql` 파일 생성:

```sql
-- =============================================
-- Synaptic 초기 스키마
-- =============================================

-- 확장 활성화
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- =============================================
-- 사용자 테이블
-- =============================================
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- =============================================
-- 구독/쿼터 관리
-- =============================================
create table subscriptions (
  user_id uuid primary key references users(id) on delete cascade,
  tier text not null default 'free'
    check (tier in ('free', 'pro', 'team', 'enterprise')),
  pages_limit int not null default 1000,
  daily_queries_limit int not null default 20,
  queries_used_today int not null default 0,
  queries_reset_at date not null default current_date,
  billing_period text check (billing_period in ('monthly', 'annual')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

-- =============================================
-- Notion 연결 정보
-- =============================================
create table notion_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  access_token_encrypted text not null,  -- AES-256 암호화 필수
  workspace_id text not null,
  workspace_name text,
  bot_id text,
  connected_at timestamptz default now(),
  unique(user_id, workspace_id)
);

-- =============================================
-- Notion 페이지
-- =============================================
create table pages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  notion_page_id text not null,
  title text,
  url text,
  content_hash text,          -- 변경 감지용 (변경 없으면 재임베딩 안 함)
  last_edited_at timestamptz, -- Notion에서 가져온 수정 시각
  last_synced_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, notion_page_id)
);

-- =============================================
-- 청크 (임베딩 단위로 쪼갠 페이지 내용)
-- =============================================
create table chunks (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references pages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  embedding vector(1024),     -- Voyage AI voyage-3 차원
  chunk_index int not null,   -- 페이지 내 순서
  token_count int,
  created_at timestamptz default now()
);

-- 벡터 검색 인덱스 (HNSW 방식, 코사인 유사도)
-- p95 < 200ms 목표
create index chunks_embedding_idx
  on chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- =============================================
-- 시맨틱 엣지 (페이지 간 관계)
-- =============================================
create table semantic_edges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  source_page_id uuid not null references pages(id) on delete cascade,
  target_page_id uuid not null references pages(id) on delete cascade,
  similarity float not null check (similarity >= 0 and similarity <= 1),
  computed_at timestamptz default now(),
  unique(source_page_id, target_page_id)
);

-- =============================================
-- 그래프 클러스터 (Leiden 알고리즘 결과)
-- =============================================
create table graph_clusters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  level int not null check (level between 1 and 3),
    -- level 1: 전체 커뮤니티 (50~100개)
    -- level 2: 서브 클러스터
    -- level 3: 개별 페이지
  label text,                          -- AI가 생성한 커뮤니티 이름
  color text,                          -- 시각화 색상 (hex)
  centroid_vector vector(1024),
  member_count int not null default 0,
  parent_cluster_id uuid references graph_clusters(id),
  computed_at timestamptz default now()
);

create index graph_clusters_user_level_idx
  on graph_clusters(user_id, level);

create table cluster_members (
  cluster_id uuid references graph_clusters(id) on delete cascade,
  page_id uuid references pages(id) on delete cascade,
  primary key (cluster_id, page_id)
);

-- =============================================
-- 사용자 맥락 (온보딩 인터뷰 결과)
-- =============================================
create table user_context (
  user_id uuid primary key references users(id) on delete cascade,
  role text,                -- 직업/역할
  purpose text,             -- Notion 활용 목적
  interests text[],         -- 관심 분야 태그
  onboarding_completed boolean default false,
  updated_at timestamptz default now()
);

-- =============================================
-- RLS (Row Level Security) 활성화
-- 각 사용자는 자기 데이터만 볼 수 있음
-- =============================================
alter table users enable row level security;
alter table subscriptions enable row level security;
alter table notion_connections enable row level security;
alter table pages enable row level security;
alter table chunks enable row level security;
alter table semantic_edges enable row level security;
alter table graph_clusters enable row level security;
alter table cluster_members enable row level security;
alter table user_context enable row level security;

-- 정책: 자기 데이터만 접근 가능
create policy "own_data" on users
  for all using (id = auth.uid());

create policy "own_data" on subscriptions
  for all using (user_id = auth.uid());

create policy "own_data" on notion_connections
  for all using (user_id = auth.uid());

create policy "own_data" on pages
  for all using (user_id = auth.uid());

create policy "own_data" on chunks
  for all using (user_id = auth.uid());

create policy "own_data" on semantic_edges
  for all using (user_id = auth.uid());

create policy "own_data" on graph_clusters
  for all using (user_id = auth.uid());

create policy "own_data" on user_context
  for all using (user_id = auth.uid());

-- cluster_members는 graph_clusters를 통해 간접 체크
create policy "own_data" on cluster_members
  for all using (
    exists (
      select 1 from graph_clusters c
      where c.id = cluster_id and c.user_id = auth.uid()
    )
  );

-- =============================================
-- 함수: 쿼리 횟수 증가 (atomic)
-- =============================================
create or replace function increment_query_count(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  -- 날짜가 바뀌면 카운터 리셋
  update subscriptions
  set
    queries_used_today = case
      when queries_reset_at < current_date then 1
      else queries_used_today + 1
    end,
    queries_reset_at = current_date
  where user_id = p_user_id;
end;
$$;

-- =============================================
-- 함수: 시맨틱 검색
-- =============================================
create or replace function semantic_search(
  p_user_id uuid,
  p_query_embedding vector(1024),
  p_limit int default 10
)
returns table (
  page_id uuid,
  title text,
  content text,
  similarity float,
  url text
)
language sql stable as $$
  select
    p.id as page_id,
    p.title,
    c.content,
    1 - (c.embedding <=> p_query_embedding) as similarity,
    p.url
  from chunks c
  join pages p on p.id = c.page_id
  where c.user_id = p_user_id
    and p.is_active = true
    and c.embedding is not null
  order by c.embedding <=> p_query_embedding
  limit p_limit;
$$;

-- =============================================
-- 함수: 페이지 간 유사도 계산
-- =============================================
create or replace function compute_page_similarities(
  p_user_id uuid,
  p_threshold float default 0.75,
  p_limit int default 10000
)
returns table (
  source_page_id uuid,
  target_page_id uuid,
  similarity float
)
language sql stable as $$
  select
    c1.page_id as source_page_id,
    c2.page_id as target_page_id,
    max(1 - (c1.embedding <=> c2.embedding)) as similarity
  from chunks c1
  join chunks c2 on c1.page_id != c2.page_id
  where c1.user_id = p_user_id
    and c2.user_id = p_user_id
    and c1.embedding is not null
    and c2.embedding is not null
  group by c1.page_id, c2.page_id
  having max(1 - (c1.embedding <=> c2.embedding)) >= p_threshold
  limit p_limit;
$$;

-- =============================================
-- 트리거: 새 사용자 가입 시 자동으로 관련 행 생성
-- =============================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- users 테이블에 행 추가
  insert into users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  -- subscriptions 테이블에 무료 플랜으로 추가
  insert into subscriptions (user_id)
  values (new.id);

  -- user_context 초기화
  insert into user_context (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

---

## Step 3. Supabase에 SQL 실행

1. Supabase 대시보드 접속
2. 좌측 메뉴 → **SQL Editor**
3. 위 SQL 전체 복사 → 붙여넣기
4. **Run** 버튼 클릭

에러 없이 실행되면 성공입니다.

### 실행 결과 확인

좌측 메뉴 → **Table Editor** 클릭.
아래 테이블들이 보이면 성공:

- users
- subscriptions
- notion_connections
- pages
- chunks
- semantic_edges
- graph_clusters
- cluster_members
- user_context

---

## Step 4. Supabase 클라이언트 코드 작성

### 4-1. 브라우저용 클라이언트

`src/lib/supabase/client.ts` 생성:

```typescript
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/env";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

### 4-2. 서버 컴포넌트용 클라이언트

`src/lib/supabase/server.ts` 생성:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/env";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키 설정 불가 (무시)
          }
        },
      },
    }
  );
}
```

### 4-3. 관리자용 클라이언트 (서버 전용)

`src/lib/supabase/admin.ts` 생성:

```typescript
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Database } from "@/types/database";

// ⚠️ 이 클라이언트는 서버에서만 사용
// 클라이언트 컴포넌트에서 import 절대 금지
export const supabaseAdmin = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

---

## Step 5. TypeScript 타입 정의

`src/types/database.ts` 생성:

```typescript
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          user_id: string;
          tier: "free" | "pro" | "team" | "enterprise";
          pages_limit: number;
          daily_queries_limit: number;
          queries_used_today: number;
          queries_reset_at: string;
          billing_period: "monthly" | "annual" | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          updated_at: string;
        };
        Insert: { user_id: string; tier?: string };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
      };
      pages: {
        Row: {
          id: string;
          user_id: string;
          notion_page_id: string;
          title: string | null;
          url: string | null;
          content_hash: string | null;
          last_edited_at: string | null;
          last_synced_at: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          notion_page_id: string;
          title?: string | null;
          url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pages"]["Row"]>;
      };
      chunks: {
        Row: {
          id: string;
          page_id: string;
          user_id: string;
          content: string;
          embedding: number[] | null;
          chunk_index: number;
          token_count: number | null;
          created_at: string;
        };
        Insert: {
          page_id: string;
          user_id: string;
          content: string;
          embedding?: number[] | null;
          chunk_index: number;
          token_count?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["chunks"]["Row"]>;
      };
      notion_connections: {
        Row: {
          id: string;
          user_id: string;
          access_token_encrypted: string;
          workspace_id: string;
          workspace_name: string | null;
          bot_id: string | null;
          connected_at: string;
        };
        Insert: {
          user_id: string;
          access_token_encrypted: string;
          workspace_id: string;
          workspace_name?: string | null;
          bot_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notion_connections"]["Row"]>;
      };
      semantic_edges: {
        Row: {
          id: string;
          user_id: string;
          source_page_id: string;
          target_page_id: string;
          similarity: number;
          computed_at: string;
        };
        Insert: {
          user_id: string;
          source_page_id: string;
          target_page_id: string;
          similarity: number;
        };
        Update: Partial<Database["public"]["Tables"]["semantic_edges"]["Row"]>;
      };
      user_context: {
        Row: {
          user_id: string;
          role: string | null;
          purpose: string | null;
          interests: string[] | null;
          onboarding_completed: boolean;
          updated_at: string;
        };
        Insert: { user_id: string };
        Update: Partial<Database["public"]["Tables"]["user_context"]["Row"]>;
      };
    };
    Functions: {
      semantic_search: {
        Args: {
          p_user_id: string;
          p_query_embedding: number[];
          p_limit?: number;
        };
        Returns: Array<{
          page_id: string;
          title: string;
          content: string;
          similarity: number;
          url: string;
        }>;
      };
      increment_query_count: {
        Args: { p_user_id: string };
        Returns: void;
      };
    };
  };
};
```

---

## Step 6. 빌드 확인 및 커밋

```bash
pnpm build
```

에러 없으면:

```bash
git add .
git commit -m "feat: add database schema, supabase clients, and types"
git push
```

---

## ✅ Phase 3 완료 조건

- [ ] Supabase에 테이블 9개 생성 확인
- [ ] RLS 정책 각 테이블에 적용됨
- [ ] HNSW 인덱스 생성됨
- [ ] `src/lib/supabase/client.ts` 생성됨
- [ ] `src/lib/supabase/server.ts` 생성됨
- [ ] `src/lib/supabase/admin.ts` 생성됨
- [ ] `src/types/database.ts` 생성됨
- [ ] `pnpm build` 에러 없음

모두 체크되면 **Phase 4**로 이동하세요.
