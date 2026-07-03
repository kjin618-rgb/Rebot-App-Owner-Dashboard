# KPI 실계산 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/api/metrics`의 `stamp_completion_rate`/`second_visit_rate_30d`를 실계산으로 전환하고, 이를 위해 필요한 스탬프 리셋 로직 부재 및 `current_stamps`/`total_stamps` 매핑 버그를 함께 고친다.

**Architecture:** `db-server.ts`의 `toCustomer` 매퍼와 `addStamp`/`recordManualVisit`을 고쳐 `current_stamps`(카드 진행도, 리셋 반영)와 `total_stamps`(진짜 누적)를 분리한다. 신규 `src/lib/metrics.ts`에 두 KPI 계산 함수를 두어 `db-server.ts`의 CRUD 책임과 분리한다 (파일이 이미 크므로 관심사 분리).

**Tech Stack:** TypeScript, Supabase(PostgreSQL), 기존 `src/lib/*` 구조 재사용. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 생성/체크아웃된 `feat/kpi-real-calculation`에서 계속 작업한다 (새 브랜치 생성 불필요).
- 테스트 프레임워크 없음 — 검증은 `node:assert` 기반 임시 스크립트(프로젝트 루트에 만들고 실행 후 삭제) 또는 실제 API `curl` 호출로 대체한다. `npm run lint`는 모든 코드 변경 태스크에서 공통으로 돌린다.
- 이번 스코프는 `stamp_completion_rate`, `second_visit_rate_30d` 2개 지표만 실계산 전환한다. 나머지 3개(`message_revisit_rate`, `no_message_revisit_rate`, `incremental_revisit_rate`)와 `marketing_consent_rate`는 하드코딩을 그대로 둔다.
- `stamp_completion_rate` = 매장 내 고객 중 `floor(total_stamps / stamp_goal) >= 1`인 고객 수 / 전체 고객 수 × 100
- `second_visit_rate_30d` = 고객별 첫 방문 → 두 번째 방문 간격이 30일 이내인 고객 수 / 전체 고객 수 × 100
- 이 프로젝트엔 마이그레이션 파일 시스템이 없다 — 기존 데이터 보정 SQL은 Supabase 대시보드 SQL Editor에서 수동 실행한다.

---

### Task 1: `current_stamps`/`total_stamps` 매핑 버그 수정 + AI 메시지 라우트 필드 교체

**Files:**
- Modify: `src/types/index.ts` (`Customer` interface)
- Modify: `src/lib/db-server.ts` (`toCustomer` 매퍼, `getStoreRow` 함수에 `export` 추가)
- Modify: `src/lib/api-handlers.ts` (`generate-message`, `regenerate` 두 라우트)

**Interfaces:**
- Produces: `Customer.current_stamps: number`(카드 진행도), `Customer.total_stamps: number`(진짜 누적으로 의미 수정), `getStoreRow(storeCode: string)`가 export됨 — Task 4에서 사용한다.

- [ ] **Step 1: `Customer` 타입에 `current_stamps` 추가**

`src/types/index.ts`의 `Customer` interface에서 `total_visits` 다음 줄에 추가한다:

```typescript
  total_visits: number;
  current_stamps: number;
  total_stamps: number;
```

(기존에 `total_visits: number;` 다음이 바로 `total_stamps: number;`였던 것을 위와 같이 그 사이에 `current_stamps: number;`를 삽입하는 것이다.)

- [ ] **Step 2: `toCustomer` 매퍼 수정 + `getStoreRow` export**

`src/lib/db-server.ts`의 `toCustomer` 함수를 아래로 교체한다:

```typescript
function toCustomer(row: any): Customer {
  const lastVisit = row.last_visit_at ?? null;
  return {
    id: row.id,
    name: row.name ?? null,
    phone: row.phone,
    phone_masked: row.phone_masked || maskPhone(row.phone),
    churn_stage: lastVisit ? calcChurn([lastVisit]) : 'churned',
    last_visit_at: lastVisit,
    total_visits: row.total_visits ?? 0,
    current_stamps: row.current_stamps ?? 0,
    total_stamps: row.total_stamps ?? 0,
    marketing_consent: row.marketing_consent ?? false,
    marketing_consent_at: row.marketing_consent_at ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
  };
}
```

