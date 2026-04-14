# Phase 1. Next.js 프로젝트 초기화

> Phase 0이 완료된 상태에서 시작하세요.
> 예상 소요 시간: 1~2시간

---

## 이 Phase에서 할 일

- Next.js 프로젝트 생성
- 필요한 패키지 전부 설치
- 폴더 구조 세팅
- GitHub 레포 생성 및 첫 커밋

---

## Step 1. Next.js 프로젝트 생성

터미널에서 `ToyPJT/synaptic` 폴더로 이동합니다.

```bash
cd ~/ToyPJT/synaptic
```

아래 명령어를 실행합니다. 물어보는 것들은 전부 **Enter**로 기본값 사용:

```bash
pnpm create next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-pnpm
```

> `.` 은 현재 폴더에 만든다는 뜻입니다.

설치 완료 후 실행 테스트:

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000` 접속 → Next.js 기본 화면 보이면 성공.

**Ctrl+C** 로 서버 종료.

---

## Step 2. 패키지 설치

필요한 라이브러리들을 한꺼번에 설치합니다.

```bash
# Supabase (데이터베이스 연결)
pnpm add @supabase/supabase-js @supabase/ssr

# AI 관련
pnpm add @anthropic-ai/sdk
pnpm add voyageai

# 입력값 검증
pnpm add zod @t3-oss/env-nextjs

# Redis 캐시 + Rate Limit
pnpm add @upstash/redis @upstash/ratelimit

# 결제
pnpm add stripe

# 그래프 시각화
pnpm add sigma graphology graphology-layout-forceatlas2 graphology-types

# 코드 포맷터 (개발용)
pnpm add -D prettier prettier-plugin-tailwindcss
```

설치 후 확인:

```bash
pnpm build
```

에러 없이 끝나면 성공입니다.

---

## Step 3. 폴더 구조 생성

아래 명령어를 **그대로** 붙여넣어서 실행하세요:

```bash
# app 폴더 구조
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(auth\)/register
mkdir -p src/app/\(dashboard\)/graph
mkdir -p src/app/\(dashboard\)/search
mkdir -p src/app/\(dashboard\)/settings
mkdir -p src/app/\(dashboard\)/billing
mkdir -p src/app/api/auth/notion/start
mkdir -p src/app/api/auth/notion/callback
mkdir -p src/app/api/graph
mkdir -p src/app/api/graph/export
mkdir -p src/app/api/search
mkdir -p src/app/api/sync
mkdir -p src/app/api/billing/checkout
mkdir -p src/app/api/webhook/stripe
mkdir -p src/app/pricing

# lib 폴더 구조
mkdir -p src/lib/supabase
mkdir -p src/lib/anthropic
mkdir -p src/lib/voyage
mkdir -p src/lib/notion
mkdir -p src/lib/graph
mkdir -p src/lib/limits
mkdir -p src/lib/utils

# components 폴더 구조
mkdir -p src/components/graph
mkdir -p src/components/search
mkdir -p src/components/ui

# types, hooks
mkdir -p src/types
mkdir -p src/hooks

# DB 마이그레이션
mkdir -p supabase/migrations
```

---

## Step 4. Prettier 설정

코드를 자동으로 정리해주는 설정입니다.

`.prettierrc` 파일을 프로젝트 루트에 생성:

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

`.prettierignore` 파일 생성:

```
.next
node_modules
pnpm-lock.yaml
```

---

## Step 5. TypeScript 설정 확인

`tsconfig.json` 파일을 열어서 아래 내용이 있는지 확인:

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

없으면 추가해주세요.

---

## Step 6. 환경변수 파일 복사

Phase 0에서 만든 `.env.local` 이 `synaptic` 폴더 루트에 있는지 확인:

```bash
ls -la | grep .env
```

`.env.local` 이 보이면 됩니다.

`.gitignore` 에 `.env*` 가 포함돼 있는지 확인:

```bash
cat .gitignore | grep env
```

`*.env*` 또는 `.env*` 가 있으면 됩니다. (Next.js가 자동으로 추가함)

---

## Step 7. GitHub 레포 생성 및 첫 커밋

```bash
# git 초기화 (이미 돼 있으면 건너뜀)
git init -b main

# 현재 상태 확인 (.env.local 이 추적되면 안 됨!)
git status
```

`.env.local` 이 목록에 **없어야** 합니다. 있으면 즉시 멈추고 `.gitignore` 확인.

```bash
# 전체 추가
git add .

# 첫 커밋
git commit -m "chore: initial Next.js setup"

# GitHub 레포 생성 + 연결 + 푸시 한번에
gh repo create synaptic --private --source=. --remote=origin --push
```

완료 후 확인:

```bash
gh repo view --web
```

브라우저에서 GitHub 레포가 열리면 성공입니다.

---

## Step 8. 폴더 구조 최종 확인

```bash
find src -type d | sort
```

아래와 비슷하게 나오면 성공:

```
src/app
src/app/(auth)
src/app/(auth)/login
src/app/(dashboard)
src/app/(dashboard)/graph
src/app/(dashboard)/search
src/app/(dashboard)/settings
src/app/api
src/app/api/auth
src/app/api/search
src/app/api/sync
...
src/lib
src/lib/supabase
src/lib/anthropic
src/components
src/types
```

---

## ✅ Phase 1 완료 조건

- [ ] `pnpm dev` → localhost:3000 접속 가능
- [ ] `pnpm build` → 에러 없음
- [ ] GitHub 레포 `synaptic` 생성 확인
- [ ] `.env.local` 이 GitHub에 올라가지 않음
- [ ] 폴더 구조 생성 완료

모두 체크되면 **Phase 2**로 이동하세요.
