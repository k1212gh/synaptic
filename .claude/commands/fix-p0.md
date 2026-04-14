# /fix-p0 — P0 보안 이슈 수정 스킬

docs/security-report.html 에서 P0(Critical/High) 항목을 자동으로 수정한다.

## 실행 전 확인

1. `git status` 로 uncommitted 변경사항 확인
2. 변경사항 있으면 사용자에게 커밋 여부 확인 후 진행

## 수정 목록 (우선순위 순)

### P0-1: decrypt() 입력 검증
파일: `src/lib/crypto/token.ts`
- buf.length < 28 체크 추가

### P0-2: 빈 컨텍스트 Claude 호출 차단
파일: `src/app/api/query/route.ts`
- ctxList.length === 0 일 때 early return

### P0-3: Notion 429 지수 백오프
파일: `src/lib/notion/fetcher.ts`
- withRetry 함수 추가 (3회, 지수 백오프)
- listAllPages, getPageText에 적용

### P0-4: processPage 토큰 중복 조회 제거
파일: `src/lib/sync/processPage.ts`, `src/lib/queue/index.ts`
- encryptedToken을 인자로 받도록 시그니처 변경

## 실행 후

- `pnpm tsc --noEmit` 로 타입 에러 확인
- 각 수정사항 커밋 (항목별 개별 커밋)
- `/review` 스킬로 최종 검토
