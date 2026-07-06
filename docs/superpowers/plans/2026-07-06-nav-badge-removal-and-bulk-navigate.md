# 사이드바 배지 제거 + 벌크 생성 후 자동 이동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바/하단내비의 완주 임박 배지와 딥링크를 완전히 제거해 "고객 관리" 기본 진입 탭이 자연스럽게 "전체 고객"이 되게 하고, 벌크 메시지 생성 성공 시 "메시지 발송" 페이지로 자동 이동하게 한다.

**Architecture:** `Sidebar`/`BottomNav`에서 배지 관련 prop/UI를 제거하고 nav 링크의 쿼리를 없앤다. 이 배지의 유일한 데이터 소스였던 `OwnerLayout`의 `/api/dashboard` fetch와 백엔드의 `near_completion_count` 계산도 함께 제거해 죽은 코드를 남기지 않는다. 벌크 생성 성공 콜백에 `navigate()` 한 줄을 추가한다.

**Tech Stack:** TypeScript, React 19, Express/Vercel 서버리스. 신규 의존성 없음.

## Global Constraints

- 브랜치: 이미 체크아웃된 `feat/near-completion-messaging`에서 계속 작업한다 (PR #14).
- 테스트 프레임워크 없음 — 검증은 `npm run lint`, `react-dom/server` 렌더 스모크 테스트, 실제 API `curl` 호출로 대체한다.
- "완주 임박 🎁" 필터 탭 자체(고객 목록 페이지 안의 탭 버튼, `resolveInitialCustomerTab`, `near_completion` 필터 로직)는 변경하지 않는다 — 이번 작업은 사이드바/하단내비의 배지+딥링크만 제거한다.
- `near_completion_count` 필드는 이 작업 이후 프론트엔드 어디에서도 소비되지 않아야 하며(제거 전 grep으로 확인됨), 그 계산에 쓰이던 `getStore(storeCode)` 호출도 함께 제거한다.
- 벌크 생성 성공 시 자동 이동은 선택 인원 수와 무관하게 항상 적용한다. 실패 응답(에러) 시에는 이동하지 않는다.

---

### Task 1: 사이드바/하단내비 배지 및 관련 데이터 소스 완전 제거

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/App.tsx` (`OwnerLayout`)
- Modify: `src/lib/api-handlers.ts` (`GET /api/dashboard/:store_code`)

**Interfaces:**
- 없음 (UI/API 응답에서 필드를 제거하는 작업 — 다른 태스크가 의존하는 신규 인터페이스 없음).

- [ ] **Step 1: `Sidebar.tsx`에서 배지/딥링크 제거**

`src/components/Sidebar.tsx` 전체를 아래로 교체한다:

```tsx
import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Sparkles, Settings, Coffee } from 'lucide-react';

interface SidebarProps {
  storeName?: string;
}

