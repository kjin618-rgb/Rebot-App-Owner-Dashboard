---
version: alpha
name: Rebot CRM Dashboard Design System
description: Rebot CRM Dashboard is a cafe & bakery owner dashboard UI system. The visual direction uses a full-color navy sidebar and a bright dashboard canvas with strong orange/yellow metric blocks. The system is intentionally restricted to Navy, Orange, Yellow, White, and Neutral Gray to keep the product focused, consistent, and easy to implement.
---

# Rebot CRM Dashboard Design System

## Overview

Rebot CRM Dashboard is a B2B SaaS-style owner dashboard for small shops such as cafes and bakeries.

The UI direction is:
- left-side full-color navigation
- right-side clean dashboard canvas
- large colored KPI cards
- compact performance cards
- orange-only data visualization
- yellow-only icon system
- navy-first typography

This document replaces the original Mistral AI marketing-site design references. Do not apply Mistral-specific elements such as mountain photography, sunset stripe bands, editorial hero layouts, or cream-heavy marketing sections.

## Design Principles

### 1. Dashboard-first, not marketing-page-first

This UI is an operational dashboard, not a landing page. Prioritize readability, hierarchy, compact metrics, and fast scanning.

### 2. Restricted color system

Use only:
- Navy
- Orange
- Yellow
- White
- Neutral Gray

Do not introduce green, blue, purple, or red for semantic states.

### 3. Strong left rail, clean right canvas

The left sidebar should visually anchor the product with a full navy background. The right dashboard area should stay bright, readable, and metric-focused.

### 4. Icons and charts must be consistent

All icons use Yellow.  
All charts, sparklines, trend lines, points, and bars use Orange.

---

## Tokens

```yaml
colors:
  navy: "#1C2F3A"
  orange: "#FF8A00"
  yellow: "#FFC400"

  white: "#FFFFFF"
  canvas: "#FFFFFF"
  surface: "#F8FAFC"
  surface-soft: "#FAFBFC"

  border: "#E5E7EB"
  border-soft: "#EEF0F3"
  border-strong: "#CBD5E1"

  muted: "#8A94A3"
  muted-soft: "#A8B0BA"

  on-navy: "#FFFFFF"
  on-orange: "#FFFFFF"
  on-yellow: "#1C2F3A"

  text-primary: "{colors.navy}"
  text-secondary: "{colors.navy}"
  text-muted: "{colors.muted}"

  icon: "{colors.yellow}"
  chart: "{colors.orange}"
  link: "{colors.orange}"

typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.8px

  heading-1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.5px

  heading-2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3

  heading-3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.35

  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55

  body-md-medium:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.55

  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5

  body-sm-medium:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.5

  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4

  caption-bold:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1.4

  micro:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4

  number-xl:
    fontFamily: Inter
    fontSize: 44px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -1px

  number-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.8px

  number-md:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.5px

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 20px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  section: 48px
  page: 64px

shadow:
  card: "0 4px 16px rgba(28, 47, 58, 0.06)"
  card-strong: "0 10px 28px rgba(28, 47, 58, 0.10)"
  sidebar-card: "0 8px 24px rgba(0, 0, 0, 0.18)"
```

---

## Colors

### Core Palette

| Token | Hex | Usage |
|---|---:|---|
| `{colors.navy}` | `#1C2F3A` | sidebar background, right dashboard text, risk card |
| `{colors.orange}` | `#FF8A00` | active menu, primary metric card, CTA, QR card, all charts |
| `{colors.yellow}` | `#FFC400` | all icons, secondary metric card, icon tiles |
| `{colors.white}` | `#FFFFFF` | cards, dashboard canvas, text on dark/strong backgrounds |
| Neutral Gray | varies | borders, dividers, muted labels only |

### Color Rules

- Right dashboard text must use `{colors.navy}` as the default text color.
- All icons must use `{colors.yellow}`.
- All graphs, sparklines, trend lines, points, bars, and chart highlights must use `{colors.orange}`.
- Do not use Green, Blue, Purple, or Red.
- Do not use color to distinguish success, warning, danger, or info states.
- State changes should be expressed with text, labels, icons, or arrow direction.
- Allowed colors are Navy, Orange, Yellow, White, and Neutral Gray only.

### Semantic State Handling

Do not create semantic color tokens like `success`, `danger`, `info`, or `warning`.

