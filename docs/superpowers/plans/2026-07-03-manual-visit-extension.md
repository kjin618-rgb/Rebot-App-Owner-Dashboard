# 방문 등록 메뉴/날짜 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "스탬프 수동 적립" 폼에 메뉴(자유텍스트)와 방문 날짜(소급 입력 가능) 입력을 추가하고, 소급 입력해도 고객의 `last_visit_at`(이탈단계 계산 기준)이 왜곡되지 않도록 재계산 로직을 도입한다.

**Architecture:** `visit_logs`에 `menu` 컬럼을 추가하고, `recordManualVisit()`이 `visited_at`을 받아 그 날짜로 기록한 뒤 해당 고객의 `visit_logs` 전체에서 최신 `visited_at`을 다시 조회해 `customers.last_visit_at`을 갱신하도록 바꾼다(무조건 `now()` 덮어쓰기 제거). API와 UI는 이 변경을 그대로 통과시킨다.

**Tech Stack:** TypeScript, Supabase(PostgreSQL), 기존 `src/lib/*` 구조 재사용. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 생성/체크아웃된 `feat/manual-visit-extension`에서 계속 작업한다 (새 브랜치 생성 불필요).
- 테스트 프레임워크 없음 — 검증은 `node:assert` 기반 임시 스크립트(프로젝트 루트에 만들고 실행 후 삭제) 또는 실제 API `curl` 호출로 대체한다. `npm run lint`는 모든 코드 변경 태스크에서 공통으로 돌린다.
- 메뉴는 자유 텍스트, 메뉴 마스터 관리 기능은 만들지 않는다.
- 방문 날짜는 소급 입력을 지원하며, `last_visit_at`은 `visit_logs` 전체 중 최신 `visited_at`으로 재계산한다 (사용자 확정).
- `total_visits`/`current_stamps`/`total_stamps`는 소급 입력이어도 지금처럼 호출할 때마다 증가시킨다 (사용자 확정).
- 이 프로젝트엔 마이그레이션 파일 시스템이 없다 — 스키마 변경은 Supabase 대시보드 SQL Editor에서 수동 실행한다.
- AI 메시지 프롬프트, 메뉴 마스터 관리, 메뉴 통계는 범위 밖 — 건드리지 않는다.

---

### Task 1: `visit_logs`에 `menu` 컬럼 추가 + 타입/매퍼 반영

**Files:**
- Modify: `src/types/index.ts` (`VisitLog` interface)
- Modify: `src/lib/db-server.ts` (`toVisitLog` 매퍼 함수)

**Interfaces:**
- Produces: `VisitLog.menu: string | null` — Task 2(insert), Task 4(UI 표시)가 사용한다.

- [ ] **Step 1: Supabase SQL Editor에서 컬럼 추가**

Supabase 대시보드 → 해당 프로젝트 → SQL Editor에서 실행:

```sql
ALTER TABLE visit_logs ADD COLUMN menu TEXT NULL;
```

- [ ] **Step 2: 컬럼 존재 검증 — 실행 전이면 실패해야 함**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_menu_column.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';

async function main() {
  const { data, error } = await getSupabase()
    .from('visit_logs')
    .select('id, menu')
    .limit(1);

  assert.ok(!error, `menu 컬럼 조회 실패: ${error?.message}`);
  console.log('OK: visit_logs.menu 컬럼 조회 성공', data);
}

main();
```

Run (Step 1을 아직 실행하지 않았다면):
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_menu_column.ts
```
Expected (컬럼 추가 전): `AssertionError` — `column visit_logs.menu does not exist` 계열 메시지.

- [ ] **Step 3: Step 1의 SQL을 실제로 실행한 뒤 재검증 — 통과해야 함**

Run:
```bash
npx tsx _tmp_verify_menu_column.ts
rm _tmp_verify_menu_column.ts
```
Expected:
```
OK: visit_logs.menu 컬럼 조회 성공 [ { id: '...', menu: null } ]
```

- [ ] **Step 4: `VisitLog` 타입에 `menu` 추가**

`src/types/index.ts`의 `VisitLog` interface를 아래로 교체한다:

```typescript
export interface VisitLog {
  id: string;
  customer_id: string;
  occurred_at: string;
  stamps_earned: number;
  menu: string | null;
}
```

- [ ] **Step 5: `toVisitLog` 매퍼에 `menu` 반영**

`src/lib/db-server.ts`의 `toVisitLog` 함수를 아래로 교체한다:

```typescript
function toVisitLog(row: any): VisitLog {
  return {
    id: row.id,
    customer_id: row.customer_id,
    occurred_at: row.visited_at ?? row.created_at,
    stamps_earned: row.stamps_earned ?? 1,
    menu: row.menu ?? null,
  };
}
```

