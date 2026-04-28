import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk";

describe("embedding/chunk", () => {
  it("returns empty array for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("filters chunks shorter than 100 chars", () => {
    expect(chunkText("짧은 글")).toEqual([]);
    expect(chunkText("hello\n\nworld")).toEqual([]);
  });

  it("returns single chunk when text fits within maxChars", () => {
    const text = "가".repeat(500);
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("splits long text into multiple chunks at paragraph boundaries", () => {
    const para = "가".repeat(800);
    const text = `${para}\n\n${para}\n\n${para}`;
    const chunks = chunkText(text, 1500, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(1500 + 200 + 1));
  });

  it("preserves overlap between consecutive chunks", () => {
    const para1 = "A".repeat(1000);
    const para2 = "B".repeat(1000);
    const chunks = chunkText(`${para1}\n\n${para2}`, 1500, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const overlap = chunks[1].slice(0, 200);
    expect(overlap).toMatch(/A+/);
  });

  it("respects custom maxChars and overlap", () => {
    const text = "X".repeat(300) + "\n\n" + "Y".repeat(300) + "\n\n" + "Z".repeat(300);
    const chunks = chunkText(text, 400, 50);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("trims whitespace-only paragraphs", () => {
    const text = "   \n\n" + "가".repeat(200) + "\n\n   ";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
  });
});
