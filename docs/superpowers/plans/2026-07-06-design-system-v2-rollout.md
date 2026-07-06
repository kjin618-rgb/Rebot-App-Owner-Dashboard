# 디자인 시스템 v2(Navy/Orange/Yellow) 전체 적용 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 제공한 `DESIGN-v2.md`(Navy/Orange/Yellow 3색 제한 디자인 시스템)와 `orange-01.png`(대시보드 시안)를 앱 전체(사이드바, 대시보드, 고객관리, 메시지발송, 콘텐츠생성, 설정)에 반영한다.

**Architecture:** `src/index.css`에 새 색상/타이포/spacing/radius/shadow 토큰을 추가하고, `src/lib/churn.ts`의 이탈 단계 배지 색상 규칙을 "색상 대신 텍스트로 상태 구분" 규칙으로 재정의한 뒤, 이 두 파운데이션을 소비하는 컴포넌트들을 파일 단위로 순차 교체한다. 로직/상태/API 호출은 전혀 건드리지 않고 JSX의 className과 일부 마크업 구조(KPI 카드가 흰 배경+색 아이콘에서 색 배경 전체로 바뀌는 등)만 변경한다.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4 (`@theme` 기반 커스텀 토큰). 신규 npm 의존성 없음(Google Fonts에 Inter 웹폰트 1개 추가만 있음).

## Global Constraints

- 브랜치: 이미 생성/체크아웃된 `feat/design-system-v2`에서 계속 작업한다.
- 테스트 프레임워크 없음 — 검증은 `npm run lint`(tsc --noEmit) + 각 태스크가 손댄 파일에서 금지 색상 클래스가 남아있지 않은지 확인하는 `grep`으로 한다.
- **이 세션은 샌드박스에 헤드리스 브라우저가 없어 실제 렌더링/스크린샷 확인이 불가하다.** 각 태스크의 "Step: 시각적 확인" 단계는 전부 "브라우저 육안 확인은 병합 후 사용자가 직접 한다"는 코멘트로 대체하고, 코드/그렙 레벨 검증만 한다.
- **로직/상태/API 계약은 절대 변경하지 않는다** — 모든 태스크는 JSX의 `className` 문자열과, KPI 카드처럼 마크업 구조 자체가 바뀌는 소수 지점의 마크업만 변경한다. `useState`/`useEffect`/`fetch` 호출/함수 시그니처는 어떤 태스크에서도 건드리지 않는다.
- `StampKioskPage`(App.tsx `/stamp/:store_code`)는 **범위 밖**이다 — `QRPreview.tsx`의 기존 주석("Stamp kiosk lives in the separate customer-facing app deployment, not this dashboard")대로 실제로는 별도 배포된 고객용 앱이 이 역할을 하고, 이 페이지는 사이드바/하단내비 어디에서도 링크되지 않는 사실상 미사용 코드다. 의도적으로 다크 테마(kiosk 화면)라 대시보드 색상 시스템과 무관하므로 건드리지 않는다.
- `src/App.tsx`의 `MessagesPage` 안에 있는 `loadMessages` 함수(미사용 dead code, 이상한 사고과정 주석 포함)는 이번 작업과 무관한 기존 이슈(최종 리뷰에서 이미 발견/기록됨) — **건드리지 않는다.**
- `src/components/PostPreview.tsx`는 어디서도 import되지 않는 미사용 컴포넌트 — **건드리지 않는다.**

### 공용 색상 매핑 표 (모든 태스크가 참조)

Task 1에서 `src/index.css`에 아래 신규 Tailwind 유틸리티가 생기고(`@theme`의 `--color-*` 변수가 자동으로 `bg-*`/`text-*`/`border-*`/`ring-*` 유틸리티를 만든다), 이후 모든 태스크는 기존 클래스를 아래 표에 따라 치환한다:

| 기존 클래스(예시) | 새 클래스 | 용도 |
|---|---|---|
| `text-stone-900`, `text-stone-950`, `text-stone-800`, `text-stone-850`, `text-stone-700`, `text-stone-600` | `text-navy` | 제목/본문 텍스트 (대시보드 기본 텍스트는 항상 navy) |
| `text-stone-500`, `text-stone-400`, `text-stone-300` | `text-muted` | 보조/설명 텍스트 |
| `bg-stone-50`, `bg-stone-100`, `bg-stone-50/40`, `bg-stone-50/50` 등 옅은 배경 | `bg-surface` | 서브틀한 섹션/행 배경 |
| `bg-stone-800`, `bg-stone-900`, `bg-stone-950`, `bg-stone-700` (어두운 버튼 배경) | `bg-navy` | 강조 다크 버튼/오버레이 |
| `border-stone-100`, `border-stone-200` | `border-border-soft` / `border-border` | 카드/구분선 테두리 |
| `border-stone-300` 이상 진한 stone 보더 | `border-navy` | 다크 요소 보더 |
| `bg-amber-*`, `bg-brand-*`(CTA/포인트 배경) | `bg-orange` | Primary CTA, 활성 상태, 핵심 강조 |
| `text-amber-*`, `text-brand-*`(포인트 텍스트/아이콘) | `text-orange` | 강조 텍스트, 차트, 링크 |
| `border-amber-*`, `border-brand-*` | `border-orange` | 강조 보더 |
| `ring-amber-500`, `ring-brand-500`(포커스 링) | `ring-orange` | 포커스 상태 |
| `bg-emerald-*`, `text-emerald-*`, `border-emerald-*`(성공/동의 상태) | 배경은 `bg-surface`(또는 카드면 흰 배경 유지), 텍스트는 `text-navy` | 상태는 색이 아니라 문구(예: "동의 완료")로만 구분 |
| `bg-red-*`, `text-red-*`, `border-red-*`(에러/위험 상태) | 배경은 `bg-surface`, 텍스트는 `text-navy` | 상태는 색이 아니라 문구로만 구분 |
| `bg-yellow-*`, `text-yellow-*`, `border-yellow-*`(기존 임의 사용) | 문맥에 따라 `bg-yellow`(강조 배경) 또는 제거 | 옐로우는 아이콘 전용이 원칙이라 배경/텍스트로 남용하지 않는다 |
| `bg-indigo-*`, `text-indigo-*`, `bg-blue-*`, `text-blue-*` | `text-navy`(텍스트), 아이콘은 `text-yellow` | 금지 색상 — 전부 제거 |
| 모든 Lucide 아이콘의 색상 클래스(`text-amber-600`, `text-emerald-600`, `text-red-500` 등 아이콘에 직접 적용된 경우) | `text-yellow` | "모든 아이콘은 옐로우" 규칙 (예외: 아이콘이 오렌지/네이비 배경의 solid 카드 위에 흰색으로 보여야 하는 경우는 각 태스크에서 명시) |

이 표에 없는 특수 케이스(카드 전체가 색으로 채워지는 KPI 카드, PerformanceCard의 항목별 색상 제거 등)는 각 태스크에서 정확한 코드로 별도 지시한다.

---

### Task 1: 디자인 토큰 파운데이션 (`src/index.css`) + 페이지 타이틀

**Files:**
- Modify: `src/index.css` (전체 교체)
- Modify: `index.html` (`<title>`)

**Interfaces:**
- Produces: Tailwind 유틸리티 `bg-navy`/`text-navy`/`border-navy`, `bg-orange`/`text-orange`/`border-orange`/`ring-orange`, `bg-yellow`/`text-yellow`/`border-yellow`, `bg-surface`/`bg-surface-soft`, `border-border`/`border-border-soft`/`border-border-strong`, `text-muted`/`text-muted-soft`, 그리고 `text-display`/`text-heading-1`/`text-heading-2`/`text-heading-3`/`text-body-md`/`text-body-sm`/`text-caption`/`text-micro`/`text-number-xl`/`text-number-lg`/`text-number-md` — Task 2~7이 전부 이 유틸리티를 사용한다.

- [ ] **Step 1: `src/index.css` 전체 교체**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", "Noto Sans KR", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  /* DESIGN-v2.md 타이포 스케일 */
  --font-size-display: 2.5rem;      /* 40px */
  --font-size-heading-1: 2rem;      /* 32px */
  --font-size-heading-2: 1.5rem;    /* 24px */
  --font-size-heading-3: 1.125rem;  /* 18px */
  --font-size-body-md: 1rem;        /* 16px */
  --font-size-body-sm: 0.875rem;    /* 14px */
  --font-size-caption: 0.8125rem;   /* 13px */
  --font-size-micro: 0.75rem;       /* 12px */
  --font-size-number-xl: 2.75rem;   /* 44px */
  --font-size-number-lg: 2.25rem;   /* 36px */
  --font-size-number-md: 1.75rem;   /* 28px */

  /* DESIGN-v2.md 색상 팔레트 — Navy/Orange/Yellow 3색 제한 */
  --color-navy: #1C2F3A;
  --color-orange: #FF8A00;
  --color-yellow: #FFC400;

  --color-surface: #F8FAFC;
  --color-surface-soft: #FAFBFC;

  --color-border: #E5E7EB;
  --color-border-soft: #EEF0F3;
  --color-border-strong: #CBD5E1;

  --color-muted: #8A94A3;
  --color-muted-soft: #A8B0BA;

  --shadow-card: 0 4px 16px rgba(28, 47, 58, 0.06);
  --shadow-card-strong: 0 10px 28px rgba(28, 47, 58, 0.10);
  --shadow-sidebar-card: 0 8px 24px rgba(0, 0, 0, 0.18);
}

