# 📘 클로드 코드로 끝내는 Git 운영 룰 (리봇 프로젝트)

터미널에서 **클로드 코드(Claude Code)와 대화하는 것만으로** 모든 작업을 진행합니다.

---

## 🗺️ 프로젝트 구조 한눈에 보기

리봇은 **두 개의 독립 레포지토리**로 운영됩니다. 각 레포 안에서 브랜치를 나누어 작업합니다.

```
Rebot-App-Owner-Dashboard        Rebot-App-Customer-facing-page
├── main  (Vercel 배포 중)        ├── main  (Vercel 배포 중)
├── dev   (개발 통합)             ├── dev   (개발 통합)
│   ├── feat/owner-login         │   ├── feat/stamp-multi
│   ├── feat/supabase-rls        │   └── feat/terms-update
│   ├── feat/ai-message-v2       └── ...
│   └── feat/kakao-message-v2
└── ...
```

**작업 흐름**
```
작업 브랜치(feat/* fix/* chore/*)  →  (PR)  →  dev  →  (PR)  →  main  →  Vercel 자동 배포
```

---

## 📚 1. 브랜치란? (평행 우주 개념)

**"왜 굳이 브랜치를 따로 파서 작업하나요?"**

만약 `main`에서 직접 작업하면, 만들다 만 미완성 코드가 실제 서비스에 바로 올라가 버립니다. 그래서 브랜치라는 '평행 우주'를 만들어 내 브랜치에서는 코드를 마음껏 부수고 실험해도 배포 중인 `main`에는 단 1%의 영향도 주지 않습니다.

브랜치는 아래 3단계로 나눕니다.

1. 👑 **`main` 브랜치 = 실제 배포 중인 서비스**
   - Vercel이 바라보는 브랜치. 실제 사장님·고객이 사용하는 공간입니다.
   - **절대 직접 건드리지 않습니다. PR로만 병합합니다.**

2. 🛠️ **`dev` 브랜치 = 개발 통합 공간**
   - 완성된 기능들을 모아서 테스트하는 공간입니다.
   - 모든 작업 브랜치는 여기로 먼저 합칩니다.
   - Vercel 프로젝트에 연결되어 있으면 Preview URL로 자동 배포되어 테스트할 수 있습니다.

3. 📝 **작업 브랜치 (`feat/`, `fix/`, `chore/`) = 기능별 작업 공간**
   - 기능 하나당 브랜치 하나를 파서 작업합니다.
   - 항상 `dev`에서 만들고, 작업 완료 후 `dev`로 PR합니다.
   - **PR이 dev에 정상적으로 머지된 뒤** 브랜치를 삭제합니다.

---