export default function Sidebar({ storeName = '리봇 베이커리' }: SidebarProps) {
  const { store_code = 'demo' } = useParams();

  const navItems = [
    { name: '홈', path: `/dashboard/${store_code}`, icon: LayoutDashboard },
    { name: '고객 관리', path: `/customers/${store_code}`, icon: Users },
    { name: '메시지 발송', path: `/messages/${store_code}`, icon: MessageSquare },
    { name: '콘텐츠 생성', path: `/content/${store_code}`, icon: Sparkles },
    { name: '설정', path: `/settings/${store_code}`, icon: Settings },
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

- [ ] **Step 2: `BottomNav.tsx`에서 배지/딥링크 제거**

`src/components/BottomNav.tsx` 전체를 아래로 교체한다:

```tsx
import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Sparkles, Settings } from 'lucide-react';

export default function BottomNav() {
  const { store_code = 'demo' } = useParams();

  const navItems = [
    { name: '홈', path: `/dashboard/${store_code}`, icon: LayoutDashboard },
    { name: '고객', path: `/customers/${store_code}`, icon: Users },
    { name: '메시지', path: `/messages/${store_code}`, icon: MessageSquare },
    { name: '콘텐츠', path: `/content/${store_code}`, icon: Sparkles },
    { name: '설정', path: `/settings/${store_code}`, icon: Settings },
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

- [ ] **Step 3: `OwnerLayout`에서 배지 전용 fetch/state 제거**

`src/App.tsx`의 `OwnerLayout` 함수에서 아래 블록을:

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
```

아래로 교체한다:

```typescript
function OwnerLayout() {
  const { store_code = 'demo' } = useParams();
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    // Fetch store configuration from backend
    fetch(`/api/store/${store_code}`)
      .then((res) => {
        if (!res.ok) throw new Error('Store not found');
        return res.json();
      })
      .then((data) => setStore(data))
      .catch((err) => console.error(err));
  }, [store_code]);

  return (
    <div className="flex bg-[#fdfdfb] min-h-screen text-stone-800">
      {/* Responsive Sidebar */}
      <Sidebar storeName={store?.store_name} />
```

그리고 같은 함수 안의 아래 줄을:

```typescript
      <BottomNav nearCompletionCount={nearCompletionCount} />
```

아래로 교체한다:

```typescript
      <BottomNav />
```

- [ ] **Step 4: 백엔드에서 `near_completion_count` 계산 및 그 전용 `getStore` 조회 제거**

`src/lib/api-handlers.ts`에서 아래 블록을:

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

      const todayStart = new Date();
```

아래로 교체한다:

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

      const todayStart = new Date();
```

그리고 같은 핸들러 안의 아래 블록을:

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

아래로 교체한다:

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

**주의**: `isNearCompletion`은 이 파일의 다른 곳(`getCustomers`를 통한 `near_completion` 필터는 `db-server.ts` 안에 있으므로 여기 `api-handlers.ts`에서는 이 계산에만 쓰였다)에서 더는 쓰이지 않을 수 있다 — 다음 스텝에서 확인 후 필요하면 import에서 제거한다.

- [ ] **Step 4-1: `isNearCompletion` import 정리 여부 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -n "isNearCompletion(" src/lib/api-handlers.ts
```

출력이 없으면(이 파일 안에서 더 이상 호출되는 곳이 없으면), `src/lib/api-handlers.ts` 최상단 import에서 `isNearCompletion,` 줄을 제거한다(다른 이름들은 그대로 둔다). 출력이 있으면(다른 곳에서 여전히 쓰이고 있으면) import를 그대로 둔다 — 이 경우는 예상되지 않지만 실제로 확인 후 판단한다.

- [ ] **Step 5: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 6: 렌더 스모크 테스트 — 배지 UI가 완전히 사라졌는지 확인**

`/mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard/_tmp_verify_no_badge.tsx` 파일을 아래 내용으로 만든다:

```tsx
import assert from 'node:assert';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './src/components/Sidebar';
import BottomNav from './src/components/BottomNav';

const sidebarHtml = renderToStaticMarkup(
  React.createElement(MemoryRouter, { initialEntries: ['/dashboard/cafe-rebot'] },
    React.createElement(Sidebar, { storeName: '테스트 매장' })
  )
);
assert.ok(!sidebarHtml.includes('tab=near_completion'), 'Sidebar 링크에 완주 임박 쿼리가 없어야 함');
assert.ok(!sidebarHtml.includes('bg-amber-600'), 'Sidebar에 배지(amber 배경) 마크업이 없어야 함');

const bottomNavHtml = renderToStaticMarkup(
  React.createElement(MemoryRouter, { initialEntries: ['/dashboard/cafe-rebot'] },
    React.createElement(BottomNav, {})
  )
);
assert.ok(!bottomNavHtml.includes('tab=near_completion'), 'BottomNav 링크에 완주 임박 쿼리가 없어야 함');
assert.ok(!bottomNavHtml.includes('bg-amber-600'), 'BottomNav에 배지(amber 배경) 마크업이 없어야 함');

console.log('OK: Sidebar/BottomNav에서 배지와 딥링크가 완전히 제거됨');
```

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npx tsx _tmp_verify_no_badge.tsx
rm _tmp_verify_no_badge.tsx
```
Expected: `OK: Sidebar/BottomNav에서 배지와 딥링크가 완전히 제거됨`

- [ ] **Step 7: 실제 서버로 대시보드 응답에 `near_completion_count` 필드가 없는지 확인**

```bash
nohup npm run start > /tmp/server-nb1.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000/api/store/cafe-rebot >/dev/null; do sleep 1; done'

curl -s "http://localhost:3000/api/dashboard/cafe-rebot" | node -e "
  const chunks=[]; process.stdin.on('data',d=>chunks.push(d)); process.stdin.on('end',()=>{
    const data=JSON.parse(Buffer.concat(chunks).toString());
    console.log('has near_completion_count:', 'near_completion_count' in data);
    console.log('total_customers:', data.total_customers);
  });
"
pkill -9 -f server.ts
ps aux | grep server.ts | grep -v grep
```
Expected: `has near_completion_count: false`, `total_customers`는 정상적인 숫자로 출력됨(다른 필드는 영향 없음 확인). `ps aux` 확인 결과 아무 출력도 없어야 한다.

- [ ] **Step 8: Commit**

```bash
git add src/components/Sidebar.tsx src/components/BottomNav.tsx src/App.tsx src/lib/api-handlers.ts
git commit -m "feat: 사이드바/하단내비의 완주 임박 배지와 딥링크 완전 제거"
```

---

### Task 2: 벌크 메시지 생성 성공 시 메시지 발송 페이지로 자동 이동

**Files:**
- Modify: `src/App.tsx` (`CustomersPage`의 `handleBulkGenerate`)

**Interfaces:**
- 없음 (UI 최종 소비 지점).

- [ ] **Step 1: 성공 분기에 `navigate` 추가**

`src/App.tsx`의 `handleBulkGenerate` 함수에서 아래 블록을:

```typescript
        setSelectedIds(new Set());
        const skippedNote = data.skipped_no_consent > 0
          ? ` (${data.skipped_no_consent}건은 마케팅 미동의로 제외)`
          : '';
        setBulkResultMsg(`메시지 초안 ${data.generated}건 생성 완료${skippedNote}`);
        setTimeout(() => setBulkResultMsg(''), 4000);
      })
      .catch(err => {
        console.error(err);
        setBulkGenerating(false);
      });
```

아래로 교체한다:

```typescript
        setSelectedIds(new Set());
        const skippedNote = data.skipped_no_consent > 0
          ? ` (${data.skipped_no_consent}건은 마케팅 미동의로 제외)`
          : '';
        setBulkResultMsg(`메시지 초안 ${data.generated}건 생성 완료${skippedNote}`);
        setTimeout(() => {
          setBulkResultMsg('');
          navigate(`/messages/${store_code}`);
        }, 4000);
      })
      .catch(err => {
        console.error(err);
        setBulkGenerating(false);
      });
```

(`handleBulkGenerate`는 `CustomersPage` 함수 내부에 있고, `CustomersPage`는 이미 `const navigate = useNavigate();`와 `store_code`를 상단에서 선언해 사용 중이므로 별도 임포트나 선언 없이 그대로 참조 가능하다.)

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 코드 리뷰 기반 확인 (브라우저 육안 검증 불가 환경)**

아래 항목을 코드 상에서 직접 확인한다(샌드박스에 헤드리스 브라우저 의존성이 없어 실제 클릭→이동 시나리오는 실행 불가 — Task 1의 백엔드/데이터 흐름은 이미 API 레벨로 검증됨):
- 실패 분기(`if (!ok) { ... return; }`)는 `navigate`를 호출하지 않고 그대로 유지되는지 확인
- `setTimeout` 콜백이 `setBulkResultMsg('')`와 `navigate(...)` 둘 다 실행하는지, 그리고 실패 시엔 이 `setTimeout`(4초 후 이동하는 쪽) 자체가 실행되지 않는지(실패 분기는 `return`으로 먼저 빠져나가고, 그 안에 있는 자신의 별도 `setTimeout(() => setBulkResultMsg(''), 4000)`만 실행됨) 확인

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 벌크 메시지 생성 성공 시 메시지 발송 페이지로 자동 이동"
```

---

## Self-Review

**스펙 커버리지:**
- `docs/superpowers/specs/2026-07-06-nav-badge-removal-and-bulk-navigate-design.md`의 "1. 사이드바/하단 내비 배지 완전 제거 (+ 기본 탭 전체 고객으로 정정)" → Task 1.
- "2. 벌크 메시지 생성 후 메시지 발송 페이지로 자동 이동" → Task 2.
- "범위 밖"(완주 임박 필터 탭 자체, 개별 생성 버튼의 기존 이동 동작, 대시보드 다른 KPI 카드) — 어느 태스크도 해당 영역을 건드리지 않음.

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 코드 블록이 실행 가능한 전체 내용을 포함.

**타입/시그니처 일관성:** Task 1에서 `Sidebar`/`BottomNav`의 props(`nearCompletionCount`)와 nav 항목의 `badge` 필드가 완전히 제거되고, `OwnerLayout`의 호출부(`<Sidebar storeName={...} />`, `<BottomNav />`)도 그에 맞게 인자 없이 호출하도록 함께 수정되어 일관됨. Task 2는 기존 `handleBulkGenerate`의 성공 분기 구조(`ok`/`data` 디스트럭처링, `setBulkResultMsg`, `setTimeout`)를 그대로 유지하며 `navigate` 호출만 추가해 실패 분기와 충돌하지 않음.

## 다음 단계

이 계획을 승인하면 `subagent-driven-development` 또는 `executing-plans` 스킬로 태스크별 구현을 시작한다.
