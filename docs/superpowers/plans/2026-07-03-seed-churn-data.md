# 이탈 데이터 시딩 (Seed Churn Data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `cafe-rebot`, `cafe01`, `sweet-bakery` 3개 매장 각각에 이탈 4단계(safe/watch/danger/churned)별 샘플 고객·방문 로그를 심어서, 실제 서비스에서는 발생하지 않는 watch/danger/churned 상태를 대시보드에서 데모·검증할 수 있게 한다.

**Architecture:** `scripts/` 아래 독립 실행 스크립트 2개(`tsx`로 실행)를 추가한다. `seed-churn-data.ts`는 재실행해도 중복이 쌓이지 않도록 이전에 심은 데이터를 전화번호 접두사로 식별해 지운 뒤 다시 심는다. `verify-churn-seed.ts`는 실제 Supabase에 저장된 데이터를 `calcChurn()`으로 재계산해 매장별 4단계 분포가 기대값과 일치하는지 확인한다. 두 스크립트는 기존 `src/lib/supabase.ts`, `src/lib/phone.ts`, `src/lib/churn.ts`를 그대로 재사용한다.

**Tech Stack:** TypeScript, `tsx`(이미 devDependency로 존재), `@supabase/supabase-js`, `dotenv/config` — 신규 의존성 없음.

## Global Constraints

- 브랜치: `dev` 기준으로 새로 만든 `chore/seed-churn-data`에서만 작업한다 (`main`/`dev` 직접 커밋 금지, `docs/GIT_GUIDE.md`).
- 신규 npm 패키지 추가 금지 — `tsx`, `@supabase/supabase-js`, `dotenv`만 사용한다.
- 시드 데이터는 반드시 재실행 가능(idempotent)해야 한다 — 전화번호 접두사 `0109999`로 이전 시드 데이터를 식별해 지우고 다시 심는다.
- 이탈 단계 판정은 `src/lib/churn.ts`의 `calcChurn()` 기준과 정확히 일치해야 한다: `safe` ≤14일, `watch` ≤30일, `danger` ≤60일, `churned` >60일.
- 대상 매장: `cafe-rebot`, `cafe01`, `sweet-bakery` (`DEV_SPEC.md` §7에서 로컬 검증된 store_code).
- 실행에는 로컬 `.env`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있어야 한다 (`.env.example` 참고).

---

### Task 1: 브랜치 생성 + 시드 상수 모듈

**Files:**
- Create: `scripts/seed-constants.ts`

**Interfaces:**
- Produces: `STORE_CODES: readonly string[]`, `SEED_PHONE_PREFIX: string`, `CHURN_STAGE_DAYS_AGO: Record<'safe'|'watch'|'danger'|'churned', number[]>`, `SAMPLE_NAMES: string[]` — Task 2, 3이 그대로 import해서 사용한다.

- [ ] **Step 1: `dev` 기준으로 작업 브랜치 생성**

```bash
git checkout dev
git pull origin dev
git checkout -b chore/seed-churn-data
```

Expected: `Switched to a new branch 'chore/seed-churn-data'`

- [ ] **Step 2: `scripts/` 폴더와 상수 모듈 작성**

```typescript
// scripts/seed-constants.ts
export const STORE_CODES = ['cafe-rebot', 'cafe01', 'sweet-bakery'] as const;

export const SEED_PHONE_PREFIX = '0109999';

export const CHURN_STAGE_DAYS_AGO: Record<'safe' | 'watch' | 'danger' | 'churned', number[]> = {
  safe: [5, 10],
  watch: [18, 25],
  danger: [35, 50],
  churned: [75, 120],
};

export const SAMPLE_NAMES = [
  '김민준', '이서연', '박도윤', '최지우',
  '정하은', '강지호', '윤서아', '임도현',
];
```

- [ ] **Step 3: 상수 모듈이 제대로 로드되는지 스모크 체크**