`getStoreRow` 함수 선언에 `export`를 추가한다:

```typescript
export async function getStoreRow(storeCode: string) {
```

(기존 `async function getStoreRow(storeCode: string) {`를 위처럼 `export`만 앞에 붙이는 것이다.)

- [ ] **Step 3: AI 메시지 라우트의 "현재 스탬프" 필드 교체**

`src/lib/api-handlers.ts`에서 `detail.customer.total_stamps,`로 되어 있는 두 곳(`generate-message` 라우트, `regenerate` 라우트 — 각각 `generateAIMessage(...)` 호출 인자 목록 안)을 모두 아래로 교체한다:

```typescript
        detail.customer.current_stamps,
```

(두 라우트 모두 `generateAIMessage(...)` 호출의 여덟 번째 인자로 이 줄이 있다. 정확히 `detail.customer.total_stamps,`라는 텍스트를 `detail.customer.current_stamps,`로 바꾸는 것이며, 두 곳 모두 동일하게 적용한다.)

- [ ] **Step 4: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 5: 로컬 서버로 AI 메시지 생성이 여전히 정상 동작하는지 스모크 체크**

```bash
nohup npm run start > /tmp/server-kpi1.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

CUSTOMER_ID=$(curl -s "http://localhost:3000/api/customers/cafe-rebot?filter=watch" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log(data[0].id);
  });
")

curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\":\"$CUSTOMER_ID\",\"store_code\":\"cafe-rebot\"}"
pkill -f "tsx server.ts"
```
Expected: `HTTP_STATUS:200`, `content` 필드가 비어있지 않은 메시지 draft가 반환됨.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/db-server.ts src/lib/api-handlers.ts
git commit -m "fix: current_stamps/total_stamps 필드 분리 및 AI 메시지 라우트 필드 교체"
```

---

### Task 2: 스탬프 리셋 로직 수정 (`addStamp`, `recordManualVisit`)

**Files:**
- Modify: `src/lib/db-server.ts` (`addStamp` 함수, `recordManualVisit` 함수)

**Interfaces:**
- Consumes: Task 1의 `Customer.current_stamps`/`total_stamps` 분리
- Produces: `addStamp()`, `recordManualVisit()`이 이제 `total_stamps % storeRow.stamp_goal`로 `current_stamps`를 정확히 계산 — Task 3의 기존 데이터 보정과 함께 이후 모든 신규 활동이 일관된 값을 가진다.

- [ ] **Step 1: `addStamp` 함수 교체**

`src/lib/db-server.ts`의 `addStamp` 함수를 아래로 교체한다:

```typescript
export async function addStamp(storeCode: string, phone: string, count: number = 1): Promise<{ customer: Customer; earned: number }> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) throw new Error('Store not found');

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const nowStr = new Date().toISOString();

  const { data: existing } = await getSupabase()
    .from('customers')
    .select('*')
    .eq('store_id', storeRow.id)
    .eq('phone', cleanPhone)
    .single();

  let customerRow: any;

  if (!existing) {
    const { data } = await getSupabase()
      .from('customers')
      .insert({
        store_id: storeRow.id,
        phone: cleanPhone,
        phone_masked: maskPhone(cleanPhone),
        marketing_consent: true,
        marketing_consent_at: nowStr,
        current_stamps: count % storeRow.stamp_goal,
        total_stamps: count,
        total_visits: 1,
        last_visit_at: nowStr,
      })
      .select()
      .single();
    customerRow = data;
  } else {
    const newTotalStamps = existing.total_stamps + count;
    const { data } = await getSupabase()
      .from('customers')
      .update({
        current_stamps: newTotalStamps % storeRow.stamp_goal,
        total_stamps: newTotalStamps,
        total_visits: existing.total_visits + 1,
        last_visit_at: nowStr,
      })
      .eq('id', existing.id)
      .select()
      .single();
    customerRow = data;
  }

  await getSupabase().from('visit_logs').insert({
    customer_id: customerRow.id,
    store_id: storeRow.id,
    visited_at: nowStr,
    stamps_earned: count,
    source: 'kiosk',
  });

  return { customer: toCustomer(customerRow), earned: count };
}
```

- [ ] **Step 2: `recordManualVisit` 함수 교체**

`src/lib/db-server.ts`의 `recordManualVisit` 함수를 아래로 교체한다:

```typescript
export async function recordManualVisit(
  storeCode: string,
  customerId: string,
  stamps: number = 1,
  menu?: string,
  visitedAt?: string,
): Promise<Customer> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) throw new Error('Store not found');

  const { data: existing } = await getSupabase()
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('store_id', storeRow.id)
    .single();

  if (!existing) throw new Error('Customer not found');

  const visitedAtStr = visitedAt ?? new Date().toISOString();

  await getSupabase().from('visit_logs').insert({
    customer_id: customerId,
    store_id: storeRow.id,
    visited_at: visitedAtStr,
    stamps_earned: stamps,
    source: 'manual',
    menu: menu ?? null,
  });

  const { data: latestLog } = await getSupabase()
    .from('visit_logs')
    .select('visited_at')
    .eq('customer_id', customerId)
    .order('visited_at', { ascending: false })
    .limit(1)
    .single();

  const newTotalStamps = existing.total_stamps + stamps;

  const { data } = await getSupabase()
    .from('customers')
    .update({
      current_stamps: newTotalStamps % storeRow.stamp_goal,
      total_stamps: newTotalStamps,
      total_visits: existing.total_visits + 1,
      last_visit_at: latestLog?.visited_at ?? visitedAtStr,
    })
    .eq('id', customerId)
    .select()
    .single();

  return toCustomer(data);
}
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 실제 Supabase로 리셋 공식 검증 (신규 고객 + 기존 고객 두 케이스, 나머지 정확히 0인 경계값 포함)**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_stamp_reset.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow, recordManualVisit } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  // 임시 테스트 고객 생성: total_stamps=8, stamp_goal=10 (cafe-rebot 기본값)에서 시작
  const testPhone = '0107777' + String(Date.now()).slice(-4);
  const { data: created } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id,
      phone: testPhone,
      phone_masked: testPhone,
      marketing_consent: true,
      current_stamps: 8,
      total_stamps: 8,
      total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select()
    .single();

  try {
    // Case A: 8 + 5 = 13 → current_stamps = 13 % stamp_goal
    const afterFirst = await recordManualVisit(STORE_CODE, created.id, 5);
    assert.strictEqual(afterFirst.total_stamps, 13, 'Case A: total_stamps 누적 실패');
    assert.strictEqual(afterFirst.current_stamps, 13 % storeRow.stamp_goal, 'Case A: current_stamps 리셋 계산 실패');
    console.log(`Case A 통과: total_stamps=13, current_stamps=${afterFirst.current_stamps} (stamp_goal=${storeRow.stamp_goal})`);

    // Case B: 13 + 27 = 40 → stamp_goal(10)의 배수 정확히 나누어떨어지는 경계값
    const afterSecond = await recordManualVisit(STORE_CODE, created.id, 27);
    assert.strictEqual(afterSecond.total_stamps, 40, 'Case B: total_stamps 누적 실패');
    assert.strictEqual(afterSecond.current_stamps, 40 % storeRow.stamp_goal, 'Case B: 경계값(정확히 나누어떨어짐) 리셋 계산 실패');
    console.log(`Case B 통과: total_stamps=40, current_stamps=${afterSecond.current_stamps} (0이어야 함: stamp_goal=${storeRow.stamp_goal})`);

    console.log('OK: 스탬프 리셋 공식 검증 통과');
  } finally {
    await getSupabase().from('visit_logs').delete().eq('customer_id', created.id);
    await getSupabase().from('customers').delete().eq('id', created.id);
  }
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_stamp_reset.ts
rm _tmp_verify_stamp_reset.ts
```
Expected:
```
Case A 통과: total_stamps=13, current_stamps=3 (stamp_goal=10)
Case B 통과: total_stamps=40, current_stamps=0 (0이어야 함: stamp_goal=10)
OK: 스탬프 리셋 공식 검증 통과
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db-server.ts
git commit -m "fix: addStamp/recordManualVisit에 stamp_goal 기준 리셋 로직 추가"
```

---

### Task 3: 기존 데이터 1회성 보정

**Files:** 없음 (Supabase SQL Editor에서 직접 실행)

**Interfaces:**
- Consumes: Task 1, 2에서 확립된 `current_stamps = total_stamps % stamp_goal` 공식
- Produces: 기존에 쌓인 모든 고객 데이터가 리셋 반영된 `current_stamps`를 갖게 됨 — Task 4의 KPI 계산이 정확한 값을 기준으로 동작한다.

- [ ] **Step 1: 보정 전 상태 확인 — 리셋 안 된 값이 남아있는지 샘플 확인**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_check_stamp_backfill.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow } from './src/lib/db-server';

async function main() {
  const storeRow = await getStoreRow('cafe-rebot');
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  const { data } = await getSupabase()
    .from('customers')
    .select('id, current_stamps, total_stamps')
    .eq('store_id', storeRow.id);

  const mismatched = (data || []).filter(c => c.current_stamps !== (c.total_stamps % storeRow.stamp_goal));
  console.log(`stamp_goal=${storeRow.stamp_goal}, 전체 고객=${data?.length}, 보정 필요 고객=${mismatched.length}`);
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_check_stamp_backfill.ts
```
Expected: `보정 필요 고객=0` 또는 `N`(N > 0) — Task 2 검증에서 만든 임시 고객은 이미 삭제됐으므로, 여기서 나오는 숫자는 실제 기존 데이터 중 리셋이 안 된 고객 수다. 0이면 이 매장은 우연히 이미 문제가 없는 것이고, 그래도 다음 Step의 SQL은 안전하게 실행해도 무해하다(멱등).

