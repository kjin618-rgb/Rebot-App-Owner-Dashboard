# 고객 메모 필드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고객 상세 정보에 자유 텍스트 메모(최대 500자)를 저장·조회할 수 있게 하고, 고객 목록에는 메모 존재 여부만 아이콘으로 표시한다. AI 메시지 연동은 하지 않는다.

**Architecture:** `customers` 테이블에 `notes` 컬럼을 추가하고, 기존 `patchMessage`/`PATCH /api/messages/:id` 패턴을 그대로 재사용해 `updateCustomerNotes` 함수와 `PATCH /api/customers/:id` 라우트를 만든다. 프론트엔드는 `CustomerDetailPage`에 메모 카드를, `CustomerTable`에 아이콘 배지를 추가한다.

**Tech Stack:** TypeScript, Supabase(PostgreSQL), 기존 `src/lib/*` 구조 그대로 재사용. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 생성/체크아웃된 `feat/customer-notes`에서 계속 작업한다 (새 브랜치 생성 불필요).
- 이 프로젝트엔 테스트 프레임워크가 없다 — 검증은 `node:assert` 기반 임시 스크립트(프로젝트 루트에 만들고 실행 후 삭제) 또는 실제 API를 `curl`로 호출하는 방식으로 대체한다. `npm run lint`(`tsc --noEmit`)는 모든 코드 변경 태스크에서 공통으로 돌린다.
- 이번 스코프는 순수 CRM 메모만 — AI 프롬프트(`buildMessagePrompt`, `generateAIMessage`)에는 손대지 않는다.
- 메모는 자유 텍스트 하나, 500자 제한을 서버(400 응답)와 클라이언트(저장 버튼 비활성화) 양쪽에서 강제한다.
- 고객 목록(`CustomerTable`)에는 메모 존재 여부만 아이콘으로 표시하고, 메모 내용 자체는 노출하지 않는다.
- 이 프로젝트엔 마이그레이션 파일 시스템이 없다 — 스키마 변경은 Supabase 대시보드의 SQL Editor에서 수동으로 실행한다.

---

### Task 1: `customers` 테이블에 `notes` 컬럼 추가 + 타입/매퍼 반영

**Files:**
- Modify: `src/types/index.ts` (`Customer` interface)
- Modify: `src/lib/db-server.ts` (`toCustomer` 매퍼 함수, 약 20-33줄)

**Interfaces:**
- Produces: `Customer.notes: string | null` — Task 2, 4, 5가 사용한다.

- [ ] **Step 1: Supabase SQL Editor에서 컬럼 추가**

Supabase 대시보드 → 해당 프로젝트 → SQL Editor에서 아래 SQL을 실행한다:

```sql
ALTER TABLE customers ADD COLUMN notes TEXT NULL;
```

- [ ] **Step 2: 컬럼이 실제로 추가됐는지 검증 스크립트로 확인 — 실행 전이면 실패해야 함**

`/tmp/verify-notes-column.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from '/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/src/lib/supabase';

async function main() {
  const { data, error } = await getSupabase()
    .from('customers')
    .select('id, notes')
    .limit(1);

  assert.ok(!error, `notes 컬럼 조회 실패: ${error?.message}`);
  console.log('OK: customers.notes 컬럼 조회 성공', data);
}

main();
```

Run (Step 1을 아직 실행하지 않았다면):
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx /tmp/verify-notes-column.ts
```
Expected (컬럼 추가 전): `AssertionError` — `error.message`에 `column customers.notes does not exist` 계열 메시지가 포함된다.

- [ ] **Step 3: Step 1의 SQL을 Supabase SQL Editor에서 실제로 실행한 뒤, 검증 스크립트 재실행 — 통과해야 함**

Run:
```bash
npx tsx /tmp/verify-notes-column.ts
```
Expected:
```
OK: customers.notes 컬럼 조회 성공 [ { id: '...', notes: null } ]
```

- [ ] **Step 4: `Customer` 타입에 `notes` 필드 추가**

`src/types/index.ts`의 `Customer` interface에서 `marketing_consent_at` 다음 줄에 추가:

```typescript
  marketing_consent_at: string | null;
  notes: string | null;
  created_at: string;
```

(기존에 `marketing_consent_at: string | null;` 다음이 `created_at: string;`이었던 것을 위와 같이 그 사이에 삽입한다.)

- [ ] **Step 5: `toCustomer` 매퍼에 `notes` 반영**

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
    total_stamps: row.current_stamps ?? 0,
    marketing_consent: row.marketing_consent ?? false,
    marketing_consent_at: row.marketing_consent_at ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
  };
}
```

- [ ] **Step 6: 타입 체크**

Run:
```bash
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/db-server.ts
git commit -m "feat: customers.notes 컬럼 추가 및 Customer 타입/매퍼 반영"
```

