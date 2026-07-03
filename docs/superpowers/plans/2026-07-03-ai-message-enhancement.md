# AI 메시지 고도화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 재방문 메시지 생성 프롬프트에 실제 방문데이터(총방문수/경과일수/스탬프현황)와 기획서 작성기준을 반영하고, 이미 만들어진 초안을 새로 재생성(덮어쓰기)할 수 있는 기능을 추가한다.

**Architecture:** `src/lib/prompts.ts`의 프롬프트 빌더에 방문데이터 파라미터를 추가하고, `src/lib/ai-server.ts` → `src/lib/api-handlers.ts` 순으로 시그니처를 확장해 기존 초안 생성 경로(`POST /api/generate-message`)와 신규 재생성 경로(`POST /api/messages/:id/regenerate`)가 동일한 프롬프트 빌더를 공유하도록 한다. 재생성은 새 row를 만들지 않고 `patchMessage()`로 기존 draft의 `content`만 교체한다.

**Tech Stack:** TypeScript, 기존 `src/lib/*` 구조 그대로 재사용. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 생성/체크아웃된 `feat/ai-message-v2`에서 계속 작업한다 (새 브랜치 생성 불필요).
- 이 프로젝트엔 테스트 프레임워크(jest/vitest)가 없다 — 검증은 `node:assert` 기반 임시 스크립트(`tsx`로 실행, 커밋 대상 아님) 또는 실제 API를 `curl`로 호출하는 방식으로 대체한다. `npm run lint`(`tsc --noEmit`)는 모든 코드 변경 태스크에서 공통으로 돌린다.
- 프롬프트 템플릿 문구는 `docs/superpowers/specs/2026-07-03-ai-message-enhancement-design.md`에서 사용자가 이미 검토·승인한 문구를 그대로 사용한다 — 임의로 문구를 바꾸지 않는다.
- `daysSinceLastVisit`이 `null`이면 프롬프트의 "마지막 방문: N일 전" 줄을 통째로 생략한다.
- 재생성은 새 `messages` row를 insert하지 않고, 기존 row의 `content`만 `patchMessage()`로 교체한다.
- 범위 밖(건드리지 않음): 마케팅 동의 차단 로직, 30일 재발송 경고, `generateAIPost`/SNS 콘텐츠 생성, `getFallbackMessage`/`getFallbackPost`의 폴백 템플릿 내용.

---

### Task 1: 프롬프트 빌더에 방문데이터 파라미터 추가

**Files:**
- Modify: `src/lib/prompts.ts` (`buildMessagePrompt` 함수 전체)

**Interfaces:**
- Produces: `buildMessagePrompt(customerName: string, churnStage: string, rewardDesc: string, storeName: string, signature: string, totalVisits: number, daysSinceLastVisit: number | null, currentStamps: number, stampGoal: number): string` — Task 2에서 이 시그니처 그대로 호출한다.

- [ ] **Step 1: 검증 스크립트를 현재(수정 전) 코드로 먼저 실행 — 실패해야 함**

`/tmp/verify-prompt.ts` 파일을 아래 내용으로 만든다:

```typescript
import { buildMessagePrompt } from '/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/src/lib/prompts';
import assert from 'node:assert';

const withVisit = (buildMessagePrompt as any)('홍길동', 'danger', '아메리카노 1잔 무료', '리봇 카페', '리봇 카페 드림', 5, 40, 3, 10);
assert.ok(withVisit.includes('총 방문 횟수: 5회'), '총 방문 횟수 문구 누락');
assert.ok(withVisit.includes('마지막 방문: 40일 전'), '마지막 방문 문구 누락');
assert.ok(withVisit.includes('현재 스탬프: 3/10개'), '스탬프 현황 문구 누락');
assert.ok(withVisit.includes('메뉴명이나 결제 금액을 직접 언급하지'), '작성 규칙(메뉴/금액 금지) 누락');

const noVisit = (buildMessagePrompt as any)('홍길동', 'safe', '아메리카노 1잔 무료', '리봇 카페', '리봇 카페 드림', 0, null, 0, 10);
assert.ok(!noVisit.includes('마지막 방문:'), 'daysSinceLastVisit이 null일 때도 마지막 방문 줄이 남아있음');

console.log('OK: buildMessagePrompt 검증 통과');
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx /tmp/verify-prompt.ts
```
Expected: `AssertionError` — 현재 `buildMessagePrompt`는 5개 인자만 받고 방문데이터 문구를 전혀 포함하지 않으므로 `총 방문 횟수: 5회` 관련 assert에서 실패한다.