- [ ] **Step 6: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/db-server.ts
git commit -m "feat: visit_logs.menu 컬럼 추가 및 VisitLog 타입/매퍼 반영"
```

---

### Task 2: `recordManualVisit` 확장 — 메뉴/소급 날짜 + `last_visit_at` 재계산

**Files:**
- Modify: `src/lib/db-server.ts` (`recordManualVisit` 함수, 약 237-272줄)

**Interfaces:**
- Consumes: `VisitLog.menu`(Task 1), 파일 내부 기존 `getSupabase()`, `toCustomer(row)`
- Produces: `recordManualVisit(storeCode: string, customerId: string, stamps?: number, menu?: string, visitedAt?: string): Promise<Customer>` — Task 3이 사용한다.

- [ ] **Step 1: 함수 전체 교체**

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

  const { data } = await getSupabase()
    .from('customers')
    .update({
      current_stamps: existing.current_stamps + stamps,
      total_stamps: existing.total_stamps + stamps,
      total_visits: existing.total_visits + 1,
      last_visit_at: latestLog?.visited_at ?? visitedAtStr,
    })
    .eq('id', customerId)
    .select()
    .single();

  return toCustomer(data);
}
```

- [ ] **Step 2: 타입 체크 (호출부는 아직 옛 시그니처 — 인자 개수는 선택 인자라 에러 없어야 함)**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0) — `menu`/`visitedAt`이 선택 인자(`?`)이므로 기존 3-인자 호출부(`api-handlers.ts`)도 그대로 컴파일된다.

- [ ] **Step 3: 실제 Supabase로 `last_visit_at` 재계산 로직 검증 (핵심)**

`cafe-rebot`의 danger 단계 시드 고객(전화번호 접두사 `0109999`, `docs/superpowers/plans/2026-07-03-seed-churn-data.md` 참고)을 사용한다. danger 단계는 `last_visit_at`이 35~50일 전으로 시딩되어 있어, "더 과거"와 "더 최근" 두 케이스를 모두 명확히 검증할 수 있다.

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_manual_visit.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getCustomers, recordManualVisit } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const dangerCustomers = await getCustomers(STORE_CODE, 'danger');
  assert.ok(dangerCustomers.length > 0, 'danger 단계 시드 고객이 없음 — npm run seed:churn을 먼저 실행하세요');
  const customer = dangerCustomers[0];
  const originalLastVisit = customer.last_visit_at as string;
  console.log('시작 시점 last_visit_at:', originalLastVisit);

  // Case A: 기존 last_visit_at보다 더 과거인 날짜를 소급 입력 → last_visit_at은 그대로여야 함
  const olderDate = new Date(new Date(originalLastVisit).getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const afterOlder = await recordManualVisit(STORE_CODE, customer.id, 1, '아메리카노', olderDate);
  assert.strictEqual(afterOlder.last_visit_at, originalLastVisit, 'Case A 실패: 더 과거 소급 입력인데 last_visit_at이 바뀜');
  console.log('Case A 통과: 더 과거 소급 입력 후에도 last_visit_at 유지됨');

  // Case B: 기존 last_visit_at보다 더 최근인 날짜를 입력 → last_visit_at이 그 값으로 갱신되어야 함
  const newerDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const afterNewer = await recordManualVisit(STORE_CODE, customer.id, 1, '소금빵', newerDate);
  assert.strictEqual(afterNewer.last_visit_at, newerDate, 'Case B 실패: 더 최근 날짜 입력인데 last_visit_at이 갱신 안 됨');
  console.log('Case B 통과: 더 최근 날짜 입력 시 last_visit_at 갱신됨');

  console.log('OK: recordManualVisit last_visit_at 재계산 로직 검증 통과');
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_manual_visit.ts
rm _tmp_verify_manual_visit.ts
```
Expected:
```
시작 시점 last_visit_at: ...
Case A 통과: 더 과거 소급 입력 후에도 last_visit_at 유지됨
Case B 통과: 더 최근 날짜 입력 시 last_visit_at 갱신됨
OK: recordManualVisit last_visit_at 재계산 로직 검증 통과
```

> 참고: 이 테스트는 대상 고객의 `total_visits`/`current_stamps`/`total_stamps`를 2회분(+2) 증가시킨 채로 남긴다. 스탬프 수치 자체는 이 기능 검증과 무관하고 시드 데이터 특성상 실사용에 영향 없으므로 별도 원복은 하지 않는다.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db-server.ts
git commit -m "feat: recordManualVisit에 메뉴/소급날짜 지원 및 last_visit_at 재계산 로직 추가"
```

---

### Task 3: `POST /api/visit/:store_code` API 확장

**Files:**
- Modify: `src/lib/api-handlers.ts` (`// 6. POST /api/visit/:store_code` 블록, 약 161-174줄)

**Interfaces:**
- Consumes: Task 2의 `recordManualVisit(storeCode, customerId, stamps?, menu?, visitedAt?): Promise<Customer>`
- Produces: `POST /api/visit/:store_code` body `{ customer_id, stamps?, menu?, visited_at? }` → `200 Customer` — Task 4의 UI가 호출한다.

- [ ] **Step 1: 라우트 핸들러 교체**

`src/lib/api-handlers.ts`의 `// 6. POST /api/visit/:store_code` 블록을 아래로 교체한다:

```typescript
    // 6. POST /api/visit/:store_code
    match = pathname.match(/^\/api\/visit\/([^/]+)$/);
    if (match && method === 'POST') {
      const body = await getRequestBody(req);
      const { customer_id, stamps, menu, visited_at } = body;
      if (!customer_id) { sendJson(400, { error: 'customer_id is required' }); return true; }
      try {
        const customer = await recordManualVisit(match[1], customer_id, parseInt(stamps || '1'), menu, visited_at);
        sendJson(200, customer);
      } catch (err: any) {
        sendJson(404, { error: err.message });
      }
      return true;
    }
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 로컬 서버로 종단 검증**

```bash
nohup npm run start > /tmp/server-visit.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'
```

```bash
CUSTOMER_ID=$(curl -s "http://localhost:3000/api/customers/cafe-rebot?filter=watch" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log(data[0].id);
  });