body {
  font-family: var(--font-sans);
  background-color: #FFFFFF;
  color: var(--color-navy);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Custom layout scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(28, 47, 58, 0.15);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(28, 47, 58, 0.3);
}

.interactive-transition {
  transition: all 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.premium-card {
  background-color: #ffffff;
  border: 1px solid var(--color-border-soft);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.premium-card:hover {
  box-shadow: var(--shadow-card-strong);
  border-color: var(--color-border-strong);
}
```

- [ ] **Step 2: `index.html`의 `<title>` 교체**

`index.html`에서 아래 줄을:

```html
    <title>My Google AI Studio App</title>
```

아래로 교체한다:

```html
    <title>리봇 CRM 대시보드</title>
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0). (이 태스크는 CSS/HTML만 바꾸므로 tsc 에러가 날 여지가 없지만, 다른 태스크들의 공통 게이트와 동일하게 실행해 습관을 유지한다.)

- [ ] **Step 4: 신규 토큰이 실제로 Tailwind 유틸리티를 생성하는지 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run build 2>&1 | tail -30
```
Expected: 빌드가 에러 없이 끝난다(exit code 0). 아직 어떤 컴포넌트도 새 클래스를 쓰지 않으므로 CSS 결과물을 직접 열어볼 필요는 없다 — 다음 태스크(Task 2)부터 실제로 새 클래스를 쓰기 시작하면 그 태스크의 lint 통과가 곧 토큰이 유효하다는 검증이 된다.

- [ ] **Step 5: Commit**

```bash
git add src/index.css index.html
git commit -m "feat: 디자인 시스템 v2 토큰(Navy/Orange/Yellow, 타이포 스케일) 추가 및 페이지 타이틀 교체"
```

---

### Task 2: 이탈 단계 배지 색상 규칙 재정의 (`src/lib/churn.ts`)

**Files:**
- Modify: `src/lib/churn.ts` (`CHURN_COLOR`만 교체, `CHURN_LABEL`/`calcChurn`은 그대로 둔다)

**Interfaces:**
- Consumes: Task 1의 `bg-surface`, `text-navy` 유틸리티.
- Produces: `CHURN_COLOR`가 모든 이탈 단계에 대해 색상 대신 통일된 navy/surface 클래스를 반환 — `CustomerTable.tsx`, `MessageList.tsx`, `App.tsx`의 `CustomerDetailPage`가 이 값을 그대로 재사용(Task 3, 5, 6에서 이 파일들을 바꿀 때 자동으로 반영됨, `CHURN_COLOR` 자체를 각 파일에서 다시 정의하지 않음).

- [ ] **Step 1: `CHURN_COLOR` 교체**

`src/lib/churn.ts`에서 아래 블록을:

```typescript
export const CHURN_COLOR: Record<ChurnStage, string> = {
  safe: 'bg-green-100 text-green-800 border-green-200',
  watch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-orange-100 text-orange-800 border-orange-200',
  churned: 'bg-red-100 text-red-800 border-red-200',
};
```

아래로 교체한다:

```typescript
// 디자인 시스템 v2: 이탈 단계는 색상이 아니라 CHURN_LABEL의 문구로만 구분한다
// (Green/Blue/Purple/Red 금지, 상태는 텍스트로 표현).
export const CHURN_COLOR: Record<ChurnStage, string> = {
  safe: 'bg-surface text-navy border-border-soft',
  watch: 'bg-surface text-navy border-border-soft',
  danger: 'bg-surface text-navy border-border-soft',
  churned: 'bg-surface text-navy border-border-soft',
};
```

- [ ] **Step 2: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 3: 금지 색상 잔재 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -n "green-\|red-\|blue-\|indigo-\|purple-" src/lib/churn.ts
```
Expected: 아무 출력도 없어야 한다.

- [ ] **Step 4: Commit**

```bash
git add src/lib/churn.ts
git commit -m "feat: 이탈 단계 배지 색상을 디자인 시스템 v2 규칙(색상 대신 텍스트로 상태 구분)으로 재정의"
```

---

### Task 3: 앱 셸 — `Sidebar.tsx`, `BottomNav.tsx`

**Files:**
- Modify: `src/components/Sidebar.tsx` (전체 교체)
- Modify: `src/components/BottomNav.tsx` (전체 교체)

**Interfaces:**
- Consumes: Task 1의 색상/타이포 토큰.

- [ ] **Step 1: `Sidebar.tsx` 전체 교체**

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
    <aside className="hidden md:flex flex-col w-[300px] h-screen bg-navy sticky top-0 shrink-0 p-5">
      {/* Brand Logo Header */}
      <div className="h-16 flex items-center gap-3 border-b border-white/10 pb-5 mb-5">
        <div className="w-14 h-14 rounded-lg bg-orange flex items-center justify-center shrink-0">
          <Coffee className="w-6 h-6 text-yellow" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-white tracking-tight text-heading-3 leading-none flex items-center gap-1.5">
            리봇 CRM
            <span className="text-micro font-bold text-navy bg-yellow px-1.5 py-0.5 rounded-md">AI</span>
          </h1>
          <p className="text-caption text-white/60 font-medium truncate mt-1" title={storeName}>
            {storeName}
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-body-sm font-semibold tracking-wide transition-all duration-300 ${
                  isActive
                    ? 'bg-orange text-white font-bold'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0 text-yellow" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="pt-4 border-t border-white/10">
        <div className="bg-white/[0.06] border border-white/[0.16] rounded-lg p-5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <p className="text-micro font-bold text-white/50 tracking-wider font-mono">STORE INSTANCE</p>
          <p className="text-caption text-white font-semibold font-mono mt-0.5 truncate" title={store_code}>
            {store_code}
          </p>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: `BottomNav.tsx` 전체 교체**

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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-navy flex items-center justify-around px-3 z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.18)] pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full py-1.5 gap-1 select-none transition-all duration-300 relative ${
                isActive ? 'text-white font-bold' : 'text-white/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative p-1.5 rounded-lg transition-all duration-300 ${isActive ? 'bg-orange' : 'bg-transparent'}`}>
                  <Icon className="w-4.5 h-4.5 shrink-0 text-yellow" />
                </div>
                <span className="text-micro font-semibold tracking-wider">{item.name}</span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-orange animate-pulse" />
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

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 금지 색상 잔재 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -nE "amber-|brand-|emerald-|stone-|red-|green-|blue-|indigo-" src/components/Sidebar.tsx src/components/BottomNav.tsx
```
Expected: 아무 출력도 없어야 한다.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/BottomNav.tsx
git commit -m "feat: 사이드바/하단내비를 디자인 시스템 v2(네이비 배경+오렌지 액티브+옐로우 아이콘)로 교체"
```

---

### Task 4: 대시보드 홈 — `DashboardCards.tsx`, `PerformanceCard.tsx`, `ActivityFeed.tsx`, `QRPreview.tsx`

**Files:**
- Modify: `src/components/DashboardCards.tsx` (전체 교체)
- Modify: `src/components/PerformanceCard.tsx` (전체 교체)
- Modify: `src/components/ActivityFeed.tsx` (전체 교체)
- Modify: `src/components/QRPreview.tsx` (전체 교체)
- Modify: `src/App.tsx` (`DashboardPage`의 제목/새로고침 버튼 부분만)

**Interfaces:**
- Consumes: Task 1의 색상/타이포 토큰.

- [ ] **Step 1: `DashboardCards.tsx` 전체 교체** — `DESIGN-v2.md`의 "Top KPI Cards" 표(오렌지/옐로우/네이비 100% 배경) 그대로 적용

```tsx
import React from 'react';
import { Users, CheckSquare, ShieldCheck, AlertCircle } from 'lucide-react';

interface DashboardCardsProps {
  totalCustomers: number;
  marketingConsentCount: number;
  churnSummary: {
    safe: number;
    watch: number;
    danger: number;
    churned: number;
  };
}

export default function DashboardCards({ totalCustomers, marketingConsentCount, churnSummary }: DashboardCardsProps) {
  const dangerAndWatch = (churnSummary?.watch || 0) + (churnSummary?.danger || 0);
  const consentRate = totalCustomers > 0 ? Math.round((marketingConsentCount / totalCustomers) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Customers — Orange 100% */}
      <div className="bg-orange rounded-xl p-6 flex items-start justify-between shadow-[0_10px_28px_rgba(28,47,58,0.10)]">
        <div className="space-y-2.5">
          <p className="text-white/80 text-micro font-bold uppercase tracking-wider">전체 등록 고객</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-white tracking-tight font-mono">{totalCustomers}</h3>
            <span className="text-white/90 text-body-sm font-semibold">명</span>
          </div>
          <p className="text-white/70 text-caption font-medium leading-normal">매장에 등록된 누적 단골 수</p>
        </div>
        <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-yellow" />
        </div>
      </div>

      {/* Marketing Consent — Yellow 100% */}
      <div className="bg-yellow rounded-xl p-6 flex items-start justify-between shadow-[0_10px_28px_rgba(28,47,58,0.10)]">
        <div className="space-y-2.5">
          <p className="text-navy/70 text-micro font-bold uppercase tracking-wider">마케팅 동의 고객</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-navy tracking-tight font-mono">{marketingConsentCount}</h3>
            <span className="text-navy/80 text-body-sm font-semibold">명</span>
            <span className="text-micro font-bold text-white bg-navy px-1.5 py-0.5 rounded-md ml-1.5 font-mono">
              {consentRate}%
            </span>
          </div>
          <p className="text-navy/70 text-caption font-medium leading-normal">메시지 즉시 발송 가능 고객</p>
        </div>
        <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-yellow" />
        </div>
      </div>

      {/* Danger & Watch — Navy 100% */}
      <div className="bg-navy rounded-xl p-6 flex items-start justify-between shadow-[0_10px_28px_rgba(28,47,58,0.10)]">
        <div className="space-y-2.5">
          <p className="text-white/70 text-micro font-bold uppercase tracking-wider">관심 및 이탈 위험군</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-number-xl font-extrabold text-white tracking-tight font-mono">{dangerAndWatch}</h3>
            <span className="text-white/80 text-body-sm font-semibold">명</span>
            <span className="text-micro font-semibold text-white/70 ml-1.5">
              (주의 {churnSummary?.watch || 0} / 위험 {churnSummary?.danger || 0})
            </span>
          </div>
          <p className="text-white/70 text-caption font-medium leading-normal">재방문 유도 및 타겟 마케팅 대상</p>
        </div>
        <div className="w-11 h-11 rounded-lg bg-white flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-yellow" />
        </div>
      </div>
    </div>
  );
}
```

**주의**: `CheckSquare`는 기존 코드에서도 import만 되고 실제로 쓰이지 않던 아이콘이다(원본 파일에도 사용처가 없었음) — 이번 교체에서도 그대로 import만 유지해 기존과 동일한 상태를 보존한다(사용하지 않는 import를 정리하는 것은 이번 스타일링 작업의 범위가 아니다).

- [ ] **Step 2: `PerformanceCard.tsx` 전체 교체** — `DESIGN-v2.md`의 "Performance Cards" 규칙(흰 배경/네이비 텍스트/옐로우 아이콘, 항목별 색상 차등 없음) 적용

```tsx
import React from 'react';
import { PerformanceMetrics } from '../lib/mock';
import { TrendingUp, Award, RefreshCw, MessageSquare, ShieldCheck, Zap } from 'lucide-react';

interface PerformanceCardProps {
  metrics: PerformanceMetrics | null;
}

export default function PerformanceCard({ metrics }: PerformanceCardProps) {
  const renderMetricValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return (
        <span className="inline-flex items-center gap-1 text-caption font-semibold px-2 py-0.5 rounded bg-surface text-navy border border-border-soft">
          <RefreshCw className="w-3 h-3 text-yellow animate-spin-slow" />
          측정 중
        </span>
      );
    }
    return (
      <span className="text-number-md font-bold text-navy tracking-tight">
        {value.toFixed(1)}<span className="text-body-sm font-medium text-muted ml-0.5">%</span>
      </span>
    );
  };

  const items = [
    {
      title: '스탬프 완성률',
      desc: '목표 스탬프 개수를 채워 혜택을 받은 고객 비율',
      value: metrics?.stamp_completion_rate,
      icon: Award,
    },
    {
      title: '30일 이내 재방문율',
      desc: '첫 방문 후 30일 이내에 다시 찾아주신 고객 비율',
      value: metrics?.second_visit_rate_30d,
      icon: TrendingUp,
    },
    {
      title: 'AI 메시지 수신군 재방문율',
      desc: '재방문 제안 메시지를 받고 매장에 재방문한 비율',
      value: metrics?.message_revisit_rate,
      icon: MessageSquare,
    },
    {
      title: '메시지 미발송군 재방문율',
      desc: '메시지를 받지 않고 자발적으로 재방문한 고객 비율',
      value: metrics?.no_message_revisit_rate,
      icon: Zap,
    },
    {
      title: '마케팅 동의율',
      desc: '스탬프 적립 시 마케팅 수신동의를 해준 고객 비율',
      value: metrics?.marketing_consent_rate,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-[0_4px_16px_rgba(28,47,58,0.06)] p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-border-soft pb-3.5">
        <h4 className="font-bold text-navy text-heading-3 tracking-tight">캠페인 및 매장 핵심 성과 지표</h4>
        {metrics?.incremental_revisit_rate !== null && metrics?.incremental_revisit_rate !== undefined && (
          <span className="text-micro font-bold text-white bg-orange px-2.5 py-1 rounded-lg">
            메시지 효과 순증가율: +{metrics.incremental_revisit_rate.toFixed(1)}%p
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="p-4 bg-surface rounded-lg border border-border-soft flex flex-col justify-between space-y-4 transition-all duration-300">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center bg-white border border-border-soft shrink-0">
                    <Icon className="w-3.5 h-3.5 text-yellow" />
                  </div>
                  <h5 className="font-bold text-navy text-caption truncate" title={item.title}>
                    {item.title}
                  </h5>
                </div>
                <p className="text-micro text-muted font-medium leading-normal line-clamp-2">
                  {item.desc}
                </p>
              </div>

              <div className="pt-1 border-t border-border-soft">
                {renderMetricValue(item.value)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `ActivityFeed.tsx` 전체 교체** — 활동 타입별로 다르던 아이콘 배경색을 전부 옐로우 아이콘으로 통일

```tsx
import React from 'react';
import { UserCheck, UserPlus, FileText, Send, Clock } from 'lucide-react';
import { ActivityItem } from '../lib/mock';

interface ActivityFeedProps {
  activities: ActivityItem[];
}

function formatTimeAgo(isoString: string): string {
  try {
    const past = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));

    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
  } catch {
    return '최근';
  }
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border-soft shadow-[0_4px_16px_rgba(28,47,58,0.06)] p-6 text-center text-muted">
        최근 활동 내역이 없습니다.
      </div>
    );
  }

  const iconMap = {
    stamp: { icon: UserCheck, text: '스탬프 적립' },
    new_customer: { icon: UserPlus, text: '신규 고객 등록' },
    draft_created: { icon: FileText, text: 'AI 메시지 초안 생성' },
    message_sent: { icon: Send, text: '메시지 발송 완료' },
  };

  return (
    <div className="bg-white rounded-xl border border-border-soft shadow-[0_4px_16px_rgba(28,47,58,0.06)] p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-border-soft pb-3">
        <h4 className="font-semibold text-navy text-heading-3">실시간 매장 활동 피드</h4>
        <span className="flex items-center gap-1 text-micro font-semibold text-navy bg-surface px-2 py-0.5 rounded-full border border-border-soft">
          <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" /> LIVE
        </span>
      </div>

      <div className="relative pl-4 space-y-6 before:absolute before:left-[21px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border-soft">
        {activities.map((activity, idx) => {
          const config = iconMap[activity.type] || iconMap.stamp;
          const Icon = config.icon;
          return (
            <div key={idx} className="relative flex items-start gap-4 group">
              {/* Icon Container */}
              <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-border-soft shrink-0 z-10 bg-white">
                <Icon className="w-4 h-4 text-yellow" />
              </div>

              {/* Content Box */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-semibold text-muted">{config.text}</span>
                  <span className="text-micro text-muted font-medium flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-muted-soft" />
                    {formatTimeAgo(activity.occurred_at)}
                  </span>
                </div>

                <p className="text-body-sm text-navy mt-1 leading-snug">
                  {activity.type === 'stamp' && (
                    <span>
                      <strong className="font-semibold text-navy">{activity.customer_name || '미등록'}</strong> 고객님에게 스탬프가 적립되었습니다.
                    </span>
                  )}
                  {activity.type === 'new_customer' && (
                    <span>
                      신규 고객 <strong className="font-semibold text-navy">{activity.customer_name || '미등록'}</strong>님이 등록되었습니다. ({activity.phone_masked})
                    </span>
                  )}
                  {activity.type === 'draft_created' && (
                    <span>
                      <strong className="font-semibold text-navy">{activity.customer_name}</strong> 고객용 맞춤 재방문 AI 메시지 초안이 생성되었습니다.
                    </span>
                  )}
                  {activity.type === 'message_sent' && (
                    <span>
                      <strong className="font-semibold text-navy">{activity.customer_name}</strong> 고객님에게 재방문 혜택 메시지가 전송되었습니다.
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `QRPreview.tsx` 전체 교체** — `DESIGN-v2.md`의 "QR Promotion Card" 규칙(오렌지 100% 배경, QR 이미지 영역만 흰 카드) 적용

```tsx
import React, { useState, useEffect } from 'react';
import { generateQRCode } from '../lib/mock';
import { Download, Link as LinkIcon, Check, Copy, QrCode } from 'lucide-react';

interface QRPreviewProps {
  storeCode: string;
}

// Stamp kiosk lives in the separate customer-facing app deployment, not this dashboard.
const CUSTOMER_APP_BASE_URL = 'https://rebot-app-customer-facing-page.vercel.app';

export default function QRPreview({ storeCode }: QRPreviewProps) {
  const [qrSrc, setQrSrc] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const stampUrl = `${CUSTOMER_APP_BASE_URL}/${storeCode}`;

  useEffect(() => {
    async function loadQR() {
      const src = await generateQRCode(stampUrl);
      setQrSrc(src);
    }
    loadQR();
  }, [stampUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(stampUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrSrc) return;
    const link = document.createElement('a');
    link.href = qrSrc;
    link.download = `rebot_stamp_qr_${storeCode}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-orange rounded-xl p-6 space-y-6 shadow-[0_10px_28px_rgba(28,47,58,0.10)]">
      <div className="flex items-center gap-2 border-b border-white/20 pb-3">
        <QrCode className="w-5 h-5 text-yellow" />
        <h3 className="font-semibold text-white text-heading-3">매장 비치용 스탬프 적립 QR</h3>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* QR Code image — white card */}
        <div className="p-3 bg-white rounded-lg shrink-0">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="Store Stamp QR Code"
              className="w-40 h-40 object-contain select-none bg-white rounded-md"
            />
          ) : (
            <div className="w-40 h-40 bg-surface animate-pulse rounded-md" />
          )}
        </div>

        {/* Info & links */}
        <div className="min-w-0 w-full space-y-4">
          <div className="space-y-1">
            <h4 className="font-bold text-white text-body-sm">고객 셀프 적립 QR 코드</h4>
            <p className="text-caption text-white/80 leading-normal break-words">
              이 QR 코드를 카운터, 테이블 등에 출력하여 비치해 주세요.
              고객이 스마트폰으로 스캔하면 별도 가입 절차 없이 휴대폰 번호 입력만으로 간편하게 스탬프를 적립할 수 있습니다.
            </p>
          </div>

          {/* URL Input Copy */}
          <div className="min-w-0 space-y-1">
            <label className="block text-micro font-bold text-white/70 uppercase tracking-wide">고객 스탬프 적립 URL</label>
            <div className="flex min-w-0 items-center gap-2">
              <input
                type="text"
                readOnly
                value={stampUrl}
                className="min-w-0 flex-1 text-caption font-mono px-3 py-2 bg-white text-navy rounded-md focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="p-2 bg-white hover:bg-surface rounded-md text-navy transition-all shrink-0"
                title="URL 복사"
              >
                {copied ? <Check className="w-4 h-4 text-yellow" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!qrSrc}
            className="w-full px-4 py-2.5 bg-white hover:bg-surface disabled:bg-white/40 text-navy rounded-md text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="text-center">QR 코드 고해상도 이미지 다운로드 (.svg)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `DashboardPage`(`src/App.tsx`) 제목/새로고침 버튼 색상만 교체**

`src/App.tsx`에서 아래 블록을:

```typescript
      {/* Top Welcome Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">사장님 대시보드</h1>
          <p className="text-xs md:text-sm text-stone-500 font-normal">
            재방문 주기가 흐려지는 단골 고객들을 모니터링하고 AI 솔루션으로 복귀를 유도하세요.
          </p>
        </div>
        <button 
          onClick={loadData}
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </div>
```

아래로 교체한다:

```typescript
      {/* Top Welcome Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-bold text-navy tracking-tight">사장님 대시보드</h1>
          <p className="text-body-sm text-muted font-normal">
            재방문 주기가 흐려지는 단골 고객들을 모니터링하고 AI 솔루션으로 복귀를 유도하세요.
          </p>
        </div>
        <button 
          onClick={loadData}
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 text-caption font-semibold rounded-md bg-white border border-border text-navy hover:bg-surface transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-yellow" />
          새로고침
        </button>
      </div>
```

- [ ] **Step 6: 로딩 스피너 색상 교체**

`src/App.tsx`의 `DashboardPage` 함수 안, 로딩 상태 블록에서 아래 줄을:

```typescript
        <div className="w-10 h-10 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-sm text-stone-500 font-medium">대시보드 지표를 집계하고 있습니다...</p>
```

아래로 교체한다:

```typescript
        <div className="w-10 h-10 border-4 border-border border-t-orange rounded-full animate-spin" />
        <p className="text-body-sm text-muted font-medium">대시보드 지표를 집계하고 있습니다...</p>
```

- [ ] **Step 7: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 8: 금지 색상 잔재 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -nE "amber-|brand-|emerald-|stone-|red-|green-|blue-|indigo-|fuchsia-|yellow-[0-9]" src/components/DashboardCards.tsx src/components/PerformanceCard.tsx src/components/ActivityFeed.tsx src/components/QRPreview.tsx
```
Expected: 아무 출력도 없어야 한다.

- [ ] **Step 9: Commit**

```bash
git add src/components/DashboardCards.tsx src/components/PerformanceCard.tsx src/components/ActivityFeed.tsx src/components/QRPreview.tsx src/App.tsx
git commit -m "feat: 대시보드 홈(KPI 카드/성과지표/활동피드/QR카드)을 디자인 시스템 v2로 교체"
```

---

### Task 5: 고객 관리 — `CustomerTable.tsx`, `CustomersPage`/`CustomerDetailPage`(`src/App.tsx`)

**Files:**
- Modify: `src/components/CustomerTable.tsx` (전체 교체)
- Modify: `src/App.tsx` (`CustomersPage`, `CustomerDetailPage` 섹션)

**Interfaces:**
- Consumes: Task 1의 토큰, Task 2에서 재정의된 `CHURN_COLOR`(자동 반영, 이 파일들은 `CHURN_COLOR`를 import해서 쓸 뿐 재정의하지 않는다).

- [ ] **Step 1: `CustomerTable.tsx` 전체 교체**

```tsx
import React from 'react';
import { CustomerRow } from '../types';
import { CHURN_LABEL, CHURN_COLOR } from '../lib/churn';
import { User, Calendar, Check, X, StickyNote } from 'lucide-react';

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
  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl border border-border-soft text-center">
        <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-4 text-muted">
          <User className="w-6 h-6" />
        </div>
        <p className="text-navy font-bold text-body-sm">조건에 맞는 고객이 없습니다.</p>
        <p className="text-muted text-caption mt-1">새로운 검색어나 탭을 선택해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface border-b border-border-soft text-muted text-micro font-bold uppercase tracking-wider">
              {selectable && (
                <th className="py-4.5 px-6 w-10">
                  <input
                    type="checkbox"
                    checked={customers.length > 0 && customers.every(c => selectedIds?.has(c.id))}
                    onChange={() => onToggleSelectAll?.()}
                    className="rounded border-border text-orange focus:ring-orange h-4 w-4 cursor-pointer"
                  />
                </th>
              )}
              <th className="py-4.5 px-6">고객명</th>
              <th className="py-4.5 px-6">전화번호</th>
              <th className="py-4.5 px-6">이탈 위험군</th>
              <th className="py-4.5 px-6">최근 방문일</th>
              <th className="py-4.5 px-6 text-center">총 방문 / 스탬프</th>
              <th className="py-4.5 px-6 text-center">마케팅 동의</th>
              <th className="py-4.5 px-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft text-caption text-navy">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-surface transition-colors duration-200 group">
                {selectable && (
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(customer.id) ?? false}
                      disabled={!customer.marketing_consent}
                      onChange={() => onToggleSelect?.(customer.id)}
                      className="rounded border-border text-orange focus:ring-orange h-4 w-4 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title={!customer.marketing_consent ? '마케팅 미동의 고객은 선택할 수 없습니다' : undefined}
                    />
                  </td>
                )}
                <td className="py-4 px-6 font-semibold text-navy">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface text-navy flex items-center justify-center font-bold text-caption border border-border-soft">
                      {customer.name ? customer.name[0] : '고'}
                    </div>
                    <span>{customer.name || '미등록 고객'}</span>
                    {customer.notes && (
                      <StickyNote className="w-3.5 h-3.5 text-yellow shrink-0" aria-label="메모 있음" />
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 font-mono text-muted tracking-wide">{customer.phone_masked}</td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-micro font-semibold border ${CHURN_COLOR[customer.churn_stage]}`}>
                    {CHURN_LABEL[customer.churn_stage]}
                  </span>
                </td>
                <td className="py-4 px-6 text-muted">
                  {customer.last_visit_at ? (
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-yellow" />
                      <span>{new Date(customer.last_visit_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  ) : (
                    <span className="text-muted-soft">-</span>
                  )}
                </td>
                <td className="py-4 px-6 text-center font-medium">
                  <span className="font-bold text-navy font-mono text-body-sm">{customer.total_visits}</span>회 / <span className="font-bold text-orange font-mono text-body-sm">{customer.total_stamps}</span>개
                </td>
                <td className="py-4 px-6">
                  <div className="flex justify-center">
                    {customer.marketing_consent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface text-navy text-micro font-bold border border-border-soft">
                        <Check className="w-3 h-3 stroke-[2.5] text-yellow" /> 수신동의
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface text-muted text-micro font-bold border border-border-soft">
                        <X className="w-3 h-3 stroke-[2.5]" /> 미동의
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => onSelectCustomer?.(customer)}
                    className="px-3.5 py-1.5 text-caption font-bold rounded-md text-navy bg-surface hover:bg-border-soft transition-all border border-border-soft cursor-pointer"
                  >
                    상세 정보
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `CustomersPage`(`src/App.tsx`) 색상 클래스 교체**

`src/App.tsx`에서 `CustomersPage` 함수(약 187번째 줄 시작) 안의 아래 항목들을 각각 치환한다. 아래 표의 좌측 문자열을 검색해 우측으로 정확히 바꾼다(문자열이 여러 곳에 나타나면 전부 바꾼다):

| 기존 문자열 | 새 문자열 |
|---|---|
| `text-xl md:text-2xl font-bold text-stone-900 tracking-tight` (페이지 제목 `<h1>고객 관리 리스트</h1>`) | `text-heading-1 font-bold text-navy tracking-tight` |
| `text-xs md:text-sm text-stone-500` (페이지 설명 `<p>`) | `text-body-sm text-muted` |
| `bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold` (신규 고객 수동 추가 버튼) | `bg-orange hover:bg-orange/90 text-white rounded-md text-caption font-semibold` |
| `bg-emerald-50 border-emerald-100 text-emerald-800` (성공 알림 박스) | `bg-surface border-border-soft text-navy` |
| `text-emerald-600` (성공 알림 체크 아이콘) | `text-yellow` |
| `bg-stone-900 text-white` (활성 탭 버튼) | `bg-orange text-white` |
| `text-stone-500 hover:bg-stone-50` (비활성 탭 버튼) | `text-muted hover:bg-surface` |
| `focus:ring-2 focus:ring-amber-500` (검색 입력창 포커스) | `focus:ring-2 focus:ring-orange` |
| `bg-amber-50 border-amber-200` (완주 임박/선택 액션 바 배경) | `bg-surface border-border` |
| `text-amber-900` (액션 바 텍스트 "N명 선택됨") | `text-navy` |
| `bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold` (일괄 생성 버튼) | `bg-orange hover:bg-orange/90 text-white rounded-md text-caption font-bold` |
| `bg-emerald-50 border-emerald-100 text-emerald-800` (일괄 생성 완료 토스트) | `bg-surface border-border-soft text-navy` |
| `text-emerald-600` (완료 토스트 체크 아이콘, `CheckCircle`) | `text-yellow` |
| `border-3 border-amber-100 border-t-amber-600` (로딩 스피너) | `border-3 border-border border-t-orange` |
| `text-xs text-stone-400` (로딩 문구) | `text-caption text-muted` |
| `bg-white border border-stone-200` 계열의 신규 고객 등록 폼 카드 배경/보더 | `bg-white border border-border-soft` |
| `text-[10px] font-bold text-stone-500` (폼 라벨) | `text-micro font-bold text-muted` |
| `bg-stone-50 border-stone-200 focus:ring-2 focus:ring-amber-500` (전화번호 입력창) | `bg-surface border-border focus:ring-2 focus:ring-orange` |
| `text-amber-600 focus:ring-amber-500` (마케팅 동의 체크박스) | `text-orange focus:ring-orange` |
| `bg-amber-600 hover:bg-amber-700 text-white` (적립 및 고객 생성 버튼) | `bg-orange hover:bg-orange/90 text-white` |
| `border-stone-200 hover:bg-stone-50 text-stone-500` (취소 버튼) | `border-border hover:bg-surface text-muted` |

이 태스크에서는 `CHURN_COLOR`를 참조하는 부분(탭 레이블에 붙은 "⚠️"/"🚨"/"📉" 이모지 등)은 문구이므로 그대로 둔다 — 색상 클래스만 교체 대상이다.

- [ ] **Step 3: `CustomerDetailPage`(`src/App.tsx`) 색상 클래스 교체**

같은 파일의 `CustomerDetailPage` 함수(약 481번째 줄 시작) 안에서 아래 블록을:

```typescript
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-amber-100 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-xs text-stone-400">고객 상세 이력을 분석하고 있습니다...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-8 text-center bg-white border border-stone-200 rounded-2xl">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-stone-700 font-bold">고객 정보를 찾을 수 없습니다.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold">
          뒤로 가기
        </button>
      </div>
    );
  }
```

아래로 교체한다:

```typescript
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-border border-t-orange rounded-full animate-spin" />
        <p className="text-caption text-muted">고객 상세 이력을 분석하고 있습니다...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-8 text-center bg-white border border-border-soft rounded-xl">
        <AlertCircle className="w-12 h-12 text-yellow mx-auto mb-3" />
        <p className="text-navy font-bold">고객 정보를 찾을 수 없습니다.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-navy text-white rounded-md text-caption font-semibold">
          뒤로 가기
        </button>
      </div>
    );
  }
```

그다음, 아래 블록을:

```typescript
      {/* Back button */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        고객 리스트로 돌아가기
      </button>

      {/* Hero card info */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-xl border border-amber-100">
            {c.name ? c.name[0] : '고'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-stone-900">{c.name || '미등록 단골 고객'}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                c.churn_stage === 'safe' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                c.churn_stage === 'watch' ? 'bg-amber-50 text-amber-800 border-amber-100' :
                c.churn_stage === 'danger' ? 'bg-red-50 text-red-800 border-red-100' :
                'bg-stone-100 text-stone-600 border-stone-200'
              }`}>
                {c.churn_stage === 'safe' ? '정상 안전군' :
                 c.churn_stage === 'watch' ? '주의군 ⚠️' :
                 c.churn_stage === 'danger' ? '위험군 🚨' :
                 '이탈군 📉'}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-mono">가입 번호: {c.phone_masked}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 shrink-0 w-full md:w-auto">
          {/* AI Message creation action */}
          <button
            onClick={handleGenerateMessage}
            disabled={isGeneratingMessage || !c.marketing_consent}
            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all ${
              c.marketing_consent
                ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
            title={!c.marketing_consent ? '마케팅 미동의 고객은 메시지를 기획할 수 없습니다' : 'AI 초안 만들기'}
          >
```

아래로 교체한다(이 블록 안의 `CHURN_LABEL 사용부는 이제 CHURN_COLOR를 직접 참조하도록 바꿔 Task 2의 재정의를 그대로 활용한다):

```typescript
      {/* Back button */}
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-1.5 text-caption font-bold text-muted hover:text-navy transition-colors"
      >
        <ArrowLeft className="w-4 h-4 text-yellow" />
        고객 리스트로 돌아가기
      </button>

      {/* Hero card info */}
      <div className="bg-white border border-border-soft rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface text-navy flex items-center justify-center font-bold text-heading-2 border border-border-soft">
            {c.name ? c.name[0] : '고'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-heading-3 font-bold text-navy">{c.name || '미등록 단골 고객'}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-caption font-medium border ${CHURN_COLOR[c.churn_stage]}`}>
                {c.churn_stage === 'safe' ? '정상 안전군' :
                 c.churn_stage === 'watch' ? '주의군 ⚠️' :
                 c.churn_stage === 'danger' ? '위험군 🚨' :
                 '이탈군 📉'}
              </span>
            </div>
            <p className="text-caption text-muted font-mono">가입 번호: {c.phone_masked}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 shrink-0 w-full md:w-auto">
          {/* AI Message creation action */}
          <button
            onClick={handleGenerateMessage}
            disabled={isGeneratingMessage || !c.marketing_consent}
            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-md text-caption font-bold flex items-center justify-center gap-2 transition-all ${
              c.marketing_consent
                ? 'bg-orange hover:bg-orange/90 text-white cursor-pointer'
                : 'bg-surface text-muted cursor-not-allowed'
            }`}
            title={!c.marketing_consent ? '마케팅 미동의 고객은 메시지를 기획할 수 없습니다' : 'AI 초안 만들기'}
          >
```

이 교체로 `CHURN_COLOR`를 새로 import해야 한다 — `src/App.tsx` 최상단 import 목록에 이미 `import { CHURN_COLOR } from './lib/churn';`가 없다면(현재 이 파일은 `ChurnStage` 타입만 `./types`에서 가져오고 `CHURN_COLOR`/`CHURN_LABEL`은 가져오지 않는다) 아래처럼 추가한다. `src/App.tsx`의 아래 import 줄을:

```typescript
import { Store, CustomerRow, VisitLog, Message, ChurnStage, GeneratedPost } from './types';
```

아래로 교체한다:

```typescript
import { Store, CustomerRow, VisitLog, Message, ChurnStage, GeneratedPost } from './types';
import { CHURN_COLOR } from './lib/churn';
```

나머지 `CustomerDetailPage`의 성공 토스트(`bg-emerald-50 border-emerald-100 text-emerald-800`), 아이콘 색(`text-amber-800`/`text-amber-700`), 버튼(`bg-stone-900`), 포커스 링(`focus:ring-amber-500`), 방문 로그의 `text-amber-600`(스탬프 개수 강조), 메시지 이력의 `bg-emerald-50 text-emerald-800`(발송완료 배지) 등은 아래 매핑을 그대로 적용한다:

| 기존 | 신규 |
|---|---|
| `bg-emerald-50 border-emerald-100 text-emerald-800` | `bg-surface border-border-soft text-navy` |
| `text-emerald-600` (아이콘) | `text-yellow` |
| `bg-amber-50/40`, `bg-amber-50` | `bg-surface` |
| `text-amber-700`, `text-amber-800`, `text-amber-600`(강조 텍스트/숫자) | `text-orange` |
| `text-emerald-600`(마케팅 동의 "동의 완료" 텍스트) | `text-navy` |
| `focus:ring-amber-500` | `focus:ring-orange` |
| `bg-stone-900 hover:bg-stone-800`(적립/메모 저장 버튼) | `bg-navy hover:bg-navy/90` |
| `text-red-600`(메모 500자 초과 경고) | `text-navy`(경고는 "500자 초과" 문구 자체로 전달, 색상 사용 안 함) |
| `bg-emerald-50 text-emerald-800`(메시지 "발송 완료" 배지), `bg-stone-100 text-stone-500`("초안 대기" 배지) | 둘 다 `bg-surface text-navy` (상태는 배지 문구로만 구분) |

- [ ] **Step 4: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 5: 금지 색상 잔재 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -nE "amber-|brand-|emerald-|red-[0-9]|green-|blue-|indigo-" src/components/CustomerTable.tsx
```
Expected: 아무 출력도 없어야 한다. (`src/App.tsx`는 다른 페이지들도 포함된 큰 파일이라 이 시점에는 전체 파일에 대해 grep하지 않고, Task 7 완료 후 마지막에 파일 전체를 한 번에 검사한다.)

- [ ] **Step 6: Commit**

```bash
git add src/components/CustomerTable.tsx src/App.tsx
git commit -m "feat: 고객 관리/상세 페이지를 디자인 시스템 v2로 교체"
```

---

### Task 6: 메시지 발송 — `MessageList.tsx`, `MessagesPage`(`src/App.tsx`)

**Files:**
- Modify: `src/components/MessageList.tsx` (전체 교체)
- Modify: `src/App.tsx` (`MessagesPage`의 JSX 반환부만, `loadMessages` 등 로직 함수는 건드리지 않음)

**Interfaces:**
- Consumes: Task 1의 토큰, Task 2의 `CHURN_COLOR`.

- [ ] **Step 1: `MessageList.tsx` 전체 교체**

```tsx
import React, { useState } from 'react';
import { Message, ChurnStage } from '../types';
import { CHURN_COLOR, CHURN_LABEL } from '../lib/churn';
import { MessageSquare, Send, Trash2, Edit3, Calendar, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  onSend: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (msg: Message) => void;
  onRegenerate: (id: string) => void;
}

export default function MessageList({ messages, onSend, onDelete, onEdit, onRegenerate }: MessageListProps) {
  const [activeTab, setActiveTab] = useState<'draft' | 'sent'>('draft');

  const filteredMessages = messages.filter((msg) => msg.status === activeTab);

  return (
    <div className="bg-white rounded-xl border border-border-soft overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border-soft bg-surface">
        <button
          onClick={() => setActiveTab('draft')}
          className={`flex-1 py-4 text-center text-body-sm font-semibold border-b-2 transition-all ${
            activeTab === 'draft'
              ? 'border-orange text-navy'
              : 'border-transparent text-muted hover:text-navy'
          }`}
        >
          발송 대기 초안 ({messages.filter((m) => m.status === 'draft').length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 py-4 text-center text-body-sm font-semibold border-b-2 transition-all ${
            activeTab === 'sent'
              ? 'border-orange text-navy'
              : 'border-transparent text-muted hover:text-navy'
          }`}
        >
          발송 완료 내역 ({messages.filter((m) => m.status === 'sent').length})
        </button>
      </div>

      {/* Message Items List */}
      <div className="divide-y divide-border-soft p-2">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare className="w-12 h-12 text-yellow mb-3" />
            <p className="text-navy font-medium">
              {activeTab === 'draft' ? '발송 대기 중인 초안이 없습니다.' : '발송 완료된 메시지 내역이 없습니다.'}
            </p>
            <p className="text-muted text-caption mt-1">
              {activeTab === 'draft' ? '새 초안 생성 패널에서 AI 초안을 생성해 보세요.' : '대기 중인 초안의 [발송] 버튼을 누르면 발송이 완료됩니다.'}
            </p>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            return (
              <div key={msg.id} className="p-4 sm:p-5 space-y-4 hover:bg-surface rounded-lg transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-navy">{msg.customer_name || '미등록'}</span>
                    <span className="text-caption text-muted font-mono">{msg.phone_masked}</span>
                    <span className={`px-2 py-0.5 rounded text-micro font-semibold ${CHURN_COLOR[msg.churn_stage]}`}>
                      {CHURN_LABEL[msg.churn_stage]}
                    </span>
                    {msg.message_type === 'near_completion' && (
                      <span className="px-2 py-0.5 rounded text-micro font-semibold bg-yellow text-navy">
                        🎁 완주 임박
                      </span>
                    )}
                    {!msg.marketing_consent && (
                      <span className="px-1.5 py-0.5 rounded text-micro font-medium bg-surface text-muted border border-border-soft">
                        마케팅 미동의
                      </span>
                    )}
                  </div>
                  
                  {/* Date Badge */}
                  <div className="flex items-center gap-1.5 text-caption text-muted">
                    <Calendar className="w-3.5 h-3.5 text-yellow" />
                    <span>
                      {msg.status === 'sent' && msg.sent_at
                        ? `${new Date(msg.sent_at).toLocaleDateString('ko-KR')} 발송`
                        : `${new Date(msg.created_at).toLocaleDateString('ko-KR')} 생성`}
                    </span>
                  </div>
                </div>

                {/* 30-Day Warning Banner */}
                {msg.status === 'draft' && msg.last_sent_within_30d && (
                  <div className="flex items-start gap-2 bg-surface rounded-lg p-3 text-caption text-navy border border-border-soft">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow" />
                    <div>
                      <strong>중복 발송 경고:</strong> 이 고객은 최근 30일 이내에 메시지를 수신한 이력이 있습니다. 잦은 발송은 피로감을 주어 마케팅 미동의 또는 수신 거부로 이어질 수 있으니 신중히 결정해 주세요.
                    </div>
                  </div>
                )}

                {/* Content Box */}
                <div className="bg-surface rounded-lg p-4 text-body-sm text-navy font-normal leading-relaxed whitespace-pre-wrap border border-border-soft">
                  {msg.content}
                </div>

                {/* Actions */}
                {msg.status === 'draft' && (
                  <div className="flex justify-end gap-2.5 pt-1">
                    <button
                      onClick={() => onDelete(msg.id)}
                      className="px-3.5 py-2 text-caption font-medium rounded-md text-muted hover:text-navy hover:bg-surface transition-all border border-border flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                    <button
                      onClick={() => onRegenerate(msg.id)}
                      className="px-3.5 py-2 text-caption font-medium rounded-md text-muted hover:text-navy hover:bg-surface transition-all border border-border flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-yellow" />
                      재생성
                    </button>
                    <button
                      onClick={() => onEdit(msg)}
                      className="px-3.5 py-2 text-caption font-medium rounded-md text-navy hover:bg-surface bg-white border border-border transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-yellow" />
                      내용 편집
                    </button>
                    
                    <div className="relative group">
                      <button
                        disabled={!msg.marketing_consent}
                        onClick={() => onSend(msg.id)}
                        className={`px-4 py-2 text-caption font-semibold rounded-md text-white transition-all flex items-center gap-1.5 ${
                          msg.marketing_consent
                            ? 'bg-orange hover:bg-orange/90 cursor-pointer'
                            : 'bg-border-strong cursor-not-allowed text-muted'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        메시지 발송
                      </button>
                      {!msg.marketing_consent && (
                        <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-navy text-white text-micro rounded shadow-lg z-50 text-center leading-normal">
                          마케팅 미동의 고객은 마케팅 메시지를 발송할 수 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `MessagesPage`(`src/App.tsx`) JSX 반환부 색상 클래스 교체**

`src/App.tsx`에서 아래 블록을(`MessagesPage` 함수의 `return` 문 전체, `loadMessages`/`fetchMessagesFromApi`/`handleSend`/`handleDelete`/`handleRegenerate`/`handleEditClick`/`handleSaveEdit` 등 로직 함수는 그대로 두고 JSX만):

```typescript
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">AI 고객 제안 메시지</h1>
        <p className="text-xs md:text-sm text-stone-500">
          이탈 위험 고객을 분석해 자동으로 작성된 맞춤 리마인드 메시지 초안을 편집하고 전송합니다.
        </p>
      </div>

      {toastMsg && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4.5 h-4.5 text-amber-600 animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Editing Modal Dialog */}
      {editingMsg && (
        <div className="fixed inset-0 bg-stone-900/45 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-stone-100">
            <h3 className="font-bold text-stone-900 text-base">메시지 내용 편집</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <textarea
                rows={8}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full text-sm p-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed whitespace-pre-wrap"
              />
              <div className={`text-right text-xs font-medium ${editContent.length >= 900 ? 'text-amber-600' : 'text-stone-400'}`}>
                {editContent.length.toLocaleString()} / 1,000자
              </div>
              {editContent.length >= 900 && (
                <div className="flex items-start gap-2 bg-amber-50 rounded-lg p-3 text-xs text-amber-800 border border-amber-100/60">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>메시지는 1,000자 이하로 작성해 주세요. 핵심 내용만 간결하게 정리하면 고객이 더 쉽게 읽을 수 있어요.</span>
                </div>
              )}
              <div className="flex justify-end gap-2.5">
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  변경사항 저장
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMsg(null)}
                  className="px-4 py-2 border border-stone-200 hover:bg-stone-50 rounded-xl text-xs text-stone-500 font-semibold"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <div className="w-8 h-8 border-3 border-amber-100 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-xs text-stone-400">초안을 불러오고 있습니다...</p>
        </div>
      ) : (
        <MessageList
          messages={messages}
          onSend={handleSend}
          onDelete={handleDelete}
          onEdit={handleEditClick}
          onRegenerate={handleRegenerate}
        />
      )}
    </div>
  );
}
```

아래로 교체한다:

```typescript
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading-1 font-bold text-navy tracking-tight">AI 고객 제안 메시지</h1>
        <p className="text-body-sm text-muted">
          이탈 위험 고객을 분석해 자동으로 작성된 맞춤 리마인드 메시지 초안을 편집하고 전송합니다.
        </p>
      </div>

      {toastMsg && (
        <div className="p-4 bg-surface border border-border-soft text-navy text-caption font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4.5 h-4.5 text-yellow animate-pulse" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Editing Modal Dialog */}
      {editingMsg && (
        <div className="fixed inset-0 bg-navy/45 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-border-soft">
            <h3 className="font-bold text-navy text-body-md">메시지 내용 편집</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <textarea
                rows={8}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full text-body-sm p-4 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange leading-relaxed whitespace-pre-wrap"
              />
              <div className={`text-right text-caption font-medium ${editContent.length >= 900 ? 'text-orange' : 'text-muted'}`}>
                {editContent.length.toLocaleString()} / 1,000자
              </div>
              {editContent.length >= 900 && (
                <div className="flex items-start gap-2 bg-surface rounded-lg p-3 text-caption text-navy border border-border-soft">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-yellow" />
                  <span>메시지는 1,000자 이하로 작성해 주세요. 핵심 내용만 간결하게 정리하면 고객이 더 쉽게 읽을 수 있어요.</span>
                </div>
              )}
              <div className="flex justify-end gap-2.5">
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange hover:bg-orange/90 text-white rounded-md text-caption font-bold cursor-pointer"
                >
                  변경사항 저장
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMsg(null)}
                  className="px-4 py-2 border border-border hover:bg-surface rounded-md text-caption text-muted font-semibold"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <div className="w-8 h-8 border-3 border-border border-t-orange rounded-full animate-spin" />
          <p className="text-caption text-muted">초안을 불러오고 있습니다...</p>
        </div>
      ) : (
        <MessageList
          messages={messages}
          onSend={handleSend}
          onDelete={handleDelete}
          onEdit={handleEditClick}
          onRegenerate={handleRegenerate}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 4: 금지 색상 잔재 확인**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -nE "amber-|brand-|emerald-|red-[0-9]|green-|blue-|indigo-" src/components/MessageList.tsx
```
Expected: 아무 출력도 없어야 한다.

- [ ] **Step 5: Commit**

```bash
git add src/components/MessageList.tsx src/App.tsx
git commit -m "feat: 메시지 발송 페이지를 디자인 시스템 v2로 교체"
```

---

### Task 7: 콘텐츠 생성 · 설정 · 남은 UI — `ContentEditor.tsx`, `ContentPage`/`SettingsPage`(`src/App.tsx`)

**Files:**
- Modify: `src/components/ContentEditor.tsx` (전체 교체)
- Modify: `src/App.tsx` (`ContentPage`, `SettingsPage` 섹션)

**Interfaces:**
- Consumes: Task 1의 토큰.

- [ ] **Step 1: `ContentEditor.tsx` 전체 교체**

```tsx
import React, { useState } from 'react';
import { Sparkles, Copy, Save, RefreshCw, Check, Instagram, Globe, MessageSquareCode } from 'lucide-react';
import { ContentDraft } from '../lib/mock';

interface ContentEditorProps {
  onGenerate: (params: {
    purpose: string;
    details: string;
    benefit: string;
    duration: string;
    tone: string;
    emphasis: string;
  }) => Promise<void>;
  onSaveDraft: (channel: 'instagram' | 'naver' | 'kakao', content: string, hashtags: string) => Promise<void>;
  savedDrafts: ContentDraft[];
  generatedPost: {
    instagram_post: string;
    naver_post: string;
    kakao_post: string;
    hashtags: string;
  } | null;
  isGenerating: boolean;
}

export default function ContentEditor({ onGenerate, onSaveDraft, savedDrafts, generatedPost, isGenerating }: ContentEditorProps) {
  // Form states
  const [purpose, setPurpose] = useState('신메뉴 소개');
  const [details, setDetails] = useState('');
  const [benefit, setBenefit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tone, setTone] = useState('친근하게');
  const [emphasis, setEmphasis] = useState('');

  // Channel Tabs
  const [activeTab, setActiveTab] = useState<'instagram' | 'naver' | 'kakao'>('instagram');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<boolean>(false);

  // Form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      purpose,
      details,
      benefit,
      duration: startDate && endDate ? `${startDate} ~ ${endDate}` : '제한 없음',
      tone,
      emphasis,
    });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = async () => {
    if (!generatedPost) return;
    const content = activeTab === 'instagram' ? generatedPost.instagram_post : activeTab === 'naver' ? generatedPost.naver_post : generatedPost.kakao_post;
    await onSaveDraft(activeTab, content, generatedPost.hashtags);
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 2000);
  };

  const getChannelContent = () => {
    if (!generatedPost) return '';
    if (activeTab === 'instagram') return generatedPost.instagram_post;
    if (activeTab === 'naver') return generatedPost.naver_post;
    if (activeTab === 'kakao') return generatedPost.kakao_post;
    return '';
  };

  const channelText = getChannelContent();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* 1. Left Input Form (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-border-soft p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-border-soft pb-3">
          <Sparkles className="w-4.5 h-4.5 text-yellow animate-pulse" />
          <h3 className="font-bold text-navy text-body-sm tracking-tight">SNS 마케팅 콘텐츠 기획</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">홍보 목적</label>
            <div className="grid grid-cols-2 gap-2">
              {['재방문 유도', '신메뉴 소개', '이벤트', '기타'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  className={`py-2 px-3 text-caption font-bold rounded-md border text-center transition-all duration-200 cursor-pointer ${
                    purpose === p
                      ? 'bg-surface border-orange text-navy'
                      : 'bg-white border-border text-muted hover:bg-surface hover:text-navy'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">상세 내용 및 소개</label>
            <textarea
              required
              rows={4}
              placeholder="예: 프랑스 고메 버터를 가득 넣어 구운 정통 소금빵이 새롭게 입고되었습니다. 겉은 바삭하고 속은 극상의 버터동굴이 있어 쫄깃합니다."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface transition-all placeholder:text-muted-soft font-medium leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">제공 혜택</label>
            <input
              type="text"
              placeholder="예: 포장 주문 시 10% 할인 또는 스탬프 2배 적립"
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface transition-all placeholder:text-muted-soft font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-caption px-3 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface font-medium"
              />
            </div>
            <div>
              <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-caption px-3 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">원하는 말투</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-white font-bold text-navy cursor-pointer"
            >
              <option value="친근하게">친근하게 (이모티콘 사용, 따뜻한 어조)</option>
              <option value="공식적으로">공식적으로 (안내문구, 깔끔하고 정중함)</option>
              <option value="감성적으로">감성적으로 (감성 에세이풍, 분위기 강조)</option>
            </select>
          </div>

          <div>
            <label className="block text-micro font-bold text-muted uppercase tracking-wide mb-2">특히 강조할 포인트</label>
            <input
              type="text"
              placeholder="예: 당일 생산 및 당일 판매 원칙 고수"
              value={emphasis}
              onChange={(e) => setEmphasis(e.target.value)}
              className="w-full text-caption px-3.5 py-2.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-orange focus:border-orange bg-surface transition-all placeholder:text-muted-soft font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-3 px-4 bg-orange hover:bg-orange/90 disabled:bg-border-strong text-white rounded-md text-caption font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                AI 포스팅 생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 포스팅 초안 만들기
              </>
            )}
          </button>
        </form>
      </div>

      {/* 2. Right Generation Results (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-border-soft overflow-hidden flex flex-col min-h-[440px]">
          {/* Header Channels Tabs */}
          <div className="flex border-b border-border-soft bg-surface">
            <button
              onClick={() => setActiveTab('instagram')}
              className={`flex-1 py-4 text-center text-caption font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'instagram'
                  ? 'border-orange text-navy bg-white font-extrabold'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Instagram className="w-4 h-4 text-yellow" /> 인스타그램
            </button>
            <button
              onClick={() => setActiveTab('naver')}
              className={`flex-1 py-4 text-center text-caption font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'naver'
                  ? 'border-orange text-navy bg-white font-extrabold'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Globe className="w-4 h-4 text-yellow" /> 네이버 소식
            </button>
            <button
              onClick={() => setActiveTab('kakao')}
              className={`flex-1 py-4 text-center text-caption font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'kakao'
                  ? 'border-orange text-navy bg-white font-extrabold'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <MessageSquareCode className="w-4 h-4 text-yellow" /> 카카오 알림
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="flex-1 p-6 flex flex-col justify-between">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-10 h-10 rounded-full border-3 border-border border-t-orange animate-spin" />
                <p className="text-navy font-bold text-body-sm">홍보 목적에 맞는 최적의 본문을 작성하고 있습니다.</p>
                <p className="text-muted text-caption">매장 가독성이 높고 매력적인 혜택 위주로 AI가 가공하는 중입니다.</p>
              </div>
            ) : generatedPost ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center text-micro font-bold text-muted">
                    <span>추천 레이아웃 및 혜택 적용 완료</span>
                    <span>글자 수: <strong className="font-bold text-navy font-mono text-caption">{channelText.length}</strong>자</span>
                  </div>

                  {/* Generated Box */}
                  <div className="mt-3 bg-surface rounded-md p-4 text-caption text-navy leading-relaxed font-medium whitespace-pre-wrap border border-border-soft max-h-[250px] overflow-y-auto">
                    {channelText}
                  </div>

                  {/* Hashtags display */}
                  {generatedPost.hashtags && (
                    <div className="mt-4 p-3.5 bg-surface rounded-md border border-border-soft">
                      <p className="text-[9px] font-bold text-orange uppercase tracking-wide">제안 해시태그</p>
                      <p className="text-caption font-mono text-navy mt-1 leading-snug">{generatedPost.hashtags}</p>
                    </div>
                  )}
                </div>

                {/* Content Actions */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-border-soft">
                  <button
                    onClick={() => handleSave()}
                    className="px-4 py-2.5 text-caption font-bold rounded-md text-navy hover:bg-surface bg-white border border-border transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {savedStatus ? <Check className="w-3.5 h-3.5 text-yellow" /> : <Save className="w-3.5 h-3.5" />}
                    {savedStatus ? '저장됨' : '임시저장'}
                  </button>
                  <button
                    onClick={() => handleCopy(channelText + '\n\n' + generatedPost.hashtags, 'gen')}
                    className="px-4 py-2.5 text-caption font-bold rounded-md text-white bg-orange hover:bg-orange/90 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === 'gen' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === 'gen' ? '복사 완료' : '전체 복사'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center text-yellow mb-4">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <p className="text-navy font-bold text-body-sm">왼쪽의 기획 내용을 채우고 버튼을 누르세요.</p>
                <p className="text-muted text-caption mt-1 leading-normal">인스타그램, 네이버 소식글이 매장의 이력을 바탕으로 동시 기획됩니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Saved Drafts History List */}
        <div className="bg-white rounded-xl border border-border-soft p-6 space-y-4">
          <h4 className="font-bold text-navy text-caption tracking-tight">저장된 기획 초안 이력 ({savedDrafts.length})</h4>
          {savedDrafts.length === 0 ? (
            <p className="text-muted text-caption text-center py-8">임시저장된 홍보 글이 아직 없습니다.</p>
          ) : (
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {savedDrafts.map((draft) => (
                <div key={draft.id} className="p-3.5 bg-surface hover:bg-border-soft rounded-md border border-border-soft transition-all flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white text-navy border border-border-soft">
                        {draft.channel === 'instagram' ? '인스타그램' : draft.channel === 'naver' ? '네이버' : '카카오'}
                      </span>
                      <span className="text-[9px] text-muted font-mono font-bold">
                        {new Date(draft.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-caption text-navy line-clamp-2 leading-relaxed whitespace-pre-wrap font-medium">
                      {draft.content}
                    </p>
                    {draft.hashtags && <p className="text-micro font-mono font-bold text-orange truncate">{draft.hashtags}</p>}
                  </div>
                  <button
                    onClick={() => handleCopy(draft.content + '\n' + draft.hashtags, draft.id)}
                    className="p-2 text-muted hover:text-navy bg-white border border-border rounded-md transition-all shrink-0 cursor-pointer"
                    title="초안 복사"
                  >
                    {copiedId === draft.id ? <Check className="w-3.5 h-3.5 text-yellow" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**참고**: 원본에는 채널 태그(인스타그램/네이버/카카오)가 `fuchsia`/`emerald`/`yellow`로 색이 서로 달랐다 — 이는 원래 있던 팔레트에도 없던 `fuchsia`를 포함해 이번 시스템의 허용 팔레트(Navy/Orange/Yellow)에 전혀 없는 색이었으므로, "채널 구분은 색이 아니라 라벨 문구로" 규칙에 따라 3개 채널 태그를 전부 동일한 `bg-white text-navy border-border-soft`로 통일했다.

- [ ] **Step 2: `ContentPage`(`src/App.tsx`) 색상 클래스 교체**

`src/App.tsx`의 `ContentPage` 함수 안, 아래 블록을:

```typescript
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">AI 소셜 마케팅 기획</h1>
        <p className="text-xs md:text-sm text-stone-500">
          인스타그램 피드, 네이버 플레이스 소식글, 카카오 채널 포스팅 초안을 한 번에 AI가 목적에 맞추어 디자인합니다.
        </p>
      </div>

      {toastMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl">
          {toastMsg}
        </div>
      )}
```

아래로 교체한다:

```typescript
      <div>
        <h1 className="text-heading-1 font-bold text-navy tracking-tight">AI 소셜 마케팅 기획</h1>
        <p className="text-body-sm text-muted">
          인스타그램 피드, 네이버 플레이스 소식글, 카카오 채널 포스팅 초안을 한 번에 AI가 목적에 맞추어 디자인합니다.
        </p>
      </div>

      {toastMsg && (
        <div className="p-4 bg-surface border border-border-soft text-navy text-caption font-semibold rounded-xl">
          {toastMsg}
        </div>
      )}
```

- [ ] **Step 3: `SettingsPage`(`src/App.tsx`) 색상 클래스 교체**

같은 파일의 `SettingsPage` 함수 안에서 아래 블록을:

```typescript
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
        <div className="w-8 h-8 border-3 border-amber-100 border-t-amber-600 rounded-full animate-spin" />
        <p className="text-xs text-stone-400">설정 데이터를 가져오고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">매장 리워드 환경설정</h1>
        <p className="text-xs md:text-sm text-stone-500">
          모바일 적립 QR 시스템 설정, 목표 스탬프 리워드 내용 및 AI 메시지 서명을 조율합니다.
        </p>
      </div>

      {toastMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl">
          {toastMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5 shadow-sm">
```

아래로 교체한다:

```typescript
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
        <div className="w-8 h-8 border-3 border-border border-t-orange rounded-full animate-spin" />
        <p className="text-caption text-muted">설정 데이터를 가져오고 있습니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-heading-1 font-bold text-navy tracking-tight">매장 리워드 환경설정</h1>
        <p className="text-body-sm text-muted">
          모바일 적립 QR 시스템 설정, 목표 스탬프 리워드 내용 및 AI 메시지 서명을 조율합니다.
        </p>
      </div>

      {toastMsg && (
        <div className="p-4 bg-surface border border-border-soft text-navy text-caption font-semibold rounded-xl">
          {toastMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border-soft p-6 space-y-5">
```

그다음, `SettingsPage` 안의 입력 필드 5개(매장명/대표자명/목표 스탬프/완주 임박 기준/리워드설명/서명)와 제출 버튼에 반복적으로 나오는 아래 클래스들을 전부 치환한다:

| 기존 | 신규 |
|---|---|
| `block text-xs font-bold text-stone-500 uppercase` (라벨) | `block text-micro font-bold text-muted uppercase` |
| `bg-stone-50 border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500` (텍스트/숫자 입력창) | `bg-surface border-border rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange` |
| `bg-white border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500` (select) | `bg-white border-border rounded-md focus:outline-none focus:ring-2 focus:ring-orange` |
| `text-[11px] text-stone-400` (완주 임박 기준 설명문) | `text-[11px] text-muted` |
| `w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm` (저장 버튼) | `w-full py-3 bg-orange hover:bg-orange/90 text-white rounded-md text-caption font-bold` |

- [ ] **Step 4: 타입 체크**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
npm run lint
```
Expected: 에러 없이 종료 (exit code 0)

- [ ] **Step 5: 금지 색상 잔재 확인 — `ContentEditor.tsx`, 그리고 `App.tsx` 전체(이번이 마지막 태스크이므로 파일 전체를 검사한다)**

Run:
```bash
cd /mnt/c/Users/kjin6/Desktop/Github/Project/Rebot-App-Owner-Dashboard
grep -nE "amber-|brand-|emerald-|red-[0-9]|green-|blue-|indigo-|fuchsia-" src/components/ContentEditor.tsx
```
Expected: 아무 출력도 없어야 한다.

```bash
grep -nE "amber-|brand-|emerald-|red-[0-9]|green-|blue-|indigo-|fuchsia-" src/App.tsx
```
Expected: `StampKioskPage`(범위 밖으로 확정됨) 함수 안의 줄들만 출력되어야 한다 — 그 외 페이지(`OwnerLayout`, `DashboardPage`, `CustomersPage`, `CustomerDetailPage`, `MessagesPage`, `ContentPage`, `SettingsPage`)에서는 아무 매치도 없어야 한다. `StampKioskPage`가 아닌 곳에서 매치가 나오면 놓친 부분이니 찾아서 위 태스크들의 매핑 표에 따라 마저 교체한다.

- [ ] **Step 6: Commit**

```bash
git add src/components/ContentEditor.tsx src/App.tsx
git commit -m "feat: 콘텐츠 생성/설정 페이지를 디자인 시스템 v2로 교체"
```

---

## Self-Review

**스펙 커버리지:**
- `docs/superpowers/specs/2026-07-06-design-system-v2-rollout.md`의 섹션 1(토큰) → Task 1. 섹션 2(이탈 배지) → Task 2. 섹션 3(앱 셸) → Task 3. 섹션 4(대시보드 홈) → Task 4. 섹션 5(고객 관리) → Task 5. 섹션 6(메시지 발송) → Task 6. 섹션 7(콘텐츠·설정·남은 페이지) → Task 7. 섹션 8(`index.html` 타이틀) → Task 1.
- "범위 밖" 섹션(로직/API 불변, `StampKioskPage` 제외, `PostPreview.tsx`/`loadMessages` 미접촉) — 각 태스크의 Global Constraints와 Step에서 명시적으로 반영됨.

**플레이스홀더 스캔:** "TBD"/"나중에" 표현 없음. 모든 Step이 실행 가능한 전체 코드 또는 완전한 문자열 매핑 표(모호함 없는 확정된 old→new 쌍)를 포함한다.

**타입/시그니처 일관성:** `CHURN_COLOR`(Task 2에서 재정의)를 `CustomerTable.tsx`(Task 5), `MessageList.tsx`(Task 6), `CustomerDetailPage`(Task 5)가 동일하게 import해서 쓰며 재정의하지 않음 — 단일 진실 공급원 유지. `CustomerTable`의 `selectable`/`selectedIds`/`onToggleSelect`/`onToggleSelectAll` props와 `CustomersPage`의 호출부(App.tsx, 이 계획에서 직접 수정하지 않지만 클래스 매핑만 적용되므로 기존 props 전달 코드는 그대로 유지됨)가 일치. Task 1에서 정의한 `text-navy`/`bg-orange`/`bg-yellow`/`bg-surface`/`border-border-soft`/`text-muted`/`text-heading-*`/`text-body-*`/`text-caption`/`text-micro`/`text-number-*` 클래스명이 Task 2~7 전체에서 동일한 철자로 일관되게 사용됨(오타로 인한 미정의 클래스 참조 없음 — 직접 대조 확인함).

## 다음 단계

이 계획을 승인하면 `subagent-driven-development` 또는 `executing-plans` 스킬로 태스크별 구현을 시작한다.