- [ ] **Step 2: `buildMessagePrompt` 구현 교체**

`src/lib/prompts.ts`의 `buildMessagePrompt` 함수 전체를 아래로 교체한다 (파일 상단의 `buildPostPrompt`는 변경하지 않음):

```typescript
export function buildMessagePrompt(
  customerName: string,
  churnStage: string,
  rewardDesc: string,
  storeName: string,
  signature: string,
  totalVisits: number,
  daysSinceLastVisit: number | null,
  currentStamps: number,
  stampGoal: number,
): string {
  const lastVisitLine = daysSinceLastVisit !== null
    ? `\n- 마지막 방문: ${daysSinceLastVisit}일 전`
    : '';

  return `당신은 카페/베이커리 매장 "${storeName}"을 운영하는 사장님입니다.
아래 고객 정보를 참고해 이 고객에게 보낼 재방문 유도 메시지를 작성해주세요.

[고객 정보]
- 이름: ${customerName}
- 이탈 단계: ${churnStage} (safe: 최근 방문, watch: 관심 필요, danger: 이탈 위험, churned: 장기 미방문)
- 총 방문 횟수: ${totalVisits}회${lastVisitLine}
- 현재 스탬프: ${currentStamps}/${stampGoal}개
- 매장 리워드: ${rewardDesc}

[작성 규칙 — 반드시 지킬 것]
1. 한국어 존댓말, 사장님이 직접 안부를 묻는 듯한 자연스러운 톤으로 작성한다.
2. 전체 분량은 2~3문장 이내로 작성한다 (카카오 알림톡 발송을 고려).
3. 특정 메뉴명이나 결제 금액을 직접 언급하지 않는다.
4. 과도한 친밀감이나 "감시받는 느낌"을 주는 표현(예: 방문 횟수를 지적하는 뉘앙스)은 피한다.
5. 마지막은 매장명 또는 아래 서명으로 마무리한다: "${signature}"

메시지 본문만 반환하세요 (따옴표나 설명 없이).`;
}
```

- [ ] **Step 3: 검증 스크립트 재실행 — 이번엔 통과해야 함**

Run:
```bash
npx tsx /tmp/verify-prompt.ts
```
Expected:
```
OK: buildMessagePrompt 검증 통과
```

- [ ] **Step 4: 타입 체크**

