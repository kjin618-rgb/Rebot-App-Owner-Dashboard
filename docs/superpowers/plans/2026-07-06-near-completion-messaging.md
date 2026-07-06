# 쿠폰 달성 임박 타겟팅 (2차: 메시지/발송/알림) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완주 임박 고객에게 전용 AI 메시지 초안을 "완주 임박" 탭에서 선택(개별/일괄)해 생성하고, 사장님이 대시보드 접속 시 완주 임박 고객이 있음을 배지로 자동으로 알 수 있게 한다.

**Architecture:** 기존 이탈-회복 메시지 파이프라인(`buildMessagePrompt`/`generateAIMessage`/`addMessageDraft`)과 완전히 분리된 완주-임박 전용 파이프라인(`buildNearCompletionMessagePrompt`/`generateNearCompletionMessage`)을 추가한다. `messages.message_type` 컬럼으로 두 파이프라인이 만든 초안을 구분해 표시한다. `CustomerTable`에 옵션 체크박스 선택 기능을 추가해 "완주 임박" 탭에서만 활성화하고, 신규 벌크 API로 선택된 고객들의 초안을 한 번에 생성한다. 대시보드 요약 API에 `near_completion_count`를 추가하고 `Sidebar`/`BottomNav`에 배지로 노출한다.

**Tech Stack:** TypeScript, React 19, Supabase(PostgreSQL), 기존 `src/lib/*`/`src/App.tsx`/`src/components/*` 구조 재사용. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 생성/체크아웃된 `feat/near-completion-messaging`에서 계속 작업한다 (새 브랜치 생성 불필요).
- 테스트 프레임워크 없음 — 검증은 `node:assert` 기반 임시 스크립트(프로젝트 루트에 만들고 실행 후 삭제), `react-dom/server`의 `renderToStaticMarkup`을 이용한 컴포넌트 스모크 렌더링, 또는 실제 API `curl` 호출로 대체한다. `npm run lint`(`tsc --noEmit`)는 모든 코드 변경 태스크에서 공통 게이트로 사용한다.
- 브라우저 육안(Playwright) 검증은 샌드박스에 헤드리스 Chromium 의존 라이브러리가 없어 불가 — API/코드/렌더 스모크 테스트로 대체한다(이전 세션들과 동일한 사유, 사용자 승인됨).
- 이 프로젝트엔 마이그레이션 파일 시스템이 없다 — 스키마 변경은 Supabase 대시보드 SQL Editor에서 수동 실행한다.
- `messages.message_type` 기본값은 `'winback'`이며, 기존 `/api/generate-message`·`/api/messages/:id/regenerate` 호출부는 인자를 넘기지 않으므로 동작 변화가 없어야 한다.
- 선택+일괄 생성 기능은 "완주 임박" 탭에만 적용한다 — 전체/주의/위험/이탈 탭의 기존 동작은 변경하지 않는다.
- "일괄 생성"은 초안 생성까지만 처리한다 — 초안 검토·수정·실제 발송(`status='sent'` 표시)은 기존 메시지 페이지의 개별 플로우를 그대로 재사용한다.
- 완주 임박 메시지 문구에는 이탈/재방문 유도 표현이나 실제로 존재하지 않는 마감 기한을 넣지 않는다.

---

### Task 1: `messages.message_type` 컬럼 추가 + 타입/매퍼/`addMessageDraft` 반영

**Files:**
- Modify: `src/types/index.ts` (`Message` interface)
- Modify: `src/lib/db-server.ts` (`toMessage` 매퍼, `addMessageDraft` 시그니처)

**Interfaces:**
- Produces: `Message.message_type: 'winback' | 'near_completion'`, `addMessageDraft(storeCode, customerId, content, messageType?: 'winback' | 'near_completion')` — Task 3(API), Task 4(UI 배지)가 사용한다.

- [ ] **Step 1: Supabase SQL Editor에서 컬럼 추가**

```sql
ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'winback';
```

- [ ] **Step 2: 컬럼 존재 검증 — 실행 전이면 실패해야 함**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_message_type_column.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';

async function main() {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('id, message_type')
    .limit(1);

  assert.ok(!error, `message_type 컬럼 조회 실패: ${error?.message}`);
  console.log('OK: messages.message_type 컬럼 조회 성공', data);
}

main();
```

Run (Step 1을 아직 실행하지 않았다면):
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_message_type_column.ts
```
Expected (컬럼 추가 전): `AssertionError` — `column messages.message_type does not exist` 계열 메시지.

- [ ] **Step 3: Step 1의 SQL을 실제로 실행한 뒤 재검증 — 통과해야 함**

Run:
```bash
npx tsx _tmp_verify_message_type_column.ts
rm _tmp_verify_message_type_column.ts
```
Expected:
```
OK: messages.message_type 컬럼 조회 성공 [ { id: '...', message_type: 'winback' } ]
```
(기존 행이 있다면 `DEFAULT 'winback'`이 소급 적용되어 모두 `'winback'`으로 채워져 있어야 한다.)

- [ ] **Step 4: `Message` 타입에 필드 추가**

`src/types/index.ts`의 `Message` interface를 아래로 교체한다:

```typescript
export interface Message {
  id: string;
  customer_id: string;
  customer_name: string | null;
  phone_masked: string;
  churn_stage: ChurnStage;
  message_type: 'winback' | 'near_completion';
  content: string;
  status: 'draft' | 'sent';
  created_at: string;
  sent_at: string | null;
  last_sent_within_30d: boolean;
  marketing_consent: boolean;
}
```

- [ ] **Step 5: `toMessage` 매퍼 반영**

`src/lib/db-server.ts`의 `toMessage` 함수를 아래로 교체한다:

```typescript
function toMessage(row: any): Message {
  return {
    id: row.id,
    customer_id: row.customer_id,
    customer_name: row.customer_name ?? null,
    phone_masked: row.phone_masked ?? '',
    churn_stage: row.churn_stage ?? 'safe',
    message_type: row.message_type ?? 'winback',
    content: row.content,
    status: row.status,
    created_at: row.created_at,
    sent_at: row.sent_at ?? null,
    last_sent_within_30d: row.last_sent_within_30d ?? false,
    marketing_consent: row.marketing_consent ?? true,
  };
}
```

- [ ] **Step 6: `addMessageDraft`에 `messageType` 파라미터 추가**

`src/lib/db-server.ts`의 `addMessageDraft` 함수를 아래로 교체한다:

