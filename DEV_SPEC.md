# Rebot 사장님 대시보드 — 개발 명세서

> 마지막 업데이트: 2026-06-30  
> 현재 상태: **Vercel 배포 정상** (Supabase 데이터 매장별 조회 정상)

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 서비스명 | Rebot (리봇) |
| 역할 | 카페·베이커리 사장님용 CRM 대시보드 |
| 연동 앱 | [고객용 스탬프 앱](https://github.com/kjin618-rgb/Rebot-App-Customer-facing-page) |
| 공유 DB | Supabase (동일 프로젝트, service_role 키 사용) |
| 배포 URL | https://rebot-app-owner-dashboard.vercel.app |
| 개발 단계 | MVP (Phase 1) — `store_code` 기준 매장별 데이터 표시 |

---

## 2. 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS v4 |
| 서버리스 API | Vercel Serverless Function (`api/handler.js`) |
| 로컬 개발 서버 | Express.js (`server.ts`) |
| Database | Supabase (PostgreSQL), service_role 키 |
| AI | OpenRouter (`google/gemini-2.0-flash-lite`) → Gemini SDK → 템플릿 폴백 |
| 아이콘 | Lucide React |
| Node.js 버전 | v24 (Vercel 환경) |

---

## 3. 프로젝트 구조

```
/
├── api/
│   └── handler.js          # Vercel 서버리스 함수 번들
├── src/
│   ├── App.tsx             # 라우팅 + 페이지 진입점
│   ├── main.tsx
│   ├── index.css
│   ├── serverless/
│   │   └── handler.ts      # 서버리스 함수 원본 엔트리
│   ├── types/
│   │   └── index.ts        # Store, Customer, VisitLog, Message 등 타입 정의
│   ├── lib/
│   │   ├── supabase.ts     # Supabase 클라이언트 싱글턴
│   │   ├── db-server.ts    # 전체 DB CRUD (서버 전용)
│   │   ├── api-handlers.ts # REST API 라우팅 로직
│   │   ├── ai-server.ts    # AI 메시지·게시글 생성 (서버 전용)
│   │   ├── openrouter.ts   # OpenRouter API 클라이언트
│   │   ├── prompts.ts      # AI 프롬프트 빌더
│   │   ├── churn.ts        # 이탈 단계 런타임 계산
│   │   ├── phone.ts        # 전화번호 마스킹 유틸
│   │   └── mock.ts         # 목데이터 (미사용)
│   └── components/
│       ├── CustomerTable.tsx
│       ├── MessageList.tsx
│       ├── ActivityFeed.tsx
│       ├── DashboardCards.tsx
│       ├── ContentEditor.tsx
│       ├── PerformanceCard.tsx
│       ├── PostPreview.tsx
│       ├── QRPreview.tsx
│       ├── Sidebar.tsx
│       └── BottomNav.tsx
├── server.ts               # 로컬 Express 서버 (npm run start)
├── vercel.json             # Vercel 배포 설정
├── vite.config.ts
├── tsconfig.json
├── package.json
└── index.html
```

---

## 4. Supabase DB 스키마

### 테이블 구조

```sql
-- 매장
stores (
  id uuid PK,
  store_code text UNIQUE,   -- 예: 'cafe-rebot', 'bakery-01'
  store_name text,
  owner_name text,
  stamp_goal int DEFAULT 10,
  reward_desc text,
  message_signature text,
  created_at timestamptz
)

-- 고객
customers (
  id uuid PK,
  store_id uuid FK → stores.id,
  phone text,
  phone_masked text,
  name text,
  current_stamps int DEFAULT 0,
  total_stamps int DEFAULT 0,
  total_visits int DEFAULT 0,
  last_visit_at timestamptz,
  marketing_consent bool DEFAULT true,
  marketing_consent_at timestamptz,
  created_at timestamptz
)

-- 방문 로그
visit_logs (
  id uuid PK,
  customer_id uuid FK → customers.id,
  store_id uuid FK → stores.id,
  visited_at timestamptz,
  stamps_earned int DEFAULT 1,
  source text  -- 'kiosk' | 'manual'
)

-- 메시지 초안
messages (
  id uuid PK,
  store_id uuid FK → stores.id,
  customer_id uuid FK → customers.id,
  customer_name text,
  phone_masked text,
  churn_stage text,
  content text,
  status text DEFAULT 'draft',  -- 'draft' | 'sent'
  sent_at timestamptz,
  last_sent_within_30d bool DEFAULT false,
  marketing_consent bool DEFAULT true,
  created_at timestamptz
)

-- SNS 콘텐츠 초안
content_drafts (
  id uuid PK,
  store_id uuid FK → stores.id,
  channel text,   -- 'instagram' | 'naver' | 'kakao'
  content text,
  hashtags text,
  status text DEFAULT 'saved',
  created_at timestamptz
)
```

### 중요 비즈니스 로직

- `churn_stage`는 DB에 저장하지 않고 `last_visit_at` 기준 런타임 계산:
  - ≤14일: `safe`
  - 15~30일: `watch`
  - 31~60일: `danger`
  - >60일: `churned`
- `current_stamps`: 현재 카드 스탬프 수 (리워드 달성 시 0 리셋)
- `store_id`: 고객용 앱이 스탬프 적립 시 `store_code → UUID` 변환 후 저장

---

## 5. API 엔드포인트

모든 API는 번들된 `/api/handler.js` 서버리스 함수에서 처리한다. 원본 엔트리는 `src/serverless/handler.ts`, 라우팅 로직은 `src/lib/api-handlers.ts`.

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/store/:storeCode` | 매장 정보 조회 (없으면 자동 생성) |
| GET | `/api/dashboard/:storeCode` | 대시보드 요약 (고객수, churn 분포, 최근 활동) |
| GET | `/api/customers/:storeCode` | 고객 목록 (`?filter=safe\|watch\|danger\|churned`) |
| GET | `/api/customers/:storeCode/:id` | 고객 상세 (방문로그, 메시지 포함) |
| POST | `/api/stamp/:storeCode` | 스탬프 적립 (`{phone, count}`) |
| POST | `/api/visit/:storeCode` | 수동 방문 등록 (`{customer_id, stamps}`) |
| GET | `/api/messages/:storeCode` | 메시지 목록 |
| POST | `/api/generate-message` | AI 메시지 생성 (`{customer_id, store_code}`) |
| PATCH | `/api/messages/:id` | 메시지 수정/상태 변경 (`{store_code, ...updates}`) |
| DELETE | `/api/messages/:id` | 메시지 삭제 (`?store_code=`) |
| GET | `/api/content/:storeCode` | SNS 콘텐츠 초안 목록 |
| POST | `/api/content/:storeCode` | SNS 콘텐츠 저장 (`{channel, content, hashtags}`) |
| POST | `/api/generate-post` | AI SNS 게시글 생성 |
| GET | `/api/settings/:storeCode` | 매장 설정 조회 |
| PATCH | `/api/settings/:storeCode` | 매장 설정 수정 |
| GET | `/api/metrics/:storeCode` | 성과 지표 (현재 하드코딩 더미값) |

---

## 6. Vercel 배포 설정

### vercel.json (현재 상태)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/handler" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

### 환경 변수 (Vercel 프로젝트 설정에서 등록 필요)

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENROUTER_API_KEY=sk-or-...   (선택)
GEMINI_API_KEY=AIza...          (선택)
```

---

## 7. MVP 데이터 조회 정책

`src/lib/db-server.ts`에서 `store_code → stores.id`를 조회한 뒤 `store_id` 기준으로 고객·메시지·콘텐츠 데이터를 필터링한다.

```typescript
export async function getCustomers(storeCode: string, ...) {
  const storeRow = await getStoreRow(storeCode);
  const { data } = await getSupabase()
    .from('customers')
    .select('*')
    .eq('store_id', storeRow.id)
    .order('created_at', { ascending: false });
}
```

현재 로컬 검증 결과:
- `cafe-rebot`: 고객 2명
- `cafe01`: 고객 2명
- `sweet-bakery`: 고객 1명

현재 Vercel 배포 검증 결과:
- `/api/store/cafe-rebot`: `200`
- `/api/dashboard/cafe-rebot`: `200`, `total_customers: 2`
- `/api/customers/cafe-rebot`: `200`, 고객 2명 반환

---

## 8. 디버깅 이력 및 해결 내역

### 8-1. 해결된 이슈

| 문제 | 원인 | 해결 |
|---|---|---|
| `/api/*` 요청이 SPA fallback에 걸려 HTML 반환 | `vercel.json` rewrite 패턴이 `/api/` 포함 | `/((?!api/).*)` 부정 전방탐색 패턴으로 수정 |
| 고객 데이터 미표시 (store_code 불일치) | 고객 앱은 `cafe-rebot` 사용, 대시보드는 `cafe01` 사용 | 기본 진입을 `/dashboard/cafe-rebot`으로 변경하고 `store_id` 필터 정상 적용 |
| TypeScript 빌드 에러 (`choices` is not a function) | `res.json()` 반환 타입이 `unknown` | `as any` 캐스팅 추가 |
| `import 'dotenv/config'` 크래시 | Vercel에 `.env` 파일 없음 | import 제거 (Vercel은 `process.env` 직접 제공) |
| `@google/genai` 모듈 로드 크래시 | 최상위 static import가 서버리스 번들에서 실패 | `async function` 내 dynamic import로 변경 |
| `url.parse()` 런타임 에러 가능성 | deprecated API, 번들러 환경에서 불안정 | WHATWG `new URL()` 생성자로 교체 |
| `/var/task/src/lib/api-handlers` 모듈 누락 | Vercel이 TS 서버리스 함수를 번들링하지 않고 JS 변환만 수행 | `src/serverless/handler.ts`를 esbuild로 `api/handler.js` 단일 번들 생성 |

### 8-2. 최종 해결 이슈 — Vercel 서버리스 번들링

**기존 증상**: `/api/store/cafe-rebot` 등 API 호출 시 `500: FUNCTION_INVOCATION_FAILED`

**Vercel 런타임 로그**:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/src/lib/api-handlers'
imported from /var/task/api/handler.js
```

**원인 분석**:
- `api/handler.ts`가 `../src/lib/api-handlers` 등을 import
- Vercel이 `api/handler.ts` → `api/handler.js`로 변환할 때 **번들링을 하지 않음**
- 컴파일된 `api/handler.js`는 `../src/lib/api-handlers`를 그대로 참조
- 배포 환경(`/var/task/`)에는 `src/lib/` 디렉토리가 없음 → 모듈 못 찾음

**최종 해결**:
- `api/handler.ts`를 Vercel 엔트리에서 제거
- 원본 엔트리를 `src/serverless/handler.ts`로 이동
- `npm run build` 실행 시 `npm run build:api`가 먼저 실행되도록 변경
- `build:api`에서 esbuild가 `src/serverless/handler.ts`와 `src/lib/*` 의존성을 단일 파일 `api/handler.js`로 번들링
- Vercel은 번들된 `api/handler.js`만 실행하므로 `/var/task/src/lib/*` 모듈 탐색 문제가 사라짐

**시도한 접근들**:

1. `api/[...path].ts` catch-all 파일명 → `404: NOT_FOUND` (브래킷 파일명 감지 실패)
2. `api/handler.ts` + `vercel.json` rewrite → tsc로 컴파일되어 번들링 없이 배포됨
3. esbuild 빌드 스크립트 → Windows 바이너리 캐시 문제로 Linux에서 실행 불가
4. `api/tsconfig.json` (`"noEmit": false`) 추가 → Vercel이 tsc 사용, 번들링 안 됨
5. `api/tsconfig.json` 삭제 → Vercel 기본 처리 기대했으나 `src/lib/api-handlers` 모듈 누락으로 실패
6. **최종 해결**: esbuild 명시 번들 `api/handler.js` 생성 후 배포

---

## 9. 로컬 개발 환경

```bash
npm install
cp .env.example .env
# .env에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 입력

npm run dev     # Vite dev 서버 (포트 3000)
npm run start   # Express 서버 (API + 정적 파일 포함)
```

로컬에서는 Express(`server.ts`)가 API 요청 처리. Vercel 배포 시 번들된 `api/handler.js`가 동일한 역할.

---

## 10. 관련 레포

- **고객용 앱**: https://github.com/kjin618-rgb/Rebot-App-Customer-facing-page
  - 고객이 QR 스캔 후 스탬프 적립
  - 동일 Supabase 프로젝트 사용
  - `store_code` (예: `cafe-rebot`) 기준으로 `stores` 테이블에서 `store_id(UUID)` 조회 후 `customers`에 저장
