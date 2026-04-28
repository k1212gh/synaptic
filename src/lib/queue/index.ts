import { env } from "@/lib/env";
import { processPage } from "@/lib/sync/processPage";

export interface SyncJob {
  pageId: string;
  userId: string;
  title?: string | null;
  url?: string | null;
}

interface QueueDriver {
  enqueue(jobs: SyncJob[]): Promise<{ queued: number; total: number }>;
}

// 동시 처리 한도. Notion 3 req/s + Voyage rate limit 고려해 보수적으로.
const DIRECT_CONCURRENCY = Number(process.env.SYNC_CONCURRENCY ?? "4");

// 풀 워커: jobs를 순차 소비하는 worker를 N개 띄움.
async function runWithConcurrency<T>(
  jobs: T[],
  worker: (job: T) => Promise<unknown>,
  limit: number
): Promise<void> {
  let cursor = 0;
  const next = async (): Promise<void> => {
    const idx = cursor++;
    if (idx >= jobs.length) return;
    try {
      await worker(jobs[idx]);
    } catch {
      // 개별 실패는 삼키고 다음 작업으로
    }
    return next();
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, next));
}

// ── Direct 드라이버 (로컬/VPS) ──────────────────────────────────────────────
// 큐 없이 백그라운드에서 처리. 동시성 제한으로 외부 API rate limit 보호.
const directDriver: QueueDriver = {
  async enqueue(jobs) {
    // 응답은 즉시 반환하고 처리는 백그라운드에서 (fire-and-forget)
    void runWithConcurrency(
      jobs,
      (j) => processPage(j.pageId, j.userId, { title: j.title, url: j.url }),
      DIRECT_CONCURRENCY
    );
    return { queued: jobs.length, total: jobs.length };
  },
};

// ── QStash 드라이버 (Vercel managed) ──────────────────────────────────────
async function createQStashDriver(): Promise<QueueDriver> {
  const { Client } = await import("@upstash/qstash");

  if (!env.QSTASH_TOKEN) {
    throw new Error(
      "QUEUE_DRIVER=qstash 이지만 QSTASH_TOKEN 이 없습니다."
    );
  }

  const qstash = new Client({ token: env.QSTASH_TOKEN });

  return {
    async enqueue(jobs) {
      const results = await Promise.allSettled(
        jobs.map((job) =>
          qstash.publishJSON({
            url: `${env.NEXT_PUBLIC_APP_URL}/api/sync/worker`,
            body: job,
            retries: 3,
          })
        )
      );
      const queued = results.filter((r) => r.status === "fulfilled").length;
      return { queued, total: jobs.length };
    },
  };
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────
let _qstashDriver: QueueDriver | null = null;

export async function enqueueSync(
  jobs: SyncJob[]
): Promise<{ queued: number; total: number }> {
  if (env.QUEUE_DRIVER === "qstash") {
    if (!_qstashDriver) _qstashDriver = await createQStashDriver();
    return _qstashDriver.enqueue(jobs);
  }
  return directDriver.enqueue(jobs);
}