Use this instead:

```yaml
status:
  iconColor: "{colors.yellow}"
  textColor: "{colors.navy}"
  backgroundColor: "{colors.white}"
  accentColor: "{colors.orange}"
```

Examples:
- 상승: Orange arrow + text
- 하락: Orange or Navy arrow + text
- 주의: Yellow icon + Navy text
- 완료: Yellow icon + Navy text
- 활성: Orange background or Orange outline

---

## Typography

Use Inter or a system sans-serif fallback for all UI.

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Typography Rules

- Right dashboard headings, labels, body text, and numbers use Navy.
- Do not use black as the default dashboard text color.
- Large KPI numbers should be bold and highly legible.
- Keep Korean text compact and scan-friendly.
- Do not use editorial serif display fonts.

### Recommended Usage

| Area | Token |
|---|---|
| Page title | `{typography.heading-1}` |
| Section title | `{typography.heading-3}` |
| KPI number | `{typography.number-xl}` or `{typography.number-lg}` |
| Card title | `{typography.body-md-medium}` |
| Card description | `{typography.body-sm}` |
| Badge / label | `{typography.caption-bold}` |
| Sidebar nav | `{typography.body-md-medium}` |

---

## Layout

### App Shell

- The app uses a fixed left sidebar and a flexible right dashboard area.
- Sidebar width: 280–320px on desktop.
- Sidebar height: 100vh.
- Sidebar background: `{colors.navy}`.
- Main dashboard background: `{colors.canvas}`.
- Main dashboard text: `{colors.navy}`.
- Main content padding: 32–40px on desktop.

```yaml
layout:
  app-shell:
    display: "grid"
    gridTemplateColumns: "300px 1fr"
    minHeight: "100vh"
    backgroundColor: "{colors.canvas}"

  sidebar:
    width: "300px"
    minHeight: "100vh"
    backgroundColor: "{colors.navy}"
    padding: "{spacing.xl}"

  main:
    backgroundColor: "{colors.canvas}"
    color: "{colors.navy}"
    padding: "{spacing.xxl}"
```

### Dashboard Structure

Desktop dashboard order:

1. Top header
2. Page title and description
3. Top KPI metric cards, 3 columns
4. Performance metrics, 5 cards
5. Bottom area, 2 columns
   - real-time activity feed
   - QR promotion card

### Density Rules

- The top KPI cards should feel large and full.
- Use colored 100% backgrounds for the top KPI cards.
- Use white cards for performance cards.
- Use Orange 100% background for QR promotion card.
- Avoid excessive empty whitespace between cards.

---

## Components

```yaml
components:
  app-shell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"

  top-header:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    height: "72px"
    borderBottom: "1px solid {colors.border-soft}"
    padding: "0 {spacing.xxl}"

  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.on-orange}"
    iconColor: "{colors.yellow}"
    typography: "{typography.body-sm-medium}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    border: "1px solid {colors.orange}"

  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    iconColor: "{colors.yellow}"
    typography: "{typography.body-sm-medium}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    border: "1px solid {colors.border}"

  sidebar:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    width: "300px"
    padding: "{spacing.xl}"
    border: "none"

  sidebar-logo-tile:
    backgroundColor: "{colors.orange}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.lg}"
    size: "56px"

  sidebar-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.on-navy}"
    iconColor: "{colors.yellow}"
    typography: "{typography.body-md-medium}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"

  sidebar-nav-item-active:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.on-orange}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.lg}"

  sidebar-badge:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.on-orange}"
    rounded: "{rounded.full}"
    typography: "{typography.caption-bold}"
    padding: "4px 8px"

  sidebar-instance-card:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "{colors.on-navy}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: "1px solid rgba(255, 255, 255, 0.16)"
    shadow: "{shadow.sidebar-card}"

  dashboard-main:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    padding: "{spacing.xxl}"

  metric-card-orange:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.on-orange}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
    shadow: "{shadow.card-strong}"

  metric-card-yellow:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.on-yellow}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
    shadow: "{shadow.card-strong}"

  metric-card-navy:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
    shadow: "{shadow.card-strong}"

  metric-icon-tile:
    backgroundColor: "{colors.white}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
    shadow: "{shadow.card}"

  performance-section:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
    border: "1px solid {colors.border-soft}"
    shadow: "{shadow.card}"

  performance-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    iconColor: "{colors.yellow}"
    chartColor: "{colors.orange}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: "1px solid {colors.border-soft}"

  performance-icon-tile:
    backgroundColor: "{colors.white}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
    border: "1px solid {colors.border-soft}"

  trend-badge:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.orange}"
    iconColor: "{colors.orange}"
    rounded: "{rounded.full}"
    typography: "{typography.caption-bold}"
    padding: "4px 10px"

  activity-feed-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
    border: "1px solid {colors.border-soft}"
    shadow: "{shadow.card}"

  activity-row:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    iconColor: "{colors.yellow}"
    padding: "{spacing.md} 0"
    borderBottom: "1px solid {colors.border-soft}"

  qr-promo-card:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.on-orange}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
    shadow: "{shadow.card-strong}"

  qr-code-box:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    shadow: "{shadow.card}"

  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
    border: "1px solid {colors.border}"

  input-focused:
    backgroundColor: "{colors.white}"
    textColor: "{colors.navy}"
    border: "2px solid {colors.orange}"

  badge:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.navy}"
    iconColor: "{colors.yellow}"
    rounded: "{rounded.full}"
    typography: "{typography.caption-bold}"
    padding: "4px 10px"
```

