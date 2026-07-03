# 🚀 Rebot(리봇) 아키텍처 및 배포 가이드

본 문서는 리봇(Rebot) 프로젝트의 상업화 및 향후 확장을 고려한 **보안, 배포, 그리고 레포지토리 관리 정책**을 정리한 문서입니다.

---

## 🔒 1. 레포지토리 보안 정책 (Private 권장)

상업성을 띤 프로젝트의 소스 코드는 핵심 자산이므로 깃허브 레포지토리를 **Private(비공개)**으로 설정하는 것이 원칙입니다.

- **지식재산권 보호**: AI 재방문 메시지 생성 프롬프트, 이탈 고객 예측 알고리즘 등의 무단 복제를 방지합니다.
- **요금 폭탄(해킹) 방지**: 깃허브를 24시간 스캔하는 해커 봇들로부터 API 키 유출을 1차적으로 방어합니다. (`.gitignore` 세팅으로 2차 방어도 완료된 상태입니다.)
- **테스트 영향 없음**: 코드가 비공개될 뿐, 이미 배포된 Vercel URL은 전 세계 누구나 계속 접속하고 테스트할 수 있습니다.

---

## 🌐 2. 프론트엔드 배포 플랫폼 정책

### Vercel (메인 배포 플랫폼)
- **지원 여부**: ⭕ 무료 지원 (무제한)
- **설명**: 리봇 서비스 배포에 Vercel을 메인으로 사용합니다. 무료 요금제(Hobby)에서도 Private 레포지토리 배포를 제한 없이 지원합니다.
- **브랜치별 배포 동작**:
  - `main` 브랜치 → Merge 시 프로덕션 배포 (실서비스)
  - `dev` 브랜치 → Vercel 프로젝트 연결 시 Preview URL 자동 생성 (테스트용)
  - `feat/*` 브랜치 → PR 생성 시 Preview URL 자동 생성 (기능 확인용)

> *(참고: GitHub Pages는 Private 배포 시 유료 결제가 필요하므로 사용하지 않습니다.)*

---

## 🏛️ 3. 레포지토리 구조 및 진화 방향

### 현재 구조 (폴리레포 — MVP 단계)

현재는 두 개의 독립 레포지토리로 운영 중입니다.

```
Rebot-App-Owner-Dashboard         (사장님 대시보드 — Vercel 배포 중)
├── main
├── dev
└── feat/*, fix/*, chore/*

Rebot-App-Customer-facing-page    (고객 스탬프 페이지 — Vercel 배포 중)
├── main
├── dev
└── feat/*, fix/*, chore/*

공통 DB: Supabase (두 레포가 동일 프로젝트 공유)
```

### 미래 구조 (모노레포 — 정식 서비스 전환 시 고려)

아래 조건이 2개 이상 해당될 때 모노레포 전환을 검토합니다.

- 두 레포 간 공통 컴포넌트·타입이 많아질 때
- 개발자가 2명 이상으로 늘어날 때
- TypeScript 타입을 두 프로젝트가 공유해야 할 때

```
rebot/ (단일 레포 — Private 유지)
├── owner-dashboard/    ← 사장님 대시보드
├── customer-page/      ← 고객 스탬프 페이지
├── docs/               ← 공통 문서
└── README.md
```

---

## 🔒 4. 브랜치 보호 설정 (Branch Protection)

**GitHub 레포 → Settings → Branches → Add branch protection rule**

### `main` 설정
- Branch name pattern: `main`
- ✅ Require a pull request before merging
- Require approvals: **0** (1인 개발 — 본인 PR 직접 머지 가능)
- ✅ Block force pushes
- ✅ Restrict deletions

### `dev` 설정
- Branch name pattern: `dev`
- ✅ Require a pull request before merging
- Require approvals: **0**
- ✅ Block force pushes

> 두 레포 **(Owner-Dashboard, Customer-facing-page)** 각각 동일하게 설정합니다.

---

## 🤝 5. 브랜치 운영 원칙

**절대 지켜야 할 원칙 딱 하나:**
> **`main`과 `dev`에는 직접 코드를 올리지 않는다. 무조건 작업 브랜치(`feat/`, `fix/`, `chore/`)에서 PR로만 병합한다.**

| 실수 유형 | 결과 |
|-----------|------|
| `main`에 직접 Push | 미완성 코드가 실서비스에 즉시 배포됨 |
| `feat/`에서 `main`으로 바로 PR 후 Merge | `dev` 테스트 없이 실서비스에 배포될 수 있음 |
| `feat/`를 `dev` 아닌 `main`에서 생성 | `dev`의 최신 코드 없는 과거 기준으로 작업하게 됨 |

**자동 삭제 설정 (권장)**
GitHub 레포 → Settings → General → **"Automatically delete head branches"** 체크
→ PR 머지 시 작업 브랜치 자동 삭제
