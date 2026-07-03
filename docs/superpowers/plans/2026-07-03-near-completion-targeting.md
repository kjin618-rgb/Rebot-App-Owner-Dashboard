# 쿠폰 달성 임박 타겟팅 (1차) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사장님이 매장 설정에서 완주 임박 임계값(%)을 설정하고, 고객 목록에서 "완주 임박" 탭으로 해당 고객만 조회할 수 있게 한다.

**Architecture:** `stores.near_completion_threshold` 컬럼을 추가하고 기존 `updateStore()`/`SettingsPage` 패턴을 그대로 확장한다. `getCustomers()`에 `current_stamps/stamp_goal >= threshold` 조건의 새 필터 분기를 추가하고, `CustomersPage`에 기존 탭 메커니즘을 재사용해 탭 하나만 늘린다.

**Tech Stack:** TypeScript, Supabase(PostgreSQL), 기존 `src/lib/*`/`src/App.tsx` 구조 재사용. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 생성/체크아웃된 `feat/near-completion-targeting`에서 계속 작업한다 (새 브랜치 생성 불필요).
- 테스트 프레임워크 없음 — 검증은 `node:assert` 기반 임시 스크립트(프로젝트 루트에 만들고 실행 후 삭제) 또는 실제 API `curl` 호출로 대체한다. `npm run lint`는 모든 코드 변경 태스크에서 공통으로 돌린다.
- 1차 스코프는 "임계값 설정 + 타겟팅 조회/표시"까지만 — 전용 메시지 문구/AI 프롬프트, 발송 플로우, 알림 자동화, 다단계 임계값은 만들지 않는다.
- 임계값은 매장당 단일 값(퍼센트 정수, 기본 80)이며 사장님이 설정 페이지에서 직접 설정한다.
- 완주 임박 조건: `(current_stamps / stamp_goal) * 100 >= near_completion_threshold`
- 이 프로젝트엔 마이그레이션 파일 시스템이 없다 — 스키마 변경은 Supabase 대시보드 SQL Editor에서 수동 실행한다.

---

### Task 1: `stores.near_completion_threshold` 컬럼 추가 + 타입/매퍼/업데이트 반영

**Files:**
- Modify: `src/types/index.ts` (`Store` interface)
- Modify: `src/lib/db-server.ts` (`toStore` 매퍼, `updateStore` 화이트리스트)

**Interfaces:**
- Produces: `Store.near_completion_threshold: number` — Task 2(설정 UI), Task 3(필터링 로직)이 사용한다.

- [ ] **Step 1: Supabase SQL Editor에서 컬럼 추가**

```sql
ALTER TABLE stores ADD COLUMN near_completion_threshold INT NOT NULL DEFAULT 80;
```

- [ ] **Step 2: 컬럼 존재 검증 — 실행 전이면 실패해야 함**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_threshold_column.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';

async function main() {
  const { data, error } = await getSupabase()
    .from('stores')
    .select('id, near_completion_threshold')
    .limit(1);

  assert.ok(!error, `near_completion_threshold 컬럼 조회 실패: ${error?.message}`);
  console.log('OK: stores.near_completion_threshold 컬럼 조회 성공', data);
}

main();
```

Run (Step 1을 아직 실행하지 않았다면):
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_threshold_column.ts
```
Expected (컬럼 추가 전): `AssertionError` — `column stores.near_completion_threshold does not exist` 계열 메시지.

- [ ] **Step 3: Step 1의 SQL을 실제로 실행한 뒤 재검증 — 통과해야 함**

Run:
```bash
npx tsx _tmp_verify_threshold_column.ts
rm _tmp_verify_threshold_column.ts
```
Expected:
```
OK: stores.near_completion_threshold 컬럼 조회 성공 [ { id: '...', near_completion_threshold: 80 } ]
```

- [ ] **Step 4: `Store` 타입에 필드 추가**