---

## Dashboard Card Rules

### Top KPI Cards

Use exactly these color roles:

| Card | Background | Text | Icon |
|---|---|---|---|
| 전체 등록 고객 | Orange | White | Yellow |
| 마케팅 동의 고객 | Yellow | Navy | Yellow |
| 관심 및 이탈 위험군 | Navy | White | Yellow |

Rules:
- Cards should occupy the full row width.
- Use 3 columns on desktop.
- Use large numbers.
- Icon tile may use a white surface, but the icon itself remains Yellow.
- Do not use green, blue, purple, or red for card states.

### Performance Cards

Rules:
- Background: White.
- Text: Navy.
- Icon: Yellow.
- Chart: Orange.
- Border: Neutral Gray.
- Each card can include one small sparkline.
- Sparkline color must not vary by metric.

### QR Promotion Card

Rules:
- Background: Orange 100%.
- Text: White.
- Icon: Yellow.
- QR code area: White card.
- CTA button can be Orange outline on White or White outline on Orange.
- Do not add blue, green, purple, or red accents inside this card.

---

## Data Visualization

### Chart Rules

```yaml
charts:
  lineColor: "{colors.orange}"
  barColor: "{colors.orange}"
  pointColor: "{colors.orange}"
  areaFillColor: "rgba(255, 138, 0, 0.10)"
  axisColor: "{colors.border}"
  gridColor: "{colors.border-soft}"
  labelColor: "{colors.navy}"
```

- All lines, bars, points, and sparklines use Orange.
- Chart labels use Navy.
- Chart grid and axis use Neutral Gray.
- Do not assign unique colors per metric.
- Do not use color to indicate positive or negative direction.
- Up/down changes can use arrow direction and text only.

---

## Iconography

### Icon Rules

```yaml
icons:
  defaultColor: "{colors.yellow}"
  activeColor: "{colors.yellow}"
  disabledColor: "{colors.muted}"
  strokeWidth: 2
  size:
    sm: "16px"
    md: "20px"
    lg: "24px"
```

- All icons use Yellow.
- Sidebar icons use Yellow.
- Card icons use Yellow.
- Performance metric icons use Yellow.
- Activity feed icons use Yellow.
- Do not use category-based icon colors.
- Do not use green success icons, blue info icons, purple AI icons, or red warning icons.

---

## Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 | no shadow, thin border | table rows, dividers |
| 1 | `0 4px 16px rgba(28, 47, 58, 0.06)` | default cards |
| 2 | `0 10px 28px rgba(28, 47, 58, 0.10)` | colored KPI cards, QR card |
| 3 | `0 16px 40px rgba(28, 47, 58, 0.14)` | modals only |

Rules:
- Avoid heavy shadows.
- Prefer thin borders on white cards.
- Use stronger shadows only on colored emphasis cards.

---

## Shapes

### Radius

| Token | Value | Use |
|---|---:|---|
| `{rounded.md}` | 8px | buttons, inputs |
| `{rounded.lg}` | 12px | small cards, icon tiles |
| `{rounded.xl}` | 16px | dashboard sections, KPI cards |
| `{rounded.xxl}` | 20px | large promo panels |
| `{rounded.full}` | 9999px | badges only |

