# Handoff: Forward Earth — Data & Calculations Workspace ("ForBuild" prototype)

## Overview
This is a high-fidelity, interactive prototype of the **Forward Earth** carbon-accounting
web app, focused on the **Data** workspace: a table of activity-data entries and their
GHG **calculations**, plus a rich **entry detail side panel (drawer)** for reviewing,
editing, and confirming entries. It also includes supporting surfaces (Overview/Home,
Trends, Calculation Quality, Hotspot analysis, Forward AI, Manual entry, Reports).

The drawer is the surface most recently refined and the primary subject of this handoff;
it is documented in depth below.

The entry point is **`index.html`**.

## About the Design Files
The files in this bundle are **design references authored in HTML/CSS + in-browser React
(via Babel standalone)**. They are prototypes that demonstrate the intended look, layout,
and interaction — **not** production code to ship as-is. The task is to **recreate these
designs in the target codebase's environment** using its established patterns and
libraries. The real Forward Earth app is a **React 18 + TypeScript SPA**, so the natural
target is React + TS with the app's existing design-system components; if you are starting
fresh, pick the framework that best fits the project and reproduce the designs there.

Notably, in the prototype:
- Components live in `src-v2/*.jsx` and are loaded as separate `<script type="text/babel">`
  tags. They communicate through globals on `window` (e.g. `window.CALCS`, `window.ENTRIES`,
  `window.fmtKgSmart`, `window.BUSINESS_UNITS`). In a real codebase these become proper
  modules/props/state — do not replicate the `window`-global pattern.
- Styling is plain CSS with a `--fe-*` design-token layer (see **Design Tokens**). Recreate
  with the codebase's styling system (CSS modules, styled-components, Tailwind, etc.), but
  keep the token values.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, and interactions are final and
intended to be reproduced precisely. Charts in the prototype are cosmetic SVG/CSS
recreations — wire them to the real charting library in the target app.

---

## Screens / Views

The app shell is a fixed left **sidebar** (280px) + a top **app bar** + a scrolling content
area on a tinted canvas. Routing is hash-based (`#data`, `#overview`, `#trends`, …) in the
prototype; map to the app's router.

### 1. Data page (`#data`) — primary surface
- **Purpose:** browse all activity-data entries and their calculations; filter, run saved
  views, open an entry to review/edit.
- **Layout:** full-width data table on the tinted canvas; a toolbar above it (tabs for
  "All data" + saved views, filters, add-data). Clicking a row opens the **Entry Detail
  Drawer** over a backdrop on the right.
- **Files:** `src-v2/DataPage.jsx`, `AllData.jsx`, `DataEntries.jsx`, `Calculations.jsx`,
  `DataToolbar.jsx`, `DataViews.jsx`, `FilterBuilder.jsx`, `DataGridModel.jsx`.

### 2. Entry Detail Drawer — the refined surface (in `src-v2/DataEntries.jsx`, `EntryDrawer`)
A right-side slide-over (`width: var(--fe-drawer-w, 48vw)`, `min-width 560px`, `max-width
820px`) over a 50%-ish dark backdrop. **The drawer background is the tinted canvas
(`--fe-bg-panel`)** so the header and each section read as **white cards floating on it**.

**Structure, top to bottom:**

1. **Header card** — a white rounded card (`margin: 16px 20px 0; padding: 20px 22px;
   border: 1px solid var(--fe-border-subtle); border-radius: 12px`). Contains, left→right:
   - A flex column (flex:1):
     - **Kicker:** `Activity · <id>` — 11px, uppercase, letter-spacing 0.4px,
       `--fe-fg-muted`, weight 500.
     - **Title (`h2`):** `<Category> — <Site>` (e.g. "Electricity — Berlin HQ") — **22px,
       weight 600, letter-spacing -0.2px, `--fe-fg-strong`**.
     - **Chip row** (margin-top 10px, gap 8px): the **StatusChip** (Draft / Ready /
       Confirmed / etc.) and, only if there are calcs needing review, an alert chip
       "`N calcs need review`". The date chip and source/import pill were intentionally
       **removed** from the title — keep the title minimal (id + title + status).
   - **Close button** (`.btn-close`, 32×32, radius 8px, ghost; hover fills `--fe-bg-subtle`),
     top-right.