`src/types/index.ts`의 `Store` interface에서 `stamp_goal: number;` 다음 줄에 추가한다:

```typescript
  stamp_goal: number;
  near_completion_threshold: number;
  reward_desc: string;
```

- [ ] **Step 5: `toStore` 매퍼 반영**

`src/lib/db-server.ts`의 `toStore` 함수를 아래로 교체한다:

```typescript
function toStore(row: any): Store {
  return {
    store_code: row.store_code,
    store_name: row.store_name,
    owner_name: row.owner_name,
    stamp_goal: row.stamp_goal ?? 10,
    near_completion_threshold: row.near_completion_threshold ?? 80,
    reward_desc: row.reward_desc ?? '',
    brand_color: '#d97706',
    logo_url: null,
    message_signature: row.message_signature ?? '',
  };
}
```

- [ ] **Step 6: `updateStore` 화이트리스트에 필드 추가**

`src/lib/db-server.ts`의 `updateStore` 함수에서 아래 줄을 찾아:

```typescript
  if (settings.stamp_goal !== undefined) updates.stamp_goal = settings.stamp_goal;
```

바로 다음 줄에 추가한다:

```typescript
  if (settings.near_completion_threshold !== undefined) updates.near_completion_threshold = settings.near_completion_threshold;
```

- [ ] **Step 7: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 8: 실제 서버로 GET/PATCH 종단 검증**

```bash
nohup npm run start > /tmp/server-nct1.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s "http://localhost:3000/api/settings/cafe-rebot"
echo ""
curl -s -X PATCH "http://localhost:3000/api/settings/cafe-rebot" \
  -H "Content-Type: application/json" \
  -d '{"near_completion_threshold": 75}'
echo ""
curl -s "http://localhost:3000/api/settings/cafe-rebot"
echo ""
curl -s -X PATCH "http://localhost:3000/api/settings/cafe-rebot" \
  -H "Content-Type: application/json" \
  -d '{"near_completion_threshold": 80}'
pkill -f "tsx server.ts"
```
Expected: 첫 GET에 `near_completion_threshold: 80` 포함, PATCH 후 두 번째 GET에 `near_completion_threshold: 75`로 바뀜, 마지막 PATCH로 다시 `80`으로 원복.

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/lib/db-server.ts
git commit -m "feat: stores.near_completion_threshold 컬럼 추가 및 타입/매퍼/업데이트 반영"
```

---

### Task 2: 설정 페이지 UI — 완주 임박 알림 기준 입력 필드

**Files:**
- Modify: `src/App.tsx` (`SettingsPage` — state 추가, GET 초기값 세팅, PATCH body 반영, UI 입력 필드 추가)

**Interfaces:**
- Consumes: Task 1의 `PATCH /api/settings/:store_code` (body에 `near_completion_threshold` 지원)
- Produces: 없음 (UI 소비 지점)

- [ ] **Step 1: state 추가**

`src/App.tsx`의 `SettingsPage` 함수 상단, `stampGoal` state 선언 다음 줄에 추가한다:

```typescript
  const [stampGoal, setStampGoal] = useState(10);
  const [nearCompletionThreshold, setNearCompletionThreshold] = useState(80);
```

- [ ] **Step 2: GET 응답으로 초기값 세팅**

`useEffect` 안의 `.then(data => { ... })` 블록에서 `setStampGoal(data.stamp_goal);` 다음 줄에 추가한다:

```typescript
        setStampGoal(data.stamp_goal);
        setNearCompletionThreshold(data.near_completion_threshold);
```

- [ ] **Step 3: PATCH body에 반영**

`handleSubmit`의 `fetch(...)` body 안, `stamp_goal: stampGoal,` 다음 줄에 추가한다:

```typescript
        stamp_goal: stampGoal,
        near_completion_threshold: nearCompletionThreshold,
