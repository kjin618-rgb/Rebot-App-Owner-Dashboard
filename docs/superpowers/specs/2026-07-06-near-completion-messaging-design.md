# 쿠폰 달성 임박 타겟팅 — 2차 설계 (2026-07-06)

## 배경

`docs/superpowers/specs/2026-07-03-near-completion-targeting-design.md`(1차, 배포 완료)에서 임계값 설정과 "완주 임박" 필터 조회/표시까지 구현했다. `docs/superpowers/specs/2026-07-03-backlog-reprioritization.md`에서 후속 작업으로 분리해둔 3가지를 이번에 구현한다:

1. 완주 임박 전용 메시지 문구/AI 프롬프트
2. 발송 플로우 (선택 + 일괄 생성)
3. 알림 자동화 (대시보드 배지)

**현재 상태**
- `generateAIMessage()`(`src/lib/ai-server.ts`)는 `churn_stage`(safe/watch/danger/churned)만 보고 톤을 정하는 "이탈 회복" 전용 프롬프트 구조 — 완주 임박은 이 축과 무관해 그대로 재사용할 수 없다.
- 메시지 생성은 현재 고객 상세페이지의 개별 버튼(`handleGenerateMessage`, `App.tsx:476`)에서만 트리거되며, 1건씩만 처리한다.
- `CustomerTable.tsx`에는 체크박스/선택 기능이 없다.
- `messages` 테이블에는 캠페인 종류를 구분할 컬럼이 없다 — `churn_stage`는 항상 고객의 실제 이탈 단계 스냅샷을 담는다.
- `/api/dashboard/:store_code`(`api-handlers.ts:77`)는 `churn_summary`는 계산하지만 완주 임박 카운트는 없다.
- `Sidebar.tsx`/`BottomNav.tsx`에는 배지 개념이 없다.
- `CustomersPage`의 `activeTab`은 URL과 무관한 로컬 state이며 항상 `'all'`로 시작한다.

## 설계

### 1. 완주 임박 전용 메시지 문구/AI 프롬프트

- `src/lib/prompts.ts`에 `buildNearCompletionMessagePrompt(customerName, currentStamps, stampGoal, rewardDesc, storeName, signature)` 신규 추가.
  - 이탈 언급 없이 "인사 → 스탬프 진행 상황 강조(현재/목표) → 리워드 안내 → 방문 시 적립 방법 안내"의 4단 구조.
  - 인위적 마감기한("오늘까지만" 등 실제로 존재하지 않는 긴급성)은 만들지 않는다.
  - 기존 `buildMessagePrompt`의 작성 규칙(1,000자 제한, 특정 메뉴/금액 언급 금지, 광고 문구·수신거부 태그는 시스템이 별도 부착하므로 본문에 넣지 않음, 서명 포함)은 동일하게 적용한다.
- `src/lib/ai-server.ts`에 `generateNearCompletionMessage(customerName, currentStamps, stampGoal, rewardDesc, storeName, signature): Promise<string>` 신규 추가.
  - 기존 `generateAIMessage`와 동일한 3단 폴백 체인(OpenRouter → Gemini 네이티브 SDK → 템플릿) 구조를 그대로 따른다.
  - 폴백 템플릿 `getNearCompletionFallbackMessage(customerName, currentStamps, stampGoal, rewardDesc, storeName, signature)` 신규 작성 — 톤은 축하/응원 중심(완주가 임박했다는 긍정적 프레이밍), 이탈 관련 표현 없음.
  - 동일하게 `wrapWithComplianceNotice()`로 광고 태그/수신거부 문구를 부착한다.
- 기존 `generateAIMessage`/`buildMessagePrompt`/`getFallbackMessage`는 변경하지 않는다 — 이탈 축과 완주 축을 코드 레벨에서 분리 유지.

### 2. 메시지 타입 구분 (스키마)

```sql
ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'winback';
```