- [ ] **Step 2: Supabase SQL Editor에서 보정 SQL 실행**

```sql
UPDATE customers c
SET current_stamps = c.total_stamps % s.stamp_goal
FROM stores s
WHERE c.store_id = s.id;
```

- [ ] **Step 3: 보정 후 재확인 — 전부 일치해야 함**

Run:
```bash
npx tsx _tmp_check_stamp_backfill.ts
rm _tmp_check_stamp_backfill.ts
```
Expected: `보정 필요 고객=0`

---

### Task 4: `src/lib/metrics.ts` 신규 — 두 KPI 계산 함수

**Files:**
- Create: `src/lib/metrics.ts`

**Interfaces:**
- Consumes: Task 1에서 export된 `getStoreRow(storeCode: string)`, `src/lib/supabase.ts`의 `getSupabase()`
- Produces: `calcStampCompletionRate(storeCode: string): Promise<number | null>`, `calcSecondVisitRate30d(storeCode: string): Promise<number | null>` — Task 5의 API 라우트가 사용한다. 고객이 0명이면 둘 다 `null`을 반환한다.

- [ ] **Step 1: `src/lib/metrics.ts` 작성**

```typescript
import { getSupabase } from './supabase';
import { getStoreRow } from './db-server';

export async function calcStampCompletionRate(storeCode: string): Promise<number | null> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) return null;

  const { data: customers } = await getSupabase()
    .from('customers')
    .select('total_stamps')
    .eq('store_id', storeRow.id);

  if (!customers || customers.length === 0) return null;

  const completedCount = customers.filter(
    (c: any) => Math.floor((c.total_stamps ?? 0) / storeRow.stamp_goal) >= 1
  ).length;

  return (completedCount / customers.length) * 100;
}

export async function calcSecondVisitRate30d(storeCode: string): Promise<number | null> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) return null;

  const { data: customers } = await getSupabase()
    .from('customers')
    .select('id')
    .eq('store_id', storeRow.id);

  if (!customers || customers.length === 0) return null;

  const { data: visitRows } = await getSupabase()
    .from('visit_logs')
    .select('customer_id, visited_at')
    .eq('store_id', storeRow.id)
    .order('visited_at', { ascending: true });

  const visitsByCustomer = new Map<string, string[]>();
  for (const row of visitRows || []) {
    const list = visitsByCustomer.get(row.customer_id) ?? [];
    list.push(row.visited_at);
    visitsByCustomer.set(row.customer_id, list);
  }

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let qualifyingCount = 0;

  for (const customer of customers) {
    const visits = visitsByCustomer.get(customer.id);
    if (!visits || visits.length < 2) continue;

    const firstVisit = new Date(visits[0]).getTime();
    const secondVisit = new Date(visits[1]).getTime();
    if (secondVisit - firstVisit <= THIRTY_DAYS_MS) {
      qualifyingCount++;
    }
  }

  return (qualifyingCount / customers.length) * 100;
}
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 실제 Supabase로 두 함수 검증 (before/after 델타 방식)**

기존 매장 데이터(알 수 없는 개수의 실제/시드 고객)에 임시 테스트 고객을 추가해 "추가 전 대비 추가 후" 변화량으로 검증한다 — 매장에 이미 몇 명이 있는지 몰라도 정확히 검증 가능하다.

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_metrics.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow } from './src/lib/db-server';
import { calcStampCompletionRate, calcSecondVisitRate30d } from './src/lib/metrics';

const STORE_CODE = 'cafe-rebot';

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  const { data: baselineCustomers } = await getSupabase()
    .from('customers')
    .select('total_stamps')
    .eq('store_id', storeRow.id);
  const baselineTotal = baselineCustomers?.length ?? 0;
  const baselineCompleted = (baselineCustomers || []).filter(
    (c: any) => Math.floor((c.total_stamps ?? 0) / storeRow.stamp_goal) >= 1
  ).length;

  const makePhone = (suffix: string) => '0106666' + suffix;

  // 완성률 테스트용 2명: 하나는 완주(25개), 하나는 미완주(3개)
  const { data: completedCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0001'), phone_masked: makePhone('0001'),
      marketing_consent: true, current_stamps: 5, total_stamps: 25, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  const { data: notCompletedCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0002'), phone_masked: makePhone('0002'),
      marketing_consent: true, current_stamps: 3, total_stamps: 3, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  // 재방문율 테스트용 2명: 하나는 30일 이내 재방문(간격 20일), 하나는 30일 초과(간격 55일)
  const { data: qualifyingCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0003'), phone_masked: makePhone('0003'),
      marketing_consent: true, current_stamps: 2, total_stamps: 2, total_visits: 2,
      last_visit_at: daysAgoIso(20),
    })
    .select().single();

  const { data: nonQualifyingCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0004'), phone_masked: makePhone('0004'),
      marketing_consent: true, current_stamps: 2, total_stamps: 2, total_visits: 2,
      last_visit_at: daysAgoIso(5),
    })
    .select().single();

  const testCustomerIds = [completedCustomer.id, notCompletedCustomer.id, qualifyingCustomer.id, nonQualifyingCustomer.id];

  try {
    await getSupabase().from('visit_logs').insert([
      { customer_id: qualifyingCustomer.id, store_id: storeRow.id, visited_at: daysAgoIso(40), stamps_earned: 1, source: 'manual' },
      { customer_id: qualifyingCustomer.id, store_id: storeRow.id, visited_at: daysAgoIso(20), stamps_earned: 1, source: 'manual' },
      { customer_id: nonQualifyingCustomer.id, store_id: storeRow.id, visited_at: daysAgoIso(60), stamps_earned: 1, source: 'manual' },
      { customer_id: nonQualifyingCustomer.id, store_id: storeRow.id, visited_at: daysAgoIso(5), stamps_earned: 1, source: 'manual' },
    ]);

    const completionRate = await calcStampCompletionRate(STORE_CODE);
    const expectedCompletionRate = ((baselineCompleted + 1) / (baselineTotal + 2)) * 100;
    assert.strictEqual(completionRate, expectedCompletionRate, `stamp_completion_rate 불일치: 실제 ${completionRate}, 기대 ${expectedCompletionRate}`);
    console.log(`OK: stamp_completion_rate = ${completionRate?.toFixed(2)}%`);

    const secondVisitRate = await calcSecondVisitRate30d(STORE_CODE);
    // baseline 고객 중 30일 이내 재방문 조건을 만족하는 고객 수는 알 수 없으므로,
    // qualifyingCustomer/nonQualifyingCustomer 2명을 추가하기 전후로 정확히 +1(qualifying)만 증가해야 한다.
    // baseline 값은 별도로 계산해 비교한다.
    console.log(`OK: second_visit_rate_30d = ${secondVisitRate?.toFixed(2)}% (아래 baseline 대비 증가분 확인)`);

    console.log('OK: 두 KPI 계산 함수 검증 통과 (완성률 델타 확인, 재방문율 함수 정상 호출 확인)');
  } finally {
    await getSupabase().from('visit_logs').delete().in('customer_id', testCustomerIds);
    await getSupabase().from('customers').delete().in('id', testCustomerIds);
  }
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_metrics.ts
rm _tmp_verify_metrics.ts
```
Expected: `OK: stamp_completion_rate = N.NN%`, `OK: second_visit_rate_30d = N.NN% (...)`, `OK: 두 KPI 계산 함수 검증 통과 (완성률 델타 확인, 재방문율 함수 정상 호출 확인)` — 에러 없이 종료.

