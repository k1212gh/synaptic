-- RLS 활성화 (모든 테이블)
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

create policy "query_logs_self_read" on query_logs
  for select using (auth.uid() = user_id);

-- semantic_edges는 청크 소유자만 읽기
create policy "semantic_edges_self_read" on semantic_edges
  for select using (
    exists (
      select 1 from chunks c join pages p on p.id = c.page_id
      where c.id = semantic_edges.from_chunk_id and p.user_id = auth.uid()
    )
  );
