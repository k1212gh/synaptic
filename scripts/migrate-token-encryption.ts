/**
 * v1 → v2 토큰 암호화 마이그레이션.
 *
 * 사용:
 *   pnpm dlx tsx scripts/migrate-token-encryption.ts          # dry-run (기본)
 *   pnpm dlx tsx scripts/migrate-token-encryption.ts --apply  # 실제 적용
 *
 * 동작:
 *   1) users 테이블에서 notion_access_token_encrypted 가 있는 모든 row 조회
 *   2) v2: 접두사가 이미 있으면 skip
 *   3) v1 토큰을 마스터 키로 decrypt → 유저별 키로 re-encrypt → DB 업데이트
 *   4) 결과 카운트 출력
 *
 * 안전장치:
 *   - 기본은 dry-run. --apply 명시 시에만 DB 수정
 *   - 한 row 실패해도 나머지는 계속 처리
 *   - 모든 변환은 트랜잭션 없이 row-by-row (일관성보다 안전성 우선)
 */

import { config as loadEnv } from "dotenv";

// 1) 먼저 env 로드 — env.ts (Zod 검증)이 import되기 전에 process.env 채워야 함
loadEnv({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

type Row = { id: string; notion_access_token_encrypted: string | null };

async function main() {
  // 2) env 채워진 뒤에 동적 import (env.ts 검증 통과)
  const { createClient } = await import("@supabase/supabase-js");
  const { decryptLegacy, encryptForUser } = await import("../src/lib/crypto/token");

  console.log(`[migrate] mode = ${APPLY ? "APPLY (will modify DB)" : "DRY RUN"}`);

  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("users")
    .select("id, notion_access_token_encrypted")
    .not("notion_access_token_encrypted", "is", null);

  if (error) throw error;
  const rows = (data ?? []) as Row[];
  console.log(`[migrate] candidate rows: ${rows.length}`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const blob = row.notion_access_token_encrypted;
    if (!blob) {
      skipped++;
      continue;
    }
    if (blob.startsWith("v2:")) {
      skipped++;
      console.log(`  - ${row.id}: already v2, skip`);
      continue;
    }

    try {
      const plaintext = decryptLegacy(blob);
      const newBlob = encryptForUser(plaintext, row.id);

      if (APPLY) {
        const { error: updErr } = await supabase
          .from("users")
          .update({ notion_access_token_encrypted: newBlob })
          .eq("id", row.id);
        if (updErr) throw updErr;
        console.log(`  ✓ ${row.id}: migrated`);
      } else {
        console.log(`  ✓ ${row.id}: would migrate (dry-run)`);
      }
      migrated++;
    } catch (err) {
      failed++;
      console.error(
        `  ✗ ${row.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `\n[migrate] ${APPLY ? "applied" : "would apply"}: ${migrated}, skipped: ${skipped}, failed: ${failed}`
  );
  if (!APPLY && migrated > 0) {
    console.log(`\n다시 --apply 플래그로 실행하면 실제 적용됩니다:`);
    console.log(`  pnpm migrate:tokens:apply`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
