# 디자인 시스템 v2(Navy/Orange/Yellow) 전체 적용 설계 (2026-07-06)

## 배경

사용자가 완결된 디자인 시스템 문서 `DESIGN-v2.md`(레포 루트)와 참조 시안 `orange-01.png`(레포 루트, 대시보드 홈 화면)를 직접 제공했다. 이 문서가 색상/타이포/레이아웃/컴포넌트 토큰을 hex 값까지 명시적으로 확정하고 있으므로, 이번 스펙은 새로 디자인을 브레인스토밍하지 않고 **`DESIGN-v2.md`를 유일한 디자인 소스로 삼아 이 코드베이스(React + Tailwind v4)에 어떻게, 어떤 순서로 반영할지**만 정의한다.

**사용자 확정 사항**
- 적용 범위: 앱 전체(사이드바/하단내비, 대시보드, 고객관리/상세, 메시지발송, 콘텐츠생성, 설정 페이지 전부).
- 폰트가 전반적으로 작아 보이니 키우되, 지금까지 빌딩한 기능(완주 임박 타겟팅, 메시지 생성, 벌크 선택 등)을 절대 망가뜨리지 않을 것 — **이번 작업은 순수 프레젠테이션(스타일) 계층만 바꾸고, 어떤 로직/상태/API 계약도 변경하지 않는다.**

## 현재 상태 조사

- `src/index.css`: `@theme`에 `--font-sans: "Plus Jakarta Sans", "Noto Sans KR", ...`, `--color-brand-50~900`(테라코타 계열), 커스텀 폰트 크기 스케일(`--font-size-xs`~`--font-size-3xl`), `--shadow-premium*`, `.premium-card` 유틸리티 클래스가 정의되어 있음.
- 색상 유틸리티 클래스 사용량 조사(`grep`) 결과, `stone-*`(중립), `amber-*`/`brand-*`(브랜드), `emerald-*`(success/동의), `red-*`(danger), `blue-*`/`indigo-*`(info/AI) 가 앱 전역에 걸쳐 상태 표현에 광범위하게 쓰이고 있음. `DESIGN-v2.md`는 "Green/Blue/Purple/Red 사용 금지, 상태는 텍스트·아이콘·화살표로만 표현"을 명시하므로 이 부분이 가장 손이 많이 가는 변경 지점이다.
- `src/lib/churn.ts`의 `CHURN_COLOR`(safe=green/watch=yellow/danger=orange/churned=red)가 이탈 단계 배지 색상을 전역에서 결정하는 단일 지점 — 여기를 디자인 시스템에 맞게 바꾸면 `CustomerTable`, `MessageList`, `CustomerDetailPage`의 배지가 한 번에 갱신된다.
- `src/App.tsx`(1600여 줄)는 페이지 컴포넌트 8개를 포함: `OwnerLayout`(41), `DashboardPage`(101), `CustomersPage`(187), `CustomerDetailPage`(481), `MessagesPage`(868), `ContentPage`(1096), `SettingsPage`(1178), `StampKioskPage`(1343).
- 개별 컴포넌트: `Sidebar.tsx`, `BottomNav.tsx`, `DashboardCards.tsx`, `PerformanceCard.tsx`, `ActivityFeed.tsx`, `QRPreview.tsx`, `CustomerTable.tsx`, `MessageList.tsx`, `ContentEditor.tsx`, `PostPreview.tsx`.
- `index.html`의 `<title>`이 아직 스캐폴딩 기본값 "My Google AI Studio App" — 이번 기회에 "리봇 CRM 대시보드" 등으로 교체.

## 설계

### 1. 디자인 토큰 (`src/index.css`) — 파운데이션

`DESIGN-v2.md`의 `Tokens`/`CSS Variable Reference`/`Tailwind Token Reference` 섹션을 그대로 이식한다:

