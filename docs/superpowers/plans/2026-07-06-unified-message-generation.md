# 통일된 메시지 생성 로직 + 범용 벌크 발송 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완주 임박/이탈 메시지 생성 여부를 트리거 방식(상세페이지 개별 버튼 vs 벌크 선택)과 무관하게 서버의 단일 판단 함수가 결정하도록 통합하고, 체크박스 벌크 선택+생성 기능을 "완주 임박" 탭 전용에서 모든 고객 탭으로 확장한다.

**Architecture:** `src/lib/ai-server.ts`에 `decideMessageType`/`generateMessageForCustomer` 오케스트레이션 계층을 추가해 기존 `generateAIMessage`(이탈)/`generateNearCompletionMessage`(완주임박) 두 함수를 감싼다(둘 다 변경 없음). 개별 생성 API, 재생성 API, 벌크 API 세 곳 모두 이 오케스트레이션 함수를 호출하도록 교체한다. 프론트엔드는 체크박스 선택 UI의 탭 제한을 제거하고 문구를 범용화한다.

**Tech Stack:** TypeScript, Supabase(PostgreSQL), 기존 `src/lib/*`/`src/App.tsx` 구조 재사용. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 체크아웃된 `feat/near-completion-messaging`에서 계속 작업한다 (PR #14, 아직 `dev` 미병합 — 새 브랜치 생성 불필요).
- 테스트 프레임워크 없음 — 검증은 `node:assert` 기반 임시 스크립트(프로젝트 루트에 만들고 실행 후 삭제) 또는 실제 API `curl` 호출로 대체한다. `npm run lint`는 모든 코드 변경 태스크에서 공통 게이트로 사용한다.
- 브라우저 육안(Playwright) 검증은 샌드박스에 헤드리스 Chromium 의존 라이브러리가 없어 불가 — API/코드 레벨 검증으로 대체한다(이전 세션들과 동일한 사유, 사용자 승인됨).
- `generateAIMessage`, `buildMessagePrompt`, `generateNearCompletionMessage`, `buildNearCompletionMessagePrompt`는 이번 작업에서 내부 로직을 변경하지 않는다 — 오직 오케스트레이션 계층만 추가한다.
- "완주 임박이 이탈보다 우선"한다: 고객이 완주 임박 조건(`isNearCompletion`)을 만족하면 항상 `near_completion` 메시지를 생성한다.
- 재생성(`regenerate`)은 재생성 시점의 고객 최신 상태를 기준으로 매번 새로 판단한다 — 이전에 생성됐던 타입을 고정하지 않는다.
- `POST /api/generate-near-completion-messages`는 폐기하고 `POST /api/generate-messages/bulk`로 대체한다(하위호환 유지 불필요 — 프로덕션에 배포된 적 없음).
- "완주 임박 🎁" 필터 탭 자체(1차 작업분)는 변경하지 않는다 — 이번 작업은 그 탭에서만 벌크 가능하다는 제약만 제거한다.

---

### Task 1: `decideMessageType`/`generateMessageForCustomer` 오케스트레이션 함수 추가

**Files:**
- Modify: `src/lib/ai-server.ts` (신규 함수 추가, import 1줄 추가)

**Interfaces:**
- Produces: `decideMessageType(currentStamps: number, stampGoal: number, threshold: number): 'winback' | 'near_completion'`, `generateMessageForCustomer(customerName, churnStage, currentStamps, stampGoal, nearCompletionThreshold, rewardDesc, storeName, signature, totalVisits, daysSinceLastVisit): Promise<{ content: string; messageType: 'winback' | 'near_completion' }>` — Task 2, 3, 4가 사용한다.

- [ ] **Step 1: import에 `isNearCompletion` 추가**

`src/lib/ai-server.ts` 최상단의 아래 줄을:

```typescript
import { buildMessagePrompt, buildPostPrompt, buildNearCompletionMessagePrompt } from './prompts';
```

아래로 교체한다:

```typescript
import { buildMessagePrompt, buildPostPrompt, buildNearCompletionMessagePrompt } from './prompts';
import { isNearCompletion } from './db-server';
```

- [ ] **Step 2: 오케스트레이션 함수 추가**

`src/lib/ai-server.ts`의 `generateNearCompletionMessage` 함수 바로 다음(`return wrapWithComplianceNotice(storeName, body);\n}` 다음 줄, `generateAIPost` 함수 이전)에 추가한다:

```typescript
export function decideMessageType(currentStamps: number, stampGoal: number, threshold: number): 'winback' | 'near_completion' {
  return isNearCompletion(currentStamps, stampGoal, threshold) ? 'near_completion' : 'winback';
}

export async function generateMessageForCustomer(
  customerName: string | null,
  churnStage: string,
  currentStamps: number,
  stampGoal: number,
  nearCompletionThreshold: number,
  rewardDesc: string,
  storeName: string,
  signature: string,
  totalVisits: number,
  daysSinceLastVisit: number | null,
): Promise<{ content: string; messageType: 'winback' | 'near_completion' }> {
  const messageType = decideMessageType(currentStamps, stampGoal, nearCompletionThreshold);

  const content = messageType === 'near_completion'
    ? await generateNearCompletionMessage(customerName, currentStamps, stampGoal, rewardDesc, storeName, signature)
    : await generateAIMessage(customerName, churnStage, rewardDesc, storeName, signature, totalVisits, daysSinceLastVisit, currentStamps, stampGoal);

  return { content, messageType };
}
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 판단 로직 + 우선순위 검증 (API 키 없이 폴백 경로로 실행)**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_generate_for_customer.ts` 파일을 아래 내용으로 만든다:

```typescript
import assert from 'node:assert';

delete process.env.OPENROUTER_API_KEY;
delete process.env.GEMINI_API_KEY;

import { decideMessageType, generateMessageForCustomer } from './src/lib/ai-server';

async function main() {
  // 순수 판단 함수: 경계값
  assert.strictEqual(decideMessageType(8, 10, 80), 'near_completion', '80% == threshold(80)는 near_completion');
  assert.strictEqual(decideMessageType(7, 10, 80), 'winback', '70% < threshold(80)는 winback');

  // 우선순위: churn_stage가 'danger'(이탈 위험)여도 완주 임박 조건을 만족하면 near_completion이어야 함
  const nearCompletionResult = await generateMessageForCustomer(
    '홍길동', 'danger', 9, 10, 80, '음료 1잔 무료', '리봇 베이커리', '리봇 베이커리 사장 드림', 5, 45,
  );
  assert.strictEqual(nearCompletionResult.messageType, 'near_completion', '이탈+완주임박 동시 해당 시 near_completion이 우선해야 함');
  assert.ok(nearCompletionResult.content.includes('음료 1잔 무료'), '완주 임박 폴백 메시지에 리워드가 포함되어야 함');
  assert.ok(!nearCompletionResult.content.includes('이탈'), '완주 임박 메시지에 이탈 언급이 없어야 함');

  // 완주 임박 조건 미달 시 winback
  const winbackResult = await generateMessageForCustomer(
    '김철수', 'danger', 3, 10, 80, '음료 1잔 무료', '리봇 베이커리', '리봇 베이커리 사장 드림', 5, 45,
  );
  assert.strictEqual(winbackResult.messageType, 'winback', '완주 임박 미달 + danger는 winback이어야 함');

  console.log('OK: decideMessageType/generateMessageForCustomer 우선순위 검증 통과');
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_generate_for_customer.ts
rm _tmp_verify_generate_for_customer.ts
```
Expected: `OK: decideMessageType/generateMessageForCustomer 우선순위 검증 통과`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-server.ts
git commit -m "feat: 완주임박/이탈 메시지 통합 판단 함수(decideMessageType/generateMessageForCustomer) 추가"
```

---

### Task 2: `POST /api/generate-message`(개별 생성)가 통일 로직을 사용하도록 변경

**Files:**
- Modify: `src/lib/api-handlers.ts`

**Interfaces:**
- Consumes: Task 1의 `generateMessageForCustomer(...)`.

- [ ] **Step 1: import에 `generateMessageForCustomer` 추가 (기존 이름은 유지)**

`src/lib/api-handlers.ts`의 아래 줄을:

```typescript
import { generateAIMessage, generateAIPost, generateNearCompletionMessage } from './ai-server';
```

아래로 교체한다:

```typescript
import { generateAIMessage, generateAIPost, generateNearCompletionMessage, generateMessageForCustomer } from './ai-server';
```

**주의**: `generateAIMessage`는 아직 `POST /api/messages/:id/regenerate`(Task 3에서 교체 예정)가, `generateNearCompletionMessage`는 아직 벌크 엔드포인트(Task 4에서 교체 예정)가 각각 사용 중이므로 이번 태스크에서는 import에서 제거하지 않는다 — 추가만 한다. `generateAIMessage`/`generateNearCompletionMessage`를 import에서 실제로 제거하는 시점은 각각 Task 3/Task 4다(각 태스크 설명에 반영됨).

- [ ] **Step 2: `POST /api/generate-message` 핸들러 교체**

아래 블록을:

```typescript
      const content = await generateAIMessage(
        detail.customer.name,
        detail.customer.churn_stage,
        store.reward_desc,
        store.store_name,
        store.message_signature,
        detail.customer.total_visits,
        calcDaysSince(detail.customer.last_visit_at),
        detail.customer.current_stamps,
        store.stamp_goal,
      );
      const newMsg = await addMessageDraft(store_code, customer_id, content);
      sendJson(200, newMsg);
      return true;
    }

    // 8. GET /api/messages/:store_code