```

- [ ] **Step 4: UI 입력 필드 추가**

"목표 완성 스탬프 개수" `<select>`를 감싼 `<div>`(`</div>`로 닫히는 지점) 바로 다음, "스탬프 완성 혜택" `<div>` 이전에 추가한다:

```typescript
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-stone-500 uppercase">완주 임박 알림 기준 (%)</label>
          <input
            type="number"
            min="1"
            max="100"
            required
            value={nearCompletionThreshold}
            onChange={e => setNearCompletionThreshold(parseInt(e.target.value || '80'))}
            className="w-full text-sm px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
          />
          <p className="text-[11px] text-stone-400">스탬프를 이 비율(%) 이상 채운 고객을 "완주 임박"으로 분류합니다.</p>
        </div>
```

- [ ] **Step 5: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 설정 페이지에 완주 임박 알림 기준(%) 입력 필드 추가"
```

---

### Task 3: `getCustomers()`에 `near_completion` 필터 분기 추가

**Files:**
- Modify: `src/lib/db-server.ts` (`getCustomers` 함수)

**Interfaces:**
- Consumes: Task 1의 `Store.near_completion_threshold`, 기존 `Customer.current_stamps`/`stamp_goal`
- Produces: `getCustomers(storeCode, 'near_completion')`이 완주 임박 고객만 반환 — Task 5의 API 라우트/UI가 사용한다.

- [ ] **Step 1: 함수 교체**

`src/lib/db-server.ts`의 `getCustomers` 함수를 아래로 교체한다:

```typescript
export async function getCustomers(storeCode: string, filter: string = 'all'): Promise<Customer[]> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) return [];

  const { data } = await getSupabase()
    .from('customers')
    .select('*')
    .eq('store_id', storeRow.id)
    .order('created_at', { ascending: false });

  const customers = (data || []).map(toCustomer);

  if (filter === 'all') return customers;

  if (filter === 'near_completion') {
    return customers.filter(c => {
      const completionRatio = (c.current_stamps / storeRow.stamp_goal) * 100;
      return completionRatio >= storeRow.near_completion_threshold;
    });
  }

  return customers.filter(c => c.churn_stage === filter);
}
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 실제 Supabase로 필터링 검증 (임계값 이상/미만 두 케이스)**

`cafe-rebot`의 `stamp_goal`은 10, `near_completion_threshold`는 Task 1에서 80으로 설정되어 있다. 시드 고객은 전부 `current_stamps=1`(10% completion)이라 임계값에 안 걸리므로, 직접 임시 고객 2명을 만들어 검증한다.

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_near_completion.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow, getCustomers } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  const makePhone = (suffix: string) => '0105555' + suffix;

  // 90% 진행 (임계값 80% 이상 → 포함되어야 함)
  const { data: nearCompletionCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0001'), phone_masked: makePhone('0001'),
      marketing_consent: true, current_stamps: 9, total_stamps: 9, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  // 30% 진행 (임계값 미만 → 제외되어야 함)
  const { data: farFromCompletionCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0002'), phone_masked: makePhone('0002'),
      marketing_consent: true, current_stamps: 3, total_stamps: 3, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  const testIds = [nearCompletionCustomer.id, farFromCompletionCustomer.id];

  try {
    const nearCompletionList = await getCustomers(STORE_CODE, 'near_completion');
    const ids = nearCompletionList.map(c => c.id);

    assert.ok(ids.includes(nearCompletionCustomer.id), '90% 진행 고객이 near_completion 필터에서 누락됨');
    assert.ok(!ids.includes(farFromCompletionCustomer.id), '30% 진행 고객이 near_completion 필터에 잘못 포함됨');

    console.log('OK: near_completion 필터가 임계값 이상/미만을 정확히 구분함');
  } finally {
    await getSupabase().from('customers').delete().in('id', testIds);
  }
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_near_completion.ts
rm _tmp_verify_near_completion.ts
```
Expected: `OK: near_completion 필터가 임계값 이상/미만을 정확히 구분함`

- [ ] **Step 4: Commit**