- 폰트: Google Fonts import에 `Inter:wght@400;500;600;700;800`을 추가. `--font-sans`를 `"Inter", "Noto Sans KR", ui-sans-serif, system-ui, sans-serif`로 변경 — **Inter는 한글 글리프가 없으므로 한국어 텍스트 렌더링을 위해 `Noto Sans KR`을 폴백으로 유지한다** (`DESIGN-v2.md`의 의도인 "Inter 계열 산세리프, 에디토리얼 세리프 금지"를 해치지 않으면서 한글이 깨지지 않도록 하는 기술적 보완 — 디자인 시스템 자체의 변경이 아님).
- 색상: `--color-navy: #1C2F3A`, `--color-orange: #FF8A00`, `--color-yellow: #FFC400`, `--color-surface: #F8FAFC`, `--color-border: #E5E7EB` 등 `DESIGN-v2.md`의 전체 팔레트를 CSS 변수 + Tailwind `@theme` 커스텀 컬러(`--color-navy-*` 등 필요한 단계만)로 추가. 기존 `--color-brand-*`는 삭제(더 이상 참조하는 곳이 없어질 때까지 각 태스크에서 순차적으로 제거).
- 타이포 스케일: `display`(40px/700), `heading-1`(32px/700) ~ `micro`(12px/500), `number-xl`(44px/800) ~ `number-md`(28px/800)를 Tailwind 커스텀 폰트사이즈 토큰으로 추가(예: `--font-size-display`, `--font-size-number-xl` 등). 이 스케일 자체가 현재보다 큰 값(예: KPI 숫자 44px vs 기존 32px)이라 "폰트가 작아 보인다"는 피드백을 텍스트 크기 자체를 임의로 부풀리지 않고 자연스럽게 해결한다.
- Radius/Shadow/Spacing: `DESIGN-v2.md`의 `rounded.*`/`shadow.*`/`spacing.*` 값을 Tailwind 커스텀 토큰으로 추가.
- `.premium-card` 유틸리티는 `DESIGN-v2.md`의 `elevation`/`shapes` 규칙(흰 카드는 얇은 테두리 우선, 무거운 그림자는 강조 카드에만)에 맞게 재정의.

### 2. 이탈 단계 배지 색상 규칙 재정의 (`src/lib/churn.ts`)

`CHURN_COLOR`(현재 green/yellow/orange/red)를 디자인 시스템의 "색상으로 상태를 구분하지 않는다" 규칙에 맞게 전면 교체한다. 모든 이탈 단계 배지를 동일하게 `surface 배경 + navy 텍스트`로 통일하고, 상태 구분은 **레이블 텍스트**(정상/주의/위험/이탈, 기존 `CHURN_LABEL` 그대로 유지)만으로 한다 — `DESIGN-v2.md`의 `status` 토큰(`iconColor: yellow`, `textColor: navy`, `backgroundColor: white`, `accentColor: orange`) 패턴을 그대로 따른다. 이 파일 하나의 변경으로 `CustomerTable`, `MessageList`, `CustomerDetailPage`의 배지가 일괄 갱신된다.

### 3. 앱 셸(사이드바/하단내비) — `Sidebar.tsx`, `BottomNav.tsx`

`DESIGN-v2.md`의 `sidebar`/`sidebar-nav-item`/`sidebar-nav-item-active`/`sidebar-logo-tile`/`sidebar-instance-card` 컴포넌트 스펙을 그대로 적용: 네이비 전체 배경, 오렌지 로고 타일, 오렌지 활성 메뉴 배경, 옐로우 아이콘. `orange-01.png` 시안과 1:1로 맞춘다. `BottomNav`(모바일)도 동일한 색상 규칙을 모바일 레이아웃에 맞게 적용(현재 구조는 유지, 색상 토큰만 교체).

### 4. 대시보드 홈 — `DashboardCards.tsx`, `PerformanceCard.tsx`, `ActivityFeed.tsx`, `QRPreview.tsx`

시안과 `DESIGN-v2.md`의 "Dashboard Card Rules" 표를 그대로 따른다:
- KPI 카드 3장: 전체 등록 고객(오렌지 100% 배경/흰 텍스트), 마케팅 동의 고객(옐로우 100% 배경/네이비 텍스트), 관심 및 이탈 위험군(네이비 100% 배경/흰 텍스트) — 현재의 "흰 배경 + 컬러 아이콘 칩" 패턴에서 "카드 전체가 색으로 꽉 찬" 패턴으로 전환.
- 성과 지표 카드(`PerformanceCard`) 5장: 흰 배경/네이비 텍스트/옐로우 아이콘, 유지.
- 활동 피드(`ActivityFeed`): 흰 카드, 아이콘 옐로우로 통일(현재 활동 타입별로 다른 색 아이콘 배경 사용 중 — 통일 규칙 적용).
- QR 카드(`QRPreview`): 오렌지 100% 배경 프로모 카드로 전환, QR 이미지 영역만 흰 카드로 유지.

