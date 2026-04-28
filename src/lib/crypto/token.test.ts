import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY ??= crypto.randomBytes(32).toString("hex");
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  process.env.NOTION_CLIENT_ID ??= "test-notion-client-id";
  process.env.NOTION_CLIENT_SECRET ??= "test-notion-client-secret";
  process.env.ANTHROPIC_API_KEY ??= "sk-ant-test";
  process.env.VOYAGE_API_KEY ??= "test-voyage-key";
  process.env.UPSTASH_REDIS_REST_URL ??= "https://test.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN ??= "test-upstash-token";
  process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
});

describe("crypto/token v1 (legacy)", () => {
  it("encrypt/decrypt roundtrip preserves the plaintext", async () => {
    const { encryptLegacy, decryptLegacy } = await import("./token");
    const plaintext = "secret_notion_token_abc123";
    const blob = encryptLegacy(plaintext);
    expect(decryptLegacy(blob)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", async () => {
    const { encryptLegacy } = await import("./token");
    const a = encryptLegacy("same-input");
    const b = encryptLegacy("same-input");
    expect(a).not.toBe(b);
  });

  it("handles unicode and long strings", async () => {
    const { encryptLegacy, decryptLegacy } = await import("./token");
    const long = "한글 토큰 " + "x".repeat(2000) + " 🚀";
    expect(decryptLegacy(encryptLegacy(long))).toBe(long);
  });

  it("throws on tampered ciphertext (AES-GCM auth tag check)", async () => {
    const { encryptLegacy, decryptLegacy } = await import("./token");
    const blob = encryptLegacy("hello");
    const buf = Buffer.from(blob, "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptLegacy(buf.toString("base64"))).toThrow();
  });

  it("rejects empty / non-string input on encrypt", async () => {
    const { encryptLegacy } = await import("./token");
    expect(() => encryptLegacy("")).toThrow("ERR_CRYPTO_INVALID_PLAINTEXT");
    expect(() => encryptLegacy(null as unknown as string)).toThrow();
  });

  it("rejects empty / non-string input on decrypt", async () => {
    const { decryptLegacy } = await import("./token");
    expect(() => decryptLegacy("")).toThrow("ERR_CRYPTO_INVALID_BLOB");
    expect(() => decryptLegacy(null as unknown as string)).toThrow();
  });

  it("rejects too-short blob (< IV + tag + 1)", async () => {
    const { decryptLegacy } = await import("./token");
    const tooShort = Buffer.alloc(20).toString("base64");
    expect(() => decryptLegacy(tooShort)).toThrow("ERR_CRYPTO_BLOB_TOO_SHORT");
  });
});

describe("crypto/token v2 (per-user)", () => {
  const USER_A = "11111111-1111-1111-1111-111111111111";
  const USER_B = "22222222-2222-2222-2222-222222222222";

  it("v2 encrypt/decrypt roundtrip with same userId", async () => {
    const { encryptForUser, decryptForUser } = await import("./token");
    const plaintext = "secret_token";
    const blob = encryptForUser(plaintext, USER_A);
    expect(blob.startsWith("v2:")).toBe(true);
    expect(decryptForUser(blob, USER_A)).toBe(plaintext);
  });

  it("v2 fails when decrypted with wrong userId (key isolation)", async () => {
    const { encryptForUser, decryptForUser } = await import("./token");
    const blob = encryptForUser("secret", USER_A);
    expect(() => decryptForUser(blob, USER_B)).toThrow();
  });

  it("v2 produces different ciphertext per user even for same plaintext", async () => {
    const { encryptForUser } = await import("./token");
    const a = encryptForUser("same-input", USER_A);
    const b = encryptForUser("same-input", USER_B);
    expect(a).not.toBe(b);
  });

  it("decryptForUser falls back to v1 when blob has no v2 prefix", async () => {
    const { encryptLegacy, decryptForUser } = await import("./token");
    const v1blob = encryptLegacy("legacy_token");
    expect(decryptForUser(v1blob, USER_A)).toBe("legacy_token");
  });

  it("rejects empty userId", async () => {
    const { encryptForUser } = await import("./token");
    expect(() => encryptForUser("x", "")).toThrow("ERR_CRYPTO_INVALID_USER_ID");
  });

  it("v2 detects tampered ciphertext", async () => {
    const { encryptForUser, decryptForUser } = await import("./token");
    const blob = encryptForUser("secret", USER_A);
    const raw = blob.slice("v2:".length);
    const buf = Buffer.from(raw, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = "v2:" + buf.toString("base64");
    expect(() => decryptForUser(tampered, USER_A)).toThrow();
  });
});