```bash
git add src/lib/db-server.ts
git commit -m "feat: getCustomers에 near_completion 필터 분기 추가"
```

---

### Task 4: `CustomersPage`에 "완주 임박" 탭 추가

**Files:**
- Modify: `src/App.tsx` (`CustomersPage` — `activeTab` 타입, 탭 배열)

**Interfaces:**
- Consumes: Task 3의 `getCustomers(storeCode, 'near_completion')` (API 경유: `GET /api/customers/:store_code?filter=near_completion`)
- Produces: 없음 (UI 최종 소비 지점)

- [ ] **Step 1: `activeTab` 타입에 `'near_completion'` 추가**

`src/App.tsx`의 `CustomersPage`에서 아래 줄을:

```typescript
  const [activeTab, setActiveTab] = useState<'all' | 'watch' | 'danger' | 'churned'>('all');
```

아래로 교체한다:

```typescript
  const [activeTab, setActiveTab] = useState<'all' | 'watch' | 'danger' | 'churned' | 'near_completion'>('all');
```

- [ ] **Step 2: 탭 배열에 항목 추가**

아래 탭 배열을:

```typescript
          {[
            { id: 'all', label: '전체 고객' },
            { id: 'watch', label: '주의군 ⚠️' },
            { id: 'danger', label: '위험군 🚨' },
            { id: 'churned', label: '이탈 고객 📉' },
          ].map(tab => (
```

아래로 교체한다:

```typescript
          {[
            { id: 'all', label: '전체 고객' },
            { id: 'watch', label: '주의군 ⚠️' },
            { id: 'danger', label: '위험군 🚨' },
            { id: 'churned', label: '이탈 고객 📉' },
            { id: 'near_completion', label: '완주 임박 🎁' },
          ].map(tab => (
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 실제 서버로 종단 검증**

```bash
nohup npm run start > /tmp/server-nct2.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s "http://localhost:3000/api/customers/cafe-rebot?filter=near_completion" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log('near_completion 필터 결과 수:', data.length);
  });
"
pkill -f "tsx server.ts"
```
Expected: `near_completion 필터 결과 수: 0` (Task 3의 임시 테스트 고객은 이미 정리되어 삭제됨, 현재 실데이터 중 임계값을 넘는 고객이 없다면 0이 정상) — 에러 없이 요청이 처리되는 것이 핵심 확인 사항이다.

브라우저 육안 확인이 가능한 환경이라면(`run` 스킬 또는 Playwright): `/customers/cafe-rebot`에서 "완주 임박 🎁" 탭이 다른 탭들 옆에 보이고 클릭 시 정상 동작하는지 확인한다. 불가능한 환경이면 위 API 레벨 검증과 코드 리뷰로 대체한다 (이전 작업들과 같은 사유).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 고객 목록에 완주 임박 탭 추가"
```

---

## Self-Review

**스펙 커버리지:** `docs/superpowers/specs/2026-07-03-near-completion-targeting-design.md`의 "1. 스키마"/"2. 설정 API/UI"는 Task 1+2, "3. 타겟팅 조건"/"4. API"는 Task 3, "5. UI"는 Task 4가 각각 커버함. "6. 범위 밖"(전용 메시지/AI 프롬프트, 발송 플로우, 알림 자동화, 다단계 임계값) — 어느 태스크도 해당 영역을 건드리지 않음.

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함.

**타입/시그니처 일관성:** `Store.near_completion_threshold`(Task 1) → `SettingsPage` state/UI(Task 2) → `getCustomers()`의 필터 조건(Task 3) → `CustomersPage`의 `activeTab`/탭 배열(Task 4) 전체에서 필드명과 조건식(`current_stamps/stamp_goal*100 >= near_completion_threshold`)이 일관되게 사용됨. `'near_completion'` 필터 문자열이 Task 3(백엔드 분기)과 Task 4(프론트 탭 id) 양쪽에서 동일하게 사용됨.