```

아래로 교체한다:

```typescript
      const { content, messageType } = await generateMessageForCustomer(
        detail.customer.name,
        detail.customer.churn_stage,
        detail.customer.current_stamps,
        store.stamp_goal,
        store.near_completion_threshold,
        store.reward_desc,
        store.store_name,
        store.message_signature,
        detail.customer.total_visits,
        calcDaysSince(detail.customer.last_visit_at),
      );
      const newMsg = await addMessageDraft(store_code, customer_id, content, messageType);
      sendJson(200, newMsg);
      return true;
    }

    // 8. GET /api/messages/:store_code
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 실제 서버로 종단 검증 — 완주 임박 고객으로 생성 시 message_type이 near_completion이어야 함**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_setup_gm_test_customer.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  const { data } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: '01066660001', phone_masked: '01066660001',
      marketing_consent: true, current_stamps: 9, total_stamps: 9, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  console.log('TEST_CUSTOMER_ID=' + data.id);
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_setup_gm_test_customer.ts
```
출력된 `TEST_CUSTOMER_ID` 값을 기록해둔다.

```bash
nohup npm run start > /tmp/server-um2.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s -X POST "http://localhost:3000/api/generate-message" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "<TEST_CUSTOMER_ID>", "store_code": "cafe-rebot"}'

