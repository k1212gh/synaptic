# /report — 프로젝트 현황 리포트 스킬

프로젝트 전체 상태를 시각화된 HTML 대시보드로 생성한다.

## 실행 순서

### 1단계: 병렬 데이터 수집 (3개 에이전트 동시)

**에이전트 A — 코드 상태**
- 전체 src/ 파일 수, 라인 수
- 구현된 API 엔드포인트 목록
- TODO/FIXME 주석 개수
- TypeScript 에러 (`tsc --noEmit`)

**에이전트 B — 보안 체크**
- `grep -r "any" src/` 결과
- `grep -r "console.log" src/` 결과
- `.env.local`이 gitignore에 포함되어 있는지
- 인증 없는 API route 존재 여부

**에이전트 C — 문서 현황**
- docs/ 파일 목록 및 최종 수정일
- PLAYBOOK 레벨 현황
- 미구현 Phase 목록

### 2단계: HTML 리포트 생성

수집 결과를 바탕으로 `docs/project-report-{날짜}.html` 생성.
- 구현 완료율 바 차트
- 보안 점수 (0~100)
- 비용 추정 테이블
- 다음 액션 아이템 3개

## 출력

`docs/project-report-YYYY-MM-DD.html` 파일 생성 후 경로 안내.