```typescript
export async function addMessageDraft(
  storeCode: string,
  customerId: string,
  content: string,
  messageType: 'winback' | 'near_completion' = 'winback',
): Promise<Message> {
  const storeRow = await getStoreRow(storeCode);
  if (!storeRow) throw new Error('Store not found');

  const { data: cRow } = await getSupabase()
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('store_id', storeRow.id)
    .single();
  if (!cRow) throw new Error('Customer not found');

  const customer = toCustomer(cRow);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSent } = await getSupabase()
    .from('messages')
    .select('id')
    .eq('customer_id', customerId)
    .eq('store_id', storeRow.id)
    .eq('status', 'sent')
    .gte('sent_at', thirtyDaysAgo)
    .limit(1);

  const { data } = await getSupabase()
    .from('messages')
    .insert({
      store_id: storeRow.id,
      customer_id: customerId,
      customer_name: customer.name,
      phone_masked: customer.phone_masked,
      churn_stage: customer.churn_stage,
      message_type: messageType,
      content,
      status: 'draft',
      last_sent_within_30d: (recentSent?.length ?? 0) > 0,
      marketing_consent: customer.marketing_consent,
    })
    .select()
    .single();

  return toMessage(data);
}
```

- [ ] **Step 7: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 8: 기존 메시지 생성 플로우가 여전히 `message_type='winback'`을 쓰는지 실제 서버로 검증**

```bash
nohup npm run start > /tmp/server-ncm1.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s "http://localhost:3000/api/customers/cafe-rebot" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const list=JSON.parse(Buffer.concat(chunks).toString());
    console.log('CUSTOMER_ID=' + list[0].id);
  });
" > /tmp/ncm-customer-id.txt
CUSTOMER_ID=$(cat /tmp/ncm-customer-id.txt | grep -oP '(?<=CUSTOMER_ID=).*')

curl -s -X POST "http://localhost:3000/api/generate-message" \
  -H "Content-Type: application/json" \
  -d "{\"customer_id\": \"$CUSTOMER_ID\", \"store_code\": \"cafe-rebot\"}" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const msg=JSON.parse(Buffer.concat(chunks).toString());
    console.log('message_type:', msg.message_type);
    console.log('MESSAGE_ID=' + msg.id);
  });
"
pkill -f "tsx server.ts"
```
Expected: `message_type: winback` 출력. (생성된 테스트 메시지는 정리하지 않아도 무방 — 실제 `cafe-rebot` 초안 목록에 정상적인 draft로 남는다. 정리하고 싶다면 출력된 `MESSAGE_ID`로 `DELETE /api/messages/:id?store_code=cafe-rebot` 호출.)

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/lib/db-server.ts
git commit -m "feat: messages.message_type 컬럼 추가 및 타입/매퍼/addMessageDraft 반영"
```

---

### Task 2: 완주 임박 전용 프롬프트 + AI 메시지 생성 함수

**Files:**
- Modify: `src/lib/prompts.ts` (`buildNearCompletionMessagePrompt` 신규)
- Modify: `src/lib/ai-server.ts` (`getNearCompletionFallbackMessage`, `generateNearCompletionMessage` 신규)

**Interfaces:**
- Produces: `generateNearCompletionMessage(customerName, currentStamps, stampGoal, rewardDesc, storeName, signature): Promise<string>` — Task 3(API 라우트)이 사용한다.

- [ ] **Step 1: 프롬프트 빌더 추가**

`src/lib/prompts.ts` 끝에 추가한다:

```typescript
export function buildNearCompletionMessagePrompt(
  customerName: string | null,
  currentStamps: number,
  stampGoal: number,
  rewardDesc: string,
  storeName: string,
  signature: string,
): string {
  const nameLine = customerName !== null
    ? `\n- 이름: ${customerName}`
    : '';
  const remaining = Math.max(stampGoal - currentStamps, 0);

  return `당신은 카페/베이커리 매장 "${storeName}"을 운영하는 사장님입니다.
아래 고객 정보를 참고해 스탬프 완주(리워드 달성)를 앞둔 고객에게 보낼 응원 메시지 본문을 작성해주세요.

[고객 정보]${nameLine}
- 현재 스탬프: ${currentStamps}/${stampGoal}개 (남은 스탬프: ${remaining}개)
- 매장 리워드: ${rewardDesc}

[메시지 구조 — 반드시 이 순서로 작성]
1. 인사: "고객님, 안녕하세요." (이름이 있으면 "{이름} 고객님, 안녕하세요.") 다음 줄에 "${storeName}입니다."로 자기소개
2. 진행 상황 축하: 스탬프가 거의 다 찼다는 사실을 밝고 긍정적으로 언급 (예: "조금만 더 채우시면 리워드입니다")
3. 리워드 안내: 완주 시 받을 혜택(${rewardDesc})을 구체적으로 안내
4. 행동 유도: 매장 방문 시 스탬프를 적립하면 된다는 명확한 안내

[작성 규칙 — 반드시 지킬 것]
1. 한국어 존댓말, 사장님이 직접 쓴 듯한 자연스러운 톤. 축하/응원하는 밝은 분위기를 유지한다
2. 전체 분량은 1,000자를 넘지 않는다
3. 특정 메뉴명이나 결제 금액을 직접 언급하지 않는다
4. 실제로 존재하지 않는 마감 기한이나 긴급성("오늘까지만" 등)을 지어내지 않는다
5. 이탈/재방문 유도 표현("오랜만에", "그동안 안 오셔서" 등)은 쓰지 않는다 — 이 고객은 최근에도 방문한 활성 고객이다
6. 고객 이름 정보가 없으면 "OOO님" 대신 그냥 "고객님"으로 부른다
7. 매장명은 항상 정확히 "${storeName}"로만 지칭하고 다른 이름으로 바꾸어 부르지 않는다
8. 광고 문구, 수신거부 안내, 매장명 태그는 절대 넣지 않는다(시스템이 별도로 붙입니다) — 메시지 본문만 작성
9. 마지막은 사장님 서명으로 마무리: "${signature}"

메시지 본문만 반환하세요 (따옴표나 설명 없이).`;
}
```

- [ ] **Step 2: `ai-server.ts` import에 신규 프롬프트 빌더 추가**

`src/lib/ai-server.ts` 최상단 import 줄을 아래로 교체한다:

```typescript
import { buildMessagePrompt, buildPostPrompt, buildNearCompletionMessagePrompt } from './prompts';
```

- [ ] **Step 3: 폴백 템플릿 + 생성 함수 추가**

`src/lib/ai-server.ts`의 `generateAIMessage` 함수 바로 다음(닫는 `}` 다음 줄)에 추가한다:

```typescript
function getNearCompletionFallbackMessage(customerName: string | null, currentStamps: number, stampGoal: number, rewardDesc: string, storeName: string, signature: string): string {
  const greeting = customerName ? `${customerName} 고객님` : '고객님';
  const remaining = Math.max(stampGoal - currentStamps, 0);

  return `${greeting}, 안녕하세요.
${storeName}입니다.

스탬프 ${currentStamps}/${stampGoal}개를 모아주셔서 리워드까지 단 ${remaining}개 남았습니다!
${rewardDesc}

다음 방문 시 스탬프를 적립하시면 리워드에 한 걸음 더 가까워집니다.
곧 뵙기를 기대하겠습니다.

${signature}`;
}