Run:
```bash
npm run lint
```
Expected: 에러 없이 종료 (exit code 0). `ai-server.ts`가 아직 옛 시그니처로 호출 중이라 여기서 타입 에러가 날 수 있음 — 그 경우 Task 2에서 해결되므로 지금은 `buildMessagePrompt` 자체의 문법 에러만 없으면 넘어간다.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat: buildMessagePrompt에 방문데이터 파라미터 및 기획서 작성기준 반영"
```

---

### Task 2: `generateAIMessage` 시그니처 확장

**Files:**
- Modify: `src/lib/ai-server.ts` (`generateAIMessage` 함수 시그니처와 `buildMessagePrompt` 호출부만 — `getFallbackMessage`, `generateAIPost`, `getFallbackPost`는 변경하지 않음)

**Interfaces:**
- Consumes: Task 1의 `buildMessagePrompt(customerName, churnStage, rewardDesc, storeName, signature, totalVisits, daysSinceLastVisit, currentStamps, stampGoal): string`
- Produces: `generateAIMessage(customerName: string, churnStage: string, rewardDesc: string, storeName: string, signature: string, totalVisits: number, daysSinceLastVisit: number | null, currentStamps: number, stampGoal: number): Promise<string>` — Task 4에서 이 시그니처로 호출한다.

- [ ] **Step 1: 타입 체크로 미수정 상태 확인 — 실패해야 함**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: `src/lib/ai-server.ts`에서 `buildMessagePrompt` 호출 시 인자 개수 불일치(`Expected 9 arguments, but got 5`) 타입 에러 발생.

- [ ] **Step 2: `generateAIMessage` 시그니처 및 호출부 수정**

`src/lib/ai-server.ts`에서 아래 함수 선언부와 `buildMessagePrompt` 호출 라인을 교체한다:

```typescript
export async function generateAIMessage(
  customerName: string,
  churnStage: string,
  rewardDesc: string,
  storeName: string,
  signature: string,
  totalVisits: number,
  daysSinceLastVisit: number | null,
  currentStamps: number,
  stampGoal: number,
): Promise<string> {
  const prompt = buildMessagePrompt(
    customerName, churnStage, rewardDesc, storeName, signature,
    totalVisits, daysSinceLastVisit, currentStamps, stampGoal,
  );
```

(바로 아래 이어지는 OpenRouter/Gemini/폴백 호출 로직 3줄은 `prompt` 변수를 그대로 사용하므로 변경하지 않는다.)

- [ ] **Step 3: 타입 체크 재실행 — 통과해야 함**

Run:
```bash
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 폴백 경로로 런타임 스모크 체크**

`/tmp/verify-ai-server.ts` 파일을 아래 내용으로 만든다 (API 키가 없거나 잘못된 상태를 가정해 폴백 템플릿 경로를 태운다):

```typescript
import { generateAIMessage } from '/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/src/lib/ai-server';
import assert from 'node:assert';

async function main() {
  const result = await generateAIMessage(
    '홍길동', 'danger', '아메리카노 1잔 무료', '리봇 카페', '리봇 카페 드림',
    5, 40, 3, 10,
  );
  assert.ok(typeof result === 'string' && result.length > 0, 'generateAIMessage가 빈 문자열 또는 비-문자열을 반환함');
  console.log('OK: generateAIMessage 9개 인자로 정상 호출됨 (반환 길이:', result.length, ')');
}

main();
```

Run:
```bash
npx tsx /tmp/verify-ai-server.ts
```
Expected: `OK: generateAIMessage 9개 인자로 정상 호출됨 (반환 길이: N )` — 에러 없이 문자열 반환 (OpenRouter/Gemini 키가 없으면 자동으로 `getFallbackMessage` 폴백 경로를 타므로 네트워크 실패와 무관하게 통과해야 함).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-server.ts
git commit -m "feat: generateAIMessage에 방문데이터 파라미터 전달"
```

---

### Task 3: `getMessageCustomerId` 조회 함수 추가

**Files:**
- Modify: `src/lib/db-server.ts` (함수 추가 — 기존 함수는 변경하지 않음, `deleteMessage` 함수 바로 다음에 추가)

**Interfaces:**
- Consumes: `getSupabase()` (`src/lib/supabase.ts`), 파일 내부의 기존 `getStoreRow(storeCode)` 헬퍼
- Produces: `getMessageCustomerId(storeCode: string, id: string): Promise<string | null>` — Task 4의 재생성 라우트가 사용한다.

- [ ] **Step 1: 함수 추가**

`src/lib/db-server.ts`의 `deleteMessage` 함수(약 353-362줄) 바로 다음에 아래 함수를 추가한다:

```typescript
export async function getMessageCustomerId(storeCode: string, id: string): Promise<string | null> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) return null;

  const { data } = await getSupabase()
    .from('messages')
    .select('customer_id')
    .eq('id', id)
    .eq('store_id', storeRow.id)
    .single();

  return data?.customer_id ?? null;
}
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 실제 Supabase에 대해 동작 검증**