## 🏷️ 2. 브랜치 이름 규칙

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feat/` | 새 기능 추가 | `feat/owner-login`, `feat/supabase-rls` |
| `fix/` | 버그 수정 | `fix/stamp-api-error`, `fix/dashboard-ui` |
| `chore/` | 기능 추가나 버그 수정은 아니지만 필요한 정리·설정·문서 작업 | `chore/terms-update`, `chore/package-update` |

### 현재 예정된 브랜치 목록 (Owner-Dashboard)

```
feat/supabase-rls        ← 1순위 (DB 보안 기반)
feat/owner-login         ← 2순위 (RLS 완료 후)
feat/ai-message-v2       ← 독립 작업 가능
feat/kakao-message-v2    ← ai-message-v2 완료 후
```

### 💡 브랜치 쪼개는 황금률 (1 브랜치 = 1 기능)

- ❌ **나쁜 예**: 하나의 브랜치에서 '로그인 + RLS + AI 메시지 개선'을 전부 작업
  - 이유: 한 기능에서 에러가 나서 롤백하면 다른 기능도 같이 날아감
- ✅ **좋은 예**: `feat/supabase-rls` 완료 → PR → `feat/owner-login` 시작
  - 이유: 문제 생긴 기능만 콕 집어서 롤백 가능

---

## 🧹 3. 브랜치 자동 청소

브랜치를 계속 파도 관리 지옥이 되지 않습니다.

- **고정 브랜치**: `main`, `dev` (항상 유지)
- **임시 브랜치**: `feat/`, `fix/`, `chore/` → 머지 후 즉시 삭제

> **PR이 dev 또는 main에 정상적으로 머지된 뒤라면**, 브랜치를 지워도 합쳐진 코드는 사라지지 않습니다. 코드는 이미 `dev`에 합쳐졌고, 브랜치 이름표만 삭제하는 것입니다.

**자동 삭제 설정 (권장)**
GitHub 레포 → Settings → General → **"Automatically delete head branches"** 체크
→ PR 머지 시 브랜치가 자동 삭제됩니다.

---

## 🔒 4. 브랜치 보호 설정 (Branch Protection)

가이드에서 "직접 Push 금지"라고 해도 실수할 수 있습니다. GitHub 설정으로 시스템이 막아주도록 합니다.

**GitHub 레포 → Settings → Branches → Add branch protection rule**

### `main` 설정
- Branch name pattern: `main`
- ✅ Require a pull request before merging
- Require approvals: **0** (1인 개발이므로 0으로 설정)
- ✅ Block force pushes
- ✅ Restrict deletions

### `dev` 설정
- Branch name pattern: `dev`
- ✅ Require a pull request before merging
- Require approvals: **0**
- ✅ Block force pushes

> 두 레포 **(Owner-Dashboard, Customer-facing-page)** 각각 동일하게 설정합니다.

---

## 🛡️ 5. 3중 방어막

코드가 날아갈 걱정하지 않아도 됩니다.

1. **브랜치 격리**: 작업 브랜치에서 망쳐도 `dev`, `main`은 멀쩡합니다.
2. **단계적 PR**: `feat` → `dev` 테스트 완료 후 → `main` Merge. 두 번 확인합니다.
3. **Revert(되돌리기)**: 망가진 코드가 머지되어도 Git 기록을 기준으로 되돌릴 수 있습니다. 공유 브랜치에서는 reset/force push가 아니라 **revert 방식**으로 되돌리는 것이 안전합니다.

---

## 🚫 6. 절대 커밋하면 안 되는 파일

Claude Code가 파일을 많이 건드리기 때문에 특히 중요합니다. 아래 파일이 깃허브에 올라가면 API 키 유출 등 심각한 보안 문제가 생깁니다.

```
.env
.env.local
.env.production
node_modules/
dist/
build/
```

> 이 파일들은 `.gitignore`에 이미 등록되어 있어야 합니다. 클로드 코드에게 확인을 요청하세요.

**커밋 전 클로드 코드에게 항상 이렇게 말합니다:**
> 🗣️ *"git status 확인하고, .env, node_modules, API 키가 포함된 파일은 절대 커밋하지 마. 커밋할 파일 목록 먼저 보여줘."*

---

## 💻 7. 실전 작업 순서

### 💡 코드가 이동하는 4단계

```
1. 수정   내 노트북 작업 브랜치에서 코드 수정
2. Push   깃허브 서버의 작업 브랜치로 백업 업로드
3. PR     작업 브랜치 → dev 합쳐달라고 요청서 제출
4. Merge  확인 후 합치기 → Vercel Preview로 테스트
          (이상 없으면 dev → main PR → Merge → 실서비스 배포)