- 값: `'winback'`(기존 이탈 회복 메시지, 기본값) | `'near_completion'`(완주 임박 메시지).
- `src/types/index.ts`의 `Message` interface에 `message_type: 'winback' | 'near_completion';` 추가.
- `src/lib/db-server.ts`의 `addMessageDraft(storeCode, customerId, content, messageType: 'winback' | 'near_completion' = 'winback')` — 파라미터를 추가해 insert 시 `message_type: messageType`을 반영한다. 기존 호출부(`/api/generate-message`, `/api/messages/:id/regenerate`)는 인자를 넘기지 않아 기본값 `'winback'`을 그대로 사용하므로 동작 변화가 없다.
- `toMessage` 매퍼에 `message_type: row.message_type ?? 'winback'` 반영.
- `src/components/MessageList.tsx`에서 `msg.message_type === 'near_completion'`일 때 기존 이탈단계 배지 옆에 "🎁 완주 임박" 배지를 추가로 표시한다(이탈단계 배지는 그대로 유지 — 두 정보는 서로 다른 축이므로 병기).

### 3. 선택 + 일괄 발송 플로우

**범위**: "완주 임박" 탭에만 적용. 다른 이탈 단계 탭(전체/주의/위험/이탈)은 변경하지 않는다. 일괄 동작은 "초안 생성"까지만 처리하고, 초안 검토·수정·실제 발송(상태를 `sent`로 표시)은 기존과 동일하게 메시지 페이지에서 건별로 진행한다.

**`CustomerTable.tsx` 확장** (선택적 props, 미전달 시 기존과 동일하게 동작):
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
```
- `selectable`이 true일 때만 체크박스 컬럼(테이블 맨 앞)을 렌더링한다.
- 헤더에 "전체 선택" 체크박스(현재 목록 전체 대상, 부분 선택 시 indeterminate 상태 표시).
- `customer.marketing_consent === false`인 행은 체크박스를 비활성화한다 — 고객 상세페이지의 기존 규칙("마케팅 미동의 고객은 메시지를 기획할 수 없습니다", `App.tsx:567`)과 동일한 기준을 적용해 애초에 선택 대상에서 제외한다.

**`CustomersPage`(`App.tsx`) 확장**:
- 선택 상태를 `useState<Set<string>>`로 관리, `activeTab === 'near_completion'`일 때만 `CustomerTable`에 `selectable` 관련 props를 전달한다.
- 탭을 전환하거나 필터링된 고객 목록이 바뀌면 선택 상태를 초기화한다.
- `activeTab === 'near_completion'`이고 선택된 고객이 1명 이상일 때만 나타나는 액션 바: "선택한 N명에게 완주 임박 메시지 초안 일괄 생성" 버튼.
- 버튼 클릭 시 로딩 스피너 표시 → API 호출 → 완료 시 토스트: `"N건 생성 완료"` (스킵된 건이 있으면 `"M건은 마케팅 미동의로 제외되었습니다"` 함께 표시) → 선택 상태 초기화.
- 체크박스 1개만 선택한 "개별" 케이스도 동일한 버튼/API로 자연스럽게 처리되므로, 고객 상세페이지에는 완주 임박 전용 생성 버튼을 별도로 추가하지 않는다.

**API**: `POST /api/generate-near-completion-messages`
```json
// Request
{ "store_code": "cafe-rebot", "customer_ids": ["uuid1", "uuid2"] }

