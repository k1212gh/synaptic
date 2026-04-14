-- 유사 청크 검색 (벡터 검색)
create or replace function match_chunks(
  query_embedding vector,
  user_id uuid,
  k int,
  threshold float
) returns table(id uuid, chunk_text text, similarity float)
language sql stable as $$
  select c.id, c.chunk_text, 1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join pages p on p.id = c.page_id
  where p.user_id = match_chunks.user_id
    and 1 - (c.embedding <=> query_embedding) > threshold
  order by c.embedding <=> query_embedding
  limit k;
$$;

-- 특정 유저의 모든 청크 조회 (엣지 계산용)
create or replace function user_chunks(uid uuid)
returns table(id uuid, embedding vector)
language sql stable as $$
  select c.id, c.embedding
  from chunks c
  join pages p on p.id = c.page_id
  where p.user_id = uid;
$$;
