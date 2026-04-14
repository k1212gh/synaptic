import { createServiceClient } from "@/lib/db/server";

type ChunkRow = { id: string; embedding: number[] };
type NeighborRow = { id: string; similarity: number };

const K = 8;
const THRESHOLD = 0.78;

export async function computeEdges(userId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: chunks, error } = await supabase.rpc("user_chunks", {
    uid: userId,
  });

  if (error || !chunks) return;

  for (const chunk of chunks as ChunkRow[]) {
    const { data: neighbors } = await supabase.rpc("match_chunks", {
      query_embedding: chunk.embedding,
      user_id: userId,
      k: K,
      threshold: THRESHOLD,
    });

    if (!neighbors) continue;

    const rows = (neighbors as NeighborRow[])
      .filter((n) => n.id !== chunk.id)
      .map((n) => ({
        from_chunk_id: chunk.id,
        to_chunk_id: n.id,
        similarity: n.similarity,
      }));

    if (rows.length > 0) {
      await supabase.from("semantic_edges").upsert(rows);
    }
  }
}
