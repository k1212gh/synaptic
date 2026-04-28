import {
  Client,
  isFullPage,
  isFullBlock,
  APIErrorCode,
  APIResponseError,
} from "@notionhq/client";
import type {
  PageObjectResponse,
  BlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { decryptForUser } from "@/lib/crypto/token";
import { logInfo, logWarn, logError, startTimer } from "@/lib/logger";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 350;

function readRetryAfter(err: unknown): number {
  if (!APIResponseError.isAPIResponseError(err)) return NaN;
  const headers = err.headers as
    | { get?: (k: string) => string | null }
    | Record<string, string>
    | null
    | undefined;
  if (!headers) return NaN;
  const raw =
    typeof (headers as { get?: unknown }).get === "function"
      ? (headers as { get: (k: string) => string | null }).get("retry-after")
      : (headers as Record<string, string>)["retry-after"];
  return raw ? Number(raw) : NaN;
}

export function getNotionClient(encryptedToken: string, userId: string): Client {
  return new Client({ auth: decryptForUser(encryptedToken, userId) });
}

// Notion 429/일시 오류 대응: Retry-After 헤더 우선, 없으면 지수 백오프
async function withNotionRetry<T>(
  fn: () => Promise<T>,
  context: Record<string, unknown> = {}
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit =
        APIResponseError.isAPIResponseError(err) &&
        err.code === APIErrorCode.RateLimited;
      const isTransient =
        APIResponseError.isAPIResponseError(err) &&
        (err.status === 502 || err.status === 503 || err.status === 504);

      if (!isRateLimit && !isTransient) throw err;
      if (attempt >= MAX_RETRIES) {
        await logError("api", "notion_retry_exhausted", err, {
          ...context,
          attempt,
        });
        throw err;
      }

      const retryAfterSec = readRetryAfter(err);
      const backoffMs = Number.isFinite(retryAfterSec)
        ? Math.max(retryAfterSec * 1000, 500)
        : Math.min(2 ** attempt * 500, 10_000);

      await logWarn("api", "notion_rate_limit_retry", {
        ...context,
        attempt,
        backoffMs,
        rateLimit: isRateLimit,
      });
      await new Promise((r) => setTimeout(r, backoffMs));
      attempt += 1;
    }
  }
}

export async function listAllPages(
  client: Client
): Promise<PageObjectResponse[]> {
  const elapsed = startTimer();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const res = await withNotionRetry(
      () =>
        client.search({
          filter: { property: "object", value: "page" },
          start_cursor: cursor,
          page_size: 100,
        }),
      { op: "search_pages", cursor }
    );
    pages.push(...res.results.filter(isFullPage));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    await new Promise((r) => setTimeout(r, BASE_DELAY_MS));
  } while (cursor);

  await logInfo("api", "notion_list_pages", {
    pageCount: pages.length,
    durationMs: elapsed(),
  });

  return pages;
}

export async function getPageText(
  client: Client,
  pageId: string
): Promise<string> {
  const elapsed = startTimer();
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  try {
    do {
      const res = await withNotionRetry(
        () =>
          client.blocks.children.list({
            block_id: pageId,
            start_cursor: cursor,
            page_size: 100,
          }),
        { op: "list_blocks", pageId, cursor }
      );
      blocks.push(...res.results.filter(isFullBlock));
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS));
    } while (cursor);
  } catch (err) {
    await logError("api", "notion_get_page_text_fail", err, { pageId });
    return "";
  }

  await logInfo("api", "notion_get_page_text", {
    pageId,
    blockCount: blocks.length,
    durationMs: elapsed(),
  });

  return blocks.map(extractText).filter(Boolean).join("\n");
}

function extractText(block: BlockObjectResponse): string {
  // BlockObjectResponse는 block.type별 union. 인덱스 접근으로 rich_text 추출.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = block as any;
  const rich: { plain_text: string }[] | undefined = b[block.type]?.rich_text;
  if (!Array.isArray(rich)) return "";
  return rich.map((r) => r.plain_text).join("");
}