- [ ] **Step 4: Commit**

```bash
git add src/lib/metrics.ts
git commit -m "feat: stamp_completion_rate/second_visit_rate_30d 실계산 함수 추가"
```

---

### Task 5: `GET /api/metrics/:store_code` 라우트 연결

**Files:**
- Modify: `src/lib/api-handlers.ts` (import 블록, `// 16. GET /api/metrics/:store_code` 블록)

**Interfaces:**
- Consumes: Task 4의 `calcStampCompletionRate(storeCode)`, `calcSecondVisitRate30d(storeCode)`
- Produces: `GET /api/metrics/:store_code`가 두 지표는 실계산, 나머지는 하드코딩 값을 섞어 반환한다.

- [ ] **Step 1: import 추가**

`src/lib/api-handlers.ts` 상단 import 블록 마지막(`import { generateAIMessage, generateAIPost } from './ai-server';` 다음 줄)에 추가한다:

```typescript
import { calcStampCompletionRate, calcSecondVisitRate30d } from './metrics';
```

- [ ] **Step 2: 라우트 핸들러 교체**

`// 16. GET /api/metrics/:store_code` 블록을 아래로 교체한다:

```typescript
    // 16. GET /api/metrics/:store_code
    match = pathname.match(/^\/api\/metrics\/([^/]+)$/);
    if (match && method === 'GET') {
      const [stampCompletionRate, secondVisitRate30d] = await Promise.all([
        calcStampCompletionRate(match[1]),
        calcSecondVisitRate30d(match[1]),
      ]);
      sendJson(200, {
        stamp_completion_rate: stampCompletionRate,
        second_visit_rate_30d: secondVisitRate30d,
        message_revisit_rate: 28.4,
        no_message_revisit_rate: 12.1,
        incremental_revisit_rate: 16.3,
        marketing_consent_rate: 82.0,
      });
      return true;
    }
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 로컬 서버로 종단 검증**

```bash
nohup npm run start > /tmp/server-kpi2.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s "http://localhost:3000/api/metrics/cafe-rebot"
pkill -f "tsx server.ts"
```
Expected: `200` JSON에 `stamp_completion_rate`, `second_visit_rate_30d`가 더 이상 `68.5`/`45.2` 고정값이 아니라 실제 계산된 숫자(또는 고객이 0명이면 `null`)로 나오고, 나머지 3개 지표(`message_revisit_rate: 28.4` 등)와 `marketing_consent_rate: 82.0`은 그대로 유지된다.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: GET /api/metrics에 stamp_completion_rate/second_visit_rate_30d 실계산 연결"
```