이 프로젝트는 `cafe-rebot` 매장에 이탈 4단계 시드 고객이 있다 (`docs/superpowers/plans/2026-07-03-seed-churn-data.md`에서 시딩됨, 전화번호 접두사 `0109999`). 이 중 하나를 이용해 임시 draft를 만들고 조회한 뒤 정리한다.

`/tmp/verify-message-customer-id.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import {
  getCustomers,
  addMessageDraft,
  getMessageCustomerId,
  deleteMessage,
} from '/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const dangerCustomers = await getCustomers(STORE_CODE, 'danger');
  assert.ok(dangerCustomers.length > 0, 'danger 단계 시드 고객이 없음 — npm run seed:churn을 먼저 실행하세요');
  const customerId = dangerCustomers[0].id;

  const draft = await addMessageDraft(STORE_CODE, customerId, '임시 검증용 메시지');
  const foundCustomerId = await getMessageCustomerId(STORE_CODE, draft.id);
  assert.strictEqual(foundCustomerId, customerId, 'getMessageCustomerId가 잘못된 customer_id를 반환함');

  await deleteMessage(STORE_CODE, draft.id);
  console.log('OK: getMessageCustomerId 검증 통과 (임시 draft 정리 완료)');
}

main();
```

Run:
```bash
npx tsx /tmp/verify-message-customer-id.ts
```
Expected:
```
OK: getMessageCustomerId 검증 통과 (임시 draft 정리 완료)
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db-server.ts
git commit -m "feat: message id로 customer_id를 조회하는 getMessageCustomerId 추가"
```

---

### Task 4: API 라우트 연결 — 생성 경로 확장 + 재생성 라우트 추가

**Files:**
- Modify: `src/lib/api-handlers.ts` (import 블록, `POST /api/generate-message` 핸들러, 신규 `POST /api/messages/:id/regenerate` 라우트 추가)

**Interfaces:**
- Consumes: Task 2의 `generateAIMessage(...9 args)`, Task 3의 `getMessageCustomerId(storeCode, id)`, 기존 `getCustomerById`, `getStore`, `patchMessage`, `addMessageDraft`
- Produces: `POST /api/messages/:id/regenerate` (body: `{ store_code: string }`) → `200 Message` — Task 5의 UI가 호출한다.

- [ ] **Step 1: import 블록에 `getMessageCustomerId` 추가**

`src/lib/api-handlers.ts` 상단 import를 아래로 교체한다:

```typescript
import {
  getStore,
  updateStore,
  getCustomers,
  getCustomerById,
  addStamp,
  recordManualVisit,
  getStoreMessages,
  addMessageDraft,
  patchMessage,
  deleteMessage,
  getMessageCustomerId,
  getSavedContentDrafts,
  saveContentDraft,
} from './db-server';
import { generateAIMessage, generateAIPost } from './ai-server';

function calcDaysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 2: 기존 `POST /api/generate-message` 핸들러에 방문데이터 전달**

`// 7. POST /api/generate-message` 블록 안의 `generateAIMessage(...)` 호출을 아래로 교체한다:

```typescript
      const content = await generateAIMessage(
        detail.customer.name || '고객',
        detail.customer.churn_stage,
        store.reward_desc,
        store.store_name,
        store.message_signature,
        detail.customer.total_visits,
        calcDaysSince(detail.customer.last_visit_at),
        detail.customer.total_stamps,
        store.stamp_goal,
      );
```

- [ ] **Step 3: `// 10. DELETE /api/messages/:id` 블록 바로 다음에 재생성 라우트 추가**