export async function generateNearCompletionMessage(
  customerName: string | null,
  currentStamps: number,
  stampGoal: number,
  rewardDesc: string,
  storeName: string,
  signature: string,
): Promise<string> {
  const prompt = buildNearCompletionMessagePrompt(
    customerName, currentStamps, stampGoal, rewardDesc, storeName, signature,
  );

  let body: string | null = null;

  // 1. Try OpenRouter if key is available
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'MY_OPENROUTER_API_KEY') {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) body = text.trim();
      }
    } catch (e) {
      console.error('OpenRouter near-completion generation failed, trying Gemini', e);
    }
  }

  // 2. Try native Gemini client
  if (!body) {
    const gemini = await getGeminiClient();
    if (gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        if (response && response.text) {
          body = response.text.trim();
        }
      } catch (e) {
        console.error('Gemini near-completion generation failed, falling back to templates', e);
      }
    }
  }

  // 3. Fallback to templates
  if (!body) {
    body = getNearCompletionFallbackMessage(customerName, currentStamps, stampGoal, rewardDesc, storeName, signature);
  }

  return wrapWithComplianceNotice(storeName, body);
}
```

- [ ] **Step 4: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 5: 폴백 경로 검증 (API 키 없이 실행)**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_near_completion_message.ts` 파일을 아래 내용으로 만든다:

```typescript
import assert from 'node:assert';

// API 키를 일부러 비워 폴백 템플릿 경로만 타도록 강제한다.
delete process.env.OPENROUTER_API_KEY;
delete process.env.GEMINI_API_KEY;

import { generateNearCompletionMessage } from './src/lib/ai-server';

async function main() {
  const result = await generateNearCompletionMessage(
    '홍길동', 9, 10, '음료 1잔 무료', '리봇 베이커리', '리봇 베이커리 사장 드림',
  );

  assert.ok(result.includes('홍길동'), '고객 이름이 메시지에 포함되어야 함');
  assert.ok(result.includes('음료 1잔 무료'), '리워드 설명이 포함되어야 함');
  assert.ok(result.includes('리봇 베이커리 사장 드림'), '서명이 포함되어야 함');
  assert.ok(!result.includes('이탈'), '이탈 관련 표현이 없어야 함');
  assert.ok(!result.includes('오랜만'), '재방문 유도 표현이 없어야 함');
  assert.ok(result.startsWith('(광고)'), '컴플라이언스 안내가 앞에 붙어야 함');
  assert.ok(result.includes('무료수신거부'), '수신거부 안내가 포함되어야 함');

  console.log('OK: generateNearCompletionMessage 폴백 경로 검증 통과');
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_near_completion_message.ts
rm _tmp_verify_near_completion_message.ts
```
Expected: `OK: generateNearCompletionMessage 폴백 경로 검증 통과`

- [ ] **Step 6: Commit**

```bash
git add src/lib/prompts.ts src/lib/ai-server.ts
git commit -m "feat: 완주 임박 전용 메시지 프롬프트 및 생성 함수 추가"
```

---

### Task 3: `POST /api/generate-near-completion-messages` API 추가

**Files:**
- Modify: `src/lib/api-handlers.ts`

**Interfaces:**
- Consumes: Task 1의 `addMessageDraft(storeCode, customerId, content, messageType)`, Task 2의 `generateNearCompletionMessage(...)`, 기존 `getCustomerById`, `getStore`.
- Produces: `POST /api/generate-near-completion-messages` — Task 6(UI 일괄 생성 버튼)이 호출한다.

- [ ] **Step 1: import에 `generateNearCompletionMessage` 추가**

`src/lib/api-handlers.ts` 최상단 import 줄을 아래로 교체한다:

```typescript
import { generateAIMessage, generateAIPost, generateNearCompletionMessage } from './ai-server';
```

- [ ] **Step 2: 신규 라우트 추가**

`src/lib/api-handlers.ts`에서 아래 줄:

```typescript
    sendJson(404, { error: `API route not found: ${pathname}` });
    return true;
```