2. **Body** (`.drawer-body`) — `padding: 14px 20px 32px; background: --fe-bg-panel;
   display:flex; flex-direction:column; gap:14px`. Every direct child section is a white
   card: `background:#fff; border:1px solid var(--fe-border-subtle); border-radius:12px`.
   Non-fold sections pad `18px 20px`; fold sections pad `4px 14px`.

   Sections, in order (some conditional on entry state):
   - **Total (calculated entries only):** a `.big-number` — value in tCO₂e (32px, weight
     500, tabular-nums) + caption "tCO₂e total from N calculations", plus a muted summary
     line. **Draft/Ready entries show no banner here** — status lives only in the header.
   - **Calculation(s)** (collapsible): if the entry has 1 calc it renders inline; if >1 it
     renders an **expandable calc list** (see below). If 0 calcs, a muted `.nocalc-note`
     ("No calculations yet. …").
   - **Classification** (collapsible, open): grid of fields — Business unit (select),
     Business activity (+ category sub-label), Site (edit only), Reporting period (date
     range), Owner (select). **Status is NOT here** — it moved to the header.
   - **Activity data** (collapsible, open): category-specific fields (see CategoryFields).
   - **Source & audit** (collapsible, closed by default): ID, Source import (link), Bulk
     import file, Files, Custom emission factor, Created on, Last updated, and **Notes**
     (full-width field — Notes was merged into this section).
   - **Additional info from bulk import** (collapsible, closed) — only if `entry.extra_meta`.

3. **Footer** (`.drawer-foot`) — actions are **right-aligned** (a leading flex spacer
   pushes them right): state-specific CTAs (`EntryActions`) then two nav-arrow buttons
   (prev/next entry). The keyboard-shortcut hint text was **removed**; J/K/Esc still work.

#### Collapsible section (`FoldSection`)
`<details>`-based. The **chevron sits on the RIGHT** of the header (title left, optional
sub-label next to it, chevron pushed right via `margin-left:auto`). Chevron rotates 180°
when open. Header hover tints `--fe-bg-subtle`. Section title: 11px uppercase, muted, weight
500, letter-spacing 0.5px — **neutral, never colored**.

#### Expandable calculation cards (multi-calc) — `.entry-calc`
Each card: `border:1px solid var(--fe-border-subtle); border-radius:10px; background:#fff`;
`.open` gets `border-color:--fe-border-strong` + a 1px shadow. The clickable header
(`.entry-calc-head`, flex, `align-items:flex-start`, gap 12px, padding 14px 16px):
- **Chevron** (left, `margin-top:4px`, rotates when open).
- **Main column** (`.entry-calc-main`, flex column, gap 7px):
  - **Meta row** (`.entry-calc-meta`, flex, gap 8px): **ScopeBadge + StatusChip together on
    one row**, with the **kg value pushed right** (`margin-left:auto`; 13px, weight 500,
    tabular-nums, e.g. "7,486 kg" with a muted 11px "kg").
  - **Titles:** `.label` = activity (14px, **weight 600**, letter-spacing -0.1px,
    `--fe-fg-strong`); `.sub` = "`<gas> · <factor name> · <factor source>`" (11px, muted,
    truncates with ellipsis).
- Expanded body (`.entry-calc-body`, bg `--fe-bg-subtle`): the calc **formula** row
  (activity × factor = kgCO₂e), an EF-match section, a change log, and calc actions
  (Approve / Swap factor / Reject).

