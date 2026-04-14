-- app_logs: 서비스 운영 로그 테이블
-- 중요 이벤트(인증, 보안, 에러)를 DB에 영구 보존해 운영 관측에 활용

create table app_logs (
  id          uuid primary key default uuid_generate_v4(),
  level       text not null check (level in ('debug','info','warn','error','fatal')),
  category    text not null check (category in ('auth','sync','query','api','security','system')),
  event       text not null,
  user_id     uuid references users(id) on delete set null,
  data        jsonb not null default '{}',
  error_message text,
  duration_ms int,
  created_at  timestamptz not null default now()
);

-- 운영 쿼리용 인덱스
create index app_logs_user_idx      on app_logs(user_id, created_at desc);
create index app_logs_level_idx     on app_logs(level, created_at desc);
create index app_logs_category_idx  on app_logs(category, created_at desc);
create index app_logs_event_idx     on app_logs(event, created_at desc);

-- RLS: service role만 쓰기, 본인 로그만 읽기
alter table app_logs enable row level security;

create policy "app_logs_self_read" on app_logs
  for select using (auth.uid() = user_id);

-- 90일 이상 된 로그 자동 삭제 (pg_cron 사용 시)
-- SELECT cron.schedule('delete-old-logs', '0 3 * * *',
--   $$DELETE FROM app_logs WHERE created_at < now() - interval '90 days'$$);