바로 위에 추가한다:

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

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 실제 서버로 종단 검증 (테스트 고객 생성 → 호출 → 검증 → 정리)**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_setup_bulk_test_customers.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  const makePhone = (suffix: string) => '0109999' + suffix;

  const { data: consentCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0001'), phone_masked: makePhone('0001'),
      marketing_consent: true, current_stamps: 9, total_stamps: 9, total_visits: 3,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  const { data: noConsentCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0002'), phone_masked: makePhone('0002'),
      marketing_consent: false, current_stamps: 9, total_stamps: 9, total_visits: 3,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  console.log('CONSENT_ID=' + consentCustomer.id);
  console.log('NO_CONSENT_ID=' + noConsentCustomer.id);
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_setup_bulk_test_customers.ts
```
출력된 `CONSENT_ID`, `NO_CONSENT_ID` 값을 기록해둔다.

```bash
nohup npm run start > /tmp/server-ncm3.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s -X POST "http://localhost:3000/api/generate-near-completion-messages" \
  -H "Content-Type: application/json" \
  -d '{"store_code": "cafe-rebot", "customer_ids": ["<CONSENT_ID>", "<NO_CONSENT_ID>"]}'

pkill -f "tsx server.ts"
```
(`<CONSENT_ID>`, `<NO_CONSENT_ID>`를 실제 값으로 치환해서 실행한다.)

Expected: `{"generated":1,"skipped_no_consent":1}`

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_and_cleanup_bulk_test.ts` 파일을 아래 내용으로 만든다(파일 안의 `<CONSENT_ID>`, `<NO_CONSENT_ID>`를 실제 값으로 치환):

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';

const CONSENT_ID = '<CONSENT_ID>';
const NO_CONSENT_ID = '<NO_CONSENT_ID>';

async function main() {
  const { data: messages } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('customer_id', CONSENT_ID);

  assert.ok(messages && messages.length === 1, 'consent 고객에게 메시지가 1건 생성되어야 함');
  assert.strictEqual(messages![0].message_type, 'near_completion', 'message_type이 near_completion이어야 함');
  assert.ok(messages![0].content.length > 0, '메시지 본문이 비어있지 않아야 함');

  const { data: noConsentMessages } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('customer_id', NO_CONSENT_ID);

  assert.strictEqual(noConsentMessages?.length ?? 0, 0, '미동의 고객에게는 메시지가 생성되지 않아야 함');

  console.log('OK: 일괄 생성 API가 동의 고객만 처리함을 확인');

  // 정리
  await getSupabase().from('messages').delete().eq('customer_id', CONSENT_ID);
  await getSupabase().from('customers').delete().in('id', [CONSENT_ID, NO_CONSENT_ID]);
  console.log('OK: 테스트 데이터 정리 완료');
}

main();
```

Run:
```bash
npx tsx _tmp_verify_and_cleanup_bulk_test.ts
rm _tmp_setup_bulk_test_customers.ts _tmp_verify_and_cleanup_bulk_test.ts
```
Expected: `OK: 일괄 생성 API가 동의 고객만 처리함을 확인`, `OK: 테스트 데이터 정리 완료`

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: POST /api/generate-near-completion-messages 일괄 생성 API 추가"
```

---

### Task 4: `MessageList.tsx`에 완주 임박 배지 표시

**Files:**
- Modify: `src/components/MessageList.tsx`

**Interfaces:**
- Consumes: Task 1의 `Message.message_type`.

- [ ] **Step 1: 배지 추가**

`src/components/MessageList.tsx`에서 아래 블록을:

```tsx
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${CHURN_COLOR[msg.churn_stage]}`}>
                      {CHURN_LABEL[msg.churn_stage]}
                    </span>
```

아래로 교체한다:

```tsx
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${CHURN_COLOR[msg.churn_stage]}`}>
                      {CHURN_LABEL[msg.churn_stage]}
                    </span>
                    {msg.message_type === 'near_completion' && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        🎁 완주 임박
                      </span>
                    )}
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 렌더 스모크 테스트 — winback 메시지에는 배지 없고 near_completion 메시지에는 있어야 함**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_message_list_badge.tsx` 파일을 아래 내용으로 만든다:

```tsx
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import MessageList from './src/components/MessageList';
import { Message } from './src/types';

const baseMsg: Message = {
  id: '1',
  customer_id: 'c1',
  customer_name: '홍길동',
  phone_masked: '010-****-0000',
  churn_stage: 'safe',
  message_type: 'winback',
  content: '본문',
  status: 'draft',
  created_at: new Date().toISOString(),
  sent_at: null,
  last_sent_within_30d: false,
  marketing_consent: true,
};

const winbackHtml = renderToStaticMarkup(
  React.createElement(MessageList, {
    messages: [baseMsg],
    onSend: () => {}, onDelete: () => {}, onEdit: () => {}, onRegenerate: () => {},
  })
);
assert.ok(!winbackHtml.includes('완주 임박'), 'winback 메시지에는 완주 임박 배지가 없어야 함');

const nearCompletionHtml = renderToStaticMarkup(
  React.createElement(MessageList, {
    messages: [{ ...baseMsg, id: '2', message_type: 'near_completion' }],
    onSend: () => {}, onDelete: () => {}, onEdit: () => {}, onRegenerate: () => {},
  })
);
assert.ok(nearCompletionHtml.includes('완주 임박'), 'near_completion 메시지에는 완주 임박 배지가 있어야 함');

console.log('OK: MessageList 완주 임박 배지 렌더 검증 통과');
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_message_list_badge.tsx
rm _tmp_verify_message_list_badge.tsx
```
Expected: `OK: MessageList 완주 임박 배지 렌더 검증 통과`

- [ ] **Step 4: Commit**

```bash
git add src/components/MessageList.tsx
git commit -m "feat: 메시지 목록에 완주 임박 배지 표시"
```

---

### Task 5: `CustomerTable.tsx` 선택(체크박스) 기능 확장

**Files:**
- Modify: `src/components/CustomerTable.tsx`

**Interfaces:**
- Produces: `CustomerTableProps`에 `selectable?`, `selectedIds?`, `onToggleSelect?`, `onToggleSelectAll?` 추가 — Task 6(`CustomersPage`)이 사용한다. props 미전달 시 기존과 동일하게 동작(체크박스 컬럼 렌더링 안 함).

- [ ] **Step 1: Props 인터페이스 확장**

`src/components/CustomerTable.tsx`의 아래 두 줄을:

```typescript
interface CustomerTableProps {
  storeCode: string;
  customers: CustomerRow[];
  onSelectCustomer?: (customer: CustomerRow) => void;
}

export default function CustomerTable({ storeCode, customers, onSelectCustomer }: CustomerTableProps) {
```

아래로 교체한다:

```typescript
interface CustomerTableProps {
  storeCode: string;
  customers: CustomerRow[];
  onSelectCustomer?: (customer: CustomerRow) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export default function CustomerTable({
  storeCode, customers, onSelectCustomer,
  selectable = false, selectedIds, onToggleSelect, onToggleSelectAll,
}: CustomerTableProps) {
```

- [ ] **Step 2: 헤더에 전체 선택 체크박스 추가**

아래 줄을:

```tsx
            <tr className="bg-stone-50/75 border-b border-stone-100 text-stone-400 text-[10px] font-bold uppercase tracking-wider">
              <th className="py-4.5 px-6">고객명</th>
```

아래로 교체한다:

```tsx
            <tr className="bg-stone-50/75 border-b border-stone-100 text-stone-400 text-[10px] font-bold uppercase tracking-wider">
              {selectable && (
                <th className="py-4.5 px-6 w-10">
                  <input
                    type="checkbox"
                    checked={customers.length > 0 && customers.every(c => selectedIds?.has(c.id))}
                    onChange={() => onToggleSelectAll?.()}
                    className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                  />
                </th>
              )}
              <th className="py-4.5 px-6">고객명</th>
```

- [ ] **Step 3: 각 행에 개별 체크박스 추가**

아래 줄을:

```tsx
              <tr key={customer.id} className="hover:bg-brand-50/10 transition-colors duration-200 group">
                <td className="py-4 px-6 font-semibold text-stone-900">
```

아래로 교체한다:

```tsx
              <tr key={customer.id} className="hover:bg-brand-50/10 transition-colors duration-200 group">
                {selectable && (
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(customer.id) ?? false}
                      disabled={!customer.marketing_consent}
                      onChange={() => onToggleSelect?.(customer.id)}
                      className="rounded border-stone-300 text-amber-600 focus:ring-amber-500 h-4 w-4 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={!customer.marketing_consent ? '마케팅 미동의 고객은 선택할 수 없습니다' : undefined}
                    />
                  </td>
                )}
                <td className="py-4 px-6 font-semibold text-stone-900">
```

- [ ] **Step 4: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 5: 렌더 스모크 테스트 — selectable 여부와 미동의 고객 비활성화 확인**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_customer_table_select.tsx` 파일을 아래 내용으로 만든다:

```tsx
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import CustomerTable from './src/components/CustomerTable';
import { CustomerRow } from './src/types';

const customers: CustomerRow[] = [
  {
    id: 'c1', name: '홍길동', phone: '01011112222', phone_masked: '010-****-2222',
    churn_stage: 'safe', last_visit_at: new Date().toISOString(), total_visits: 3,
    current_stamps: 9, total_stamps: 9, marketing_consent: true, marketing_consent_at: null,
    notes: null, created_at: new Date().toISOString(),
  },
  {
    id: 'c2', name: '김철수', phone: '01033334444', phone_masked: '010-****-4444',
    churn_stage: 'safe', last_visit_at: new Date().toISOString(), total_visits: 2,
    current_stamps: 9, total_stamps: 9, marketing_consent: false, marketing_consent_at: null,
    notes: null, created_at: new Date().toISOString(),
  },
];

const withoutSelection = renderToStaticMarkup(
  React.createElement(CustomerTable, { storeCode: 'cafe-rebot', customers })
);
assert.ok(!withoutSelection.includes('type="checkbox"'), 'selectable 미전달 시 체크박스가 없어야 함');

const withSelection = renderToStaticMarkup(
  React.createElement(CustomerTable, {
    storeCode: 'cafe-rebot', customers, selectable: true,
    selectedIds: new Set(['c1']), onToggleSelect: () => {}, onToggleSelectAll: () => {},
  })
);
assert.ok(withSelection.includes('type="checkbox"'), 'selectable=true면 체크박스가 있어야 함');
assert.ok(withSelection.includes('disabled='), '미동의 고객 체크박스는 비활성화되어야 함');

console.log('OK: CustomerTable 선택 기능 렌더 검증 통과');
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_customer_table_select.tsx
rm _tmp_verify_customer_table_select.tsx
```
Expected: `OK: CustomerTable 선택 기능 렌더 검증 통과`

- [ ] **Step 6: Commit**

```bash
git add src/components/CustomerTable.tsx
git commit -m "feat: CustomerTable에 선택(체크박스) 기능 추가"
```

---

### Task 6: `CustomersPage`에 선택 상태 관리 + 일괄 생성 액션 바 연동

**Files:**
- Modify: `src/App.tsx` (`CustomersPage`)

**Interfaces:**
- Consumes: Task 3의 `POST /api/generate-near-completion-messages`, Task 5의 `CustomerTable` 선택 관련 props.

- [ ] **Step 1: 선택 상태 및 일괄 생성 state 추가**

`src/App.tsx`의 `CustomersPage` 함수에서 아래 줄을:

```typescript
  const [showAddForm, setShowAddForm] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [consentInput, setConsentInput] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
```

아래로 교체한다:

```typescript
  const [showAddForm, setShowAddForm] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [consentInput, setConsentInput] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResultMsg, setBulkResultMsg] = useState('');
