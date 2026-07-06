# Rebot Design System

리봇의 기본 브랜드 컬러는 `Warm Citrus`를 사용한다.

브랜드 태그라인:
`고객의 재방문을 만드는 자동화 AI`

디자인 방향:
- 카페/베이커리 사장님이 부담 없이 느끼는 따뜻함
- 발랄하지만 가볍지 않은 SaaS 제품 인상
- 메시지, 성과, 행동 유도 버튼이 또렷하게 보이는 UI

## 1. Brand Palette

기본 팔레트:
- Main: `#F59E0B`
- Secondary: `#F97316`
- Deep Accent: `#C2410C`
- Soft Background: `#FFF8F1`
- Surface: `#FFFFFF`
- Text Primary: `#2F2A26`
- Text Secondary: `#6B625C`

추천 역할:
- `#F59E0B`: 브랜드 대표색, 주요 CTA, 핵심 수치 강조
- `#F97316`: hover, 보조 CTA, 활성 상태
- `#C2410C`: pressed, 진한 포인트, 중요한 강조 텍스트
- `#FFF8F1`: 전체 페이지 기본 배경
- `#FFFFFF`: 카드, 모달, 입력창 배경
- `#2F2A26`: 제목, 본문 핵심 텍스트
- `#6B625C`: 보조 설명, 메타 정보

## 2. Semantic Colors

UI 토큰 기준:

```css
:root {
  --color-brand-500: #F59E0B;
  --color-brand-600: #F97316;
  --color-brand-700: #C2410C;

  --color-bg-page: #FFF8F1;
  --color-bg-surface: #FFFFFF;
  --color-bg-muted: #FEF1E6;

  --color-text-primary: #2F2A26;
  --color-text-secondary: #6B625C;
  --color-text-inverse: #FFFFFF;

  --color-border-default: #F3DFC9;
  --color-border-strong: #E8C9A6;

  --color-success: #2E8B57;
  --color-warning: #D97706;
  --color-danger: #D14343;
  --color-info: #3B82F6;
}
```

배경 계층:
- Page: `#FFF8F1`
- Section tint: `#FEF1E6`
- Card: `#FFFFFF`
- Hover surface: `#FFF4E8`

텍스트 계층:
- Headline: `#2F2A26`
- Body: `#2F2A26`
- Secondary: `#6B625C`
- Disabled: `#B3A59A`

## 3. CTA And Button Rules

Primary button:
- Background: `#F59E0B`
- Text: `#FFFFFF`
- Hover: `#F97316`
- Pressed: `#C2410C`
- Disabled: `#F6D7A2`

Secondary button:
- Background: `#FFFFFF`
- Text: `#C2410C`
- Border: `#F3DFC9`
- Hover background: `#FFF4E8`

Ghost button:
- Background: `transparent`
- Text: `#C2410C`
- Hover background: `#FEF1E6`

버튼 원칙:
- 가장 중요한 액션은 한 화면에 하나만 `Primary`
- 삭제/파괴 액션에는 브랜드 오렌지를 쓰지 않고 `danger` 사용
- 작은 액션은 고채도 fill 대신 `Secondary` 또는 `Ghost` 우선

## 4. Inputs And Forms

입력창:
- Background: `#FFFFFF`
- Border: `#E8C9A6`
- Text: `#2F2A26`
- Placeholder: `#B3A59A`
- Focus ring: `#F59E0B`

상태:
- Default: `1px solid #E8C9A6`
- Focus: `2px solid #F59E0B`
- Error: `1px solid #D14343`
- Success: `1px solid #2E8B57`

폼 원칙:
- 입력창은 넓고 단순하게 유지
- 사장님 대상 제품이므로 촘촘한 엔터프라이즈 UI보다 여백을 넉넉하게 사용

## 5. Cards And Dashboard

카드 스타일:
- Card background: `#FFFFFF`
- Border: `1px solid #F3DFC9`
- Radius: `16px`
- Shadow: `0 8px 24px rgba(95, 61, 24, 0.08)`

카드 내부 강조:
- KPI 숫자: `#2F2A26`
- KPI 상승값: `#2E8B57`
- KPI 주의값: `#D97706`
- 핵심 배지/태그: `#F59E0B` 또는 `#FEF1E6`

대시보드 원칙:
- 핵심 성과 카드는 흰 배경 중심
- 전체를 오렌지로 채우지 말고, 오렌지는 숫자와 행동 요소에만 집중

## 6. Chart Colors

차트 기본 세트:
- Primary: `#F59E0B`
- Secondary: `#F97316`
- Tertiary: `#FDBA74`
- Deep: `#C2410C`
- Neutral: `#D6C4B8`

보조 상태 색:
- Success: `#2E8B57`
- Warning: `#D97706`
- Danger: `#D14343`
- Info: `#3B82F6`

차트 권장 사용:
- 막대 차트 핵심 지표: `#F59E0B`
- 전월 비교/보조 데이터: `#FDBA74`
- 목표선/기준선: `#C2410C`
- 긍정 성과: `#2E8B57`
- 부정 성과: `#D14343`

차트 원칙:
- 한 차트에 오렌지 계열은 최대 2~3톤만 사용
- 비교군은 뉴트럴 또는 상태색으로 분리
- 격자선은 연하고 얇게 유지

## 7. Status And Badges

배지 색상:
- New: background `#FEF1E6`, text `#C2410C`
- Active: background `#FFF4E8`, text `#B45309`
- Success: background `#E8F5EC`, text `#2E8B57`
- Warning: background `#FFF3E0`, text `#D97706`
- Danger: background `#FDECEC`, text `#D14343`
- Info: background `#EAF2FF`, text `#3B82F6`

## 8. Icons And Illustration

아이콘 스타일:
- 둥근 모서리의 단순한 라인 또는 듀오톤 아이콘
- 지나치게 기술적이거나 차가운 사이버 스타일은 지양

이미지 스타일:
- 카페 운영, 고객 재방문, 메시지 자동화가 연상되는 따뜻한 장면
- 실제 업장 사진을 쓸 경우 밝은 자연광, 우드톤, 크림톤 위주
- 일러스트를 쓸 경우 코랄/오렌지/크림 베이스로 단순하게 구성

## 9. Usage Rules

컬러 비율 권장:
- 70% Neutral background and surface
- 20% text and structural colors
- 10% brand orange accents

실무 원칙:
- 오렌지는 집중을 유도하는 곳에만 사용
- 본문 영역까지 오렌지 비중이 커지면 저가형 커머스처럼 보일 수 있음
- 발표자료와 서비스 페이지 모두 같은 의미 체계를 유지
  - CTA: `#F59E0B`
  - 강조: `#F97316`
  - 강한 포인트: `#C2410C`

## 10. Recommended Pairings

추천 조합:
- Hero section: `#FFF8F1` background + `#2F2A26` headline + `#F59E0B` CTA
- Dashboard: `#FFF8F1` page + `#FFFFFF` cards + orange only for KPI highlights
- Presentation slides: white or soft cream background with orange used for headlines, icons, and key metrics

피해야 할 조합:
- 순도 높은 검정 `#000000` 대량 사용
- 채도 높은 오렌지 단색 배경 남용
- 오렌지와 빨강의 과도한 혼합
- 차가운 블루를 메인보다 더 강하게 쓰는 구성