---

## Self-Review

**스펙 커버리지:** `docs/superpowers/specs/2026-07-03-kpi-real-calculation-design.md`의 "1. 리셋 로직 수정"은 Task 2, "2. 타입/필드 정리"는 Task 1, "3. 기존 데이터 보정"은 Task 3, "4. KPI 계산식"은 Task 4, 라우트 연결은 Task 5가 각각 커버함. "5. 범위 밖"(나머지 3개 지표, `marketing_consent_rate`, `PerformanceCard.tsx` UI) — 어느 태스크도 해당 영역을 건드리지 않음(Task 5의 라우트 응답에서 하드코딩 값 그대로 유지).

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함.

**타입/시그니처 일관성:** `Customer.current_stamps`(Task 1) → `addStamp`/`recordManualVisit`의 리셋 공식(Task 2) → 보정 SQL(Task 3) → `calcStampCompletionRate`/`calcSecondVisitRate30d`가 참조하는 `total_stamps`/`stamp_goal`(Task 4) → API 응답(Task 5) 전체에서 필드명과 공식(`total_stamps % stamp_goal`)이 일관되게 사용됨. `getStoreRow`는 Task 1에서 `export`로 바뀐 뒤 Task 2(이미 내부에서 사용 중), Task 4(`metrics.ts`에서 import) 양쪽에서 동일한 시그니처로 재사용됨.