Run:
```bash
npx tsx -e "import('./scripts/seed-constants.ts').then(m => console.log(m.STORE_CODES, m.SEED_PHONE_PREFIX, m.SAMPLE_NAMES.length))"
```
Expected output:
```
[ 'cafe-rebot', 'cafe01', 'sweet-bakery' ] '0109999' 8
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-constants.ts
git commit -m "chore: 이탈 데이터 시딩용 공통 상수 모듈 추가"
```

---

### Task 2: 검증 스크립트 작성 (선 실행 시 실패해야 함)

**Files:**
- Create: `scripts/verify-churn-seed.ts`
- Modify: `package.json` (npm script 추가)

**Interfaces:**
- Consumes: `scripts/seed-constants.ts`의 `STORE_CODES`, `SEED_PHONE_PREFIX`, `CHURN_STAGE_DAYS_AGO` / `src/lib/supabase.ts`의 `getSupabase()` / `src/lib/churn.ts`의 `calcChurn(dates: string[]): ChurnStage`
- Produces: `npm run seed:churn:verify` 커맨드 — Task 4에서 최종 검증에 사용.

- [ ] **Step 1: 검증 스크립트 작성**

```typescript
// scripts/verify-churn-seed.ts
import 'dotenv/config';
import { getSupabase } from '../src/lib/supabase';
import { calcChurn } from '../src/lib/churn';
import { STORE_CODES, SEED_PHONE_PREFIX, CHURN_STAGE_DAYS_AGO } from './seed-constants';

const EXPECTED_PER_STAGE = 2;
const STAGES = Object.keys(CHURN_STAGE_DAYS_AGO) as Array<keyof typeof CHURN_STAGE_DAYS_AGO>;

async function verifyStore(storeCode: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('store_code', storeCode)
    .single();

  if (!store) {
    console.log(`[FAIL] ${storeCode}: 매장이 존재하지 않음 (시드 실행 전)`);
    return false;
  }

  const { data: customers } = await supabase
    .from('customers')
    .select('phone, last_visit_at')
    .eq('store_id', store.id)
    .like('phone', `${SEED_PHONE_PREFIX}%`);

  const counts: Record<string, number> = { safe: 0, watch: 0, danger: 0, churned: 0 };
  for (const row of customers || []) {
    const stage = calcChurn([row.last_visit_at]);
    counts[stage]++;
  }

  let ok = true;
  for (const stage of STAGES) {
    const actual = counts[stage];
    if (actual !== EXPECTED_PER_STAGE) {
      console.log(`[FAIL] ${storeCode} / ${stage}: 기대 ${EXPECTED_PER_STAGE}건, 실제 ${actual}건`);
      ok = false;
    } else {
      console.log(`[OK]   ${storeCode} / ${stage}: ${actual}건`);
    }
  }
  return ok;
}

async function main() {
  let allOk = true;
  for (const storeCode of STORE_CODES) {
    const ok = await verifyStore(storeCode);
    allOk = allOk && ok;
  }

  if (!allOk) {
    console.error('\n검증 실패: 시드 데이터가 기대와 다릅니다.');
    process.exit(1);
  }
  console.log('\n검증 성공: 모든 매장의 이탈 단계 분포가 기대값과 일치합니다.');
}

main();
```

- [ ] **Step 2: `package.json`에 검증 스크립트 등록**

`package.json`의 `scripts` 블록에 아래 한 줄을 추가한다 (`"lint": "tsc --noEmit"` 다음 줄):

```json
    "seed:churn:verify": "tsx scripts/verify-churn-seed.ts"
```

- [ ] **Step 3: 시드 실행 전 상태에서 검증 스크립트를 돌려 실패를 확인**

