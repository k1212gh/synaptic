/**
 * 텍스트를 의미 단위 청크로 분할.
 * 규칙: 1500자/청크 + 200자 오버랩, 문단 단위 분할, 100자 미만 청크 제거.
 */
export function chunkText(
  text: string,
  maxChars = 1500,
  overlap = 200
): string[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const chunks: string[] = [];
  let buf = "";

  for (const p of paragraphs) {
    if ((buf + p).length > maxChars && buf) {
      chunks.push(buf);
      buf = buf.slice(-overlap) + "\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf);

  return chunks.filter((c) => c.trim().length >= 100);
}