```

- [ ] **Step 2: 탭/매장 변경 시 선택 초기화**

`useEffect(() => { loadCustomers(); }, [store_code, activeTab]);` 바로 다음 줄에 추가한다:

```typescript
  useEffect(() => {
    setSelectedIds(new Set());
  }, [store_code, activeTab]);
```

- [ ] **Step 3: 선택 토글 핸들러와 일괄 생성 핸들러 추가**

`filteredCustomers` 선언(`const filteredCustomers = customers.filter(...)`) 바로 다음(닫는 `});` 다음 줄)에 추가한다(핸들러가 `filteredCustomers`를 참조하기 때문에 그 선언 이후에 위치해야 한다):

```typescript
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const selectableCustomers = filteredCustomers.filter(c => c.marketing_consent);
      const allSelected = selectableCustomers.length > 0 && selectableCustomers.every(c => prev.has(c.id));
      if (allSelected) return new Set();
      return new Set(selectableCustomers.map(c => c.id));
    });
  };

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

- [ ] **Step 4: 액션 바 UI 추가**

아래 블록(검색/탭 영역과 테이블 영역 사이):

```tsx
      {/* Table Section */}
      {loading ? (
```

바로 위에 추가한다:

```tsx
      {activeTab === 'near_completion' && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-xs font-semibold text-amber-900">{selectedIds.size}명 선택됨</span>
          <button
            onClick={handleBulkGenerate}
            disabled={bulkGenerating}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {bulkGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              `선택한 ${selectedIds.size}명에게 완주 임박 메시지 초안 일괄 생성`
            )}
          </button>
        </div>
      )}

      {bulkResultMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
          <span>{bulkResultMsg}</span>
        </div>
      )}

      {/* Table Section */}
      {loading ? (
```

- [ ] **Step 5: `CustomerTable` 호출에 선택 props 전달**

아래 블록을:

```tsx
        <CustomerTable 
          storeCode={store_code} 
          customers={filteredCustomers} 
          onSelectCustomer={c => navigate(`/customers/${store_code}/${c.id}`)}
        />
```

아래로 교체한다:

```tsx
        <CustomerTable 
          storeCode={store_code} 
          customers={filteredCustomers} 
          onSelectCustomer={c => navigate(`/customers/${store_code}/${c.id}`)}
          selectable={activeTab === 'near_completion'}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
```

- [ ] **Step 6: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 7: 코드 리뷰 기반 확인 (브라우저 육안 검증 불가 환경)**

아래 항목을 코드 상에서 직접 확인한다(샌드박스에 헤드리스 브라우저 의존성이 없어 실제 클릭 시나리오는 실행 불가 — Task 3에서 이미 API 레벨로 벌크 생성 로직 자체는 검증됨):
- `activeTab`이 `'near_completion'`이 아닐 때 `CustomerTable`에 `selectable=false`가 전달되는지 (다른 탭 영향 없음 확인)
- `filteredCustomers`가 바뀌어도(탭 전환/검색어 입력) 이전 탭에서 선택했던 `selectedIds`가 새 탭에 남아있지 않는지 (Step 2의 `useEffect` 확인)

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 완주 임박 탭에 선택+일괄 초안 생성 액션 바 추가"
```

---

### Task 7: `isNearCompletion()` 추출 + `getCustomers()` 리팩터

**Files:**
- Modify: `src/lib/db-server.ts`

**Interfaces:**
- Produces: `isNearCompletion(currentStamps: number, stampGoal: number, threshold: number): boolean` — Task 8(대시보드 집계)이 사용한다.

- [ ] **Step 1: 공용 함수 추출 및 `getCustomers` 교체**

`src/lib/db-server.ts`의 `getCustomers` 함수를 아래로 교체한다:

```typescript
export function isNearCompletion(currentStamps: number, stampGoal: number, threshold: number): boolean {
  return (currentStamps / stampGoal) * 100 >= threshold;
}

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
    return customers.filter(c => isNearCompletion(c.current_stamps, storeRow.stamp_goal, storeRow.near_completion_threshold));
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

