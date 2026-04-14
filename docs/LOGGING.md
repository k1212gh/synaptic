# Synaptic 로깅 시스템

## 개요

구조화 로거(`src/lib/logger.ts`)를 통해 모든 중요 이벤트를 두 채널로 기록합니다.

| 채널 | 대상 | 용도 |
|---|---|---|
| stdout (JSON) | Vercel 로그 / VPS pm2 | 실시간 스트림 관찰 |
| Supabase `app_logs` | DB 영구 보존 | 운영 감사, 보안 이슈 추적 |

---

## 로그 레벨

| 레벨 | 사용 시점 |
|---|---|
| `debug` | 개발 디버깅 (프로덕션 DB 미저장) |
| `info` | 정상 동작 완료 (인증, 동기화, 쿼리 완료 등) |
| `warn` | 이상 감지 (rate limit, CSRF 실패 등) |
| `error` | 외부 API / DB 오류 |
| `fatal` | 서버 기동 불가 수준의 오류 |

DB에 저장되는 조건: `warn` 이상 **또는** `auth`/`security` 카테고리

---

## 카테고리

| 카테고리 | 적용 파일 |
|---|---|
| `auth` | `/api/auth/notion/*` |
| `sync` | `/api/sync/*`, `lib/sync/processPage.ts` |
| `query` | `/api/query` |
| `api` | `lib/notion/fetcher.ts`, `lib/embedding/voyage.ts` |
| `security` | CSRF 실패, 무단 접근 |
| `system` | 서버 기동, env 검증 |

---

## 이벤트 목록

### auth
| 이벤트 | 레벨 | 발생 시점 |
|---|---|---|
| `notion_oauth_start` | info | OAuth 시작 시 |
| `notion_oauth_complete` | info | OAuth 성공 + DB 저장 완료 |
| `notion_token_exchange_fail` | error | Notion 토큰 교환 실패 |
| `notion_token_db_upsert_fail` | error | 사용자 DB upsert 실패 |
| `notion_disconnect` | info | Notion 연결 해제 |

### security
| 이벤트 | 레벨 | 발생 시점 |
|---|---|---|
| `notion_oauth_csrf_fail` | warn | CSRF state 불일치 |

### sync
| 이벤트 | 레벨 | 발생 시점 |
|---|---|---|
| `sync_enqueued` | info | 동기화 잡 큐에 등록 |
| `sync_rate_limit` | warn | syncLimiter 초과 |
| `sync_page_complete` | info | 페이지 동기화 성공 |
| `sync_page_skipped` | info | 콘텐츠 변경 없어 스킵 |
| `sync_page_no_chunks` | info | 추출 텍스트 없음 |
| `sync_page_fail` | error | processPage 에러 반환 |
| `sync_page_upsert_fail` | error | pages 테이블 upsert 실패 |
| `sync_chunk_insert_fail` | error | chunks 테이블 insert 실패 |

### query
| 이벤트 | 레벨 | 발생 시점 |
|---|---|---|
| `query_complete` | info | Q&A 응답 완료 (latency 포함) |
| `query_rate_limit` | warn | queryLimiter 초과 |

### api
| 이벤트 | 레벨 | 발생 시점 |
|---|---|---|
| `notion_list_pages` | info | listAllPages 완료 |
| `notion_get_page_text` | info | getPageText 완료 |
| `notion_get_page_text_fail` | error | getPageText 중 Notion API 오류 |
| `voyage_embed_complete` | info | embed() 완료 |
| `voyage_embed_fail` | error | Voyage API 오류 |

---

## 사용 예시

```typescript
import { logInfo, logWarn, logError, startTimer } from "@/lib/logger";

// 기본 사용
await logInfo("auth", "notion_oauth_complete", { userId: user.id });
await logWarn("security", "notion_oauth_csrf_fail", { hasCode: true });
await logError("sync", "sync_page_fail", error, { userId, pageId });

// 타이머
const elapsed = startTimer();
// ... 처리 ...
await logInfo("api", "voyage_embed_complete", {
  textCount: 50,
  durationMs: elapsed(),
});
```

---

## 보안 원칙

- 토큰, 암호화된 값, 이메일 원문, 사용자 콘텐츠 **절대 금지**
- `userId`는 UUID만 (PII 아님)
- `data` 필드에 들어가는 값: 카운트, 상태 코드, 소요 시간, boolean 등

---

## Supabase 쿼리 예시

```sql
-- 최근 인증 오류 확인
SELECT * FROM app_logs
WHERE category = 'auth' AND level = 'error'
ORDER BY created_at DESC LIMIT 20;

-- 특정 사용자의 동기화 이력
SELECT * FROM app_logs
WHERE user_id = '<uuid>' AND category = 'sync'
ORDER BY created_at DESC;

-- CSRF 공격 탐지 (1시간 내)
SELECT COUNT(*), data->>'hasCode' as has_code
FROM app_logs
WHERE event = 'notion_oauth_csrf_fail'
  AND created_at > now() - interval '1 hour'
GROUP BY data->>'hasCode';
```

---

## DB 스키마

`supabase/migrations/0004_app_logs.sql` 참고.

- RLS: service role만 쓰기, 본인 로그만 읽기
- 인덱스: `user_id`, `level`, `category`, `event` (각각 `created_at DESC` 복합)
- 90일 auto-purge: `pg_cron` 설치 시 주석 해제
