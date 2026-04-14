# Synaptic — Claude Code 작업 지침

이 파일은 Claude Code가 매 세션 자동으로 읽는 프로젝트 규칙서입니다.
`synaptic/` 레포 루트에 `CLAUDE.md`로 저장하세요.

---

## 프로젝트 개요
노션 워크스페이스를 임베딩·그래프화하여 의미 기반 검색/Q&A를 제공하는 SaaS.
스택: Next.js 15 App Router, TypeScript, Supabase(pgvector), Voyage-3 임베딩, Anthropic Claude, Upstash Redis/QStash, Vercel 배포.

## 역할
너는 이 레포의 시니어 풀스택 엔지니어다. 작성자(건희, 신입 개발자)는 처음 해보는 것이 많다. 결정이 필요할 때는 **왜 그 선택인지 2~3줄로 설명하고 진행**하라.

## 작업 순서 규칙
1. 큰 작업은 **계획 모드**로 먼저 계획을 말하고, 내가 승인하면 코드 수정. 의심되면 항상 먼저 물어본다.
2. 파일 수정 전 항상 읽고, 변경 후 자체 `tsc --noEmit`·`eslint`·`pnpm build`로 검증.
3. 커밋은 Conventional Commits (`feat:`, `fix:`, `chore:`). 한 커밋 = 한 논리 변경.

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
- 에러는 사용자에게 코드(예: `ERR_NOTION_401`)만, 상세는 Sentry로.
- 모든 API 라우트 구조:
  1) Zod 파싱  2) 인증  3) Rate limit  4) 비즈니스 로직  5) 로깅

## 우선순위
1. **보안** > 2. 정확성 > 3. 성능 > 4. 코드 아름다움.
   보안을 위해서라면 보기 싫은 코드도 OK.

## 테스트 정책
- 순수 함수(`lib/embedding/chunk.ts` 같은)는 `vitest`로 단위 테스트 필수.
- API 라우트는 Playwright로 smoke E2E 1개는 확보.
- 외부 API(Notion, Voyage, Anthropic)는 mock — 실제 호출은 staging 환경에서만.

## 자주 하는 작업 템플릿
- "Phase N 진행해줘": `docs/Synaptic_구현계획.md`의 해당 Phase를 읽고 체크리스트를 만들어 순차 수행.
- "배포 준비": `pnpm build` + 런칭 체크리스트의 보안 항목 자동 점검 후 보고.
- "OAuth 디버깅": 쿠키/state/redirect_uri 3종 먼저 확인.

## 관련 문서
- 구현 상세: `docs/Synaptic_구현계획.md`
- Claude Code 활용 플레이북: `docs/CLAUDE_CODE_PLAYBOOK.md` (L1~L5 성숙도 모델)
- 아키텍처 결정: `docs/ADR/*.md`

## 모호할 때
추측하지 말고 **3가지 옵션 + 각각의 트레이드오프**를 제시해 내가 고르게 한다.

## 플레이북 자동 업데이트 규칙 (중요)
아래 트리거가 발생하면 `docs/CLAUDE_CODE_PLAYBOOK.md`를 업데이트 제안한다.

트리거:
1. 사용자가 `/wrap`, `세션 정리`, `오늘 끝` 이라고 말했을 때
2. 같은 지적이 한 세션에서 2회 이상 반복됐을 때
3. 새로운 스킬/훅/서브에이전트를 추가했을 때
4. 기존 규칙이 쓸모없어지거나 틀렸다고 확인됐을 때

실행 순서 (절대 자동 수정 금지, 항상 diff 제안 후 승인 대기):
1. 현재 `docs/CLAUDE_CODE_PLAYBOOK.md` 읽기
2. 이번 세션에서 반복된 지적, 새 패턴, 죽은 규칙을 추출
3. 변경안을 "기존 → 제안" 형식으로 diff 출력
4. 하단 "업데이트 로그" 테이블에 날짜·요약 추가 제안
5. 사용자가 `적용` 혹은 `승인`이라 답하면 `Edit`로 반영
6. 커밋 메시지: `docs: update claude code playbook (YYYY-MM-DD)`

금지:
- 사용자 승인 없이 파일 수정
- 업데이트 로그 없이 본문만 변경
- L1~L5 레벨 구조 자체를 삭제/합치기 (추가·세부 수정만)

## 요구사항 자동 반영 규칙
사용자가 같은 질문을 반복하거나 새 요구를 제시하면, 이 `CLAUDE.md`나 플레이북에 해당 규칙을 추가할지 먼저 제안한다.
자동 추가는 금지 — 항상 "이 규칙을 CLAUDE.md에 넣을까요?" 물어본다.

## 플레이북 업데이트 하이브리드 정책 (수동 주도 + 자동 리마인더)
원칙: **플레이북 파일 수정은 항상 건희의 `/wrap` 명령 이후에만**. 스케줄드 태스크는 절대 파일을 직접 수정하지 않는다.

- **수동 트리거(주 경로)**: `/wrap`, `세션 정리`, `오늘 끝` → 즉시 diff 제안 후 승인 대기
- **자동 리마인더(보조)**: 매주 금요일 18시 스케줄드 태스크 `weekly-playbook-reminder`가 "이번 주 돌아보고 `/wrap` 돌려보세요" 알림만 발송. 파일 수정·커밋 없음.
- 자동 리마인더가 초안을 만들거나 diff를 자동 적용하는 일은 없다. 모든 플레이북 변경의 최종 결정권은 건희에게 있다.