")
echo "CUSTOMER_ID=$CUSTOMER_ID"

curl -s -X POST "http://localhost:3000/api/visit/cafe-rebot" \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\":\"$CUSTOMER_ID\",\"stamps\":1,\"menu\":\"카페라떼\",\"visited_at\":\"2026-06-01T12:00:00.000Z\"}"
```
Expected: `200`, JSON에 `total_visits`가 증가된 `Customer` 객체가 반환된다 (이 API는 `Customer`를 반환하므로 `menu`는 응답에 직접 보이지 않음 — 저장 확인은 Task 4에서 `GET .../:id`의 `visit_logs`로 한다).

```bash
pkill -f "tsx server.ts"
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: POST /api/visit/:store_code에 menu/visited_at 파라미터 추가"
```

---

### Task 4: UI — 폼에 메뉴/날짜 입력 추가 + 방문 이력에 메뉴 표시

**Files:**
- Modify: `src/App.tsx` (`CustomerDetailPage` — state 추가, `handleManualStamp` 확장, 폼에 필드 추가, 방문 이력 로그에 메뉴 표시)

**Interfaces:**
- Consumes: Task 3의 `POST /api/visit/:store_code` (body에 `menu`, `visited_at` 추가 지원)
- Produces: 없음 (UI 최종 소비 지점)

- [ ] **Step 1: state 추가**

`src/App.tsx`의 `CustomerDetailPage` 함수 상단, `stampLoading` state 선언 다음 줄에 추가한다:

```typescript
  const [stampCount, setStampCount] = useState(1);
  const [stampLoading, setStampLoading] = useState(false);
  const [menuInput, setMenuInput] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
