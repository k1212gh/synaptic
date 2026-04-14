# /phase [N] — 구현 Phase 실행 스킬

`docs/Synaptic_구현계획.md` 의 Phase N을 실행한다.

## 사용법
```
/phase 7     ← Phase 7 프론트엔드 실행
/phase 9     ← Phase 9 배포 설정 실행
```

## 실행 순서

1. `docs/Synaptic_구현계획.md` 에서 해당 Phase 섹션 읽기
2. 체크리스트로 변환해서 사용자에게 보여주기
3. **승인 대기** — 사용자가 "진행" 또는 "좋아" 입력 시만 코드 작성
4. 각 항목 완료 시 TodoWrite로 체크
5. Phase 완료 후 `pnpm tsc --noEmit` 검증

## 주의사항
- 한 번에 한 Phase만 실행
- 외부 서비스 계정(Supabase, Vercel 등) 필요한 항목은 사용자에게 별도 안내
- 데이터 삭제/마이그레이션 항목은 반드시 사용자 확인 후 실행