```typescript
    // 10-1. POST /api/messages/:id/regenerate
    match = pathname.match(/^\/api\/messages\/([^/]+)\/regenerate$/);
    if (match && method === 'POST') {
      const body = await getRequestBody(req);
      const { store_code } = body;
      if (!store_code) { sendJson(400, { error: 'store_code is required' }); return true; }
      const messageId = match[1];

      try {
        const customerId = await getMessageCustomerId(store_code, messageId);
        if (!customerId) { sendJson(404, { error: 'Message not found' }); return true; }

        const [detail, store] = await Promise.all([
          getCustomerById(store_code, customerId),
          getStore(store_code),
        ]);
        if (!detail) { sendJson(404, { error: 'Customer not found' }); return true; }

        const content = await generateAIMessage(
          detail.customer.name || '고객',
          detail.customer.churn_stage,
          store.reward_desc,
          store.store_name,
          store.message_signature,
          detail.customer.total_visits,
          calcDaysSince(detail.customer.last_visit_at),
          detail.customer.total_stamps,
          store.stamp_goal,
        );

        const updated = await patchMessage(store_code, messageId, { content });
        sendJson(200, updated);
      } catch (err: any) {
        sendJson(404, { error: err.message });
      }
      return true;
    }
```

- [ ] **Step 4: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 5: 로컬 서버 기동 후 실제 API로 생성 → 재생성 흐름 검증**

```bash
npm run start &
sleep 5
```

danger 단계 시드 고객 id 조회 후 초안 생성:
```bash
CUSTOMER_ID=$(curl -s "http://localhost:3000/api/customers/cafe-rebot?filter=danger" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log(data[0].id);
  });
")
echo "CUSTOMER_ID=$CUSTOMER_ID"

curl -s -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\":\"$CUSTOMER_ID\",\"store_code\":\"cafe-rebot\"}"
```
Expected: `200`, `{"id": "...", "content": "...(빈 문자열 아님)...", "status": "draft", ...}` 형태의 JSON. `id` 값을 다음 단계에서 사용한다.

재생성 호출 (위 응답의 `id` 값을 `$MSG_ID`에 대입):
```bash
MSG_ID="<위 응답의 id 값>"
curl -s -X POST "http://localhost:3000/api/messages/$MSG_ID/regenerate" \
  -H "Content-Type: application/json" \
  -d '{"store_code":"cafe-rebot"}'
```
Expected: `200`, 같은 `"id": "<MSG_ID>"`를 가진 JSON이 반환되고 `content` 필드가 비어있지 않다.

서버 종료:
```bash
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: 메시지 생성 API에 방문데이터 반영 + 재생성 엔드포인트 추가"
```

---

### Task 5: UI — MessageList에 재생성 버튼 추가

**Files:**
- Modify: `src/components/MessageList.tsx` (props 인터페이스, draft 카드 액션 버튼 영역, import에 `RefreshCw` 아이콘 추가)
- Modify: `src/App.tsx` (`handleRegenerate` 핸들러 추가, `MessageList`에 `onRegenerate` prop 전달)

**Interfaces:**
- Consumes: Task 4의 `POST /api/messages/:id/regenerate`
- Produces: 없음 (UI 최종 소비 지점)

- [ ] **Step 1: `MessageList.tsx`의 props와 import 수정**

`src/components/MessageList.tsx` 상단을 아래로 교체한다:

```typescript
import React, { useState } from 'react';
import { Message, ChurnStage } from '../types';
import { CHURN_COLOR, CHURN_LABEL } from '../lib/churn';
import { MessageSquare, Send, Trash2, Edit3, Calendar, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (msg: Message) => void;
  onRegenerate: (id: string) => void;
}

export default function MessageList({ messages, onSend, onDelete, onEdit, onRegenerate }: MessageListProps) {
```

- [ ] **Step 2: draft 카드 액션 버튼 영역에 "재생성" 버튼 추가**

`src/components/MessageList.tsx`의 액션 버튼 영역(`삭제` 버튼과 `내용 편집` 버튼 사이, 약 101-117줄)을 아래로 교체한다:

