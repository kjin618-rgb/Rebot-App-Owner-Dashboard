# KPI 실계산 전환 설계 (2026-07-03)

## 배경

`docs/superpowers/specs/2026-07-03-backlog-reprioritization.md`의 5순위 항목. 요구사항 원문: "`/api/metrics` 하드코딩값(68.5% 등)을 실제 집계로 전환".

**스코프 결정**: 6개 지표 중 단순 집계가 가능한 2개(`stamp_completion_rate`, `second_visit_rate_30d`)만 이번에 실계산으로 전환한다. 메시지 발송-재방문 상관관계가 필요한 3개(`message_revisit_rate`, `no_message_revisit_rate`, `incremental_revisit_rate`)는 하드코딩을 유지하고 다음 단계에서 재검토한다. `marketing_consent_rate`는 이번 스코프에서 다루지 않는다(별도 확인 필요 시 후속).

**현재 상태**
- `src/lib/api-handlers.ts`의 `GET /api/metrics/:store_code`(약 329-341줄)가 6개 지표 전부 고정 상수를 반환한다.

## 핵심 발견 — 스탬프 리셋 로직 부재 및 필드 매핑 버그

브레인스토밍 중 아래 문제를 발견해 이번 스코프에 함께 포함하기로 확정했다(사용자 확정).

1. **리셋 로직 부재**: `addStamp()`/`recordManualVisit()`이 `current_stamps`를 `stamp_goal` 도달 여부와 무관하게 계속 누적만 한다. `DEV_SPEC.md`에는 "리워드 달성 시 0 리셋"이라 문서화되어 있지만 실제 구현이 없다.
2. **매핑 버그**: `src/lib/db-server.ts`의 `toCustomer()` 매퍼가 API의 `total_stamps` 필드를 DB의 `current_stamps` 컬럼값으로 채운다. DB에 별도로 존재하는 진짜 누적 `total_stamps` 컬럼은 계속 정확히 기록되지만(`addStamp`/`recordManualVisit`에서 매번 증가) API 응답 어디서도 읽히지 않는 죽은 데이터였다.
3. **AI 메시지 기능의 오염**: `src/lib/api-handlers.ts`의 `generate-message`/`regenerate` 라우트가 "현재 스탬프" 정보로 `detail.customer.total_stamps`를 `generateAIMessage()`에 넘기는데, 위 매핑 버그 때문에 우연히 지금까지는 "현재 카드 진행도"가 들어갔다. 이 버그를 고치면 해당 필드가 사용하는 이름/값의 의미가 바뀌므로 AI 메시지 코드도 함께 고쳐야 한다.

**중요**: DB의 진짜 누적 `total_stamps` 컬럼 자체는 처음부터 계속 정확하게 기록되어 왔다 — 죽은 데이터일 뿐 손상된 데이터는 아니다. 따라서 기존 고객 데이터는 이 값을 기준으로 정확히 보정(backfill)할 수 있다.

## 설계

### 1. 리셋 로직 수정

`addStamp()`, `recordManualVisit()`에서 스탬프 추가 시:

```
newTotalStamps = existing.total_stamps + count   // 진짜 누적, 계속 그대로 증가
newCurrentStamps = newTotalStamps % storeRow.stamp_goal   // 현재 카드 진행도, 리셋 반영
```

`current_stamps: newCurrentStamps`, `total_stamps: newTotalStamps`로 update한다. 신규 고객 생성(`addStamp`에서 `!existing`인 경우)도 동일 공식을 적용한다 (`count`가 `stamp_goal`을 넘는 극단적 경우까지 대비).

### 2. 타입/필드 정리

- `Customer` 타입에 `current_stamps: number` 신규 추가 (현재 카드 진행도, 0 ~ `stamp_goal - 1`)
- `total_stamps`는 DB의 진짜 누적 `total_stamps` 컬럼을 그대로 매핑하도록 수정 (지금까지의 `row.current_stamps` 참조를 `row.total_stamps`로 교체)
- `src/lib/api-handlers.ts`의 `generate-message`/`regenerate` 두 라우트에서 `generateAIMessage()` 호출 시 넘기는 "현재 스탬프" 인자를 `detail.customer.total_stamps` → `detail.customer.current_stamps`로 변경

### 3. 기존 데이터 보정 (1회성 SQL, Supabase 대시보드에서 수동 실행)

```sql
UPDATE customers c
SET current_stamps = c.total_stamps % s.stamp_goal
FROM stores s
WHERE c.store_id = s.id;
```

DB의 `total_stamps`가 처음부터 정확했으므로, 이 한 번의 업데이트로 모든 기존 고객의 `current_stamps`가 올바른 리셋 반영 값으로 보정된다.

### 4. KPI 계산식

**`stamp_completion_rate`** (목표 스탬프를 채워 혜택을 받은 고객 비율):
```
completed_customers = 매장 내 고객 중 floor(total_stamps / stamp_goal) >= 1 인 고객 수
stamp_completion_rate = completed_customers / 전체 고객 수 × 100
```

**`second_visit_rate_30d`** (첫 방문 후 30일 이내 재방문율):
```
고객별로 visit_logs를 visited_at 오름차순 정렬
first_visit = 가장 이른 visited_at
second_visit = 그 다음으로 이른 visited_at (있다면)
"30일 이내 재방문" 조건 = second_visit이 존재하고 (second_visit - first_visit) <= 30일

second_visit_rate_30d = 조건을 만족하는 고객 수 / 전체 고객 수 × 100
```

두 지표 모두 Supabase JS 클라이언트로 해당 매장의 `customers`/`visit_logs`를 조회한 뒤 애플리케이션 코드(JS)에서 집계한다 (이 프로젝트엔 raw SQL 실행 경로가 없음).

### 5. 범위 밖 (변경하지 않음)

- `message_revisit_rate`, `no_message_revisit_rate`, `incremental_revisit_rate` — 하드코딩 유지
- `marketing_consent_rate` — 이번 스코프 아님
- `PerformanceCard.tsx`의 UI 표시 방식 — 변경 없음 (값만 실계산으로 교체)

## 사용자 확정 사항

- 스탬프 리셋 로직 부재 및 `total_stamps`/`current_stamps` 매핑 버그를 이번 작업 범위에 함께 포함한다.
- 기존 데이터는 DB의 정확한 누적 `total_stamps` 컬럼 기준으로 1회성 SQL 보정한다.
- `second_visit_rate_30d`는 "첫 방문 → 두 번째 방문까지 간격이 30일 이내"로 정의한다.

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