Run:
```bash
npm run seed:churn:verify
```
Expected: 각 매장에 대해 4단계 모두 `[FAIL] ... 기대 2건, 실제 0건` 출력, 마지막 줄 `검증 실패: 시드 데이터가 기대와 다릅니다.`, exit code 1.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-churn-seed.ts package.json
git commit -m "test: 이탈 데이터 시딩 검증 스크립트 추가 (시드 전이라 실패 상태)"
```

---

### Task 3: 시드 스크립트 작성 및 실행

**Files:**
- Create: `scripts/seed-churn-data.ts`
- Modify: `package.json` (npm script 추가)

**Interfaces:**
- Consumes: `scripts/seed-constants.ts`의 4개 상수 / `src/lib/supabase.ts`의 `getSupabase()` / `src/lib/phone.ts`의 `normalizePhone(phone: string): string`, `maskPhone(phone: string): string`
- Produces: `npm run seed:churn` 커맨드 — Task 4에서 실행 후 검증.

- [ ] **Step 1: 시드 스크립트 작성**

```typescript
// scripts/seed-churn-data.ts
import 'dotenv/config';
import { getSupabase } from '../src/lib/supabase';
import { normalizePhone, maskPhone } from '../src/lib/phone';
import {
  STORE_CODES,
  SEED_PHONE_PREFIX,
  CHURN_STAGE_DAYS_AGO,
  SAMPLE_NAMES,
} from './seed-constants';

const STAGES = Object.keys(CHURN_STAGE_DAYS_AGO) as Array<keyof typeof CHURN_STAGE_DAYS_AGO>;

async function getOrCreateStoreId(storeCode: string): Promise<string> {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('store_code', storeCode)
    .single();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('stores')
    .insert({
      store_code: storeCode,
      store_name: `${storeCode} 매장`,
      owner_name: '사장님',
      stamp_goal: 10,
      reward_desc: '스탬프 10개 적립 시 음료 1잔 무료',
      message_signature: `${storeCode} 사장 드림`,
    })
    .select('id')
    .single();

  return created.id;
}

async function clearPreviousSeed(storeId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: seeded } = await supabase
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .like('phone', `${SEED_PHONE_PREFIX}%`);

  const ids = (seeded || []).map((row: any) => row.id);
  if (ids.length === 0) return;

  await supabase.from('visit_logs').delete().in('customer_id', ids);
  await supabase.from('customers').delete().in('id', ids);
}

async function seedStore(storeCode: string, storeIndex: number): Promise<void> {
  const supabase = getSupabase();
  const storeId = await getOrCreateStoreId(storeCode);
  await clearPreviousSeed(storeId);

  let nameIndex = 0;
  for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex++) {
    const stage = STAGES[stageIndex];
    const daysAgoOptions = CHURN_STAGE_DAYS_AGO[stage];

    for (let repIndex = 0; repIndex < daysAgoOptions.length; repIndex++) {
      const globalIndex = storeIndex * 8 + stageIndex * 2 + repIndex;
      const phone = normalizePhone(`${SEED_PHONE_PREFIX}${String(globalIndex).padStart(4, '0')}`);
      const daysAgo = daysAgoOptions[repIndex];
      const lastVisitAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const name = SAMPLE_NAMES[nameIndex % SAMPLE_NAMES.length];
      const marketingConsent = repIndex === 0;
      nameIndex++;

      const { data: customer } = await supabase
        .from('customers')
        .insert({
          store_id: storeId,
          name,
          phone,
          phone_masked: maskPhone(phone),
          current_stamps: 1,
          total_stamps: 1,
          total_visits: 1,
          last_visit_at: lastVisitAt,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? lastVisitAt : null,
          created_at: lastVisitAt,
        })
        .select('id')
        .single();

      await supabase.from('visit_logs').insert({
        customer_id: customer.id,
        store_id: storeId,
        visited_at: lastVisitAt,
        stamps_earned: 1,
        source: 'kiosk',
      });

      console.log(`  [${storeCode}] ${stage} 샘플 생성: ${name} (${daysAgo}일 전 방문)`);
    }
  }
}

async function main() {
  for (let i = 0; i < STORE_CODES.length; i++) {
    const storeCode = STORE_CODES[i];
    console.log(`\n=== ${storeCode} 시딩 시작 ===`);
    await seedStore(storeCode, i);
  }
  console.log('\n시딩 완료.');
}

