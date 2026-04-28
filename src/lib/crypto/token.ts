import crypto from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const MIN_BLOB_LEN = IV_LEN + TAG_LEN + 1;
const V2_PREFIX = "v2:";
const HKDF_INFO = Buffer.from("synaptic-notion-token-v2");
const MASTER_KEY = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

function deriveUserKey(userId: string): Buffer {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("ERR_CRYPTO_INVALID_USER_ID");
  }
  // HKDF-SHA256: salt=userId, info=label → 32바이트 키
  const ab = crypto.hkdfSync(
    "sha256",
    MASTER_KEY,
    Buffer.from(userId, "utf8"),
    HKDF_INFO,
    32
  );
  return Buffer.from(ab);
}

function aesEncrypt(plaintext: string, key: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function aesDecrypt(buf: Buffer, key: Buffer): string {
  if (buf.length < MIN_BLOB_LEN) {
    throw new Error("ERR_CRYPTO_BLOB_TOO_SHORT");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// === v2 (per-user key) — 기본 API ===

export function encryptForUser(plaintext: string, userId: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("ERR_CRYPTO_INVALID_PLAINTEXT");
  }
  const key = deriveUserKey(userId);
  return V2_PREFIX + aesEncrypt(plaintext, key).toString("base64");
}

/**
 * 토큰 복호화. v2 접두사가 있으면 유저별 파생 키, 없으면 마스터 키(legacy v1)로 복호화.
 * v1 fallback은 마이그레이션 윈도우용. 마이그레이션 완료 후 제거 가능.
 */
export function decryptForUser(blob: string, userId: string): string {
  if (typeof blob !== "string" || blob.length === 0) {
    throw new Error("ERR_CRYPTO_INVALID_BLOB");
  }
  if (blob.startsWith(V2_PREFIX)) {
    const key = deriveUserKey(userId);
    return aesDecrypt(Buffer.from(blob.slice(V2_PREFIX.length), "base64"), key);
  }
  // legacy v1
  return aesDecrypt(Buffer.from(blob, "base64"), MASTER_KEY);
}

// === legacy v1 (single master key) — 마이그레이션 스크립트 전용 ===

/** @deprecated v1 — 신규 호출 금지. 마이그레이션 스크립트와 fallback용. */
export function encryptLegacy(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("ERR_CRYPTO_INVALID_PLAINTEXT");
  }
  return aesEncrypt(plaintext, MASTER_KEY).toString("base64");
}

/** @deprecated v1 — 신규 호출 금지. 마이그레이션 스크립트와 fallback용. */
export function decryptLegacy(blob: string): string {
  if (typeof blob !== "string" || blob.length === 0) {
    throw new Error("ERR_CRYPTO_INVALID_BLOB");
  }
  return aesDecrypt(Buffer.from(blob, "base64"), MASTER_KEY);
}

// === legacy 별칭 (기존 호출부 호환용 — 점진 제거) ===

/** @deprecated `encryptForUser(plaintext, userId)`로 교체 */
export const encrypt = encryptLegacy;
/** @deprecated `decryptForUser(blob, userId)`로 교체 */
export const decrypt = decryptLegacy;
