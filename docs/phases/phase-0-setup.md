# Phase 0. 환경 세팅

> 이 문서를 끝까지 따라하면 코드를 작성할 준비가 완전히 됩니다.
> 예상 소요 시간: 1~2시간

---

## 이 Phase에서 할 일

- 개발에 필요한 프로그램 설치
- 필요한 서비스 계정 생성 + API 키 발급
- 프로젝트 폴더 준비

---

## Step 1. Node.js 설치

Node.js는 JavaScript를 컴퓨터에서 실행할 수 있게 해주는 프로그램입니다.

### 설치 방법

1. https://nodejs.org 접속
2. **"20.x.x LTS"** 버전 다운로드 (LTS = 안정 버전)
3. 다운로드된 파일 실행 → 설치

### 설치 확인

터미널(맥: Terminal, 윈도우: PowerShell)을 열고 입력:

```bash
node --version
```

결과가 `v20.x.x` 형태로 나오면 성공입니다.

---

## Step 2. pnpm 설치

pnpm은 패키지(라이브러리) 관리 도구입니다. npm보다 빠릅니다.

```bash
npm install -g pnpm
```

### 설치 확인

```bash
pnpm --version
```

숫자가 나오면 성공입니다.

---

## Step 3. Git + GitHub 설정

Git은 코드 버전 관리 도구입니다. GitHub는 코드를 온라인에 저장하는 곳입니다.

### Git 설치 확인

```bash
git --version
```

없으면 https://git-scm.com 에서 설치.

### GitHub 계정 생성

1. https://github.com 접속
2. Sign up → 계정 생성

### SSH 키 설정 (GitHub 연결용)

```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "your@email.com"
# 엔터 3번 누르기 (기본값 사용)

# 생성된 공개키 복사
cat ~/.ssh/id_ed25519.pub
```

복사한 내용을:
1. GitHub → Settings → SSH and GPG keys
2. New SSH key → 붙여넣기 → 저장

### 설치 확인

```bash
ssh -T git@github.com
```

`Hi username!` 메시지 나오면 성공입니다.

---

## Step 4. GitHub CLI 설치

GitHub를 터미널에서 다룰 수 있게 해줍니다.

### 설치

- **맥:** `brew install gh`
- **윈도우:** https://cli.github.com 에서 다운로드

### 로그인

```bash
gh auth login
```

물어보는 것들:
- `GitHub.com` 선택
- `SSH` 선택
- 브라우저 열리면 승인

### 설치 확인

```bash
gh auth status
```

`Logged in to github.com` 나오면 성공입니다.

---

## Step 5. Supabase 계정 생성

Supabase는 데이터베이스 서비스입니다.

1. https://supabase.com 접속 → Sign up
2. 로그인 후 **New Project** 클릭
3. 설정:
   - **Name:** `synaptic`
   - **Database Password:** 강력한 비밀번호 (저장해두기!)
   - **Region:** `Northeast Asia (Seoul)` ← 반드시 서울 선택
4. **Create new project** 클릭 → 2분 대기

### API 키 저장

프로젝트 생성 후:
- Settings → API 클릭
- 아래 두 가지 복사해두기:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ 절대 외부 노출 금지

---

## Step 6. Anthropic API 키 발급

Claude AI를 사용하기 위한 키입니다.

1. https://console.anthropic.com 접속 → 계정 생성
2. **Settings → Billing** → 결제 수단 등록
3. ⚠️ **중요:** Usage Limits에서 월 한도 **$20**으로 설정 (실수 방지)
4. **API Keys** → **Create Key**
5. 생성된 키 복사 → `ANTHROPIC_API_KEY`

> 키는 `sk-ant-` 로 시작합니다.

---

## Step 7. Voyage AI 가입

문서를 벡터로 변환(임베딩)하는 서비스입니다.

1. https://dash.voyageai.com 접속 → Sign up
2. **API Keys** → **Create new key**
3. 복사 → `VOYAGE_API_KEY`

---

## Step 8. Upstash 가입

Redis 캐시 서비스입니다. (자주 하는 검색을 빠르게 처리)

1. https://upstash.com 접속 → Sign up
2. **Create Database** 클릭
3. 설정:
   - **Name:** `synaptic-cache`
   - **Region:** `ap-northeast-1 (Tokyo)` ← 서울 없으면 도쿄
   - **Type:** `Regional`
4. 생성 후 **REST API** 탭에서:
   - `UPSTASH_REDIS_REST_URL` 복사
   - `UPSTASH_REDIS_REST_TOKEN` 복사