// Response
{ "generated": 2, "skipped_no_consent": 0 }
```
- `src/lib/api-handlers.ts`에 신규 라우트 추가. `customer_ids`를 순회하며 각 고객에 대해:
  1. `getCustomerById(store_code, id)`로 고객 상세(및 `store.stamp_goal`, `store.reward_desc` 등) 조회.
  2. `marketing_consent === false`면 스킵하고 `skipped_no_consent` 카운트 증가.
  3. `generateNearCompletionMessage(...)` 호출 후 `addMessageDraft(store_code, id, content, 'near_completion')`으로 저장.
- 존재하지 않는 `customer_id`는 조용히 스킵한다(개별 API처럼 전체 요청을 실패시키지 않음 — 여러 건 중 일부 문제로 전체가 막히지 않도록).
- `addMessageDraft`의 기존 30일 중복발송 감지 로직(`last_sent_within_30d`)은 `message_type`과 무관하게 그대로 적용된다 — 완주 임박 초안도 최근 30일 내 발송 이력이 있으면 동일하게 경고 배지가 붙는다(신규 로직 불필요, 기존 함수를 그대로 재사용하기 때문).

### 4. 알림 자동화 (대시보드 배지)

**데이터 소스**:
- `src/lib/db-server.ts`에 `isNearCompletion(customer: Customer, store: Store): boolean` 공용 함수를 추출한다 — 현재 `getCustomers()`의 `near_completion` 분기에 인라인되어 있는 `(current_stamps / stamp_goal) * 100 >= near_completion_threshold` 계산식을 재사용 가능하게 분리한다(대시보드 집계에서도 동일 로직이 필요해서 하는 최소 리팩터링). `getCustomers()`의 `near_completion` 분기는 이 함수를 호출하도록 교체한다.
- `/api/dashboard/:store_code` 핸들러(`api-handlers.ts`)에서 `getStore(storeCode)`를 추가로 조회(현재 이 핸들러는 store를 조회하지 않음)하고, 응답에 `near_completion_count: customers.filter(c => isNearCompletion(c, store)).length`를 추가한다.

**UI**:
- `OwnerLayout`(`App.tsx:41`)이 이미 `/api/store/:store_code`를 불러오고 있는 `useEffect`에 `/api/dashboard/:store_code` 호출을 추가해 `near_completion_count`를 가져오고, `Sidebar`/`BottomNav`에 prop(`nearCompletionCount?: number`)으로 전달한다.
- `Sidebar`의 "고객 관리" 항목, `BottomNav`의 "고객" 항목 옆에 `count > 0`일 때만 작은 원형 숫자 배지를 표시한다.
- 두 네비게이션 항목의 링크를 `/customers/:store_code?tab=near_completion`로 구성한다(고객 관리로 이동할 때는 배지 유무와 무관하게 항상 이 쿼리를 포함 — 완주 임박 카운트가 있을 때 클릭 한 번으로 바로 확인 가능하게 하기 위함).
- `CustomersPage`가 `useSearchParams()`로 `tab` 쿼리 파라미터를 읽어 `activeTab`의 초기값으로 사용하도록 확장한다(현재는 항상 `'all'`로 시작).

**갱신 방식**: 폴링/웹소켓은 이 프로젝트에 없는 패턴이라 추가하지 않는다. `OwnerLayout` 마운트 시(레이아웃 진입/새로고침 시) 1회 계산 — 다른 페이지들의 "마운트 시 1회 fetch" 패턴과 동일하다.

### 5. 범위 밖

- 실제 SMS/카카오 알림톡 발송 연동 — 기존과 동일하게 "발송" 버튼은 `status='sent'`로 표시만 한다.
- 완주 임박 메시지의 자동 발송(사람 검토 없이) — 초안 생성까지만 자동/일괄화한다.
- 다단계 임계값, 임계값 도달 시점 자동 알림(예: 정확히 방금 임계값을 넘은 순간의 실시간 알림) — 배지는 페이지 진입 시점의 스냅샷 카운트이며 실시간 트리거가 아니다.
- `watch`/`danger`/`churned` 탭에 대한 선택+일괄 생성 기능 확장 — 이번 스코프는 완주 임박 탭 전용이다.

## 사용자 확정 사항

- 완주 임박 메시지 생성은 "완주 임박" 탭 전용 버튼으로 트리거한다(고객 상세페이지의 기존 "재방문 유도" 버튼과는 별개 문구/프롬프트를 쓰는 새 액션).
- 선택+일괄 발송 기능은 완주 임박 탭에만 우선 적용한다.
- "일괄 생성" 버튼은 초안 생성만 하고, 검토/실제 발송은 기존처럼 건별로 처리한다(개별 케이스는 체크박스 1개 선택으로 동일하게 처리 — 별도 개별 버튼 불필요).
- 알림 자동화는 대시보드 내 배지/배너로 구현한다(실 SMS/푸시 연동 없음).

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
