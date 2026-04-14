# Claude Code 시작 가이드 (이 순서대로만 따라하세요)

## 0. 사전 준비 (1회만)

PowerShell에서:
```powershell
# Node 20 LTS 설치 확인
node -v

# pnpm 설치
npm install -g pnpm

# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# Git 설치 확인
git --version
```

## 1. 이 폴더로 이동

```powershell
cd C:\Users\SSAFY\Desktop\ToyPJT
```

## 2. Claude Code 실행

```powershell
claude
```

처음이면 브라우저가 열리며 로그인. Max 플랜 or API 키 선택.

## 3. 첫 명령 (그대로 복사해서 붙여넣기)

```
CLAUDE.md와 docs/Synaptic_구현계획.md를 먼저 읽어줘.
그 다음 Phase 0과 Phase 1만 실행할 계획을 체크리스트로 보여줘.
아직 아무 파일도 만들지 말고, 내 승인을 기다려.
```

> Shift+Tab 두 번 눌러 **Plan mode**로 전환한 뒤 위 명령을 보내면 더 안전합니다.

## 4. 계획 검토 후

이상 없으면:
```
좋아, 진행해줘
```

이상하면:
```
X 부분이 이해 안 돼. 왜 그렇게 하는지 설명하고 대안도 보여줘.
```

## 5. 작업 단위마다 반복

각 Phase 끝나면:
```
/cost              # 이번 세션 얼마 썼나
/clear             # 컨텍스트 초기화 (다음 Phase 들어가기 전)
```

그다음 새 Phase 시작:
```
Phase 2 보안 기초 공사 진행 계획 짜줘
```

## 6. 자주 쓰는 명령어

| 명령 | 용도 |
|---|---|
| `/clear` | 대화 초기화. Phase 넘어갈 때마다. |
| `/compact` | 컨텍스트가 찼을 때 요약해서 압축 |
| `/cost` | 토큰/비용 확인 |
| `/status` | 현재 모델, 모드 확인 |
| `/help` | 전체 명령 목록 |
| `Shift+Tab` (2번) | Plan mode 진입/해제 |
| `Esc` | 현재 작업 중단 |
| `Ctrl+C` 두 번 | Claude Code 종료 |

## 7. 위험 방지 수칙

1. **`.env` 관련 명령은 반드시 직접 검토** (y 누르기 전에 내용 읽기)
2. **`git status`는 매일 한 번**: 이상한 파일 추가됐나 확인
3. **첫 커밋 전에** `cat .gitignore | grep env` 확인: `.env*` 포함되어 있어야 함
4. 클로드가 `rm -rf`, `DROP TABLE`, `--force` 같은 명령 제안하면 **한 번 더 의심**
5. 막히면 혼자 고치려 하지 말고 에러 메시지 그대로 클로드에게 붙여넣기

## 8. 하루 마무리

```
오늘 뭐 했는지 CHANGELOG.md에 한 줄로 정리해줘
```

그리고:
```powershell
git add . && git commit -m "feat: today's progress"
git push
```

---

막힐 때 대응:
- 빨간 에러 → 통째로 복사해서 붙여넣기
- 의미를 모르겠는 코드 → "이 파일 ~~.ts 각 줄이 뭐 하는 건지 설명해줘"
- 맞는지 모르겠음 → "지금까지 만든 거 보안 체크리스트로 검증해줘"
