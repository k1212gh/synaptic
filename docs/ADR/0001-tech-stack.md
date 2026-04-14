# ADR 0001: 기술 스택 선택

날짜: 2026-04-14
상태: 승인됨

## 결정

Next.js 15 App Router + Supabase(pgvector) + Voyage-3 임베딩 + Anthropic Claude + Upstash Redis/QStash + Vercel 배포

## 이유

| 선택 | 대안 | 이유 |
|---|---|---|
| Voyage-3 | OpenAI text-embedding-3-small | 무료 200M 토큰, 품질 동급 이상 |
| Supabase pgvector | Pinecone | 별도 벡터 DB 없이 RLS까지 통합 |
| Upstash QStash | Vercel Cron | Serverless 타임아웃 우회, 재시도 내장 |
| Claude Haiku | GPT-4o-mini | Anthropic 생태계 통일, 비용 유사 |

## 트레이드오프

- pgvector는 수백만 벡터 이후 속도 저하 가능 → MVP 범위에서는 충분
- Voyage AI 유료 전환 시 비용 재검토 필요
