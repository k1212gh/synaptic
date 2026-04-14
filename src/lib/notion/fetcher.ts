import { Client, isFullPage, isFullBlock } from "@notionhq/client";
import type {
  PageObjectResponse,
  BlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { decrypt } from "@/lib/crypto/token";
import { logInfo, logError, startTimer } from "@/lib/logger";

export function getNotionClient(encryptedToken: string): Client {
  return new Client({ auth: decrypt(encryptedToken) });
}

export async function listAllPages(
  client: Client
): Promise<PageObjectResponse[]> {
  const elapsed = startTimer();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const res = await client.search({
      filter: { property: "object", value: "page" },
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...res.results.filter(isFullPage));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    // Notion API rate limit: 3 req/sec
    await new Promise((r) => setTimeout(r, 350));
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
      const res = await client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });
      blocks.push(...res.results.filter(isFullBlock));
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
      await new Promise((r) => setTimeout(r, 350));
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