```

---

### [준비] 처음에 딱 1번만 하는 일 (Clone)

> 🗣️ *"깃허브에서 `Rebot-App-Owner-Dashboard` 레포지토리를 내 컴퓨터에 클론해줘."*

- 두 레포 각각 한 번씩 클론합니다.
- 클론 = 인터넷의 레포를 내 노트북으로 다운로드. 처음 한 번만 합니다.

---

### [1단계] 새 브랜치 만들기 (새 기능 시작할 때마다)

> 🗣️ *"`dev` 브랜치 기준으로 `feat/owner-login` 브랜치 만들고 전환해줘."*

- ⚠️ 반드시 **`dev` 기준으로** 만들어야 합니다.
- 브랜치를 파면 처음엔 내 노트북에만 생깁니다. Push 후 깃허브에 올라갑니다.

---

### [2단계] 작업하기 (Vibe Coding)

클로드 코드에게 기능 구현을 맡기고 자유롭게 작업합니다.

---

### [3단계] 커밋 & 깃허브에 백업 (Push)

> 🗣️ *"git status 확인하고, .env나 node_modules는 빼고, 사장님 로그인 1차 구현 내용으로 커밋 후 푸시해줘."*

- Push = 내 노트북의 코드를 깃허브 서버로 백업. 아직 `dev`와 섞이지 않습니다.

> 💡 **중간에도 자주 Push하세요.** 하루 작업이 끝나거나 의미 있는 단계마다 커밋+Push 해두면 실수로 파일을 날려도 복구할 수 있습니다.

---

### [4단계] PR 생성 (작업 브랜치 → dev)

> 🗣️ *"`feat/owner-login` 브랜치를 `dev`에 합쳐달라고 PR 만들어줘."*

- 혼자 작업하더라도 PR을 거치는 습관이 코드 이력 관리에 좋습니다.

---

### [5단계] Merge (dev에 합치기)

깃허브에서 PR 확인 후 **Merge pull request** 버튼 클릭.

- Vercel 설정이 연결되어 있으면 `dev` Preview URL에서 기능이 정상 동작하는지 확인합니다.
- 이상 없으면 `dev` → `main` PR 생성 → **Merge → 실서비스 자동 배포.**

> ⚠️ PR 생성만으로는 배포되지 않습니다. **main에 Merge될 때** Vercel 프로덕션 배포가 일어납니다.

---

### [6단계] 다음 작업 준비

> 🗣️ *"`dev` 브랜치로 전환하고 최신 상태로 Pull해줘."*

최신화된 `dev`를 기준으로 다음 작업 브랜치를 새로 팝니다.

---

## 🔄 8. 작업 중 dev가 바뀌었을 때

작업이 며칠 걸리면 그 사이 `dev`에 다른 변경사항이 생길 수 있습니다. 이때 무작정 Pull하면 코드가 꼬일 수 있습니다.

> 🗣️ *"현재 작업 상태를 git status로 확인하고, 필요하면 커밋 또는 stash로 백업한 뒤 dev의 최신 변경사항을 내 브랜치에 안전하게 반영해줘. 충돌이 나면 멈추고 설명해줘."*

---

## ⏰ 9. 타임머신 사용법 (에러 복구)

코드를 심하게 망쳤을 때 당황하지 말고 과거로 되돌립니다.

**1단계 — 세이브 기록 확인**
> 🗣️ *"최근 Git 커밋 로그 5개 보여줘."*

```
a952a71  feat: 사장님 로그인 1차 구현
0caf362  fix: 대시보드 버튼 UI 수정
```

**2단계 — 과거로 되돌리기 (Revert)**
> 🗣️ *"문제가 생긴 커밋을 찾아서 reset이나 force push 없이 revert 방식으로 안전하게 되돌려줘."*

- **revert**: 되돌리는 기록을 새로 남기는 방식. `dev`, `main` 같은 공유 브랜치에서는 항상 이 방식을 씁니다.
- **reset/force push**: 기록 자체를 삭제하는 방식. 공유 브랜치에서 쓰면 위험합니다.

> 🚨 **롤백 전 반드시 현재 상태를 커밋하세요!** 저장하지 않은 코드는 롤백 시 영영 사라집니다.

> 💡 **꿀팁**: *"지금 꼬인 상태도 '임시백업'으로 커밋해두고, 그 다음에 `0caf362` 시점으로 revert해줘."*

---

## 🛑 10. `main` 브랜치를 실수로 건드리면?

**절대 지켜야 할 원칙 딱 하나:**
> **`main`과 `dev`에는 직접 코드를 올리지 않는다. 무조건 작업 브랜치에서 PR로만 병합한다.**

| 실수 유형 | 결과 |
|-----------|------|
| `main`에서 직접 작업 후 Push | 미완성 코드가 실서비스에 바로 배포됨 |
| `feat/`에서 `main`으로 바로 PR 후 Merge | `dev` 테스트 없이 실서비스에 배포될 수 있음 |
| `feat/`를 `dev` 아닌 `main`에서 생성 | `dev`의 최신 코드 없는 과거 기준으로 작업하게 됨 |

클로드 코드에게 명령할 때 항상 **"`dev` 기준으로"**, **"`dev`에 PR해줘"** 라고 명시하는 습관을 들이세요.

---

## 🎬 11. 실전 시뮬레이션 — feat/supabase-rls 작업 예시

```
[시작 전]
🗣️ "dev 브랜치로 전환하고 최신 Pull해줘."
🗣️ "dev 기준으로 feat/supabase-rls 브랜치 만들어줘."

[작업 중]
🗣️ "Supabase RLS 설정해줘. 매장별 데이터 격리가 목표야."
→ 클로드 코드가 구현

[중간 백업]
🗣️ "git status 확인하고 .env는 빼고, RLS 기본 설정 완료로 커밋 후 푸시해줘."

[작업 완료]
🗣️ "feat/supabase-rls를 dev에 합쳐달라고 PR 만들어줘."
→ 깃허브에서 Merge
→ Vercel Preview에서 테스트 확인

[실서비스 배포]
🗣️ "dev를 main에 합쳐달라고 PR 만들어줘."
→ 깃허브에서 Merge → Vercel 프로덕션 자동 배포

[다음 작업 준비]
🗣️ "dev로 전환하고 최신 Pull해줘."
🗣️ "dev 기준으로 feat/owner-login 브랜치 만들어줘."
```

---

✨ **모든 작업은 터미널에서 클로드 코드와의 대화만으로 완료됩니다. 마음껏 실험하고 부딪혀보세요!**
