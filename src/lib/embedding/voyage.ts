import { env } from "@/lib/env";
import { logInfo, logWarn, logError, startTimer } from "@/lib/logger";

const BATCH_SIZE = 128;
const MAX_RETRIES = 4;
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

type VoyageResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
};

class VoyageError extends Error {
  constructor(
    public status: number,
    public bodyText: string,
    public retryAfter?: number
  ) {
    super(`Voyage API ${status}: ${bodyText.slice(0, 200)}`);
  }
  get isRetryable(): boolean {
    return this.status === 429 || (this.status >= 500 && this.status < 600);
  }
}

async function embedBatch(batch: string[]): Promise<number[][]> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(VOYAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
        },
        body: JSON.stringify({ input: batch, model: "voyage-3" }),
      });
      if (!res.ok) {
        const retryAfter = Number(res.headers.get("retry-after"));
        throw new VoyageError(
          res.status,
          await res.text(),
          Number.isFinite(retryAfter) ? retryAfter : undefined
        );
      }
      const json = (await res.json()) as VoyageResponse;
      return json.data.map((d) => d.embedding);
    } catch (err) {
      const retryable =
        err instanceof VoyageError ? err.isRetryable : err instanceof TypeError;
      if (!retryable || attempt >= MAX_RETRIES) throw err;

      const backoffMs =
        err instanceof VoyageError && err.retryAfter
          ? Math.max(err.retryAfter * 1000, 500)
          : Math.min(2 ** attempt * 500, 8_000);
      await logWarn("api", "voyage_embed_retry", {
        attempt,
        backoffMs,
        batchSize: batch.length,
        status: err instanceof VoyageError ? err.status : "network",
      });
      await new Promise((r) => setTimeout(r, backoffMs));
      attempt += 1;
    }
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const elapsed = startTimer();
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    try {
      const vectors = await embedBatch(batch);
      all.push(...vectors);
    } catch (err) {
      await logError("api", "voyage_embed_fail", err, {
        batchIndex: i,
        batchSize: batch.length,
      });
      throw err;
    }
  }

  await logInfo("api", "voyage_embed_complete", {
    textCount: texts.length,
    durationMs: elapsed(),
  });

  return all;
}