#### Editing model (draft / edit mode)
- Draft entries open in **edit mode** automatically. Other states have an "Edit" CTA.
- **All Activity-data category fields are editable** in edit mode — selects and text inputs,
  not just the required ones. Numeric fields (kWh, liters, spend, pax, distance, etc.) are
  parsed back to Numbers on save; values fold back into `entry.details`.
- **Required (missing) fields** render **inline at their natural position** (not hoisted to
  a top card). They are marked with a **small red dot** (`6px`, `--fe-error-500`) beside the
  label — **no yellow/amber warning fill** anymore. Saving a draft with all required fields
  filled flips it to `ready`.

### 3. Other views (lower priority for this handoff)
- **Overview / Home** (`Overview.jsx`), **Trends** (`Trends.jsx`), **Calculation Quality**
  (`CalculationQuality.jsx`), **Hotspot analysis** (`HotspotAnalysis.jsx`), **Forward AI**
  (`ForwardAI.jsx`, `AICopilot.jsx`, `AIThreads.jsx`), **Manual entry** (`ManualEntry.jsx`),
  **Reports / report boards** (`Reports.jsx`). The app shell (sidebar + app bar, brand
  switcher) is in `Shell.jsx`.

---

## Form controls — combobox style
Editable selects/inputs follow a combobox aesthetic:
- `border-radius: var(--fe-radius-md, 8px)`, `padding: 8px 11px`, `font-size:13px`,
  `font-weight:500`, 1px `--fe-border-default` border on white.
- **Selects** use `appearance:none` with an inline SVG **chevron** (right 10px center,
  16px, stroke `#5F5F78`), `padding-right:32px`.
- **Hover:** border → `--fe-border-strong`. **Focus:** border → `--fe-primary-500` +
  `box-shadow: 0 0 0 3px rgba(90,77,255,0.12)`. No warning colors on empty fields.
- Fields with a trailing unit use `.d-edit-unit` (flex; muted unit label after the input).

## Interactions & Behavior
- **Open drawer:** click a table row → drawer slides in (`slideIn` 220ms cubic-bezier).
  Backdrop fades (`fadeIn` 160ms). Click backdrop or close button (or Esc) to dismiss.
- **Navigate entries:** J / K (or footer arrows) move to prev/next entry in the current list.
- **Collapse/expand** sections and calc cards via their headers (native `<details>`).
- **Save / Discard (draft):** Save persists; if all required filled, status → "ready" and a
  toast confirms. Discard reverts the form.
- **Confirm / Reject / Swap factor** on a calculation update its status (+ toast).
- **Brand switch:** `⌥⇧T` cycles 10 white-label brands (accent + neutrals + font swap live)
  via `ds/themes/themes.js`. Default theme = Forward Earth indigo.
- Standard transition: **150ms ease** on color/background/border. No springy motion.

## State Management
Prototype keeps state in the top-level `App` (in `index.html`) and `EntryDrawer`:
- `route` (hash-synced), `dataTab`, filters/presets, `selEntryId` / `selCalcId`.
- `calcs` (`window.CALCS`) and `entries` (`window.ENTRIES`) are the data spine; an entry
  owns ≥0 calcs (`calc.entryId`).
- Entry lifecycle: **draft → ready → (processing) → calculated**, plus **failed**. Derived
  from child-calc statuses + field completeness (see `data.jsx`).
- Drawer edit form mirrors entry fields incl. a `details` object; `commit()` builds a patch
  (parsing numeric detail keys) and updates the entry; draft→ready when `missing_fields`
  clears.
In the target app, model these as proper state/store + typed entities and API calls.

## Design Tokens
Defined in `colors_and_type.css` → bridges to `ds/colors_and_type.css` + `ds/themes/themes.css`.
Use the semantic `--fe-*` roles; they re-resolve per brand theme.