---

## Step 9. Notion Integration 생성

Notion 데이터를 읽어오기 위한 앱 등록입니다.

1. https://www.notion.so/my-integrations 접속
2. **New integration** 클릭
3. 설정:
   - **Name:** `Synaptic`
   - **Logo:** (선택사항)
   - **Associated workspace:** 내 워크스페이스 선택
4. **Submit** 클릭
5. **OAuth Domain & URIs** 탭:
   - Redirect URIs 추가: `http://localhost:3000/api/auth/notion/callback`
6. **Secrets** 탭에서:
   - `OAuth client ID` → `NOTION_CLIENT_ID`
   - `OAuth client secret` → `NOTION_CLIENT_SECRET`

---

## Step 10. Vercel 가입

배포(서비스를 인터넷에 올리는 것) 서비스입니다.

1. https://vercel.com 접속
2. **Sign up with GitHub** → GitHub 계정으로 가입

> 지금은 가입만. 실제 배포는 Phase 9에서 합니다.

---

## Step 11. Sentry 가입

에러 모니터링 서비스입니다. 서비스가 언제 오류가 났는지 알 수 있습니다.

1. https://sentry.io 접속 → 계정 생성
2. **Create Project** → **Next.js** 선택
3. 프로젝트 이름: `synaptic`
4. DSN 주소 복사 → `SENTRY_DSN`

> 지금은 계정 생성과 DSN 복사만. 실제 연결은 Phase 9에서 합니다.

---

## Step 12. Stripe 가입

결제 처리 서비스입니다.

1. https://stripe.com 접속 → 계정 생성
2. 대시보드에서 **테스트 모드** 확인 (오른쪽 상단 토글)
3. **Developers → API Keys**:
   - `Publishable key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `Secret key` → `STRIPE_SECRET_KEY`

> 지금은 키만 저장. 실제 가격 설정은 Phase 8.5에서 합니다.

---

## Step 13. 암호화 키 생성

토큰을 안전하게 저장하기 위한 암호화 키입니다.

```bash
openssl rand -base64 32
```

출력된 값 복사 → `TOKEN_ENCRYPTION_KEY`

---

## Step 14. 프로젝트 폴더 준비

```bash
# 원하는 위치로 이동 (예: 홈 폴더)
cd ~

# 폴더 생성
mkdir -p ToyPJT/synaptic
cd ToyPJT/synaptic
```

---

## Step 15. .env.local 파일 생성

위에서 모은 키들을 한 파일에 정리합니다.

```bash
# synaptic 폴더 안에서
touch .env.local
```

아래 내용을 `.env.local`에 붙여넣고 각 값을 채워주세요:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=여기에_붙여넣기
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_붙여넣기
SUPABASE_SERVICE_ROLE_KEY=여기에_붙여넣기

# Anthropic
ANTHROPIC_API_KEY=여기에_붙여넣기

# Voyage AI
VOYAGE_API_KEY=여기에_붙여넣기

# Upstash Redis
UPSTASH_REDIS_REST_URL=여기에_붙여넣기
UPSTASH_REDIS_REST_TOKEN=여기에_붙여넣기

# Notion OAuth
NOTION_CLIENT_ID=여기에_붙여넣기
NOTION_CLIENT_SECRET=여기에_붙여넣기
NOTION_REDIRECT_URI=http://localhost:3000/api/auth/notion/callback

# Stripe
STRIPE_SECRET_KEY=여기에_붙여넣기
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=여기에_붙여넣기
STRIPE_WEBHOOK_SECRET=나중에_채우기

# 암호화 키
TOKEN_ENCRYPTION_KEY=여기에_붙여넣기

# 앱 주소
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 최종 확인

아래 명령어를 전부 실행해서 모두 정상인지 확인하세요.

```bash
# Node.js 버전
node --version
# 기대값: v20.x.x

# pnpm 버전
pnpm --version
# 기대값: 숫자

# GitHub 로그인
gh auth status
# 기대값: Logged in to github.com

# Anthropic API 테스트
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
# 기대값: JSON 응답 (에러 없음)
```

---

## ✅ Phase 0 완료 조건

- [ ] `node --version` → v20.x.x
- [ ] `pnpm --version` → 숫자 출력
- [ ] `gh auth status` → Logged in
- [ ] `.env.local` 파일에 모든 키 입력 완료
- [ ] Supabase 프로젝트 생성됨 (Seoul 리전)

모두 체크되면 **Phase 1**으로 이동하세요.
