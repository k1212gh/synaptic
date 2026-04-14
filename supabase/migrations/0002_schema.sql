-- 확장 활성화
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- 사용자
create table users (
  id uuid primary key,                                  -- Supabase auth.users.id와 동일
  email text unique not null,
  notion_workspace_id text,
  notion_access_token_encrypted text,                   -- AES-256-GCM 암호화된 토큰
  notion_bot_id text,
  plan text not null default 'free',                    -- free / pro
  created_at timestamptz default now()
);

-- 동기화된 Notion 페이지
create table pages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  notion_page_id text not null,
  title text,
  url text,
  content_hash text,                                    -- 변경 감지용
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
  embedding vector(1024) not null,                      -- Voyage-3: 1024 dim
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
  feedback int,                                         -- -1, 0, 1
  latency_ms int,
  created_at timestamptz default now()
);
