# 통일된 메시지 생성 로직 + 범용 벌크 발송 설계 (2026-07-06, 3차)

## 배경

`docs/superpowers/specs/2026-07-06-near-completion-messaging-design.md`(2차, PR #14 — 아직 `dev` 미병합)에서 완주 임박 전용 메시지 파이프라인과 "완주 임박" 탭 전용 체크박스 선택+일괄생성 기능을 구현했다. 사용자가 실제로 확인해보니 두 가지 문제가 드러났다:

1. 완주 임박 메시지를 만들려면 고객 상세페이지가 아니라 "완주 임박" 탭에서 체크박스를 선택해야 하는 별도 플로우라 사용자 입장에서 이해하기 복잡함.
2. 이탈 단계와 완주 임박은 서로 독립적인 축이라, 한 고객이 이탈 탭과 완주 임박 탭에 동시에 나타날 수 있는데, 이 경우 어떤 메시지를 보내야 하는지 규칙이 없었음.

추가로 사장님이 고객이 많을 때는 이탈/정상 고객에게도 벌크 발송을 하고 싶다는 요구가 확인됨 — "완주 임박 탭에서만 벌크 가능"이라는 1차 스코프 제약이 더 이상 유효하지 않음.

**이번 작업(3차)은 PR #14의 브랜치(`feat/near-completion-messaging`)가 아직 `dev`에 병합되지 않았으므로, 같은 브랜치 위에서 이어서 작업한다.** 별도 브랜치로 분리하지 않는다.

## 핵심 설계 원칙

**"어떤 메시지를 생성할지"는 트리거 방식(상세페이지 개별 버튼 / 어느 탭에서든 체크박스 벌크 선택)과 무관하게, 서버의 단일 판단 규칙이 결정한다.** 완주 임박 조건을 만족하면 완주 임박 메시지, 아니면 이탈 단계 기반 메시지 — **완주 임박이 이탈보다 우선**한다.

## 현재 상태 (2차 작업 결과)

- `src/lib/ai-server.ts`: `generateAIMessage(...)`(이탈 기반, `churn_stage` 인자로 톤 결정)와 `generateNearCompletionMessage(...)`(완주 임박 전용)가 완전히 분리된 별도 함수로 존재. 각각의 프롬프트 빌더(`buildMessagePrompt`/`buildNearCompletionMessagePrompt`)도 분리 유지 — **이 둘은 변경하지 않는다**.
- `src/lib/db-server.ts`: `isNearCompletion(currentStamps, stampGoal, threshold): boolean` 공용 함수 존재 (`getCustomers`의 근접완주 필터, 대시보드 카운트에서 재사용 중).
- `src/lib/api-handlers.ts:182-211` (`POST /api/generate-message`, 상세페이지 개별 버튼용)와 `:245-281` (`POST /api/messages/:id/regenerate`, 재생성 버튼용) 둘 다 항상 `generateAIMessage(...)`만 호출하고 `addMessageDraft(store_code, customer_id, content)`를 `messageType` 인자 없이 호출(기본값 `'winback'`) — 완주 임박 여부를 전혀 고려하지 않음.
- `src/lib/api-handlers.ts:353-` (`POST /api/generate-near-completion-messages`): 완주 임박 전용 벌크 API. 항상 `generateNearCompletionMessage(...)`만 호출.
- `src/lib/db-server.ts:372-391` (`patchMessage`): 화이트리스트에 `content`/`status`/`sent_at`만 있고 `message_type`은 없음 — 재생성 시 메시지 타입을 바꿀 수 없는 상태.
- `src/App.tsx:466` (`CustomersPage`): `<CustomerTable selectable={activeTab === 'near_completion'} ...>` — "완주 임박" 탭에서만 체크박스 선택 가능.
- `src/App.tsx:293-314` (`handleBulkGenerate`): `POST /api/generate-near-completion-messages`를 호출하는 완주 임박 전용 핸들러.
- `src/App.tsx:428-446`: 액션 바가 `activeTab === 'near_completion'`일 때만 나타나고, 버튼 문구가 "완주 임박 메시지 초안 일괄 생성"으로 고정.
- `src/App.tsx:573-` (`handleGenerateMessage`, 상세페이지): 버튼 라벨 "AI 맞춤 복귀 제안 생성"(:674), 성공 토스트 "AI 기반 개인맞춤 혜택 복귀 제안 메시지가 신규 생성되었습니다!"(:583) — 둘 다 이탈 회복 전제 문구로 고정.

## 설계

### 1. 통일된 메시지 생성 판단 로직 (서버)

`src/lib/ai-server.ts`에 신규 함수 추가:

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

- `decideMessageType`은 `db-server.ts`의 `isNearCompletion`을 가져와 재사용한다(import 추가만, 함수 자체는 변경 없음).
- `generateMessageForCustomer`는 기존 `generateAIMessage`/`generateNearCompletionMessage`를 그대로 호출하는 얇은 오케스트레이션 계층 — 두 함수의 내부 프롬프트/폴백 로직은 전혀 건드리지 않는다.
- **범위 밖(이번엔 하지 않음):** `generateAIMessage`와 `generateNearCompletionMessage` 사이의 OpenRouter/Gemini 폴백 체인 중복 제거 — 2차 최종 리뷰에서 별도 기술부채로 남기기로 이미 확정됨. 이번 작업과 무관하게 그대로 둔다.

### 2. 기존 API들이 통일 로직을 사용하도록 변경

**`POST /api/generate-message`** (`api-handlers.ts:182-211`): `generateAIMessage` 직접 호출 대신 `generateMessageForCustomer(...)` 호출, 반환된 `messageType`을 `addMessageDraft(store_code, customer_id, content, messageType)`에 전달.

**`POST /api/messages/:id/regenerate`** (`api-handlers.ts:245-281`): 동일하게 `generateMessageForCustomer(...)`로 교체. 재생성 시점의 고객 최신 상태(`getCustomerById`로 다시 조회한 `current_stamps` 등)를 기준으로 **매번 새로 판단**한다(고정된 이전 타입을 유지하지 않음 — 사용자 확정 사항). 반환된 `messageType`을 `patchMessage(store_code, messageId, { content, message_type: messageType })`에 반영.

**`patchMessage`** (`db-server.ts:372-391`): 화이트리스트에 추가:
```typescript
if (updates.message_type !== undefined) dbUpdates.message_type = updates.message_type;
```

**`POST /api/generate-near-completion-messages`는 폐기**하고, 아래 3번의 범용 벌크 API로 대체한다 (PR #14가 아직 `dev`에 병합되지 않아 하위호환 부담 없음).

### 3. 범용 벌크 API

`POST /api/generate-near-completion-messages`를 **`POST /api/generate-messages/bulk`**로 교체한다.

```
Request:  { store_code, customer_ids: string[] }
Response: { generated: number, skipped_no_consent: number }
```

동작: `customer_ids`를 순회하며 각 고객에 대해 `getCustomerById` → 마케팅 미동의 스킵 → `generateMessageForCustomer(...)` 호출 → `addMessageDraft(..., messageType)` 저장. 존재하지 않는 ID는 조용히 스킵. 순차 처리(동시 다발 AI 호출 방지) 유지 — 기존 벌크 API의 안전장치를 그대로 승계한다.

**핵심 효과:** 벌크 요청 하나에 완주 임박 고객과 이탈 고객이 섞여 있어도, 고객별로 알맞은 메시지 타입이 자동으로 갈린다.

### 4. 체크박스 선택 UI를 모든 탭으로 확장

- `App.tsx:466`의 `selectable={activeTab === 'near_completion'}`를 `selectable={true}`로 변경 — 전체/주의/위험/이탈/완주임박 모든 탭에서 체크박스 선택 가능.
- `App.tsx:428`의 액션 바 노출 조건 `activeTab === 'near_completion' && selectedIds.size > 0`에서 탭 조건 제거 → `selectedIds.size > 0`.
- 액션 바 버튼 문구(`App.tsx:442`) "선택한 N명에게 완주 임박 메시지 초안 일괄 생성" → **"선택한 N명에게 메시지 초안 일괄 생성"**로 범용화.
- 완료 토스트 문구(`App.tsx:307`) "완주 임박 메시지 초안 N건 생성 완료" → **"메시지 초안 N건 생성 완료"**로 범용화.
- `handleBulkGenerate`(`App.tsx:293-314`)의 fetch URL을 `/api/generate-near-completion-messages` → `/api/generate-messages/bulk`로 변경.
- "완주 임박 🎁" 필터 탭 자체(1차 작업분)는 그대로 유지 — 완주 임박 고객만 모아보는 조회 용도로는 여전히 유효하다. 이번 변경은 "그 탭에서만 벌크 가능하다"는 제약만 제거하는 것이다.

### 5. 상세페이지 버튼/토스트 문구 통일

`src/App.tsx`의 `CustomerDetailPage`:
- 버튼 라벨(:674) "AI 맞춤 복귀 제안 생성" → **"고객 맞춤 메시지 생성"** (고객이 이탈이든 완주임박이든 문구 고정, 조건부 분기 없음).
- 성공 토스트(:583) "AI 기반 개인맞춤 혜택 복귀 제안 메시지가 신규 생성되었습니다!" → **"고객 맞춤 메시지가 생성되었습니다"**.
- `handleGenerateMessage`가 호출하는 API(`POST /api/generate-message`)는 이미 2번에서 통일 로직을 쓰도록 바뀌었으므로, 이 페이지의 코드 변경은 문구만 바꾸는 것으로 끝난다 — 별도 조건 분기나 신규 API 필드 불필요.
- 생성된 메시지가 실제로 어떤 타입이었는지는 메시지 목록 페이지의 "🎁 완주 임박" 배지(기존 구현, 변경 없음)로 확인한다.

## 범위 밖

- `generateAIMessage`/`generateNearCompletionMessage` 사이의 폴백 체인 중복 제거 (기술부채로 별도 기록, 2차 최종 리뷰에서 이미 확정).
- AI 메시지 생성 시 사장님이 조건/지시문을 직접 입력하는 기능 — **후속 백로그 항목으로 기록만 한다.**
- 사장님이 최종 수정한 메시지를 DB에 저장해 향후 학습(파인튜닝 등) 자료로 활용하는 기능 — **후속 백로그 항목으로 기록만 한다.**
- 완주 임박 필터 탭의 UI/조회 로직 변경 (1차 작업분 그대로 유지).

## 사용자 확정 사항

- 완주 임박 메시지 생성 트리거를 이탈 메시지와 동일한 방식(상세페이지 개별 버튼 + 모든 탭 공통 벌크 선택)으로 통일한다.
- 이탈+완주임박 동시 해당 고객은 완주 임박을 우선한다.
- 재생성 버튼은 재생성 시점의 현재 상태를 기준으로 매번 새로 판단한다(고정 타입 유지 아님).
- 체크박스 선택+벌크 생성 UI는 완주 임박 탭 전용에서 모든 탭 공통으로 확장한다.
- 상세페이지 버튼/토스트 문구는 고객 상태와 무관하게 "고객 맞춤 메시지 생성" / "고객 맞춤 메시지가 생성되었습니다"로 통일한다.
- 이번 작업은 PR #14의 브랜치(`feat/near-completion-messaging`) 위에서 이어서 진행한다.

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