- [ ] **Step 3: 경계값 검증 + 리팩터 후 `getCustomers` 동작 회귀 확인**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_is_near_completion.ts` 파일을 아래 내용으로 만든다:

```typescript
import 'dotenv/config';
import assert from 'node:assert';
import { getSupabase } from './src/lib/supabase';
import { getStoreRow, getCustomers, isNearCompletion } from './src/lib/db-server';

const STORE_CODE = 'cafe-rebot';

async function main() {
  // 순수 함수 경계값 확인
  assert.strictEqual(isNearCompletion(8, 10, 80), true, '80% == threshold(80)는 포함되어야 함');
  assert.strictEqual(isNearCompletion(7, 10, 80), false, '70% < threshold(80)는 제외되어야 함');

  // 리팩터 후 getCustomers 회귀 확인 (실제 Supabase 대상)
  const storeRow = await getStoreRow(STORE_CODE);
  if (!storeRow) throw new Error('cafe-rebot 매장을 찾을 수 없음');

  const makePhone = (suffix: string) => '0108888' + suffix;
  const { data: nearCompletionCustomer } = await getSupabase()
    .from('customers')
    .insert({
      store_id: storeRow.id, phone: makePhone('0001'), phone_masked: makePhone('0001'),
      marketing_consent: true, current_stamps: 9, total_stamps: 9, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  try {
    const list = await getCustomers(STORE_CODE, 'near_completion');
    assert.ok(list.some(c => c.id === nearCompletionCustomer.id), '90% 진행 고객이 near_completion 필터에 포함되어야 함');
    console.log('OK: isNearCompletion 추출 후 getCustomers 회귀 검증 통과');
  } finally {
    await getSupabase().from('customers').delete().eq('id', nearCompletionCustomer.id);
  }
}

main();
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_is_near_completion.ts
rm _tmp_verify_is_near_completion.ts
```
Expected: `OK: isNearCompletion 추출 후 getCustomers 회귀 검증 통과`

- [ ] **Step 4: Commit**

```bash
git add src/lib/db-server.ts
git commit -m "refactor: isNearCompletion 공용 함수 추출"
```

---

### Task 8: `/api/dashboard/:store_code`에 `near_completion_count` 추가

**Files:**
- Modify: `src/lib/api-handlers.ts`

**Interfaces:**
- Consumes: Task 7의 `isNearCompletion(...)`, 기존 `getStore(...)`.
- Produces: `GET /api/dashboard/:store_code` 응답에 `near_completion_count: number` — Task 9(대시보드 배지)가 사용한다.

- [ ] **Step 1: import에 `isNearCompletion` 추가**

`src/lib/api-handlers.ts` 최상단 import 줄을 아래로 교체한다:

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
  updateCustomerNotes,
  getSavedContentDrafts,
  saveContentDraft,
  isNearCompletion,
} from './db-server';
```

- [ ] **Step 2: 대시보드 핸들러에 `store` 조회 및 `near_completion_count` 추가**

아래 블록을:

```typescript
    // 3. GET /api/dashboard/:store_code
    match = pathname.match(/^\/api\/dashboard\/([^/]+)$/);
    if (match && method === 'GET') {
      const storeCode = match[1];
      const [customers, messages] = await Promise.all([
        getCustomers(storeCode),
        getStoreMessages(storeCode),
      ]);

      const churn_summary = {
        safe: customers.filter(c => c.churn_stage === 'safe').length,
        watch: customers.filter(c => c.churn_stage === 'watch').length,
        danger: customers.filter(c => c.churn_stage === 'danger').length,
        churned: customers.filter(c => c.churn_stage === 'churned').length,
      };
```

아래로 교체한다:

```typescript
    // 3. GET /api/dashboard/:store_code
    match = pathname.match(/^\/api\/dashboard\/([^/]+)$/);
    if (match && method === 'GET') {
      const storeCode = match[1];
      const [customers, messages, store] = await Promise.all([
        getCustomers(storeCode),
        getStoreMessages(storeCode),
        getStore(storeCode),
      ]);

      const churn_summary = {
        safe: customers.filter(c => c.churn_stage === 'safe').length,
        watch: customers.filter(c => c.churn_stage === 'watch').length,
        danger: customers.filter(c => c.churn_stage === 'danger').length,
        churned: customers.filter(c => c.churn_stage === 'churned').length,
      };

      const near_completion_count = customers.filter(c => isNearCompletion(c.current_stamps, store.stamp_goal, store.near_completion_threshold)).length;
```

그리고 같은 핸들러 안의 아래 블록을:

```typescript
      sendJson(200, {
        total_customers: customers.length,
        marketing_consent_count: customers.filter(c => c.marketing_consent).length,
        churn_summary,
        today_stamps: customers.filter(c => c.last_visit_at && new Date(c.last_visit_at).getTime() >= todayStart.getTime()).length,
        recent_visitors_30d: customers.filter(c => c.last_visit_at && new Date(c.last_visit_at).getTime() >= thirtyDaysAgo).length,
        pending_drafts: messages.filter(m => m.status === 'draft').length,
        recent_activity,
      });
```

아래로 교체한다:

```typescript
      sendJson(200, {
        total_customers: customers.length,
        marketing_consent_count: customers.filter(c => c.marketing_consent).length,
        churn_summary,
        near_completion_count,
        today_stamps: customers.filter(c => c.last_visit_at && new Date(c.last_visit_at).getTime() >= todayStart.getTime()).length,
        recent_visitors_30d: customers.filter(c => c.last_visit_at && new Date(c.last_visit_at).getTime() >= thirtyDaysAgo).length,
        pending_drafts: messages.filter(m => m.status === 'draft').length,
        recent_activity,
      });
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 실제 서버로 종단 검증 (평소 0 → 테스트 고객 추가 후 1 증가 → 정리)**

```bash
nohup npm run start > /tmp/server-ncm8.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

echo "--- before ---"
curl -s "http://localhost:3000/api/dashboard/cafe-rebot" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log('near_completion_count:', data.near_completion_count);
  });