main();
```

- [ ] **Step 2: `package.json`에 시드 스크립트 등록**

`"seed:churn:verify"` 옆에 추가:

```json
    "seed:churn": "tsx scripts/seed-churn-data.ts",
```

- [ ] **Step 3: 시드 스크립트 실행**

Run:
```bash
npm run seed:churn
```
Expected: 매장 3개 × 8건(=24건) 생성 로그가 출력되고 마지막 줄 `시딩 완료.`가 나온다. 에러(예: `SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env`) 없이 종료해야 한다.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-churn-data.ts package.json
git commit -m "feat: 매장별 이탈 4단계 샘플 고객 시딩 스크립트 추가"
```

---

### Task 4: 최종 검증 (코드 변경 없음)

**Files:** 없음 (검증 전용 태스크)

**Interfaces:**
- Consumes: Task 2의 `npm run seed:churn:verify`, Task 3의 `npm run seed:churn` 결과물

- [ ] **Step 1: 검증 스크립트 재실행 — 이번엔 통과해야 함**

Run:
```bash
npm run seed:churn:verify
```
Expected: 매장 3개 × 4단계 모두 `[OK] ... 2건` 출력, 마지막 줄 `검증 성공: 모든 매장의 이탈 단계 분포가 기대값과 일치합니다.`, exit code 0.

- [ ] **Step 2: 재실행 시 중복이 쌓이지 않는지 확인 (idempotency)**

Run:
```bash
npm run seed:churn && npm run seed:churn:verify
```
Expected: 시드를 두 번 실행해도 검증 스크립트가 여전히 매장당 4단계 `2건`씩만 보고한다 (24건 유지, 중복 누적 없음).

- [ ] **Step 3: 실제 대시보드 API로 육안 확인**

로컬 Express 서버 기동:
```bash
npm run start
```
다른 터미널에서:
```bash
curl -s http://localhost:3000/api/customers/cafe-rebot?filter=danger | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.length)"
```
Expected: `2` (cafe-rebot의 danger 단계 시드 고객 수)

같은 방식으로 `filter=watch`, `filter=churned`도 각각 `2`가 나오는지 확인하고, `npm run seed:churn:verify`가 이미 `safe`도 검증했으므로 대시보드 메인 화면(`/dashboard/cafe-rebot`)에서 4단계 배지가 모두 보이는지 브라우저로 최종 육안 확인한다.

- [ ] **Step 4: 서버 종료**

로컬 서버를 `Ctrl+C`로 종료한다. 커밋할 코드 변경이 없으므로 이 태스크는 커밋 없이 종료한다.

---

## Self-Review

**스펙 커버리지:** `docs/superpowers/specs/2026-07-03-backlog-reprioritization.md`의 "이탈 데이터 시딩" 요구사항(watch/danger/churned 샘플 부재 해결) — Task 1~4가 생성부터 검증까지 전 과정을 커버함. "chore/docs-priority에서 파생하지 말고 dev 기준 새 브랜치" 요구 — Task 1 Step 1에서 명시적으로 `dev`에서 분기함. "실행 후 검증 방법(대시보드에서 4단계 분포 확인)" 요구 — Task 4에서 API curl + 브라우저 육안 확인 모두 포함.

**플레이스홀더 스캔:** "TBD"/"나중에" 류 표현 없음. 모든 코드 블록에 실행 가능한 전체 내용 포함.

**타입/시그니처 일관성:** `STORE_CODES`, `SEED_PHONE_PREFIX`, `CHURN_STAGE_DAYS_AGO`, `SAMPLE_NAMES` 이름과 타입이 Task 1(정의) → Task 2, 3(사용) 전체에서 동일하게 사용됨. `getSupabase()`, `calcChurn()`, `normalizePhone()`, `maskPhone()`는 기존 코드(`src/lib/supabase.ts`, `src/lib/churn.ts`, `src/lib/phone.ts`)의 실제 시그니처를 그대로 참조함 (신규 정의 아님).
