# 고객 메모 필드 설계 (2026-07-03)

## 배경

`docs/superpowers/specs/2026-07-03-backlog-reprioritization.md`의 3순위 항목. 요구사항 원문: "고객 메모 필드 추가 (AI 메시지 고도화에 활용)".

**현재 상태**
- `customers` 테이블/타입(`src/types/index.ts`의 `Customer` interface)에 메모 관련 필드가 전혀 없다.
- `src/components/CustomerTable.tsx`, 고객 상세 페이지(`src/App.tsx`의 `CustomerDetailPage`) 어디에도 메모 UI가 없다.
- 고객 정보를 수정하는 API/함수 자체가 존재하지 않는다 (`addStamp`/`recordManualVisit`만 있고, 일반 필드 업데이트 경로가 없음) — 이번 작업에서 이 업데이트 경로 자체를 새로 만들어야 한다.
- AI 메시지 프롬프트(`buildMessagePrompt`)는 최근 리비전으로 구조가 확정됨(인사→기억/상황→방문이유→혜택/한정성→행동유도, 1,000자 이내, 메뉴명·금액 언급 금지, 과도한 친밀감 배제). 사장님이 적어둔 개인 메모(예: "손님이 까다로움", "항상 지각")가 이 메시지에 그대로 노출되면 안 되므로, AI 연동은 안전장치 설계가 더 필요하다.

## 스코프 결정

**이번 작업은 순수 CRM 메모 필드만 추가한다. AI 프롬프트 연동은 하지 않는다** (사용자 확정). "AI 개인화 재료"라는 원 요구사항의 AI 연동 부분은 별도 후속 작업으로 미룬다 — 개인 메모를 안전하게(고객에게 노출되지 않게) AI에 반영하는 방법은 그 자체로 별도 설계가 필요하기 때문.

## 설계

### 1. 스키마

`customers` 테이블에 컬럼 추가:

```sql
ALTER TABLE customers ADD COLUMN notes TEXT NULL;
```

- 자유 텍스트 하나 (구조화된 태그 아님)
- DB 레벨 길이 제약 없음 (`TEXT`) — 500자 제한은 UI/API 레벨에서만 강제

### 2. API

신규 `PATCH /api/customers/:id` (body: `{ store_code: string, notes: string }`).

- 기존 `PATCH /api/messages/:id`(`patchMessage`), `PATCH /api/settings/:store_code`(`updateStore`)가 이미 "부분 업데이트(Partial)" 패턴을 쓰고 있어 동일 컨벤션을 따른다. 지금은 `notes`만 받지만, 나중에 고객의 다른 필드(예: 이름 수정) 편집이 필요해지면 같은 엔드포인트를 확장하면 된다.
- 서버에서 `notes.length > 500`이면 `400 Bad Request` 반환 (클라이언트 검증 우회 방지).
- `src/lib/db-server.ts`에 `updateCustomerNotes(storeCode: string, customerId: string, notes: string): Promise<Customer>` 함수 신설.

### 3. UI

**고객 상세 페이지** (`src/App.tsx`의 `CustomerDetailPage`, "스탬프 수동 적립" 카드 근처):
- "메모" 카드 추가 — `textarea` + 실시간 글자수 표시(`0/500`) + "저장" 버튼
- 500자 초과 시 저장 버튼 비활성화 + 경고 문구 표시

**고객 목록** (`src/components/CustomerTable.tsx`):
- 메모가 있는(비어있지 않은) 고객의 이름 옆에 작은 아이콘 배지 표시 (예: `StickyNote` 아이콘, lucide-react)
- 메모 내용 자체는 목록에 노출하지 않음 — 존재 여부만 표시

### 4. 범위 밖 (변경하지 않음)

- AI 메시지 프롬프트(`buildMessagePrompt`, `generateAIMessage`)에 메모를 반영하는 작업 — 후속 별도 스펙으로 분리
- 구조화된 태그/카테고리 형태의 메모 — 이번엔 자유 텍스트 하나로 한정

## 사용자 확정 사항

- 스코프: 순수 CRM 메모만 (AI 연동 제외)
- 필드 형태: 자유 텍스트 하나
- 글자수 제한: 500자 이내
- UI: 고객 상세 페이지에 메모 카드 + 고객 목록에는 메모 존재 여부만 아이콘으로 표시 (내용 노출 안 함)
- API 방식: `PATCH /api/customers/:id` (기존 Partial 업데이트 컨벤션 재사용)

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
