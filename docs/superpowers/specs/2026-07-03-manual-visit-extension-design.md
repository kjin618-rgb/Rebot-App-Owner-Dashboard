# 방문 등록 메뉴/날짜 확장 설계 (2026-07-03)

## 배경

`docs/superpowers/specs/2026-07-03-backlog-reprioritization.md`의 4순위 항목. 요구사항 원문: "고객 수동 입력 란이 있는데, 이때 번호뿐 아니라 메뉴, 방문 날짜로 선택할 수 있도록 항목 추가".

**현재 상태**
- `src/App.tsx`의 `CustomerDetailPage` "스탬프 수동 적립" 폼(`handleManualStamp`, 약 585줄)은 "적립할 스탬프 개수"만 입력받아 `POST /api/visit/:store_code` (body: `{customer_id, stamps}`)를 호출한다.
- `src/lib/db-server.ts`의 `recordManualVisit(storeCode, customerId, stamps)`가 이를 처리한다. `visit_logs`에 `{ customer_id, store_id, visited_at: now(), stamps_earned, source: 'manual' }`을 insert하고(코드 확인 결과 `source`는 이미 정확히 `'manual'`), `customers.current_stamps`/`total_stamps`/`total_visits`를 증가시키며 **`last_visit_at`을 무조건 `now()`로 덮어쓴다**.
- `visit_logs` 테이블에 메뉴 관련 컬럼이 없다.
- 메뉴 마스터 데이터(메뉴 목록 테이블)가 프로젝트에 전혀 없다.

## 스코프 결정

- **방문 날짜**: 소급 입력(backdate) 지원 — 사장님이 과거 날짜를 지정해 방문 기록을 남길 수 있다.
- **메뉴**: 자유 텍스트 입력. 메뉴 마스터 목록 관리 기능은 만들지 않는다.
- **사용 목적**: 순수 기록용. AI 메시지 연동, 메뉴 통계/리포트는 이번 스코프에 포함하지 않는다 (기획서가 AI 메시지에 메뉴명·금액 언급을 금지하므로 AI 활용 경로 자체가 없음 — 백로그 재우선순위 문서의 기존 판단 재확인됨).

## 설계

### 1. 스키마

```sql
ALTER TABLE visit_logs ADD COLUMN menu TEXT NULL;
```

### 2. API

`POST /api/visit/:store_code` body 확장: `{ customer_id: string, stamps?: number, menu?: string, visited_at?: string }`

- `menu`: 선택, 미입력 시 `null`
- `visited_at`: 선택(ISO 8601 문자열), 미입력 시 현재 시각(`now()`) 사용 — 기존 동작과 동일하게 유지

### 3. `recordManualVisit` 로직 변경 (핵심)

**변경 전**: `customers.last_visit_at`을 호출 시점의 `now()`로 무조건 덮어씀.

**변경 후**: 소급 입력을 지원하려면 `last_visit_at`이 실제로 가장 최근 방문일을 반영해야 한다. 방식:

1. 지정된 `visited_at`(또는 미지정 시 `now()`)으로 `visit_logs`에 새 row를 insert한다.
2. 그 고객의 `visit_logs` 전체에서 `visited_at` 최댓값을 다시 조회한다.
3. `customers.last_visit_at`을 그 최댓값으로 업데이트한다 (새로 넣은 방문이 가장 최근이면 그 값, 더 과거를 소급 입력한 경우 기존 최근 방문일이 그대로 유지됨).
4. `total_visits`/`current_stamps`/`total_stamps`는 기존과 동일하게 호출 시마다 증가시킨다 (소급 입력이어도 스탬프는 적립되는 것으로 처리 — 사용자 확정).

이렇게 하면 "어제 방문을 오늘 소급 입력"해도 오늘 날짜의 실제 최근 방문(있다면)이 `last_visit_at`에서 뒤로 밀리지 않는다.

### 4. UI

"스탬프 수동 적립" 폼(`CustomerDetailPage`)에 필드 추가:
- 메뉴: 텍스트 입력 (선택, placeholder "예: 아메리카노, 소금빵")
- 방문 날짜: `<input type="date">`, 기본값 오늘 날짜

### 5. 범위 밖 (변경하지 않음)

- 메뉴 마스터 관리(등록/수정 화면) — 자유 텍스트로 대체
- AI 메시지 프롬프트에 메뉴 반영 — 기획서가 금지하므로 해당 없음
- 메뉴별 판매 통계/리포트 — 이번 스코프 아님
- 고객 앱(페어 레포)의 `source: 'kiosk'` 경로 — 대시보드 단독 작업, 페어 레포는 건드리지 않음

## 사용자 확정 사항

- 방문 날짜는 과거 날짜 소급 입력(backdate)을 지원한다.
- 소급 입력 시 `last_visit_at`은 해당 고객의 `visit_logs` 전체 중 최신 `visited_at` 값으로 재계산한다 (무조건 `now()` 덮어쓰기 방식에서 변경).
- 메뉴는 자유 텍스트, 메뉴 마스터 관리 기능 없음.
- 이 기능은 순수 기록용이며, AI 연동이나 통계 활용 계획은 없음.

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