```

(`stampCount`, `stampLoading` 두 줄은 기존 코드 그대로이며, 그 다음에 `menuInput`/`visitDate` 두 줄을 새로 추가하는 것이다.)

- [ ] **Step 2: `handleManualStamp`에 메뉴/날짜 반영**

`handleManualStamp` 함수를 아래로 교체한다:

```typescript
  const handleManualStamp = (e: React.FormEvent) => {
    e.preventDefault();
    setStampLoading(true);
    fetch(`/api/visit/${store_code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: id,
        stamps: stampCount,
        menu: menuInput || undefined,
        visited_at: new Date(`${visitDate}T12:00:00`).toISOString(),
      })
    })
      .then(res => res.json())
      .then(() => {
        setSuccessMsg(`성공적으로 스탬프 ${stampCount}개가 추가 적립되었습니다.`);
        setStampLoading(false);
        setStampCount(1);
        setMenuInput('');
        setVisitDate(new Date().toISOString().slice(0, 10));
        loadDetail();
        setTimeout(() => setSuccessMsg(''), 3000);
      })
      .catch(err => {
        console.error(err);
        setStampLoading(false);
      });
  };
```

- [ ] **Step 3: 폼에 메뉴/날짜 입력 필드 추가**

"스탬프 수동 적립" 폼의 `<form onSubmit={handleManualStamp} className="space-y-3">` 내부, 스탬프 개수 입력 `<div>` 다음, 제출 버튼 이전에 아래 두 블록을 추가한다:

```typescript
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-stone-400">적립할 스탬프 개수</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={stampCount}
                  onChange={e => setStampCount(parseInt(e.target.value || '1'))}
                  className="w-full text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-stone-400">메뉴 (선택)</label>
                <input
                  type="text"
                  value={menuInput}
                  onChange={e => setMenuInput(e.target.value)}
                  placeholder="예: 아메리카노, 소금빵"
                  className="w-full text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-stone-400">방문 날짜</label>
                <input
                  type="date"
                  required
                  value={visitDate}
                  onChange={e => setVisitDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full text-sm px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={stampLoading}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                {stampLoading ? '적립하는 중...' : '적립 완료'}
              </button>
```

(기존의 스탬프 개수 `<div>`와 제출 `<button>`은 그대로 두고, 그 사이에 메뉴/날짜 두 `<div>`를 새로 삽입하는 형태다. `max` 속성으로 미래 날짜 선택은 막는다.)

- [ ] **Step 4: 방문 이력 로그에 메뉴 표시**

방문 이력을 렌더링하는 블록을 아래로 교체한다:

```typescript
                  {detail.visit_logs.map((log: any) => (
                    <div key={log.id} className="p-3 bg-stone-50 hover:bg-stone-100/50 border border-stone-100 rounded-xl flex justify-between items-center text-xs">
                      <span className="text-stone-600 font-medium">
                        스탬프 적립 방문{log.menu ? ` · ${log.menu}` : ''}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-amber-600 font-mono">+{log.stamps_earned} 스탬프</span>
                        <span className="text-stone-400 font-mono">{new Date(log.occurred_at).toLocaleString('ko-KR')}</span>
                      </div>
                    </div>
                  ))}
```

- [ ] **Step 5: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 6: 실제 서버로 저장→표시 흐름 확인 (API 레벨)**

```bash
nohup npm run start > /tmp/server-visit2.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

CUSTOMER_ID=$(curl -s "http://localhost:3000/api/customers/cafe-rebot?filter=safe" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log(data[0].id);
  });
")

curl -s -X POST "http://localhost:3000/api/visit/cafe-rebot" \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\":\"$CUSTOMER_ID\",\"stamps\":1,\"menu\":\"바닐라라떼\",\"visited_at\":\"$(date -u +%Y-%m-%dT12:00:00.000Z)\"}" > /dev/null

curl -s "http://localhost:3000/api/customers/cafe-rebot/$CUSTOMER_ID" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    const latest = data.visit_logs[0];
    console.log('최신 방문 로그 menu:', latest.menu);
  });
"
pkill -f "tsx server.ts"
```
Expected: `최신 방문 로그 menu: 바닐라라떼`

브라우저 육안 확인이 가능한 환경이라면(`run` 스킬 또는 Playwright): `/customers/cafe-rebot/{CUSTOMER_ID}` 접속 → 폼에 메뉴/날짜 입력란이 보이는지, 제출 후 방문 이력에 "스탬프 적립 방문 · 바닐라라떼"처럼 표시되는지 확인한다. 불가능한 환경이면 위 API 레벨 검증과 코드 리뷰로 대체한다 (이전 작업들과 같은 사유).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 스탬프 수동 적립 폼에 메뉴/방문날짜 입력 및 이력 표시 추가"
```

---

## Self-Review

**스펙 커버리지:** `docs/superpowers/specs/2026-07-03-manual-visit-extension-design.md`의 "1. 스키마"는 Task 1, "2. API"는 Task 3, "3. recordManualVisit 로직 변경"은 Task 2, "4. UI"는 Task 4가 각각 커버함. "5. 범위 밖"(메뉴 마스터, AI 연동, 통계, 페어 레포) — 어느 태스크도 해당 영역을 건드리지 않음. 스펙에 명시되지 않았지만 계획에 추가한 "방문 이력에 메뉴 표시"(Task 4 Step 4)는 "기록해놓고 안 보여주면 의미가 없다"는 취지로 포함했다.

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함.

**타입/시그니처 일관성:** `VisitLog.menu: string | null`(Task 1) → `toVisitLog` 매퍼(Task 1) → `recordManualVisit(storeCode, customerId, stamps?, menu?, visitedAt?)`(Task 2) → API 라우트(Task 3) → UI(Task 4) 전체에서 이름과 타입이 일관되게 사용됨. `last_visit_at` 재계산은 Task 2에서 `visit_logs` 최신값 조회 → `customers` 업데이트로 한 곳에만 존재하며, Task 3/4는 이를 그대로 통과시키기만 한다(중복 로직 없음).