pkill -9 -f server.ts
ps aux | grep server.ts | grep -v grep
```
(`<TEST_CUSTOMER_ID>`를 실제 값으로 치환한다.) `ps aux` 확인 결과 아무 출력도 없어야 서버가 완전히 종료된 것이다.

Expected: 응답 JSON의 `message_type` 필드가 `"near_completion"`.

정리 스크립트 `_tmp_cleanup_gm_test.ts` (`<TEST_CUSTOMER_ID>`를 실제 값으로 치환):
```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';

async function main() {
  const CUSTOMER_ID = '<TEST_CUSTOMER_ID>';
  await getSupabase().from('messages').delete().eq('customer_id', CUSTOMER_ID);
  await getSupabase().from('customers').delete().eq('id', CUSTOMER_ID);
  console.log('OK: 정리 완료');
}
main();
```
```bash
npx tsx _tmp_cleanup_gm_test.ts
rm _tmp_setup_gm_test_customer.ts _tmp_cleanup_gm_test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: 개별 메시지 생성 API가 완주임박/이탈 통합 판단 로직을 사용하도록 변경"
```

---

### Task 3: 재생성 API가 통일 로직을 사용하도록 변경 + `patchMessage`에 `message_type` 업데이트 지원 추가

**Files:**
- Modify: `src/lib/db-server.ts` (`patchMessage` 화이트리스트)
- Modify: `src/lib/api-handlers.ts` (`POST /api/messages/:id/regenerate`)

**Interfaces:**
- Consumes: Task 1의 `generateMessageForCustomer(...)`.
- Produces: `patchMessage(storeCode, id, { message_type })`가 `messages.message_type`을 갱신 — 이번 태스크의 재생성 핸들러가 사용한다.

- [ ] **Step 1: `patchMessage`에 `message_type` 필드 추가**

`src/lib/db-server.ts`의 `patchMessage` 함수에서 아래 줄을:

```typescript
  const dbUpdates: Record<string, any> = {};
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.sent_at !== undefined) dbUpdates.sent_at = updates.sent_at;
```

아래로 교체한다:

```typescript
  const dbUpdates: Record<string, any> = {};
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.sent_at !== undefined) dbUpdates.sent_at = updates.sent_at;
  if (updates.message_type !== undefined) dbUpdates.message_type = updates.message_type;