```typescript
                {msg.status === 'draft' && (
                  <div className="flex justify-end gap-2.5 pt-1">
                    <button
                      onClick={() => onDelete(msg.id)}
                      className="px-3.5 py-2 text-xs font-medium rounded-lg text-stone-500 hover:text-red-700 hover:bg-red-50 hover:border-red-100 transition-all border border-stone-200 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                    <button
                      onClick={() => onRegenerate(msg.id)}
                      className="px-3.5 py-2 text-xs font-medium rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-100 transition-all border border-stone-200 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      재생성
                    </button>
                    <button
                      onClick={() => onEdit(msg)}
                      className="px-3.5 py-2 text-xs font-medium rounded-lg text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      내용 편집
                    </button>
```

(이어지는 발송 버튼 블록은 변경하지 않는다.)

- [ ] **Step 3: `App.tsx`에 `handleRegenerate` 핸들러 추가**

`src/App.tsx`의 `handleDelete` 함수(약 778-790줄) 바로 다음에 추가한다:

```typescript
  const handleRegenerate = (id: string) => {
    fetch(`/api/messages/${id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_code })
    })
      .then(res => res.json())
      .then(() => {
        setToastMsg('AI 메시지가 새로 재생성되었습니다.');
        fetchMessagesFromApi();
        setTimeout(() => setToastMsg(''), 3000);
      })
      .catch(err => console.error(err));
  };
```

- [ ] **Step 4: `MessageList`에 `onRegenerate` prop 전달**

`src/App.tsx`의 `<MessageList ... />` 호출부(약 870-875줄)를 아래로 교체한다:

```typescript
        <MessageList 
          messages={messages} 
          onSend={handleSend} 
          onDelete={handleDelete} 
          onEdit={handleEditClick} 
          onRegenerate={handleRegenerate}
        />
```

- [ ] **Step 5: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 6: 브라우저로 육안 확인**

```bash
npm run start &
sleep 5
```

브라우저에서 `http://localhost:3000/dashboard/cafe-rebot` 접속 후:
1. 이탈 위험 고객 목록에서 danger/watch 고객의 "상세 정보" → "AI 초안 만들기"로 draft를 하나 생성한다.
2. `/messages/cafe-rebot` 페이지(메시지 관리)로 이동해 방금 생성한 draft 카드에 "삭제 / 재생성 / 내용 편집 / 메시지 발송" 4개 버튼이 순서대로 보이는지 확인한다.
3. "재생성" 버튼을 클릭해 토스트 메시지("AI 메시지가 새로 재생성되었습니다.")가 뜨고 내용이 갱신되는지 확인한다.

서버 종료:
```bash
kill %1
```

- [ ] **Step 7: Commit**

```bash
git add src/components/MessageList.tsx src/App.tsx
git commit -m "feat: 메시지 카드에 재생성 버튼 추가"
```

---

## Self-Review

**스펙 커버리지:** `docs/superpowers/specs/2026-07-03-ai-message-enhancement-design.md`의 3개 섹션 — "1. 프롬프트 확장"은 Task 1(빌더)+Task 2(호출부)+Task 4 Step 2(생성 라우트 반영)가 커버, "2. 재생성 = 해당 draft 덮어쓰기"는 Task 3(조회 함수)+Task 4 Step 3(라우트)+Task 5(UI 버튼)가 커버, "3. 범위 밖"은 어느 태스크도 해당 코드를 건드리지 않음(마케팅 동의/30일 경고/`generateAIPost`/폴백 템플릿 전부 미변경).

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함.

**타입/시그니처 일관성:** `buildMessagePrompt`(Task 1) → `generateAIMessage`(Task 2) → `api-handlers.ts`의 두 라우트(Task 4)까지 `(customerName, churnStage, rewardDesc, storeName, signature, totalVisits, daysSinceLastVisit, currentStamps, stampGoal)` 순서와 타입이 전 태스크에서 동일하게 유지됨. `getMessageCustomerId(storeCode: string, id: string): Promise<string | null>`(Task 3)의 이름과 반환 타입이 Task 4의 사용처와 일치. `onRegenerate: (id: string) => void`가 Task 5의 `MessageList` 인터페이스 정의와 `App.tsx` 호출부에서 동일하게 사용됨.
