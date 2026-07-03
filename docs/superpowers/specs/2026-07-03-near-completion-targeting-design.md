# 쿠폰 달성 임박 타겟팅 설계 (2026-07-03, 1차)

## 배경

`docs/superpowers/specs/2026-07-03-backlog-reprioritization.md`의 6순위(마지막) 항목. AI 메시지 고도화 작업 리뷰 중 사용자가 제안: 사장님이 설정한 임계값(예: 80%) 이상 스탬프를 채운 고객을 별도로 조회해 완주를 유도하는 기능.

**1차 스코프 결정 (사용자 확정)**: 이번엔 "임계값 설정 + 타겟팅 조회/표시"까지만 한다. 전용 메시지 문구/AI 프롬프트, 발송 플로우는 후속 작업으로 분리한다. 이탈 위험 축(오래 안 옴)과는 별개인 완주 임박 축(스탬프 거의 참)이므로 기존 이탈 단계 필터와 병행하는 새 필터로 만든다.

**현재 상태**
- `src/types/index.ts`의 `Store` interface에 임계값 관련 필드 없음.
- `src/lib/db-server.ts`의 `updateStore(storeCode, settings: Partial<Store>)`가 화이트리스트 방식으로 필드별 업데이트를 지원 (해당 화이트리스트에 추가만 하면 새 필드 저장 가능).
- `src/App.tsx`의 `SettingsPage`(1078줄부터)가 매장 설정 폼(매장명/사장님명/스탬프 목표/리워드 설명/서명)을 관리.
- `src/lib/db-server.ts`의 `getCustomers(storeCode, filter)`(119-132줄)가 `filter === 'all'`이면 전체, 아니면 `customers.churn_stage === filter`로 필터링. 완주 임박은 이 로직과 무관한 새 조건이라 별도 분기가 필요.
- 최근 완료된 KPI 작업(백로그 5번)에서 `Customer.current_stamps`(카드 진행도, `stamp_goal` 도달 시 리셋 반영)와 `total_stamps`(진짜 누적)가 정확히 분리됨 — "완주 임박"은 `current_stamps`/`stamp_goal` 비율로 정확히 판단 가능.
- `src/App.tsx`의 `CustomersPage`(182줄부터)가 `activeTab`(`'all'|'watch'|'danger'|'churned'`) 탭 UI로 `GET /api/customers/:store_code?filter=X`를 호출.

## 설계

### 1. 스키마

```sql
ALTER TABLE stores ADD COLUMN near_completion_threshold INT NOT NULL DEFAULT 80;
```

퍼센트 정수(0~100)로 저장한다 (예: `80` = 80%). 매장당 단일 값 (사용자 확정 — 다단계 아님).

### 2. 설정 API/UI

- `Store` 타입에 `near_completion_threshold: number` 추가.
- `updateStore()`의 화이트리스트에 `near_completion_threshold` 추가.
- `SettingsPage`에 "완주 임박 알림 기준(%)" 입력 필드 추가 (숫자 input, 0-100 범위, "스탬프 목표" 필드 근처에 배치). 사장님이 직접 설정 가능 (사용자 확정).

### 3. 타겟팅 조건

```
completion_ratio = (current_stamps / stamp_goal) * 100
completion_ratio >= near_completion_threshold  →  "완주 임박" 고객으로 분류
```

`current_stamps`는 최근 KPI 작업에서 리셋이 정확히 반영되도록 고쳐졌으므로, 리셋 직후(0으로 돌아간) 고객은 자동으로 이 조건에서 제외된다 — 항상 "현재 진행 중인 카드" 기준으로 판단한다.

### 4. API

`GET /api/customers/:store_code?filter=near_completion`

`getCustomers()`에 분기 추가:
```
if (filter === 'near_completion') {
  storeRow.stamp_goal, storeRow.near_completion_threshold 기준으로
  completion_ratio >= threshold 인 고객만 필터링
} else if (filter === 'all') {
  전체
} else {
  기존과 동일하게 churn_stage 기준 필터링
}
```

### 5. UI

`CustomersPage`의 탭 목록에 "완주 임박" 탭 추가 (기존 전체/관심/위험/이탈 옆에 나란히). 클릭 시 `?filter=near_completion` 호출, 결과는 기존 `CustomerTable` 컴포넌트를 그대로 재사용해 표시한다 (별도 테이블 컴포넌트 불필요 — 컬럼 구성이 동일함).

### 6. 범위 밖 (후속 작업으로 분리)

- 완주 임박 전용 AI 메시지 문구/프롬프트
- 이 타겟에게 메시지를 발송하는 별도 플로우/버튼
- 알림 자동화(예: 임계값 도달 시 자동 알림)
- 다단계 임계값 지원

## 사용자 확정 사항

- 1차 스코프: 임계값 설정 + 타겟팅 조회/표시까지만. 메시지 발송은 후속.
- 임계값은 매장당 단일 값, 사장님이 설정 페이지에서 직접 설정.
- 완주 임박 고객 목록은 `CustomersPage`에 새 탭으로 추가 (별도 화면 아님).

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
