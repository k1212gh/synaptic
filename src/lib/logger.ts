/**
 * Synaptic 구조화 로거
 *
 * 2가지 채널로 출력:
 *   1. stdout (JSON) — Vercel 로그 / VPS pm2 로그에 자동 수집
 *   2. Supabase app_logs 테이블 — 중요 이벤트 영구 보존 (선택적)
 *
 * 민감 정보 절대 금지: 토큰, 암호화된 값, 이메일 원문, 사용자 콘텐츠
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogCategory =
  | "auth"      // 로그인, OAuth, 연결 해제
  | "sync"      // 노션 동기화
  | "query"     // Q&A 질의
  | "api"       // 외부 API 호출 (Notion, Voyage, Claude)
  | "security"  // CSRF 실패, 무단 접근, rate limit
  | "system";   // 서버 기동, 환경변수 검증

export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  event: string;
  userId?: string;          // 식별용 — PII 아닌 UUID만
  durationMs?: number;      // 처리 시간
  data?: Record<string, unknown>; // 컨텍스트 (민감정보 제외)
  error?: string;           // 에러 메시지 (스택 제외 — Sentry로)
}

// DB 저장 여부 결정: 중요 이벤트만 app_logs에 저장
const DB_PERSIST_LEVELS: LogLevel[] = ["warn", "error", "fatal"];
const DB_PERSIST_CATEGORIES: LogCategory[] = ["auth", "security"];

function shouldPersistToDB(entry: LogEntry): boolean {
  return (
    DB_PERSIST_LEVELS.includes(entry.level) ||
    DB_PERSIST_CATEGORIES.includes(entry.category)
  );
}

// stdout JSON 출력
function writeStdout(entry: LogEntry): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  if (entry.level === "error" || entry.level === "fatal") {
    console.error(line);
  } else {
    console.log(line);
  }
}

// Supabase app_logs 저장 (비동기, 실패해도 앱 동작 무관)
async function persistToDB(entry: LogEntry): Promise<void> {
  try {
    // createServiceClient는 server-only — 동적 import로 클라이언트 번들 제외
    const { createServiceClient } = await import("@/lib/db/server");
    const supabase = createServiceClient();
    await supabase.from("app_logs").insert({
      level: entry.level,
      category: entry.category,
      event: entry.event,
      user_id: entry.userId ?? null,
      data: entry.data ?? {},
      error_message: entry.error ?? null,
      duration_ms: entry.durationMs ?? null,
    });
  } catch {
    // 로그 저장 실패는 조용히 무시 (로깅이 앱을 망가뜨리면 안 됨)
  }
}

// 핵심 log 함수
export async function log(entry: LogEntry): Promise<void> {
  writeStdout(entry);
  if (shouldPersistToDB(entry)) {
    await persistToDB(entry);
  }
}

// ── 편의 함수 ────────────────────────────────────────────────────────────────

export function logInfo(
  category: LogCategory,
  event: string,
  data?: LogEntry["data"] & { userId?: string }
) {
  const { userId, ...rest } = data ?? {};
  return log({ level: "info", category, event, userId, data: rest });
}

export function logWarn(
  category: LogCategory,
  event: string,
  data?: LogEntry["data"] & { userId?: string }
) {
  const { userId, ...rest } = data ?? {};
  return log({ level: "warn", category, event, userId, data: rest });
}

export function logError(
  category: LogCategory,
  event: string,
  error: unknown,
  data?: LogEntry["data"] & { userId?: string }
) {
  const { userId, ...rest } = data ?? {};
  const errorMessage =
    error instanceof Error ? error.message : String(error);
  return log({ level: "error", category, event, userId, data: rest, error: errorMessage });
}

// API 호출 타이머 헬퍼
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