**Color (default Forward Earth theme):**
- Primary/accent indigo: `--fe-primary-500` ≈ `#5A4DFF` (focus ring `rgba(90,77,255,0.12)`).
- Secondary violet surface: `--fe-secondary-50` `#FAF8FF`.
- Canvas (tinted): `--fe-bg-panel` (≈ tintedGrey-100 `#F2F3FB`). Surface/white: `--fe-bg-surface`.
- Subtle bg / hover: `--fe-bg-subtle`.
- Text: `--fe-fg-strong`, `--fe-fg-default`, `--fe-fg-muted`, `--fe-fg-subtle`.
- Borders: `--fe-border-subtle`, `--fe-border-default` (grey-200), `--fe-border-strong` (grey-300).
- Status: success `--fe-success-*` (chip uses ~`#DCFCE7` bg / green text), error
  `--fe-error-500` `#F35151` (the required red dot), plus alert/warning scales.

**Radius:** `--fe-radius-xs 4px`, `sm 6px`, `md 8px`, `lg 12px`, `xl 16px`, `full 9999px`.
Cards 12px (drawer) / 10px (calc cards), buttons 6px, inputs 8px.

**Spacing:** 4px base scale (4, 8, 12, 16, 20, 24, 32, 40, 48…). Card padding 18–20px; grid
gaps 14–20px.

**Type:** **Satoshi Variable** for everything (headings 600/700, body/labels weight **500**
is the default), **Source Code Pro** for mono. Base body 14px; dense data UI. `tCO₂e` renders
with a subscript 2.

**Shadows:** system is mostly flat. Drawer uses `-24px 0 48px -16px rgba(11,16,49,0.18)`;
dropdown/popover `0 4px 16px rgba(0,0,0,0.10)`. Avoid heavy shadows.

## Assets
- **Icons:** the prototype's own icon set is in `src-v2/Icon.jsx` (used via `<Icon name=…>`).
  The full Forward Earth icon set (Heroicons-outline style, 24×24, 1.5px stroke,
  `currentColor`) is also in `ds/assets/icons.js`. Use the target app's icon system; match
  names/style.
- **Logos:** `ds/assets/logo.svg`, `ds/assets/named-logo.svg`.
- **Fonts:** **NOT bundled here** (100+ font files). Satoshi Variable + Source Code Pro are
  the brand fonts (self-hosted in the FE design system / `ds/fonts/` in the source project);
  partner-theme fonts (Roboto, Inter, DM Sans, Poppins, Saans, Aeonik Pro, Parastoo) load per
  brand. Wire fonts via the target app's font pipeline.
- **Partner theme logos/splashes** (white-label) are referenced by `ds/themes/themes.js` but
  not bundled — add if you implement brand switching.

## Files
- `index.html` — entry point: loads React/Babel, all `src-v2/*` scripts, CSS, and the
  top-level `App` (routing, state, tweaks, brand theme, drawer wiring).
- `app-v2.css` — app shell + base styles; `@import`s `colors_and_type.css`.
- `extras-v2.css` — the bulk of component CSS, **including all drawer / section-card /
  calc-card / form-field styles** referenced above.
- `colors_and_type.css` — `--fe-*` token bridge; imports the two `ds/` token files.
- `src-v2/` — all React components (Babel JSX) + `AICopilot.css`, `Analyse.css`,
  `Imports2.css`. Key files for this handoff: **`DataEntries.jsx`** (drawer, sections, calc
  cards, CategoryFields, EntryActions), `DataPage.jsx`, `Calculations.jsx`, `data.jsx`
  (data model + lifecycle), `bits.jsx` (StatusChip, ScopeBadge, chips), `Icon.jsx`.
- `ds/colors_and_type.css`, `ds/themes/themes.css`, `ds/themes/themes.js` — design-system
  tokens + white-label theming. `ds/assets/` — icons + logos.

### Running the reference
Open `index.html` in a browser (it uses CDN React/Babel). Fonts will fall back since the
font binaries aren't bundled; everything else renders. Navigate to **Data** and click a row
to open the drawer (the documented surface).