---

### Task 2: `updateCustomerNotes` 함수 추가

**Files:**
- Modify: `src/lib/db-server.ts` (`patchMessage` 함수 바로 다음에 추가)

**Interfaces:**
- Consumes: `Customer.notes`(Task 1), 파일 내부의 기존 `getStoreRow(storeCode)` 헬퍼, `toCustomer(row)` 매퍼
- Produces: `updateCustomerNotes(storeCode: string, customerId: string, notes: string): Promise<Customer>` — 500자 초과 시 `Error`를 throw한다. Task 3이 사용한다.

- [ ] **Step 1: 함수 추가**

`src/lib/db-server.ts`의 `patchMessage` 함수(약 330-350줄) 바로 다음에 추가한다:

```typescript
export async function updateCustomerNotes(storeCode: string, customerId: string, notes: string): Promise<Customer> {
  if (notes.length > 500) {
    throw new Error('메모는 500자를 초과할 수 없습니다.');
  }

  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) throw new Error('Store not found');

  const { data } = await getSupabase()
    .from('customers')
    .update({ notes })
    .eq('id', customerId)
    .eq('store_id', storeRow.id)
    .select()
    .single();

  if (!data) throw new Error('Customer not found');
  return toCustomer(data);
}
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 실제 Supabase로 검증 (정상 저장 + 500자 초과 시 에러)**

`cafe-rebot`에는 이탈 4단계 시드 고객이 있다 (`docs/superpowers/plans/2026-07-03-seed-churn-data.md` 참고, 전화번호 접두사 `0109999`). 이 중 하나로 검증한다.

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_customer_notes.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getCustomers, updateCustomerNotes } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const customers = await getCustomers(STORE_CODE, 'safe');
  assert.ok(customers.length > 0, 'safe 단계 시드 고객이 없음 — npm run seed:churn을 먼저 실행하세요');
  const customerId = customers[0].id;

  const updated = await updateCustomerNotes(STORE_CODE, customerId, '단골, 아메리카노 선호');
  assert.strictEqual(updated.notes, '단골, 아메리카노 선호', '메모가 정상 저장되지 않음');

  const reverted = await updateCustomerNotes(STORE_CODE, customerId, '');
  assert.strictEqual(reverted.notes, '', '메모 원복(빈 문자열) 실패');

  let threw = false;
  try {
    await updateCustomerNotes(STORE_CODE, customerId, 'a'.repeat(501));
  } catch (e: any) {
    threw = true;
    assert.ok(e.message.includes('500자'), '500자 초과 에러 메시지 불일치');
  }
  assert.ok(threw, '501자 메모가 예외 없이 저장됨');

  console.log('OK: updateCustomerNotes 검증 통과 (저장/원복/500자 초과 예외 모두 확인)');
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_customer_notes.ts
rm _tmp_verify_customer_notes.ts
```
Expected: `OK: updateCustomerNotes 검증 통과 (저장/원복/500자 초과 예외 모두 확인)`, 이후 파일 삭제로 working tree에 남지 않음.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db-server.ts
git commit -m "feat: updateCustomerNotes 함수 추가 (500자 제한)"
```

---

### Task 3: `PATCH /api/customers/:id` 라우트 추가

**Files:**
- Modify: `src/lib/api-handlers.ts` (import 블록, 신규 라우트를 `// 5. GET /api/customers/:store_code/:id` 블록 다음에 추가)

**Interfaces:**
- Consumes: Task 2의 `updateCustomerNotes(storeCode, customerId, notes): Promise<Customer>`
- Produces: `PATCH /api/customers/:id` (body: `{ store_code: string, notes: string }`) → `200 Customer` 또는 `400`/`404` — Task 4의 UI가 호출한다.

- [ ] **Step 1: import 블록에 `updateCustomerNotes` 추가**

`src/lib/api-handlers.ts` 상단 import 중 `db-server`에서 가져오는 목록에 `updateCustomerNotes`를 추가한다 (`getMessageCustomerId,` 다음 줄):

```typescript
  getMessageCustomerId,
  updateCustomerNotes,
```

- [ ] **Step 2: 신규 라우트 추가**

`// 5. GET /api/customers/:store_code/:id` 블록(139줄에서 끝남) 바로 다음, `// 6. POST /api/visit/:store_code` 블록 이전에 추가한다:

```typescript
    // 5-1. PATCH /api/customers/:id
    match = pathname.match(/^\/api\/customers\/([^/]+)$/);
    if (match && method === 'PATCH') {
      const body = await getRequestBody(req);
      const { store_code, notes } = body;
      if (!store_code) { sendJson(400, { error: 'store_code is required' }); return true; }
      if (typeof notes !== 'string' || notes.length > 500) {
        sendJson(400, { error: 'notes must be a string of 500 characters or fewer' });
        return true;
      }
      try {
        const updated = await updateCustomerNotes(store_code, match[1], notes);
        sendJson(200, updated);
      } catch (err: any) {
        sendJson(404, { error: err.message });
      }
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
nohup npm run start > /tmp/server-notes.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'
```