```

- [ ] **Step 2: 재생성 핸들러 교체**

`src/lib/api-handlers.ts`에서 아래 블록을:

```typescript
        const content = await generateAIMessage(
          detail.customer.name,
          detail.customer.churn_stage,
          store.reward_desc,
          store.store_name,
          store.message_signature,
          detail.customer.total_visits,
          calcDaysSince(detail.customer.last_visit_at),
          detail.customer.current_stamps,
          store.stamp_goal,
        );

        const updated = await patchMessage(store_code, messageId, { content });
```

아래로 교체한다:

```typescript
        const { content, messageType } = await generateMessageForCustomer(
          detail.customer.name,
          detail.customer.churn_stage,
          detail.customer.current_stamps,
          store.stamp_goal,
          store.near_completion_threshold,
          store.reward_desc,
          store.store_name,
          store.message_signature,
          detail.customer.total_visits,
          calcDaysSince(detail.customer.last_visit_at),
        );

        const updated = await patchMessage(store_code, messageId, { content, message_type: messageType });
```

- [ ] **Step 2-1: import에서 `generateAIMessage` 제거 (더 이상 사용처 없음)**

이 시점에서 `api-handlers.ts` 안에 `generateAIMessage(`를 호출하는 곳이 없는지 확인한다:

```bash
grep -n "generateAIMessage(" src/lib/api-handlers.ts
```
Expected: 아무 출력도 없어야 한다(Task 2가 개별 생성 핸들러를, 이번 Step 2가 재생성 핸들러를 각각 `generateMessageForCustomer`로 교체했으므로).

확인되면 import 줄을:

```typescript
import { generateAIMessage, generateAIPost, generateNearCompletionMessage, generateMessageForCustomer } from './ai-server';
```

아래로 교체한다:

```typescript
import { generateAIPost, generateNearCompletionMessage, generateMessageForCustomer } from './ai-server';
```

(`generateNearCompletionMessage`는 아직 벌크 엔드포인트가 사용 중이므로 유지 — Task 4에서 제거한다.)

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 실제 서버로 종단 검증 — winback으로 생성된 메시지를, 고객을 완주임박 상태로 바꾼 뒤 재생성하면 near_completion으로 바뀌어야 함**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_setup_regen_test.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  // 처음엔 완주 임박 미달 상태(30%)로 생성
  const { data: customer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: '01066660002', phone_masked: '01066660002',
      marketing_consent: true, current_stamps: 3, total_stamps: 3, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  console.log('TEST_CUSTOMER_ID=' + customer.id);
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_setup_regen_test.ts
```
출력된 `TEST_CUSTOMER_ID`를 기록해둔다.

```bash
nohup npm run start > /tmp/server-um3.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

# 1. 최초 생성 (30% 진행 → winback이어야 함)
curl -s -X POST "http://localhost:3000/api/generate-message" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "<TEST_CUSTOMER_ID>", "store_code": "cafe-rebot"}'
```
(`<TEST_CUSTOMER_ID>`를 실제 값으로 치환) Expected: `message_type: "winback"`, 응답의 `id`를 `MESSAGE_ID`로 기록.

```bash
pkill -9 -f server.ts
```

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_bump_to_near_completion.ts` 파일을 아래 내용으로 만든다(`<TEST_CUSTOMER_ID>`를 실제 값으로 치환):

```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';

async function main() {
  await getSupabase().from('customers').update({ current_stamps: 9, total_stamps: 9 }).eq('id', '<TEST_CUSTOMER_ID>');
  console.log('OK: 고객을 완주 임박 상태(9/10)로 변경함');
}
main();
```

```bash
npx tsx _tmp_bump_to_near_completion.ts

nohup npm run start > /tmp/server-um3b.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

# 2. 재생성 (이제 90% 진행 → near_completion으로 바뀌어야 함)
curl -s -X POST "http://localhost:3000/api/messages/<MESSAGE_ID>/regenerate" \
  -H "Content-Type: application/json" \
  -d '{"store_code": "cafe-rebot"}'

pkill -9 -f server.ts
ps aux | grep server.ts | grep -v grep
```
(`<MESSAGE_ID>`를 실제 값으로 치환) Expected: `message_type: "near_completion"` — 처음 생성 시(`winback`)와 다른 타입으로 바뀌어야 검증 통과. `ps aux` 확인 결과 아무 출력도 없어야 한다.

정리 스크립트 `_tmp_cleanup_regen_test.ts` (`<TEST_CUSTOMER_ID>`를 실제 값으로 치환):
```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';

async function main() {
  const CUSTOMER_ID = '<TEST_CUSTOMER_ID>';
  await getSupabase().from('messages').delete().eq('customer_id', CUSTOMER_ID);
  await getSupabase().from('customers').delete().eq('id', CUSTOMER_ID);
  console.log('OK: 정리 완료');
}
main();
```
```bash
npx tsx _tmp_cleanup_regen_test.ts
rm _tmp_setup_regen_test.ts _tmp_bump_to_near_completion.ts _tmp_cleanup_regen_test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db-server.ts src/lib/api-handlers.ts
git commit -m "feat: patchMessage에 message_type 업데이트 지원 추가, 재생성 API가 통합 판단 로직 사용"
```

---

### Task 4: 벌크 API를 `/api/generate-messages/bulk`로 범용화

**Files:**
- Modify: `src/lib/api-handlers.ts`

**Interfaces:**
- Consumes: Task 1의 `generateMessageForCustomer(...)`.
- Produces: `POST /api/generate-messages/bulk` — Task 5(프론트엔드)가 호출한다. `POST /api/generate-near-completion-messages`는 삭제됨.

- [ ] **Step 1: 기존 완주 임박 전용 벌크 라우트를 범용 라우트로 교체**

`src/lib/api-handlers.ts`에서 아래 블록 전체를(주석 번호 `17.`부터 해당 `if` 블록 끝까지):

```typescript
    // 17. POST /api/generate-near-completion-messages
    match = pathname.match(/^\/api\/generate-near-completion-messages$/);
    if (match && method === 'POST') {
      const body = await getRequestBody(req);
      const { store_code, customer_ids } = body;
      if (!store_code || !Array.isArray(customer_ids) || customer_ids.length === 0) {
        sendJson(400, { error: 'store_code and non-empty customer_ids array are required' });
        return true;
      }

      const store = await getStore(store_code);
      let generated = 0;
      let skipped_no_consent = 0;

      // AI 공급자 요청이 순간적으로 몰리지 않도록 순차 처리한다.
      for (const customerId of customer_ids) {
        const detail = await getCustomerById(store_code, customerId);
        if (!detail) continue;
        if (!detail.customer.marketing_consent) {
          skipped_no_consent++;
          continue;
        }

        const content = await generateNearCompletionMessage(
          detail.customer.name,
          detail.customer.current_stamps,
          store.stamp_goal,
          store.reward_desc,
          store.store_name,
          store.message_signature,
        );
        await addMessageDraft(store_code, customerId, content, 'near_completion');
        generated++;
      }

      sendJson(200, { generated, skipped_no_consent });
      return true;
    }
```

아래로 교체한다:

```typescript
    // 17. POST /api/generate-messages/bulk
    match = pathname.match(/^\/api\/generate-messages\/bulk$/);
    if (match && method === 'POST') {
      const body = await getRequestBody(req);
      const { store_code, customer_ids } = body;
      if (!store_code || !Array.isArray(customer_ids) || customer_ids.length === 0) {
        sendJson(400, { error: 'store_code and non-empty customer_ids array are required' });
        return true;
      }

      const store = await getStore(store_code);
      let generated = 0;
      let skipped_no_consent = 0;

      // AI 공급자 요청이 순간적으로 몰리지 않도록 순차 처리한다.
      for (const customerId of customer_ids) {
        const detail = await getCustomerById(store_code, customerId);
        if (!detail) continue;
        if (!detail.customer.marketing_consent) {
          skipped_no_consent++;
          continue;
        }

        const { content, messageType } = await generateMessageForCustomer(
          detail.customer.name,
          detail.customer.churn_stage,
          detail.customer.current_stamps,
          store.stamp_goal,
          store.near_completion_threshold,
          store.reward_desc,
          store.store_name,
          store.message_signature,
          detail.customer.total_visits,
          calcDaysSince(detail.customer.last_visit_at),
        );
        await addMessageDraft(store_code, customerId, content, messageType);
        generated++;
      }

      sendJson(200, { generated, skipped_no_consent });
      return true;
    }
```

- [ ] **Step 1-1: import에서 `generateNearCompletionMessage` 제거 (더 이상 사용처 없음)**

이 시점에서 `api-handlers.ts` 안에 `generateNearCompletionMessage(`를 호출하는 곳이 없는지 확인한다:

```bash
grep -n "generateNearCompletionMessage(" src/lib/api-handlers.ts
```
Expected: 아무 출력도 없어야 한다(방금 교체한 벌크 핸들러가 마지막 사용처였음).

확인되면 import 줄을:

```typescript
import { generateAIPost, generateNearCompletionMessage, generateMessageForCustomer } from './ai-server';
```

아래로 교체한다:

```typescript
import { generateAIPost, generateMessageForCustomer } from './ai-server';
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 실제 서버로 종단 검증 — 완주임박 고객 1명 + 이탈(danger) 고객 1명을 같은 벌크 요청에 섞어서 검증**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_setup_bulk_v2_test.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

  // 완주 임박(90%), 최근 방문 → near_completion 예상
  const { data: nearCompletionCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: '01066660003', phone_masked: '01066660003',
      marketing_consent: true, current_stamps: 9, total_stamps: 9, total_visits: 3,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  // 완주 임박 미달(20%) + 이탈 위험(45일 전 방문) → winback 예상
  const { data: churnCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: '01066660004', phone_masked: '01066660004',
      marketing_consent: true, current_stamps: 2, total_stamps: 5, total_visits: 2,
      last_visit_at: fortyFiveDaysAgo,
    })
    .select().single();

  console.log('NEAR_COMPLETION_ID=' + nearCompletionCustomer.id);
  console.log('CHURN_ID=' + churnCustomer.id);
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_setup_bulk_v2_test.ts
```
출력된 두 ID를 기록해둔다.

```bash
nohup npm run start > /tmp/server-um4.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s -X POST "http://localhost:3000/api/generate-messages/bulk" \
  -H "Content-Type: application/json" \
  -d '{"store_code": "cafe-rebot", "customer_ids": ["<NEAR_COMPLETION_ID>", "<CHURN_ID>"]}'

pkill -9 -f server.ts
ps aux | grep server.ts | grep -v grep
```
(두 ID를 실제 값으로 치환) Expected: `{"generated":2,"skipped_no_consent":0}`. `ps aux` 확인 결과 아무 출력도 없어야 한다.

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_cleanup_bulk_v2.ts` 파일을 아래 내용으로 만든다(두 ID를 실제 값으로 치환):

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';

const NEAR_COMPLETION_ID = '<NEAR_COMPLETION_ID>';
const CHURN_ID = '<CHURN_ID>';

async function main() {
  const { data: nearMsgs } = await getSupabase().from('messages').select('*').eq('customer_id', NEAR_COMPLETION_ID);
  assert.strictEqual(nearMsgs?.length, 1, '완주임박 고객에게 메시지 1건 생성되어야 함');
  assert.strictEqual(nearMsgs![0].message_type, 'near_completion', '완주임박 고객은 near_completion 타입이어야 함');

  const { data: churnMsgs } = await getSupabase().from('messages').select('*').eq('customer_id', CHURN_ID);
  assert.strictEqual(churnMsgs?.length, 1, '이탈 고객에게 메시지 1건 생성되어야 함');
  assert.strictEqual(churnMsgs![0].message_type, 'winback', '이탈 고객은 winback 타입이어야 함');

  console.log('OK: 벌크 API가 고객별로 올바른 message_type을 부여함');

  await getSupabase().from('messages').delete().in('customer_id', [NEAR_COMPLETION_ID, CHURN_ID]);
  await getSupabase().from('customers').delete().in('id', [NEAR_COMPLETION_ID, CHURN_ID]);
  console.log('OK: 테스트 데이터 정리 완료');
}

main();
```

Run:
```bash
npx tsx _tmp_verify_cleanup_bulk_v2.ts
rm _tmp_setup_bulk_v2_test.ts _tmp_verify_cleanup_bulk_v2.ts
```
Expected: `OK: 벌크 API가 고객별로 올바른 message_type을 부여함`, `OK: 테스트 데이터 정리 완료`

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: 벌크 메시지 생성 API를 완주임박 전용에서 범용(/api/generate-messages/bulk)으로 교체"
```

---

### Task 5: 체크박스 선택 UI를 모든 탭으로 확장 + 벌크 API 엔드포인트/문구 갱신

**Files:**
- Modify: `src/App.tsx` (`CustomersPage`)

**Interfaces:**
- Consumes: Task 4의 `POST /api/generate-messages/bulk`.

- [ ] **Step 1: `CustomerTable`에 전달하는 `selectable` 조건 제거**

`src/App.tsx`에서 아래 줄을:

```typescript
          selectable={activeTab === 'near_completion'}
```

아래로 교체한다:

```typescript
          selectable={true}
```

- [ ] **Step 2: 액션 바 노출 조건에서 탭 제한 제거**

아래 줄을:

```typescript
      {activeTab === 'near_completion' && selectedIds.size > 0 && (
```

아래로 교체한다:

```typescript
      {selectedIds.size > 0 && (
```

- [ ] **Step 3: 액션 바 버튼 문구를 범용화**

아래 줄을:

```typescript
              `선택한 ${selectedIds.size}명에게 완주 임박 메시지 초안 일괄 생성`
```

아래로 교체한다:

```typescript
              `선택한 ${selectedIds.size}명에게 메시지 초안 일괄 생성`
```

- [ ] **Step 4: `handleBulkGenerate`의 fetch URL과 완료 토스트 문구 갱신**

아래 블록을:

```typescript
  const handleBulkGenerate = () => {
    setBulkGenerating(true);
    fetch('/api/generate-near-completion-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_code, customer_ids: Array.from(selectedIds) })
    })
      .then(res => res.json())
      .then(result => {
        setBulkGenerating(false);
        setSelectedIds(new Set());
        const skippedNote = result.skipped_no_consent > 0
          ? ` (${result.skipped_no_consent}건은 마케팅 미동의로 제외)`
          : '';
        setBulkResultMsg(`완주 임박 메시지 초안 ${result.generated}건 생성 완료${skippedNote}`);
        setTimeout(() => setBulkResultMsg(''), 4000);
      })
      .catch(err => {
        console.error(err);
        setBulkGenerating(false);
      });
  };
```

아래로 교체한다:

```typescript
  const handleBulkGenerate = () => {
    setBulkGenerating(true);
    fetch('/api/generate-messages/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_code, customer_ids: Array.from(selectedIds) })
    })
      .then(res => res.json())
      .then(result => {
        setBulkGenerating(false);
        setSelectedIds(new Set());
        const skippedNote = result.skipped_no_consent > 0
          ? ` (${result.skipped_no_consent}건은 마케팅 미동의로 제외)`
          : '';
        setBulkResultMsg(`메시지 초안 ${result.generated}건 생성 완료${skippedNote}`);
        setTimeout(() => setBulkResultMsg(''), 4000);
      })
      .catch(err => {
        console.error(err);
        setBulkGenerating(false);
      });
  };
```

- [ ] **Step 5: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 6: 코드 리뷰 기반 확인 (브라우저 육안 검증 불가 환경)**

아래 항목을 코드 상에서 직접 확인한다:
- `CustomerTable`이 이제 모든 탭에서 `selectable={true}`로 호출되는지 (더 이상 `activeTab` 조건이 없는지)
- "완주 임박 🎁" 탭 자체(필터 목록, `getCustomers`의 `near_completion` 분기)는 이 태스크에서 손대지 않았는지 — `grep -n "near_completion" src/App.tsx`로 필터 탭 정의(`{ id: 'near_completion', label: '완주 임박 🎁' }`)가 그대로 남아있는지 확인

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 체크박스 선택+벌크 생성을 완주 임박 탭 전용에서 모든 탭으로 확장"
```

---

### Task 6: 고객 상세페이지 버튼/토스트 문구 통일

**Files:**
- Modify: `src/App.tsx` (`CustomerDetailPage`)

**Interfaces:**
- 없음 (UI 최종 소비 지점, 문구만 변경).

- [ ] **Step 1: 성공 토스트 문구 변경**

`src/App.tsx`에서 아래 줄을:

```typescript
        setSuccessMsg('AI 기반 개인맞춤 혜택 복귀 제안 메시지가 신규 생성되었습니다! 메시지 발송 패널에서 확인하세요.');
```

아래로 교체한다:

```typescript
        setSuccessMsg('고객 맞춤 메시지가 생성되었습니다. 메시지 발송 패널에서 확인하세요.');
```

- [ ] **Step 2: 버튼 라벨 변경**

아래 줄을:

```typescript
                AI 맞춤 복귀 제안 생성
```

아래로 교체한다:

```typescript
                고객 맞춤 메시지 생성
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 문구 변경이 실제로 반영됐는지 grep으로 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -n "고객 맞춤 메시지 생성\|고객 맞춤 메시지가 생성되었습니다" src/App.tsx
grep -n "AI 맞춤 복귀 제안 생성\|AI 기반 개인맞춤 혜택 복귀 제안" src/App.tsx
```
Expected: 첫 번째 명령은 두 줄을 출력하고(버튼 라벨 + 토스트 문구), 두 번째 명령은 아무것도 출력하지 않아야 한다(옛 문구가 완전히 제거됨).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 고객 상세페이지 메시지 생성 버튼/토스트 문구를 '고객 맞춤 메시지 생성'으로 통일"
```

---

## Self-Review

**스펙 커버리지:**
- `docs/superpowers/specs/2026-07-06-unified-message-generation-design.md`의 "1. 통일된 메시지 생성 판단 로직" → Task 1.
- "2. 기존 API들이 통일 로직을 사용하도록 변경"(개별 생성/재생성/`patchMessage`) → Task 2, Task 3.
- "3. 범용 벌크 API" → Task 4.
- "4. 체크박스 선택 UI를 모든 탭으로 확장" → Task 5.
- "5. 상세페이지 버튼/토스트 문구 통일" → Task 6.
- "범위 밖"(폴백 체인 중복 제거, AI 조건 입력 기능, 메시지 학습 저장 기능, 완주 임박 필터 탭 변경) — 어느 태스크도 해당 영역을 건드리지 않음.

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함. 검증 스크립트 안의 `<TEST_CUSTOMER_ID>` 등은 각 단계에서 "실제 값으로 치환"이라고 명시된 런타임 값이지 플레이스홀더가 아니다.

**타입/시그니처 일관성:** `generateMessageForCustomer(...)`(Task 1)의 파라미터 순서(`customerName, churnStage, currentStamps, stampGoal, nearCompletionThreshold, rewardDesc, storeName, signature, totalVisits, daysSinceLastVisit`)와 반환 타입 `{ content, messageType }`가 Task 2(개별 생성), Task 3(재생성), Task 4(벌크) 세 호출부 모두에서 동일하게 사용됨. `addMessageDraft(..., messageType)`(2차 작업에서 이미 구현됨)와 `patchMessage(..., { content, message_type: messageType })`(Task 3에서 신규 지원)의 필드명이 정확히 일치함. `POST /api/generate-messages/bulk`(Task 4가 만든 엔드포인트)와 Task 5의 `fetch('/api/generate-messages/bulk', ...)` 호출 URL이 일치함.

## 다음 단계

이 계획을 승인하면 `subagent-driven-development` 또는 `executing-plans` 스킬로 태스크별 구현을 시작한다.
