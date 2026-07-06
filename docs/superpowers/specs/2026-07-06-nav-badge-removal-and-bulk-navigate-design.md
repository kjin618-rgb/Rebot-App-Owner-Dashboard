# 사이드바 배지 제거 + 벌크 생성 후 자동 이동 설계 (2026-07-06, 4차)

## 배경

3차 작업(`docs/superpowers/specs/2026-07-06-unified-message-generation-design.md`) 이후 사용자가 실제로 확인해보니 3가지 개선점이 나왔다:

1. "고객 관리" 페이지 진입 시 기본 탭이 "완주 임박"으로 고정되어 있어 혼란스러움 — "전체 고객"이 기본이어야 함.
2. 사이드바/하단 내비게이션의 "고객 관리" 옆 숫자 배지(완주 임박 고객 수)의 용도가 불분명하고 혼란을 줌 — 사용자가 완전히 제거하기로 확정.
3. "완주 임박" 탭에서만이 아니라 모든 탭에서 벌크 선택+생성이 가능해졌는데(3차 작업), 생성 후에도 같은 페이지에 머물러 결과를 확인하려면 "메시지 발송" 페이지로 수동 이동해야 함 — 개별 생성 버튼처럼 자동 이동되면 좋겠음.

## 현재 상태

- `src/components/Sidebar.tsx:15`, `src/components/BottomNav.tsx:14`: "고객 관리"/"고객" nav 항목이 `path: \`/customers/${store_code}?tab=near_completion\`` — 항상 완주 임박 탭으로 딥링크됨. 이게 1번 문제의 원인.
- `nearCompletionCount`/`badge`가 오직 이 두 컴포넌트의 배지 표시에만 쓰임 — 다른 곳(대시보드 카드 등)에서 참조 없음(grep으로 확인).
- `src/App.tsx`의 `OwnerLayout`(44, 58, 65, 99행 부근)이 배지용으로 `/api/dashboard/:store_code`를 fetch해 `nearCompletionCount` state를 채우고 `Sidebar`/`BottomNav`에 prop으로 전달.
- `src/lib/api-handlers.ts:81-94, 121`: `/api/dashboard/:store_code` 핸들러가 `near_completion_count` 계산을 위해 `getStore(storeCode)`를 `Promise.all`에 포함해 조회하고, 응답에 `near_completion_count` 필드를 포함. 이 필드는 프론트엔드 어디에서도 더 이상 소비되지 않게 됨(배지 제거 후).
- `src/App.tsx`의 `handleGenerateMessage`(상세페이지 개별 생성)는 이미 "성공 토스트 표시 → `setTimeout` 후 토스트 지우고 `navigate('/messages/:store_code')`" 패턴을 사용 중.
- `src/App.tsx`의 `handleBulkGenerate`(벌크 생성)는 성공 시 토스트만 4초 후 사라지고, 페이지 이동은 하지 않음.

## 설계

### 1. 사이드바/하단 내비 배지 완전 제거 (+ 기본 탭 전체 고객으로 정정)

- `src/components/Sidebar.tsx`: `SidebarProps`에서 `nearCompletionCount` 제거, nav 항목 배열에서 `badge` 필드 제거, `path`를 `` `/customers/${store_code}?tab=near_completion` `` → `` `/customers/${store_code}` ``로 변경, 배지 렌더링 JSX(`{item.badge > 0 && (...)}`) 제거.
- `src/components/BottomNav.tsx`: 동일하게 `BottomNavProps`의 `nearCompletionCount`, nav 항목의 `badge`, `path`의 쿼리, 배지 렌더링 JSX 모두 제거.
- `src/App.tsx`의 `OwnerLayout`: `nearCompletionCount` state와 이를 채우던 `/api/dashboard/${store_code}` fetch(`useEffect` 안의 두 번째 fetch 블록) 제거. `<Sidebar>`/`<BottomNav>` 호출에서 `nearCompletionCount` prop 전달 제거.
- `src/lib/api-handlers.ts`의 `/api/dashboard/:store_code` 핸들러: `near_completion_count` 계산 줄과 응답 객체의 `near_completion_count` 필드 제거. `Promise.all`에서 `getStore(storeCode)` 호출도 제거(이 필드 계산 외에 다른 용도로 쓰이지 않으므로) — `store` 변수 자체가 더 이상 필요 없어짐.
- 결과: "고객 관리" 링크는 `/customers/:store_code`로 이동하고, 쿼리가 없으므로 기존 `resolveInitialCustomerTab(null)` 로직에 따라 자동으로 "전체 고객" 탭(`'all'`)이 기본으로 표시된다 — 별도의 새 로직 불필요, 기존 폴백을 그대로 활용.
- "완주 임박 🎁" 필터 탭 자체(고객 목록 페이지 안의 탭 버튼)는 그대로 유지 — 없애는 건 사이드바/하단내비의 배지+딥링크뿐이다. 사장님은 여전히 고객 목록 페이지에서 수동으로 "완주 임박 🎁" 탭을 클릭해 조회할 수 있다.

### 2. 벌크 메시지 생성 후 "메시지 발송" 페이지로 자동 이동

- `src/App.tsx`의 `handleBulkGenerate`: 성공 응답(`ok === true`) 처리 분기에서, 기존 `setBulkResultMsg(...)` + `setTimeout(() => setBulkResultMsg(''), 4000)`를 아래로 바꾼다:
  ```typescript
  setBulkResultMsg(`메시지 초안 ${data.generated}건 생성 완료${skippedNote}`);
  setTimeout(() => {
    setBulkResultMsg('');
    navigate(`/messages/${store_code}`);
  }, 4000);
  ```
- 선택 인원 수와 무관하게(1명이든 여러 명이든) 벌크 생성이 성공하면 항상 이동한다 — 사용자 확정 사항.
- 실패 응답(`ok === false`, 예: 3차 작업에서 추가한 20건 초과 에러) 처리 분기는 변경하지 않는다 — 에러 시에는 페이지 이동 없이 에러 메시지만 보여주고 현재 페이지(선택 상태 유지)에 머문다.
- `CustomersPage`는 이미 `const navigate = useNavigate();`를 사용 중이므로 별도 임포트 불필요.

## 범위 밖

- "완주 임박 🎁" 필터 탭 자체의 제거/변경 — 그대로 유지.
- 개별 생성 버튼(`handleGenerateMessage`)의 자동 이동 동작 — 이미 구현되어 있고 변경하지 않음.
- 대시보드 페이지(`DashboardPage`/`DashboardCards`)의 다른 KPI 카드들 — `near_completion_count` 제거와 무관하게 그대로 유지.

## 사용자 확정 사항

- 사이드바/하단내비 배지는 완전히 제거한다(뷰 확인 후 사라지는 방식이 아님).
- "고객 관리" 기본 진입 탭은 배지 제거의 자연스러운 결과로 "전체 고객"이 된다.
- 벌크 생성 성공 시 선택 인원 수와 무관하게 항상 "메시지 발송" 페이지로 자동 이동한다.

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다.