"
pkill -f "tsx server.ts"
```

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_dashboard_count_test.ts` 파일을 아래 내용으로 만든다:

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
      store_id: storeRow.id, phone: '01077770001', phone_masked: '01077770001',
      marketing_consent: true, current_stamps: 9, total_stamps: 9, total_visits: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select().single();

  console.log('TEST_CUSTOMER_ID=' + data.id);
}

main();
```

```bash
npx tsx _tmp_dashboard_count_test.ts

nohup npm run start > /tmp/server-ncm8b.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

echo "--- after ---"
curl -s "http://localhost:3000/api/dashboard/cafe-rebot" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log('near_completion_count:', data.near_completion_count);
  });
"
pkill -f "tsx server.ts"
```
Expected: `--- after ---`의 `near_completion_count`가 `--- before ---`보다 정확히 1 크다.

테스트 고객 정리(`TEST_CUSTOMER_ID`를 실제 값으로 치환):
```typescript
// _tmp_cleanup_dashboard_count_test.ts
import 'dotenv/config';
import { getSupabase } from './src/lib/supabase';

async function main() {
  await getSupabase().from('customers').delete().eq('id', '<TEST_CUSTOMER_ID>');
  console.log('OK: 정리 완료');
}
main();
```
```bash
npx tsx _tmp_cleanup_dashboard_count_test.ts
rm _tmp_dashboard_count_test.ts _tmp_cleanup_dashboard_count_test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-handlers.ts
git commit -m "feat: 대시보드 요약 API에 near_completion_count 추가"
```

---

### Task 9: 대시보드 배지 UI (Sidebar/BottomNav) + 완주 임박 딥링크

**Files:**
- Modify: `src/App.tsx` (`OwnerLayout` — 대시보드 요약 fetch + prop 전달; `CustomersPage` — 쿼리 파라미터로 초기 탭 설정)
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/BottomNav.tsx`

**Interfaces:**
- Consumes: Task 8의 `GET /api/dashboard/:store_code` 응답의 `near_completion_count`.

- [ ] **Step 1: react-router-dom import에 `useSearchParams` 추가**

`src/App.tsx` 최상단의 아래 줄을:

```typescript
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
```

아래로 교체한다:

```typescript
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation, useSearchParams, Outlet } from 'react-router-dom';
```

- [ ] **Step 2: `OwnerLayout`이 대시보드 요약을 조회하도록 확장**

`OwnerLayout` 함수를 아래로 교체한다:

```typescript
function OwnerLayout() {
  const { store_code = 'demo' } = useParams();
  const [store, setStore] = useState<Store | null>(null);
  const [nearCompletionCount, setNearCompletionCount] = useState(0);

  useEffect(() => {
    // Fetch store configuration from backend
    fetch(`/api/store/${store_code}`)
      .then((res) => {
        if (!res.ok) throw new Error('Store not found');
        return res.json();
      })
      .then((data) => setStore(data))
      .catch((err) => console.error(err));

    fetch(`/api/dashboard/${store_code}`)
      .then((res) => res.json())
      .then((data) => setNearCompletionCount(data.near_completion_count ?? 0))
      .catch((err) => console.error(err));
  }, [store_code]);

  return (
    <div className="flex bg-[#fdfdfb] min-h-screen text-stone-800">
      {/* Responsive Sidebar */}
      <Sidebar storeName={store?.store_name} nearCompletionCount={nearCompletionCount} />

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col min-h-screen pb-20 md:pb-6 overflow-x-hidden">
        {/* Header Bar */}
        <header className="h-16 border-b border-stone-200/50 bg-white/85 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-40 shadow-[0_1px_12px_rgba(139,115,85,0.02)]">
          <div className="flex items-center gap-3">
            <div className="md:hidden w-8.5 h-8.5 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center shadow-md shadow-brand-500/10">
              <Coffee className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-sm leading-tight">
                {store?.store_name || '리봇 매장'}
              </h2>
              <p className="text-[10px] text-stone-400 font-mono mt-0.5 tracking-wide">
                STORE ID: {store_code}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-brand-800 bg-brand-50 border border-brand-100/50 px-3 py-1 rounded-full shadow-xs">
              사장님 모드
            </span>
          </div>
        </header>

        {/* Content View Router Outlet Container */}
        <div className="flex-1 p-5 md:p-6.5 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Sticky Bottom Nav Bar */}
      <BottomNav nearCompletionCount={nearCompletionCount} />
    </div>
  );
}
```

- [ ] **Step 3: `CustomersPage`가 `tab` 쿼리 파라미터로 초기 탭을 설정하도록 확장**

`function CustomersPage() {` 바로 위에 추가한다:

```typescript
export function resolveInitialCustomerTab(tabParam: string | null): 'all' | 'watch' | 'danger' | 'churned' | 'near_completion' {
  const validTabs = ['all', 'watch', 'danger', 'churned', 'near_completion'];
  return (validTabs.includes(tabParam || '') ? tabParam : 'all') as any;
}

```

그리고 `CustomersPage` 함수 안의 아래 줄을:

```typescript
  const { store_code = 'demo' } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'watch' | 'danger' | 'churned' | 'near_completion'>('all');
```

아래로 교체한다:

```typescript
  const { store_code = 'demo' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'watch' | 'danger' | 'churned' | 'near_completion'>(
    resolveInitialCustomerTab(searchParams.get('tab'))
  );
```

- [ ] **Step 4: `Sidebar.tsx`에 배지 + 딥링크 추가**

`src/components/Sidebar.tsx` 전체를 아래로 교체한다:

