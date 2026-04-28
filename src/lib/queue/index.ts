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

// ── Direct 드라이버 (로컬/VPS) ──────────────────────────────────────────────
// 큐 없이 백그라운드에서 바로 처리. fire-and-forget.
const directDriver: QueueDriver = {
  async enqueue(jobs) {
    // 응답은 즉시 반환하고 처리는 백그라운드에서
    Promise.allSettled(
      jobs.map((j) =>
        processPage(j.pageId, j.userId, { title: j.title, url: j.url })
      )
    ).catch(() => {});
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