```bash
CUSTOMER_ID=$(curl -s "http://localhost:3000/api/customers/cafe-rebot?filter=safe" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log(data[0].id);
  });
")
echo "CUSTOMER_ID=$CUSTOMER_ID"

curl -s -X PATCH "http://localhost:3000/api/customers/$CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d '{"store_code":"cafe-rebot","notes":"창가 자리 선호"}'
```
Expected: `200`, `{"id":"...", ..., "notes":"창가 자리 선호", ...}` 형태의 JSON.

500자 초과 검증:
```bash
LONG_NOTE=$(node -e "console.log('a'.repeat(501))")
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:3000/api/customers/$CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d "{\"store_code\":\"cafe-rebot\",\"notes\":\"$LONG_NOTE\"}"
```
Expected: `HTTP_STATUS:400`

원복(테스트로 남긴 메모 정리):
```bash
curl -s -X PATCH "http://localhost:3000/api/customers/$CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d '{"store_code":"cafe-rebot","notes":""}'
pkill -f "tsx server.ts"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: PATCH /api/customers/:id 라우트 추가 (메모 저장)"
```

---

### Task 4: 고객 상세 페이지에 메모 카드 추가

**Files:**
- Modify: `src/App.tsx` (`CustomerDetailPage` 컴포넌트 — state 추가, `handleSaveNotes` 핸들러 추가, "스탬프 수동 적립" 카드 다음에 메모 카드 추가)

**Interfaces:**
- Consumes: Task 3의 `PATCH /api/customers/:id`
- Produces: 없음 (UI 소비 지점)

- [ ] **Step 1: state 추가**

`src/App.tsx`의 `CustomerDetailPage` 함수 상단, 기존 state 선언부(약 384-390줄)를 아래로 교체한다:

```typescript
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Stamp input state
  const [stampCount, setStampCount] = useState(1);
  const [stampLoading, setStampLoading] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Notes state
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
```

- [ ] **Step 2: `detail` 로드 시 `noteText` 동기화하는 `useEffect` 추가**

기존 `useEffect(() => { loadDetail(); }, [store_code, id]);` 블록 바로 다음에 추가한다:

```typescript
  useEffect(() => {
    if (detail?.customer) {
      setNoteText(detail.customer.notes || '');
    }
  }, [detail]);
```

- [ ] **Step 3: `handleSaveNotes` 핸들러 추가**

`handleManualStamp` 함수(약 411-433줄) 바로 다음에 추가한다:

```typescript
  const handleSaveNotes = () => {
    setNoteSaving(true);
    fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_code, notes: noteText })
    })
      .then(res => res.json())
      .then(() => {
        setNoteSaving(false);
        setSuccessMsg('메모가 저장되었습니다.');
        loadDetail();
        setTimeout(() => setSuccessMsg(''), 3000);
      })
      .catch(err => {
        console.error(err);
        setNoteSaving(false);
      });
  };
```

- [ ] **Step 4: 메모 카드 UI 추가**

"스탬프 수동 적립" 카드가 끝나는 지점(`</div>` 다음 줄, 왼쪽 컬럼을 닫는 `</div>` 이전)에 추가한다. 정확히는 아래 코드에서 `{stampLoading ? '적립하는 중...' : '적립 완료'}` 버튼을 감싼 `</form>` `</div>` 다음이다:

```typescript
              </button>
            </form>
          </div>

          {/* Customer notes */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-stone-900 text-sm border-b border-stone-100 pb-2.5">메모</h3>
            <textarea
              rows={4}
              maxLength={500}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="고객에 대한 메모를 남겨보세요 (예: 선호 메뉴, 특이사항 등)"
              className="w-full text-sm p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed whitespace-pre-wrap"
            />
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${noteText.length > 500 ? 'text-red-600' : 'text-stone-400'}`}>
                {noteText.length} / 500자
              </span>
              <button
                onClick={handleSaveNotes}
                disabled={noteSaving || noteText.length > 500}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                {noteSaving ? '저장하는 중...' : '메모 저장'}
              </button>
            </div>
          </div>
        </div>
```

(마지막 `</div>`는 왼쪽 컬럼(`lg:col-span-4`)을 닫는 기존 태그이므로, 기존 코드의 중복된 `</div>`를 새로 추가하지 않도록 원본에서 해당 줄을 이 블록으로 교체하는 형태로 적용한다.)

- [ ] **Step 5: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 6: 실제 서버로 저장 흐름 재확인 (API 레벨)**

```bash
nohup npm run start > /tmp/server-notes2.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

