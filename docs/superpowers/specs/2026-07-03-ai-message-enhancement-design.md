# AI 메시지 고도화 설계 (2026-07-03)

## 배경

`docs/superpowers/specs/2026-07-03-backlog-reprioritization.md`의 2순위 항목. 요구사항 원문: "AI 메시지 고도화 (실제 방문데이터 프롬프트 반영, 기획서 작성기준 명시적 적용, 재생성 버튼 추가)".

**현재 상태**
- `src/lib/prompts.ts`의 `buildMessagePrompt(customerName, churnStage, rewardDesc, storeName, signature)`는 실제 방문 이력(총방문수, 마지막 방문일, 스탬프 현황)을 전혀 사용하지 않는다.
- 기획서(`../rebot-planning-doc/index.html` §9 "AI 메시지 생성 원칙 / 메시지 작성 기준")에 명시된 규칙(존댓말, 2~3문장 이내, 메뉴명·금액 언급 금지, 과도한 친밀감 배제, 매장명/서명 마무리)이 현재 프롬프트에 반영되어 있지 않다.
- `src/lib/db-server.ts`의 `addMessageDraft()`는 항상 새 `messages` row를 insert한다 — 재생성이라는 개념이 없다.
- 마케팅 미동의 고객 발송 차단(`App.tsx:521-527`, `MessageList.tsx:120`)과 30일 내 재발송 경고(`MessageList.tsx:86-93`, `last_sent_within_30d`)는 이미 구현되어 있어 이번 작업 범위에서 제외.

## 설계

### 1. 프롬프트 확장

`buildMessagePrompt()`에 방문데이터 파라미터를 추가한다: `totalVisits`(총방문수), `daysSinceLastVisit`(마지막 방문 경과일수, `last_visit_at`이 없으면 null), `currentStamps`/`stampGoal`(스탬프 현황). `generateAIMessage()`(`src/lib/ai-server.ts`) 시그니처도 동일하게 확장해 전달한다.

**프롬프트 템플릿 (사용자 검토 완료, 2026-07-03 기준 확정)**

```
당신은 카페/베이커리 매장 "{storeName}"을 운영하는 사장님입니다.
아래 고객 정보를 참고해 이 고객에게 보낼 재방문 유도 메시지를 작성해주세요.

[고객 정보]
- 이름: {customerName}
- 이탈 단계: {churnStage} (safe: 최근 방문, watch: 관심 필요, danger: 이탈 위험, churned: 장기 미방문)
- 총 방문 횟수: {totalVisits}회
- 마지막 방문: {daysSinceLastVisit}일 전
- 현재 스탬프: {currentStamps}/{stampGoal}개
- 매장 리워드: {rewardDesc}

[작성 규칙 — 반드시 지킬 것]
1. 한국어 존댓말, 사장님이 직접 안부를 묻는 듯한 자연스러운 톤으로 작성한다.
2. 전체 분량은 2~3문장 이내로 작성한다 (카카오 알림톡 발송을 고려).
3. 특정 메뉴명이나 결제 금액을 직접 언급하지 않는다.
4. 과도한 친밀감이나 "감시받는 느낌"을 주는 표현(예: 방문 횟수를 지적하는 뉘앙스)은 피한다.
5. 마지막은 매장명 또는 아래 서명으로 마무리한다: "{signature}"

메시지 본문만 반환하세요 (따옴표나 설명 없이).
```

`daysSinceLastVisit`이 `null`인 경우(방문 이력이 없는 신규 고객) `[고객 정보]` 블록에서 해당 줄은 생략한다. `customerName`이 `null`인 경우 기존과 동일하게 `'고객'`으로 대체한다(`api-handlers.ts:165`의 기존 처리 유지).

### 2. 재생성 = 해당 draft 덮어쓰기

- UI: `MessageList.tsx`의 각 draft 카드(삭제/편집/발송 버튼 옆)에 "재생성" 버튼을 추가한다.
- API: 신규 엔드포인트 `POST /api/messages/:id/regenerate` (body: `{store_code}`). 해당 `messages` row의 `customer_id`로 고객·매장 데이터를 다시 조회 → `generateAIMessage()` 재호출 → `patchMessage()`로 같은 row의 `content`만 교체한다. 새 row는 생성하지 않는다.
- 기존 "AI 메시지 생성" 버튼(고객 상세 페이지)은 변경하지 않는다 — 지금처럼 `addMessageDraft()`로 새 draft를 insert하는 최초 생성 전용으로 유지한다.

### 3. 범위 밖 (변경하지 않음)

- 마케팅 미동의 발송 차단, 30일 내 재발송 경고 — 이미 구현되어 있어 그대로 둔다.
- 고객 상세 페이지의 최초 생성 버튼 동작 — 변경 없음.
- SNS 콘텐츠 생성(`generateAIPost`, `buildPostPrompt`) — 이번 스펙은 메시지 생성에만 한정.

## 사용자 확정 사항

- 방문데이터 필드 범위: 총방문수 + 마지막 방문일로부터 경과일수 + 현재스탬프/목표 (visit_logs 상세 이력까지는 포함하지 않음).
- 재생성 시 기존 draft의 content를 덮어쓴다 (새 row 생성 안 함).
- 재생성 버튼은 `MessageList`의 각 draft 카드에만 배치한다 (고객 상세 페이지에는 추가하지 않음).
- 프롬프트 템플릿 문구는 사용자가 직접 검토 후 "우선 진행"으로 승인함 — 실제 코드 작성(`writing-plans`) 단계에서 이 문구를 그대로 사용하되, 필요시 사용자가 재검토/수정할 수 있다.

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
