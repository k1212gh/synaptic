import { VoyageAIClient } from "voyageai";
import { env } from "@/lib/env";
import { logInfo, logError, startTimer } from "@/lib/logger";

const client = new VoyageAIClient({ apiKey: env.VOYAGE_API_KEY });

const BATCH_SIZE = 128;

export async function embed(texts: string[]): Promise<number[][]> {
  const elapsed = startTimer();
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    try {
      const res = await client.embed({ input: batch, model: "voyage-3" });
      all.push(...(res.data ?? []).map((d) => d.embedding!));
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