CUSTOMER_ID=$(curl -s "http://localhost:3000/api/customers/cafe-rebot?filter=watch" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log(data[0].id);
  });
")

curl -s "http://localhost:3000/api/customers/cafe-rebot/$CUSTOMER_ID" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log('customer.notes 필드 존재:', 'notes' in data.customer);
  });
"
pkill -f "tsx server.ts"
```
Expected: `customer.notes 필드 존재: true` — `GET /api/customers/:store_code/:id` 응답에 `notes` 필드가 포함되어 UI가 초기값을 채울 수 있음을 확인.

브라우저 육안 확인이 가능한 환경이라면(`run` 스킬 또는 Playwright): `/customers/cafe-rebot/{CUSTOMER_ID}` 접속 → "메모" 카드에 textarea/글자수/저장 버튼이 보이는지, 입력 후 저장 시 성공 메시지가 뜨는지 확인한다. 불가능한 환경이면 위 API 레벨 검증과 코드 리뷰로 대체한다 (이전 AI 메시지 작업 때도 같은 사유로 대체함).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 고객 상세 페이지에 메모 카드 추가"
```

---

### Task 5: 고객 목록에 메모 존재 여부 배지 추가

**Files:**
- Modify: `src/components/CustomerTable.tsx` (import에 `StickyNote` 추가, 이름 표시 부분에 조건부 아이콘 추가)

**Interfaces:**
- Consumes: `CustomerRow.notes`(Task 1에서 `Customer`에 추가된 필드, `CustomerRow`는 `Customer`를 extend)
- Produces: 없음 (UI 최종 소비 지점)

- [ ] **Step 1: import에 `StickyNote` 아이콘 추가**

`src/components/CustomerTable.tsx` 상단을 아래로 교체한다:

```typescript
import React from 'react';
import { CustomerRow } from '../types';
import { CHURN_LABEL, CHURN_COLOR } from '../lib/churn';
import { User, Calendar, Check, X, StickyNote } from 'lucide-react';
```

- [ ] **Step 2: 이름 표시 부분에 메모 배지 추가**

아래 블록(약 44-49줄)을:

```typescript
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center font-bold text-xs border border-brand-100/50">
                      {customer.name ? customer.name[0] : '고'}
                    </div>
                    <span className="group-hover:text-brand-800 transition-colors">{customer.name || '미등록 고객'}</span>
                  </div>
```

아래로 교체한다:

```typescript
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center font-bold text-xs border border-brand-100/50">
                      {customer.name ? customer.name[0] : '고'}
                    </div>
                    <span className="group-hover:text-brand-800 transition-colors">{customer.name || '미등록 고객'}</span>
                    {customer.notes && (
                      <StickyNote className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="메모 있음" />
                    )}
                  </div>
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 실제 서버로 목록 API에 notes 필드가 포함되는지 확인**

```bash
nohup npm run start > /tmp/server-notes3.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s "http://localhost:3000/api/customers/cafe-rebot" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log('전체 고객 수:', data.length, '/ notes 필드 존재:', 'notes' in data[0]);
  });
"
pkill -f "tsx server.ts"
```
Expected: `전체 고객 수: N / notes 필드 존재: true`

브라우저 육안 확인이 가능한 환경이라면: `/customers/cafe-rebot` 목록에서 Task 4에서 메모를 저장했던 고객 이름 옆에 아이콘이 보이는지 확인한다.

- [ ] **Step 5: Commit**

```bash
git add src/components/CustomerTable.tsx
git commit -m "feat: 고객 목록에 메모 존재 여부 아이콘 배지 추가"
```

---

## Self-Review

**스펙 커버리지:** `docs/superpowers/specs/2026-07-03-customer-notes-design.md`의 "1. 스키마"는 Task 1, "2. API"는 Task 2+3, "3. UI"의 고객 상세 페이지는 Task 4, 고객 목록은 Task 5가 각각 커버함. "4. 범위 밖"(AI 프롬프트 연동, 구조화된 태그) — 어느 태스크도 `buildMessagePrompt`/`generateAIMessage`나 태그 UI를 건드리지 않음.

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함.

**타입/시그니처 일관성:** `Customer.notes: string | null`(Task 1) → `toCustomer` 매퍼(Task 1) → `updateCustomerNotes(storeCode, customerId, notes): Promise<Customer>`(Task 2) → API 라우트(Task 3) → UI(Task 4, 5) 전체에서 이름과 타입이 일관되게 사용됨. `CustomerRow`(Task 5에서 사용)는 `types/index.ts`에서 `interface CustomerRow extends Customer {}`로 정의되어 있어 Task 1에서 `Customer`에 추가한 `notes`가 자동으로 상속됨 — 별도 수정 불필요.
