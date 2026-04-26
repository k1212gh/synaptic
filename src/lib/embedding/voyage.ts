import { env } from "@/lib/env";
import { logInfo, logError, startTimer } from "@/lib/logger";

const BATCH_SIZE = 128;
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

type VoyageResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
};

export async function embed(texts: string[]): Promise<number[][]> {
  const elapsed = startTimer();
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
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
        throw new Error(`Voyage API ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as VoyageResponse;
      all.push(...json.data.map((d) => d.embedding));
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