### 5. 고객 관리 — `CustomerTable.tsx`, `CustomerDetailPage`(App.tsx), `CustomersPage`(App.tsx)

체크박스, 탭 활성 상태, 마케팅 동의/미동의 배지, "완주 임박" 배지 등의 색상을 시스템 토큰으로 교체. 2단계에서 재정의한 `CHURN_COLOR`가 여기 자동 반영됨을 확인. 체크박스/버튼의 accent는 오렌지로 통일.

### 6. 메시지 발송 — `MessageList.tsx`, `MessagesPage`(App.tsx)

"🎁 완주 임박" 배지, 중복발송 경고 배너, 발송/초안 상태 탭 등의 색상 교체. 경고/에러성 배너는 색이 아니라 아이콘+문구로 상태를 표현하는 시스템 규칙에 맞춰 조정.

### 7. 콘텐츠 생성 · 설정 · 남은 페이지 — `ContentEditor.tsx`, `PostPreview.tsx`, `ContentPage`/`SettingsPage`/`StampKioskPage`(App.tsx)

나머지 페이지의 버튼/입력창/카드 색상을 동일한 토큰으로 교체. 입력창 포커스 링, 저장 버튼 등은 `DESIGN-v2.md`의 `input`/`button-primary`/`button-secondary` 스펙 그대로.

### 8. 기타

- `index.html`의 `<title>`을 "리봇 CRM 대시보드"로 변경.

## 범위 밖 (이번 작업에서 하지 않음)

- 어떤 비즈니스 로직, API 계약, 상태 관리 흐름도 변경하지 않는다 — 클래스명/토큰 교체와 마크업 구조의 순수 시각적 조정(카드 배경을 색으로 채우는 등 레이아웃 밀도 변경 포함)까지만 한다.
- 새 페이지, 새 기능, 새 API를 추가하지 않는다.
- `orange-01.png`에 없는 화면(고객상세/메시지/콘텐츠/설정)은 `DESIGN-v2.md`의 일반 컴포넌트 규칙(버튼/카드/배지/인풋 토큰)을 동일하게 적용하되, 시안이 없으므로 대시보드 홈과 동일한 룩을 유지하는 선에서 합리적으로 판단한다 — 페이지별로 새로운 레이아웃 구조를 고안하지 않는다.

## 검증 방식

- 이 프로젝트는 테스트 프레임워크가 없고, 이번 세션 내내 그래왔듯 샌드박스에 헤드리스 브라우저가 없어 실제 렌더링 스크린샷 확인이 불가하다.
- 각 태스크는 `npm run lint`(타입 체크)와, 해당 태스크가 손댄 파일에 금지 색상 클래스(`emerald-`, `red-`, `blue-`, `indigo-`, `green-`, 그리고 옛 `brand-`/`amber-` 잔재)가 하나도 남지 않았는지 `grep`으로 확인하는 방식으로 검증한다.
- **실제 시각적 결과(색상 대비, 레이아웃 밀도, 시안과의 일치 여부)는 병합 후 사용자가 실제 브라우저에서 직접 확인해야 한다** — 이 점을 사용자에게 명확히 알린다.

## 사용자 확정 사항

- `DESIGN-v2.md` + `orange-01.png`를 유일한 디자인 소스로 그대로 적용한다(추가 브레인스토밍 없음).
- 적용 범위는 앱 전체.
- 순수 프레젠테이션 계층 변경만 하고 기존 기능/로직은 절대 건드리지 않는다.
- 한글 렌더링을 위해 `Noto Sans KR`을 Inter의 폴백으로 유지하는 것은 기술적으로 필요한 보완으로 승인됨(암묵적 — 별도 이견 없으면 이 방식으로 진행).

## 다음 단계

이 문서 승인 후 `writing-plans` 스킬로 상세 구현 계획을 작성한다. 앱 전체 롤아웃이라 범위가 크므로, 위 섹션 1~8 순서를 태스크 단위로 그대로 사용한다(파운데이션 → 셸 → 대시보드 → 고객관리 → 메시지 → 나머지 페이지).