Cards should feel modern and structured, not overly playful.

---

## Responsive Behavior

### Desktop, 1280px and above

- Sidebar fixed at 300px.
- Main content uses full remaining width.
- Top KPI cards: 3 columns.
- Performance cards: 5 columns.
- Bottom area: 2 columns.

### Tablet, 768–1279px

- Sidebar can remain fixed or collapse depending on implementation.
- Top KPI cards: 2 columns, with the third card spanning if needed.
- Performance cards: 2–3 columns.
- Bottom area: 1 column.

### Mobile, below 768px

- Sidebar collapses into top navigation or drawer.
- KPI cards stack 1 column.
- Performance cards stack 1 column or 2 compact columns.
- Activity feed and QR card stack vertically.
- Maintain the same color rules.

---

## Accessibility

- Ensure text contrast is sufficient on Navy, Orange, and Yellow backgrounds.
- Use Navy text on Yellow backgrounds.
- Use White text on Navy and Orange backgrounds.
- Do not rely on color alone to communicate state.
- Interactive elements should have at least 40px effective height.
- Focus states should use Orange border or outline.

---

## Do's and Don'ts

### Do

- Use Navy as the default text color in the right dashboard.
- Use Navy as the full sidebar background.
- Use Orange for active navigation, primary emphasis, QR card, CTA, and all charts.
- Use Yellow for every icon.
- Use large colored KPI cards to make the screen feel visually full.
- Use White cards with thin neutral borders for detailed metric sections.
- Use arrows, labels, or text to explain status changes.

### Don't

- Do not use Green, Blue, Purple, or Red.
- Do not use multiple chart colors.
- Do not use different icon colors by category.
- Do not use black as the default right dashboard text.
- Do not use Mistral-specific mountain photography.
- Do not use sunset stripe footer bands.
- Do not use editorial serif hero typography.
- Do not make the dashboard look like a marketing landing page.

---

## Implementation Notes for AI Coding Agents

When applying this design system to code:

1. Search for hardcoded color classes or hex values.
2. Replace green, blue, purple, red, and black UI colors with the approved tokens.
3. Centralize tokens in the project theme file, Tailwind config, CSS variables, or design token file.
4. Refactor charts so all line/bar/point colors reference `{colors.orange}`.
5. Refactor icons so all icon components reference `{colors.yellow}`.
6. Refactor right dashboard text so it references `{colors.navy}`.
7. Refactor sidebar to use `{colors.navy}` background and `{colors.orange}` active menu state.
8. Verify there are no remaining unauthorized accent colors in dashboard components.

### CSS Variable Reference

```css
:root {
  --rebot-navy: #1C2F3A;
  --rebot-orange: #FF8A00;
  --rebot-yellow: #FFC400;

  --rebot-white: #FFFFFF;
  --rebot-canvas: #FFFFFF;
  --rebot-surface: #F8FAFC;
  --rebot-surface-soft: #FAFBFC;

  --rebot-border: #E5E7EB;
  --rebot-border-soft: #EEF0F3;
  --rebot-border-strong: #CBD5E1;

  --rebot-muted: #8A94A3;

  --rebot-text-primary: var(--rebot-navy);
  --rebot-icon: var(--rebot-yellow);
  --rebot-chart: var(--rebot-orange);
}
```

### Tailwind Token Reference

```js
theme: {
  extend: {
    colors: {
      rebot: {
        navy: "#1C2F3A",
        orange: "#FF8A00",
        yellow: "#FFC400",
        white: "#FFFFFF",
        surface: "#F8FAFC",
        border: "#E5E7EB",
        muted: "#8A94A3",
      },
    },
  },
}
```

---

## Acceptance Criteria

The implementation is acceptable only when:

- The sidebar background is Navy.
- The active sidebar menu background is Orange.
- Sidebar icons are Yellow.
- Right dashboard text is Navy.
- Top KPI cards use Orange, Yellow, and Navy 100% backgrounds.
- All dashboard icons are Yellow.
- All graph lines, bars, points, and sparklines are Orange.
- No Green, Blue, Purple, or Red accent colors remain.
- The QR promotion card uses Orange as its primary background.
- The dashboard no longer contains Mistral marketing-site visual elements.