```tsx
import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Sparkles, Settings, Coffee } from 'lucide-react';

interface SidebarProps {
  storeName?: string;
  nearCompletionCount?: number;
}

export default function Sidebar({ storeName = '리봇 베이커리', nearCompletionCount = 0 }: SidebarProps) {
  const { store_code = 'demo' } = useParams();

  const navItems = [
    { name: '홈', path: `/dashboard/${store_code}`, icon: LayoutDashboard, badge: 0 },
    { name: '고객 관리', path: `/customers/${store_code}?tab=near_completion`, icon: Users, badge: nearCompletionCount },
    { name: '메시지 발송', path: `/messages/${store_code}`, icon: MessageSquare, badge: 0 },
    { name: '콘텐츠 생성', path: `/content/${store_code}`, icon: Sparkles, badge: 0 },
    { name: '설정', path: `/settings/${store_code}`, icon: Settings, badge: 0 },
  ];

  return (
    <aside className="hidden md:flex flex-col w-[260px] h-screen bg-white border-r border-stone-200/60 sticky top-0 shrink-0 shadow-[1px_0_10px_rgba(139,115,85,0.02)]">
      {/* Brand Logo Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-stone-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center shadow-md shadow-brand-500/20">
          <Coffee className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-stone-900 tracking-tight text-sm leading-none flex items-center gap-1.5">
            리봇 CRM
            <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-md border border-brand-100">AI</span>
          </h1>
          <p className="text-[11px] text-stone-400 font-medium truncate mt-1" title={storeName}>
            {storeName}
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-4.5 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 ${
                  isActive
                    ? 'bg-brand-50 text-brand-800 border-l-[3px] border-brand-600 pl-3 shadow-[0_2px_8px_-1px_rgba(181,124,76,0.06)] font-bold'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900 border-l-[3px] border-transparent pl-3'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span>{item.name}</span>
              {item.badge > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-stone-100/80 bg-stone-50/30">
        <div className="bg-stone-50/80 border border-stone-100 rounded-xl p-3 text-center shadow-inner">
          <p className="text-[10px] font-bold text-stone-400 tracking-wider font-mono">STORE INSTANCE</p>
          <p className="text-xs text-stone-600 font-semibold font-mono mt-0.5 truncate" title={store_code}>
            {store_code}
          </p>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: `BottomNav.tsx`에 배지 + 딥링크 추가**

`src/components/BottomNav.tsx` 전체를 아래로 교체한다:

```tsx
import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Sparkles, Settings } from 'lucide-react';

interface BottomNavProps {
  nearCompletionCount?: number;
}

export default function BottomNav({ nearCompletionCount = 0 }: BottomNavProps) {
  const { store_code = 'demo' } = useParams();

  const navItems = [
    { name: '홈', path: `/dashboard/${store_code}`, icon: LayoutDashboard, badge: 0 },
    { name: '고객', path: `/customers/${store_code}?tab=near_completion`, icon: Users, badge: nearCompletionCount },
    { name: '메시지', path: `/messages/${store_code}`, icon: MessageSquare, badge: 0 },
    { name: '콘텐츠', path: `/content/${store_code}`, icon: Sparkles, badge: 0 },
    { name: '설정', path: `/settings/${store_code}`, icon: Settings, badge: 0 },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-stone-200/50 flex items-center justify-around px-3 z-50 shadow-[0_-4px_16px_rgba(139,115,85,0.06)] pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full py-1.5 gap-1 select-none transition-all duration-300 relative ${
                isActive
                  ? 'text-brand-800 font-bold'
                  : 'text-stone-400 hover:text-stone-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-brand-50 text-brand-700' : 'bg-transparent text-stone-400'}`}>
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  {item.badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold tracking-wider">{item.name}</span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-brand-600 animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 7: `resolveInitialCustomerTab` 순수 함수 검증**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_initial_tab.ts` 파일을 아래 내용으로 만든다:

```typescript
import assert from 'node:assert';
import { resolveInitialCustomerTab } from './src/App';

assert.strictEqual(resolveInitialCustomerTab(null), 'all', '쿼리 없으면 all이어야 함');
assert.strictEqual(resolveInitialCustomerTab('near_completion'), 'near_completion', 'near_completion 쿼리는 그대로 반영되어야 함');
assert.strictEqual(resolveInitialCustomerTab('bogus'), 'all', '알 수 없는 값은 all로 폴백해야 함');
assert.strictEqual(resolveInitialCustomerTab('watch'), 'watch', '유효한 다른 탭 값도 반영되어야 함');

console.log('OK: resolveInitialCustomerTab 검증 통과');
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_initial_tab.ts
rm _tmp_verify_initial_tab.ts
```
Expected: `OK: resolveInitialCustomerTab 검증 통과`

- [ ] **Step 8: 실제 서버로 배지 카운트 반영 확인**

```bash
nohup npm run start > /tmp/server-ncm9.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s "http://localhost:3000/api/dashboard/cafe-rebot" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log('near_completion_count (OwnerLayout이 이 값을 그대로 배지에 사용):', data.near_completion_count);
  });
"
pkill -f "tsx server.ts"
```
Expected: 에러 없이 숫자 값 출력 (브라우저 육안 확인은 샌드박스 제약으로 대체 — `run` 스킬이나 Playwright가 가능한 환경이라면 `/dashboard/cafe-rebot` 접속 후 Sidebar/BottomNav의 "고객 관리" 항목 옆 배지와 클릭 시 완주 임박 탭으로 바로 이동하는지 육안 확인 권장).

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx src/components/BottomNav.tsx
git commit -m "feat: 대시보드 배지(완주 임박 고객 수) 및 딥링크 추가"
```

---

## Self-Review

**스펙 커버리지:**
- `docs/superpowers/specs/2026-07-06-near-completion-messaging-design.md`의 "1. 완주 임박 전용 메시지 문구/AI 프롬프트" → Task 2.
- "2. 메시지 타입 구분 (스키마)" → Task 1, Task 4.
- "3. 선택 + 일괄 발송 플로우" → Task 3, Task 5, Task 6.
- "4. 알림 자동화 (대시보드 배지)" → Task 7, Task 8, Task 9.
- "5. 범위 밖" 항목(실 SMS 연동, 완전 자동 발송, 다단계 임계값, 다른 탭으로의 선택 기능 확장) — 어느 태스크도 해당 영역을 건드리지 않음.

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함. Task 3의 검증 스크립트에 남아있는 `<CONSENT_ID>` 등의 자리표시자는 "실행 전 실제 값으로 치환"이라고 단계에서 명시적으로 안내됨(플레이스홀더가 아니라 실행자가 채워야 할 런타임 값).

**타입/시그니처 일관성:** `Message.message_type`(Task 1) → `addMessageDraft(..., messageType)`(Task 1) → `/api/generate-near-completion-messages`가 `addMessageDraft(store_code, customerId, content, 'near_completion')` 호출(Task 3) → `MessageList`의 `msg.message_type === 'near_completion'` 배지 조건(Task 4) 전체에서 일관됨. `isNearCompletion(currentStamps, stampGoal, threshold)`(Task 7) 시그니처가 `getCustomers`(Task 7)와 대시보드 핸들러(Task 8) 양쪽에서 동일하게 사용됨. `CustomerTable`의 `selectable`/`selectedIds`/`onToggleSelect`/`onToggleSelectAll`(Task 5)가 `CustomersPage`의 호출부(Task 6)와 이름·타입이 일치함. `resolveInitialCustomerTab`(Task 9)의 반환 타입이 `activeTab`의 `useState` 타입과 일치함.

## 다음 단계

이 계획을 승인하면 `subagent-driven-development` 또는 `executing-plans` 스킬로 태스크별 구현을 시작한다.
