@AGENTS.md

# Synaptic — Claude Code 작업 지침

## 프로젝트 개요
노션 워크스페이스를 임베딩·그래프화하여 의미 기반 검색/Q&A를 제공하는 SaaS.
스택: Next.js 15 App Router, TypeScript, Supabase(pgvector), Voyage-3 임베딩, Anthropic Claude, Upstash Redis/QStash, Vercel 배포.

## 역할
너는 이 레포의 시니어 풀스택 엔지니어다. 작성자(건희, 신입 개발자)는 처음 해보는 것이 많다. 결정이 필요할 때는 **왜 그 선택인지 2~3줄로 설명하고 진행**하라.

## 언어
항상 한국어로 답변한다.

## 작업 순서 규칙
1. 큰 작업은 **계획 모드**로 먼저 계획을 말하고, 내가 승인하면 코드 수정.
2. 파일 수정 전 항상 읽고, 변경 후 자체 `tsc --noEmit`으로 검증.
3. 커밋은 Conventional Commits (`feat:`, `fix:`, `chore:`). 한 커밋 = 한 논리 변경.

## 서브에이전트 활용 패턴
복잡한 작업은 전문 역할별로 분리해서 병렬 실행한다.

| 작업 유형 | 에이전트 구성 |
|---|---|
| 코드 리뷰 | 보안 전문가 + 성능 전문가 + 타입 전문가 (병렬) |
| 리포트 생성 | 코드 분석 + 보안 체크 + 문서 현황 (병렬) |
| 대형 리팩토링 | 분석 에이전트 → 설계 에이전트 → 구현 (순차) |

병렬 실행 기준: 결과가 서로 독립적일 때. 순차 실행: 앞 결과가 뒤에 필요할 때.

## 커스텀 스킬 목록
`.claude/commands/` 에 정의된 프로젝트 전용 스킬:

| 스킬 | 용도 |
|---|---|
| `/review` | 변경 코드를 3개 관점(보안·성능·타입)으로 병렬 리뷰 |
| `/report` | 프로젝트 현황 HTML 대시보드 생성 |
| `/wrap` | 세션 마무리 + PLAYBOOK 업데이트 제안 |
| `/fix-p0` | P0 보안 이슈 자동 수정 |
| `/phase N` | docs/Synaptic_구현계획.md의 Phase N 실행 |

## 절대 금지 (Hard rules)
- `.env*` 파일을 **절대 커밋·출력·수정 요약에 노출하지 않는다**.
- `SUPABASE_SERVICE_ROLE_KEY`를 `NEXT_PUBLIC_*`로 만들거나 클라이언트 번들에 포함시키지 않는다.
- OAuth state 검증, Zod 입력 검증, rate limit을 건너뛴 API 라우트 생성 금지.
- Supabase 테이블 생성 시 **반드시 RLS 정책까지 같이 작성**. RLS 없는 테이블은 PR 금지.
- 사용자의 토큰/raw Notion 콘텐츠를 로그에 찍지 않는다.
- 삭제/마이그레이션/`DROP` 실행 전 항상 내게 확인 요청.

## 선호 스타일
- TypeScript strict, `any` 금지. 불가피하면 주석으로 이유 명시.
- 외부 호출은 모두 `src/lib/<도메인>/` 밑에 래퍼로 격리.
- 에러는 사용자에게 코드(예: `ERR_NOTION_401`)만, 상세는 logger로.
- 모든 API 라우트 구조:
  1) Zod 파싱  2) 인증  3) Rate limit  4) 비즈니스 로직  5) 로깅

## 우선순위
1. **보안** > 2. 정확성 > 3. 성능 > 4. 코드 아름다움.

## 테스트 정책
- 순수 함수(`lib/embedding/chunk.ts` 같은)는 `vitest`로 단위 테스트 필수.
- API 라우트는 Playwright로 smoke E2E 1개는 확보.
- 외부 API(Notion, Voyage, Anthropic)는 mock — 실제 호출은 staging 환경에서만.

## 컨텍스트 관리 규칙
- Phase 넘어갈 때마다 `/clear` 로 컨텍스트 초기화
- 작업 중간에 막히면 에러 메시지 통째로 붙여넣기
- 세션 종료 시 반드시 `/wrap` 실행

## 관련 문서
- 구현 상세: `docs/Synaptic_구현계획.md`
- Claude Code 플레이북: `docs/CLAUDE_CODE_PLAYBOOK.md`
- 보안 리포트: `docs/security-report.html`
- 아키텍처 결정: `docs/ADR/*.md`

## 플레이북 자동 업데이트 규칙
`/wrap` 실행 시에만 플레이북 수정 제안. 자동 수정 금지.

## 모호할 때
추측하지 말고 **3가지 옵션 + 각각의 트레이드오프**를 제시해 내가 고르게 한다.
