# TokaiSim — UI/UX Review
**Reviewer:** Sally (UX Expert)  
**Date:** 2026-04-03  
**Scope:** Full site audit — desktop & mobile — against Style Guide v3.1 and UX best practice  
**Priority tiers:** 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low / Polish

---

## Summary

The site has a strong editorial identity and the simulator UI is genuinely distinctive. The corridor card system, botanical palette, and holographic card treatment are well-executed on desktop. However, the site has **no mobile-responsive layout** for its editorial sections, several accessibility gaps, systemic use of hardcoded colour values instead of design tokens, and a number of inconsistencies in iconography, typography sizing, and spacing scale. The issues below are grouped by zone, then by cross-cutting theme.

---

## 1. Access Barrier (Intro Modal)

### 🔴 Disclaimer column unreadable on mobile
The `barrier-grid` uses a 12-column CSS grid (`span 7` narrative / `span 5` disclaimer) with no mobile breakpoint override. On 390px viewports the disclaimer card is squeezed to ~120px wide, forcing every word onto its own line. The text becomes completely unreadable.

**Fix:** Add to the `@media (max-width: 768px)` block:
```css
.barrier-grid { grid-template-columns: 1fr; }
.barrier-narrative, .barrier-disclaimer { grid-column: span 1; }
```

### 🟠 Title wraps awkwardly on mobile
"Traff✱k - Tokai High Traffic Simulator" at `font-size: 1.75rem` wraps to three lines at 390px. The title pill (`barrier-title-box`) was designed for a single line.

**Fix:** Use `clamp(1.25rem, 4vw, 1.75rem)` on `.barrier-title-box h2`, or shorten the display title to "Traff✱k" with a subtitle below.

### 🟡 Disclaimer text: all-italic is fatiguing
The entire `disclaimer-text` block is italic (`font-style: italic`). Italic body text at 0.875rem over more than 2–3 lines fatigues the eye. Italic should be reserved for specific emphasis, not a whole block.

**Fix:** Set `font-style: normal` on `.disclaimer-text`. Use italic only on `strong` phrases within it.

### 🟡 Hardcoded colours not using design tokens
`.barrier-narrative` uses `color: #374151` and `.disclaimer-text` uses `color: #4b5563`. These are Tailwind Gray values and are not design tokens. 

**Fix:** Replace with `var(--on-surface)` and `var(--muted-text)` respectively.

### 🟡 Mysterious coral/salmon page border
A persistent salmon/coral outline is visible around the full viewport edge in all screen states. This is not in the Style Guide and breaks from the botanical mineral palette.

**Fix:** Audit `body`, `.app`, `.access-barrier`, and `#root` for any `border`, `outline`, or `box-shadow` that produces this effect and remove it.

### 🔵 Accessibility: No focus trap, no ARIA dialog role
The access barrier is a modal gate but has no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, and no keyboard focus trap. Keyboard users can tab behind the barrier into the (hidden) simulator.

**Fix:** Add `role="dialog" aria-modal="true" aria-labelledby="barrier-title"` to `.barrier-card`. Implement a focus trap (keep Tab cycling within modal children only). Move initial focus to the modal on mount.

### 🔵 Init button has no loading/disabled state
Clicking "Initialize Simulator →" transitions immediately. There is no disabled state, loading indicator, or transition animation on the button to signal to the user that something is happening.

**Fix:** Add a brief opacity/scale transition (`opacity 0.7s ease`) on the barrier itself as it fades, and disable the button on click.

---

## 2. Header & Navigation (Top Bar)

### 🔴 No sticky header on scroll
The entire top bar (logo + nav + stats pill) scrolls away when the user navigates to the editorial sections (Briefing, Models, Findings). Once past the simulator, there is no navigation visible. Users cannot easily return to the simulator or navigate between sections.

**Fix:** Make `.scrolling-top-bar` `position: sticky; top: 0; z-index: 500; background: rgba(241,245,241,0.92); backdrop-filter: blur(16px)`. Apply only to simulator view OR create a minimal persistent header for the editorial scroll.

### 🔴 Stats pill and nav collide on mobile
At widths below ~500px, the active nav pill expands its label ("Simulator", "Home" etc.) while the stats pill is simultaneously trying to render TIME + TOTAL IN/OUT + AVG TIME IN/OUT on the same row. These two elements overlap, with the stats pill TIME value rendering directly over the nav label text.

**Root cause:** The media query at `max-width: 1024px` hides `.scrolling-stats-row` but the rendered class is `.scrolling-stats-pill` — **this selector does not match**, so the stats pill is never hidden on any breakpoint.

**Fix:** Change the media query hide rule from `.scrolling-stats-row` to `.scrolling-stats-pill`. On mobile, show only the TIME value in a compact chip, or collapse the stats pill to a single line.

### 🟠 Large dead space between logo/nav and stats pill (desktop)
The 12-column grid allocates `span 8` for the nav container and `span 4` for the stats pill. The expanding nav pill itself is small (~320px wide), leaving roughly 800px of empty `span-8` area. This horizontal imbalance makes the header feel sparse and unanchored.

**Fix:** Place the logo and nav pill flush left and use the remaining space to hold the stats pill centred, or reduce the nav container span and give the stats pill more breathing room. Consider a 3-column layout: `logo | [nav] | stats`.

### 🟠 Logo is visually disconnected from the nav
On initial page load the logo "Traff✱k" appears as small unstyled text above the nav pill, not visually integrated with it. The logo style (`header-brand-nav`, `app-logo`) is not defined in App.css — these class names don't match the rendered structure.

**Fix:** Confirm the `.header-brand-nav` and `.app-logo` CSS is present and matched. Place the logo inline-flex with the nav pill at the same vertical baseline. Consider giving the logo the same glassmorphic pill treatment as the nav for visual cohesion.

### 🟡 Nav active state is purely client-side
Active state is driven by `useState('home')` and set on click only. If the user scrolls to a section, the active pill doesn't update. The "Home" pill stays active even when the user is reading the Findings section.

**Fix:** Implement an IntersectionObserver to track which section is in viewport and update `active` state accordingly. This is standard SPA section-nav practice.

### 🟡 Stats pill label casing inconsistency
The stats pill labels use: "Time" / "Total In/Out" / "Avg Time In/Out" — mixed Title Case. Other label elements throughout the site use ALL CAPS uppercase. Pick one and apply it consistently.

**Fix:** Use `text-transform: uppercase; letter-spacing: 0.1em` on `.htc-label` to match the Label-SM spec in the Style Guide.

---

## 3. Simulation Controls Bar (Bottom of Map)

### 🔴 ROAD LOG button clipped on mobile
The `sim-controls` bar overflows horizontally on mobile viewports. The "ROAD LOG" button is pushed off-screen to the right. The bar has no wrapping or overflow handling below 1024px.

**Fix:** On mobile, move LOG and ROAD LOG to a secondary row below the main controls, or hide them behind a `⋯` overflow menu. The primary action (play/pause) should always be accessible.

### 🟠 L/M/H scenario selector has no visible label
The three scenario buttons "L", "M", "H" have no tooltip, label, or legend explaining they represent Low/Medium/High traffic scenarios. New users will not understand what they do.

**Fix:** Add a small `title` attribute for tooltip on each button. Better: add a `font-size: 7px; uppercase; letter-spacing` label "SCENARIO" above the L/M/H group, matching the Label-SM type style.

### 🟠 UXSim source button renders as a single character "ᵾ"
In the sim controls bar, the UXSim source option appears to render as a single unicode combining character rather than "UXSim". This is likely a character encoding issue or a unicode letter being used as an icon.

**Fix:** Audit the `onSourceChange` rendering in SimMap.jsx. Ensure "UXSim" is rendered as the visible text label for that source pill, not a unicode glyph.

### 🟠 Touch targets too small throughout the controls bar
Speed pills (`0.3rem 0.65rem` padding, `10px` font), scenario buttons, and source pills all fall below the WCAG 2.5.5 minimum of 44×44px touch target size. On mobile these are nearly impossible to tap accurately.

**Fix:** On `@media (max-width: 1024px)`, increase pill padding to at minimum `0.6rem 1rem`. Consider making the entire pill bar taller on touch devices.

### 🟡 Drag handle uses braille unicode (⠿)
The drag handle for the controls bar and legend uses the braille character `⠿` instead of a Lucide icon. This is inconsistent with the Lucide icon set used in the nav and creates platform-dependent rendering.

**Fix:** Replace `⠿` with a Lucide `GripVertical` or `GripHorizontal` icon (`<GripVertical size={14} />`) to match the nav's icon system.

### 🔵 No visible sim-end state
When the simulation completes (all vehicles exit), the controls bar shows no "Simulation ended" or completion state. The play button presumably stays in its current state.

**Fix:** Add a subtle "Simulation complete" toast or indicator text near the controls when `onAutoStop` fires. Use muted-text colour to avoid alarm.

---

## 4. Map Area

### 🟠 Leaflet zoom controls are unstyled
The `+` / `−` zoom buttons in the top-left of the map are Leaflet defaults. They use browser-default borders, white backgrounds, and system font — completely inconsistent with the design system.

**Fix:** Override with:
```css
.leaflet-control-zoom a {
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(12px);
  border: none !important;
  color: var(--on-surface);
  font-family: 'Manrope', sans-serif;
  font-weight: 700;
  border-radius: 6px;
  width: 32px;
  height: 32px;
}
```
Or replace with custom zoom buttons using the same glassmorphic treatment as the legend card.

### 🟠 Map legend uses native HTML checkbox
The "Show Routes" toggle uses a native `<input type="checkbox">`. This renders with platform-default styling (macOS blue checkbox, Android green toggle, etc.) and is visually jarring against the custom design.

**Fix:** Replace with a custom-styled toggle using the same pill/active pattern as other toggles in the system:
```jsx
<button className={`source-pill ${showRoutes ? 'active' : ''}`} onClick={onToggle}>
  Show Routes
</button>
```

### 🟡 Legend shape vocabulary not implemented
The Style Guide (§5B) specifies distinct vehicle shapes: ● solid circle (inbound main), ◆ diamond (inbound rat-run), ○ hollow circle (egress main), ◇ hollow diamond (egress rat-run), ■ square (parked). The legend only shows solid coloured dots for all entries. Users cannot distinguish vehicle types from the legend.

**Fix:** Update legend entries to use the corresponding shapes matching what's actually rendered on the map canvas. If shape differentiation isn't fully implemented on the map, the legend should still match what IS drawn.

### 🟡 Eye/visibility icon uses emoji (👁 / ✕)
The corridor card visibility toggle uses the `👁` emoji for "visible" and `✕` (multiplication sign) for "hidden". These are inconsistent with each other and with the Lucide icon set used in the nav.

**Fix:** Import and use Lucide `Eye` and `EyeOff` icons:
```jsx
import { Eye, EyeOff } from 'lucide-react';
// ...
{isSelected ? <Eye size={12} /> : <EyeOff size={12} />}
```

### 🔵 `100vh` unreliable on iOS Safari
`.main-layout` uses `height: 100vh`. On iOS Safari, `100vh` includes the browser chrome (address bar) which causes the bottom of the map to be hidden behind the browser UI on first load.

**Fix:** Use `height: 100dvh` (dynamic viewport height) with a `100vh` fallback:
```css
.main-layout {
  height: 100vh;
  height: 100dvh;
}
```

---

## 5. Sidebar — Stats Panel

### 🟠 Corridor card ordering does not reflect route priority
Cards are ordered 3A → 2A → 2B → 1A (top-left to bottom-right). The Style Guide designates 1A (Main Rd) as the "Primary artery anchor" — but it appears last (bottom-right). Users naturally read top-left first; the most important corridor should be most prominent.

**Fix:** Reorder `INITIAL_STATS` in App.jsx to `1A, 2A, 2B, 3A` or `1A, 3A, 2A, 2B`. Alternatively, use a visual priority treatment (larger card, different weighting) for 1A.

### 🟠 Typography at 7px violates Style Guide minimum
Multiple text elements are below the Style Guide's minimum type size (Label-SM: 0.65rem ≈ 10.4px):
- `holo-breakdown`: `font-size: 7px`
- Stat block labels (in `StatBlock` component): `font-size: 7px` inline
- `holo-label`: `font-size: 8px`
- `holo-id`: `font-size: 9px`
- `wmy-focus-hint`: `font-size: 7px`

At 7–8px, these fail WCAG 1.4.3 contrast requirements even at high contrast ratios, and are unreadable for users with any visual impairment.

**Fix:** Set a minimum of `0.65rem` (10.4px) for all text. For labels that need to be "small", use `font-size: 0.65rem` as the floor. The `holo-breakdown` breakdown row should be at minimum `0.65rem`.

### 🟠 Close button and watch hint use raw characters instead of icons
- The Watch My Road close button uses `×` (multiplication character) 
- The expand/collapse should use Lucide `X` for consistency

**Fix:**
```jsx
import { X } from 'lucide-react';
// In close button:
<button className="rw-close" onClick={onCloseRoad}><X size={14} /></button>
```

### 🟡 Stats panel has no visual scroll indicator on mobile
`.stats-panel-container` hides the scrollbar (`scrollbar-width: none`). On mobile, the panel could have off-screen corridor cards with no indication to the user.

**Fix:** On mobile, add a subtle bottom gradient fade (`::after` with a transparent-to-surface gradient) to signal there is more content below. Re-enable a thin scrollbar track (`scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.15) transparent`) on desktop.

### 🟡 Congestion bar "hot" fill colour inconsistency
The `CongBar` component uses `#A64D4D` for `isHot` in the JSX, but the Style Guide and `CORR_BG` define the hot/stopped accent as `#8B1A1A` (dark crimson). The breakdown span also correctly uses `#8B1A1A`. This means the congestion bar fill colour and the breakdown text colour are different shades of crimson.

**Fix:** Standardise on `#8B1A1A` in `CongBar` for the hot fill colour, matching the breakdown text and Style Guide spec.

### 🟡 `holo-breakdown` default CSS colour is wrong for light cards
`.holo-breakdown { color: rgba(241,245,241,0.38) }` — this is a near-white colour designed for the old dark cards. The StatsPanel correctly overrides this via inline `style={{ color: cols.mutedDark }}`, but the CSS default should reflect the light card system.

**Fix:** Update the CSS default to `color: var(--muted-text)` and let the per-card inline colour be the exception where needed.

### 🔵 Deselected card collapse animation not implemented
The CHANGELOG (2026-04-02) describes "Auto-Collapsing Cards: Deselected corridor cards automatically collapse to a minimal state (48px)". The current implementation only fades to `opacity: 0.25` without any height collapse. The style spec isn't realised.

**Fix:** Add to `.stat-card.deselected`:
```css
max-height: 48px;
overflow: hidden;
transition: max-height 0.4s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease;
```
And restore to `max-height: 400px` when selected.

---

## 6. Bento Briefing Section

### 🔴 No mobile responsive layout
The briefing grid uses `narrative-block: grid-column: span 9` and `tech-hub-block: grid-column: span 3`. There are **no mobile overrides** for these in the single `@media (max-width: 1024px)` block. On mobile, the 9-column narrative is squeezed to ~75% of a 390px screen and the 3-column tech-hub sidebar is ~25% (~97px) wide. The popover triggers ("TIA Assumptions", "Model Parameters") truncate to their first letter.

**Fix:**
```css
@media (max-width: 768px) {
  .bento-content { grid-template-columns: 1fr; gap: 2rem; }
  .narrative-block, .tech-hub-block { grid-column: span 1; }
  .tech-hub-block { order: -1; } /* Show technical context above narrative on mobile */
}
```

### 🔴 Hover popovers are inaccessible on touch devices
The "TIA Assumptions" and "Model Parameters" cards use CSS `:hover` to show popover content. Touch screens cannot hover. Mobile users have no way to access this information.

**Fix:** Convert hover triggers to click/tap toggles using React state. Add a `▾`/`▴` indicator to show the expandable nature. Or move the popover content to an always-visible accordion below each trigger on mobile.

### 🟠 Background is `#fff` instead of `--canvas`
`.bento-briefing { background: #fff }` — the Style Guide specifies `--canvas: #F1F5F1` as the main site background. White creates a visible colour jump between the simulator area and the briefing section.

**Fix:** Change to `background: var(--canvas)` or `background: #F1F5F1`.

### 🟠 `border-top` violates the No-Line Rule
`.bento-briefing { border-top: 1px solid rgba(0,0,0,0.05) }` — the Style Guide §3 explicitly states "Borders are forbidden. Boundaries are defined by tonal shifts and negative space."

**Fix:** Remove the `border-top`. Use a tonal background shift (e.g., the briefing section starts at `--surface-low`) to delineate the section transition.

### 🟠 Hardcoded non-token text colours throughout
The editorial sections use Tailwind Gray values instead of design tokens:
- `#374151` → should be `var(--on-surface)` 
- `#4b5563` → should be `var(--muted-text)`
- `#415D43` → should be `var(--c-3a)` or a new dark-accent token

**Fix:** Audit and replace all `#374151`, `#4b5563`, `#415D43` hardcoded values across App.css and StatsPanel.jsx with the appropriate CSS variables.

### 🟡 8rem section padding is excessive on mobile
`.bento-briefing { padding: 8rem 1.5rem }` — 128px top and bottom padding renders as enormous whitespace on mobile. This forces unnecessary scrolling.

**Fix:**
```css
.bento-briefing { padding: clamp(3rem, 8vw, 8rem) 1.5rem; }
```

### 🟡 `narrative-text-large` uses hardcoded font size
`.narrative-text-large { font-size: 1.875rem }` — this is between Style Guide tokens (Headline-MD: 1.25rem; Display-LG: 3.5rem). It's not using a token and doesn't reflow on smaller screens.

**Fix:** Use `font-size: clamp(1.25rem, 3vw, 1.875rem)` for fluid scaling.

---

## 7. Models Section

### 🔴 No mobile responsive layout
`models-header: grid-column: span 4` and `models-content: grid-column: span 8` have no mobile overrides. On 390px the `.models-title { font-size: 3.75rem }` heading renders at 60px — far too large for a narrow column while the content occupies only ~65% of the screen width.

**Fix:**
```css
@media (max-width: 768px) {
  .models-grid { grid-template-columns: 1fr; }
  .models-header, .models-content { grid-column: span 1; }
  .models-title { font-size: clamp(2rem, 8vw, 3.75rem); }
  .pedigree-grid { grid-template-columns: 1fr; gap: 2rem; }
}
```

### 🟠 12rem section padding creates excessive dead space
`.models-section { padding: 12rem 1.5rem }` — 192px top/bottom. Combined with `.models-content { gap: 6rem }` between entries, users scroll through multiple screenheights of near-empty canvas. The visual breathing room is welcome at desktop scale but needs compression at mobile.

**Fix:** `padding: clamp(4rem, 10vw, 12rem) 1.5rem` and `gap: clamp(2rem, 5vw, 6rem)`.

### 🟡 Calibration box `border-radius: 3rem` is inconsistent with system
The `.calibration-box` uses `border-radius: 3rem` (48px). The Style Guide specifies `4px` (standard components) and `8px` (map/hero). The large-radius pill treatment is used for nav elements — not content boxes. The editorial sections use `1.5rem`–`2rem` radii which are themselves inconsistent with the system.

**Fix:** Align all editorial card/box border-radii to a consistent editorial token. Suggest `1.5rem` for large editorial cards and `0.75rem` for smaller ones. Add these to `:root` as `--radius-card-lg` and `--radius-card-sm`.

### 🟡 `.models-section` lacks a `max-width` on its own element
The section uses `padding: 12rem 1.5rem` on `.models-section` but the inner `.models-grid` has `max-width: 1700px`. The padding applies outside the max-width constraint — this means on very wide screens the vertical padding is relative to the section, not the content column.

**Fix:** Move `max-width: 1700px; margin: 0 auto` to `.models-section` itself, and apply padding inside the grid.

---

## 8. Findings Section

### 🔴 No mobile responsive layout
`findings-header: grid-column: span 4` and `findings-content: grid-column: span 8`. The sticky header becomes a layout problem on mobile — a sticky left column takes space off every viewport scroll position. On 390px, the finding cards are ~65% width.

**Fix:**
```css
@media (max-width: 768px) {
  .findings-grid { grid-template-columns: 1fr; }
  .findings-header { grid-column: span 1; position: static; }
  .findings-content { grid-column: span 1; }
}
```

### 🟠 Finding card icons use mixed emoji/unicode
Icons in finding cards: ⚠ (unicode), ⏱ (emoji), ✓ (unicode), 🔀 (emoji), ℹ (unicode). This mix creates inconsistent rendering across platforms. On Android, emoji render with colour and shadows; on iOS they render differently; in some browsers unicode symbols render as coloured emoji or as plain text glyphs.

**Fix:** Replace all five with Lucide icons:
- ⚠ → `<AlertTriangle />`
- ⏱ → `<Clock />`
- ✓ → `<CheckCircle />`
- 🔀 → `<Shuffle />`
- ℹ → `<Info />`

Apply a consistent colour: `color: rgba(241,245,241,0.6)` to match the section palette.

### 🟡 "network-level validation" link invisible on dark background
In the last finding card, the text "its role here is *network-level validation*" uses `<em>` which the CSS sets to `color: var(--c-3a)` on the dark background. The `--c-3a` value is `#709775` which against `rgba(241,245,241,0.05)` card background on `#111D13` section background gives approximately 3.1:1 contrast — below the 4.5:1 WCAG AA minimum for normal text.

**Fix:** Use `var(--c-2a)` (`#A1CCA5`) for `<em>` links on dark sections. This is brighter and achieves 5.1:1 contrast against the dark section background.

### 🔵 Findings section `editorial-link` colour on dark
Any `a.editorial-link` within the Findings section inherits `color: var(--c-3a)` + underline. On the dark `#111D13` background, `#709775` has low contrast. This applies to the "WCMD" link visible in the models section if it appears against dark backgrounds.

**Fix:** Add a dark-section variant: `.findings-section .editorial-link { color: var(--c-2a); }`.

---

## 9. Footer

### 🟠 No mobile responsive layout
`.footer-content { display: flex; justify-content: space-between }` — on mobile, the brand block and credits block sit side-by-side at very small sizes. Footer text becomes cramped.

**Fix:**
```css
@media (max-width: 768px) {
  .footer-content { flex-direction: column; align-items: flex-start; gap: 2rem; }
  .footer-credits { text-align: left; }
}
```

### 🟡 Footer slogan uses `font-style: italic`
`.footer-slogan { font-style: italic }` — italic is not in the Style Guide's typography system. On the dark background at 1.25rem, italic text is harder to read than roman.

**Fix:** Remove `font-style: italic`. Use `font-weight: 300` (light) for a more refined, non-italic contrast with the bold logo above it.

### 🟡 Orphaned `Space Grotesk` font reference
`.mobile-menu-link-num { font-family: 'Space Grotesk', sans-serif }` — Space Grotesk is not in the project's font imports (only Manrope and Work Sans). It will silently fall back to a system font, creating unpredictable rendering.

**Fix:** Replace with `font-family: 'Manrope', sans-serif` to stay within the type system.

### 🔵 Excessive top padding
`.site-footer { padding: 8rem 2.5rem 5rem }` — 128px before any footer content. This creates a large scroll void at the bottom of the page.

**Fix:** `padding: clamp(3rem, 6vw, 8rem) 2.5rem clamp(2rem, 4vw, 5rem)`.

---

## 10. Global / Cross-Cutting Issues

### 🔴 Only one responsive breakpoint (1024px)
The entire site has a single media query at `@media (max-width: 1024px)` which handles only the simulator layout. The editorial sections (Briefing, Models, Findings, Footer) have **no responsive handling at any breakpoint**. This means the site is essentially broken on all mobile devices for 60%+ of its content.

**Fix:** Add the following breakpoints:
```css
/* Tablet */
@media (max-width: 1024px) { /* existing simulator fixes */ }

/* Mobile landscape / small tablet */
@media (max-width: 768px) { 
  /* All editorial section grid collapses */
  /* Padding compression */
  /* Typography scale-down */
}

/* Mobile portrait */
@media (max-width: 480px) {
  /* Further padding compression */
  /* Barrier modal stacking */
  /* Controls bar single-column */
}
```

### 🔴 Hardcoded non-token colours throughout
A systemic pattern: the codebase mixes CSS variables (correct) with hardcoded Tailwind-origin hex values. Every instance below should become a token or use an existing one:

| Hardcoded Value | Appears In | Correct Token |
|:---|:---|:---|
| `#374151` | barrier-narrative, narrative-text-large | `var(--on-surface)` |
| `#4b5563` | disclaimer-text, model-entry p, popover-list | `var(--muted-text)` |
| `#415D43` | popover-card h4, pedigree-item h4 | `var(--c-3a)` or new `--accent-dark` |
| `#fff` | bento-briefing background, popover-card | `var(--canvas)` |
| `rgba(241,245,241,*)` | Dark section text variants | Add `--canvas-alpha` tokens |
| `#A64D4D` | CongBar hot fill | `#8B1A1A` (match Style Guide §1C) |

### 🟠 Missing `@media (hover: none)` for holographic tilt effect
The corridor card 3D tilt/shimmer effect (`handleMouseMove`) is activated on all pointer events. On touch devices, no hover/shimmer occurs — cards appear flat. More importantly, `mousemove` handlers on mobile trigger on touchmove, which can cause jank during scrolling.

**Fix:** Disable the 3D tilt effect on touch devices:
```css
@media (hover: none) {
  .holo-card { will-change: auto; }
}
```
And conditionally attach the handlers only when `window.matchMedia('(hover: hover)').matches`.

### 🟠 Missing `:focus-visible` styles on interactive elements
Nav pills, buttons, close buttons, and source toggles have no visible keyboard focus indicator. This is a WCAG 2.4.7 failure.

**Fix:** Add globally:
```css
:focus-visible {
  outline: 2px solid var(--c-3a);
  outline-offset: 3px;
  border-radius: 4px;
}
```
This uses the brand sage colour for a consistent, on-brand focus ring.

### 🟠 Colour-only congestion information
The congestion bar communicates severity through colour only (green accent → crimson red). Users with red-green colour blindness (~8% of males) cannot distinguish mild vs severe congestion.

**Fix:** Add a secondary indicator to the congestion bar:
- At >70% congestion, increase bar height from 4px to 6px
- Add a subtle pattern (repeating diagonal lines via CSS) at the hot threshold
- The "STOPPED" badge text already provides a textual alternative — ensure it's always visible at the critical threshold, not just for colourblind users

### 🟡 `will-change: transform` on all corridor cards simultaneously
Four corridor cards all have `will-change: transform` (plus the Watch My Road card). This creates 5 compositing layers simultaneously, putting pressure on GPU memory — especially on mobile.

**Fix:** Apply `will-change: transform` only on hover/focus, and remove it on mouseleave:
```javascript
el.style.willChange = 'transform'; // on mouseenter
el.style.willChange = 'auto';       // on mouseleave (after transition)
```

### 🟡 `fmtTime` function duplicated in App.jsx and StatsPanel.jsx
Minor code smell — the function is copy-pasted in two files. If the time format ever needs to change, it must be updated in two places.

**Fix:** Extract to `src/engine/utils.js` or `src/lib/format.js` and import in both files.

### 🟡 No `<html lang>` attribute
The HTML document likely has no `lang="en"` attribute, which is required for screen readers to interpret text correctly.

**Fix:** Add `lang="en"` to the root `<html>` element in `index.html`.

### 🟡 No `<meta name="description">` or Open Graph tags
When shared on social media or indexed by search engines, the page will show no description or preview image.

**Fix:** Add to `index.html`:
```html
<meta name="description" content="Visualise what 800 extra cars do to Bergvliet's streets during morning school drop-off at Tokai High." />
<meta property="og:title" content="Traff✱k — Tokai High Traffic Simulator" />
<meta property="og:description" content="..." />
<meta property="og:type" content="website" />
```

### 🟡 No `prefers-reduced-motion` media query
The site has multiple animations: the holographic shimmer, speed pill transitions, card opacity fades, menu slide-ins. Users who have "reduce motion" enabled in their OS receive no accommodation.

**Fix:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 🔵 No skip-to-content link
Keyboard-only users must tab through the entire nav before reaching the main simulator content.

**Fix:** Add as the first element in `<body>`:
```html
<a href="#simulator" class="skip-link">Skip to simulator</a>
```
With CSS:
```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 1rem;
  background: var(--on-surface);
  color: var(--canvas);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: top 0.2s;
}
.skip-link:focus { top: 1rem; }
```

---

## 11. Typography Consistency Audit

| Element | Current | Style Guide Spec | Action |
|:---|:---|:---|:---|
| Stat block labels | 7px, Work Sans, 900 | Label-SM: 0.65rem | Increase to 0.65rem |
| `holo-breakdown` | 7px, 800 | Label-SM: 0.65rem | Increase to 0.65rem |
| `holo-label` | 8px, 800 | Label-SM: 0.65rem | Increase to 0.65rem |
| `wmy-focus-hint` | 7px, 800, uppercase | Label-SM: 0.65rem | Increase to 0.65rem |
| `htc-label` | 8px, Work Sans 900 | Label-SM: 0.65rem, 0.1em tracking | Increase; use token |
| `narrative-text-large` | 1.875rem, Manrope 700 | Headline-MD: 1.25rem or Display | Clarify role; use token |
| `models-title` | 3.75rem | Display-LG: 3.5rem | Align to 3.5rem token |
| `footer-brand h2` | 2.25rem | Headline-MD: 1.25rem? | Clarify; use token or raise |
| `nav-pill-label` | 0.9rem, Manrope 800 | Headline-MD: 1.25rem, 700 | Close; acceptable |
| `scrolling-stats pill value` | 1rem, Manrope 700 | Metric-XL: 1.5rem, 300 | Consider raising to 1.25rem |

**Recommendation:** Define all used type styles as CSS custom property sets in `:root` (e.g., `--type-display`, `--type-headline`, `--type-label`) and apply via a mixin or utility class pattern to enforce the hierarchy.

---

## 12. Spacing & White Space

| Issue | Current | Recommendation |
|:---|:---|:---|
| Models section vertical padding | `12rem` (~192px) | `clamp(4rem, 10vw, 12rem)` |
| Briefing section vertical padding | `8rem` (~128px) | `clamp(3rem, 8vw, 8rem)` |
| Models content gap | `6rem` (~96px) | `clamp(2rem, 5vw, 6rem)` |
| Footer top padding | `8rem` (~128px) | `clamp(3rem, 6vw, 8rem)` |
| Corridor grid gap | `0.5rem` | `0.75rem` — slightly more breathing room |
| Stat block internal gap | `1px` (hardcoded in JSX) | `0.25rem` — use rem unit |

The large padding values create a premium editorial feel on desktop but become a significant usability problem on mobile (excessive scrolling, content too spread out). The `clamp()` approach preserves the spacious desktop feel while compressing proportionally for smaller screens.

---

## 13. Iconography System — Full Audit

The site currently uses three different icon systems simultaneously:

| Used For | System | Elements |
|:---|:---|:---|
| Navigation | Lucide React | Home, Bot, Map, Monitor, MessageCircleMore |
| Card visibility | Emoji | 👁 |
| Card dismiss | Unicode char | ✕ |
| Controls drag | Braille unicode | ⠿ |
| Finding icons | Mixed emoji/unicode | ⚠ ⏱ ✓ 🔀 ℹ |

**Recommendation:** Standardise on Lucide React for all UI icons. The library is already installed. Replace every emoji and unicode glyph with the appropriate Lucide equivalent. Emojis render with platform-dependent colour, size, and style — they should never be used as functional UI elements.

---

## 14. Editorial Section Flow & Rhythm

### Problem statement

The three editorial sections (Briefing, Models, Findings) feel disconnected from each other and internally inconsistent. The root causes are:

1. **Whitespace as separator** — each section relies on large top/bottom padding (`3rem–5rem` in several places) and empty `<div>` gaps to visually separate itself from its neighbours. Whitespace alone creates a sense of *fragmentation*, not *rhythm*.
2. **Inconsistent bento block proportions** — bento cards mix `span 4`, `span 6`, `span 8`, and `span 12` column widths with no shared vertical rhythm, so the grids feel ad hoc rather than designed.
3. **Tone-shifting surface colours** — Briefing uses a different shade of `--surface-low` than Models; Findings introduces inline `rgba(...)` hardcoded tints; the result is three sections that could be from three different sites.
4. **No connective tissue** — there is nothing to visually *join* sections between the large gap breaks. The eye loses context between scrolling through Briefing → Models → Findings.

The 4 reference layout examples (layout1–4) all solve this the same way: **alternating full-width section backgrounds + consistent vertical padding + uniform card grids**. The colour system and visual identity are irrelevant from these references; the structural principle transfers directly.

---

### 14.1 — Introduce alternating section backgrounds

**Current:** All three sections pull from `var(--canvas)` or a barely-distinguishable `var(--surface-low)`. The difference is too subtle to register as intentional section separation.

**Recommendation:** Assign a deliberate, alternating background pattern:

| Section | Background token | Effect |
|:---|:---|:---|
| Briefing | `var(--canvas)` | Light anchor — matches the simulator surface above |
| Models | `var(--surface-low)` | Subtle step down — signals new context |
| Findings | `var(--surface-high)` | Slightly deeper — creates closure before footer |

Apply the background to the **full-width section wrapper** (e.g., `.bento-briefing`, `.models-section`, `.findings-section`), not to the inner container. This creates clean edge-to-edge bands, matching the structural approach all four reference layouts use. The visitor's eye reads the background-colour shift as a section transition — no gap required.

**CSS change:**
```css
.bento-briefing   { background: var(--canvas); }
.models-section   { background: var(--surface-low); }
.findings-section { background: var(--surface-high); }
```

---

### 14.2 — Replace variable padding with a shared `--section-vpad` token

**Current:** Section padding varies (`padding: 5rem 2rem`, `padding-top: 4rem`, `padding: 3rem`, etc.). No two sections use the same value. The inconsistency compounds as the user scrolls.

**Recommendation:** Define a single responsive padding token and apply it everywhere:

```css
:root {
  --section-vpad: clamp(3.5rem, 7vw, 6rem);
}

.bento-briefing,
.models-section,
.findings-section {
  padding-block: var(--section-vpad);
}
```

The `clamp()` ensures sections breathe on large screens but compress naturally on tablet and mobile without feeling cramped. Reference layouts 1, 2, and 4 all demonstrate that tight, consistent vertical rhythm reads as *confident*, not sparse.

---

### 14.3 — Normalise bento grid proportions

**Current:** Bento blocks span inconsistent column widths with no shared vertical unit. Some cards are 3× taller than neighbours within the same row. A grid that doesn't share a common row height looks unfinished.

**Recommendation:** Adopt one of two patterns — pick consistently across all sections:

**Pattern A — Equal-weight 3-column grid** (matches layout3/layout4 reference)
```css
.bento-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--grid-gap, 1rem);
}
.bento-grid-3 > * {
  /* No manual column-span overrides — let equal columns do the work */
}
```
Use for: Models cards, Findings findings cards.

**Pattern B — 2-wide + 1-narrow asymmetric pair** (matches layout1/layout2 reference)
```css
.bento-row-asymmetric {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--grid-gap, 1rem);
}
```
Use for: Briefing hero + aside pairings, stat callout + prose blocks.

The key rule: **do not mix both patterns within a single section**. Pick one per section and stick to it. This is the single biggest structural improvement visible across all four reference layouts.

---

### 14.4 — Standardise card internal padding

**Current:** Cards within the bento grid have padding values ranging from `0.75rem` to `2.5rem`. The inconsistency means cards do not share a visual baseline, making grids look misaligned even when the outer grid math is correct.

**Recommendation:** Define a card padding token and use it everywhere:
```css
:root {
  --card-pad: clamp(1.25rem, 2.5vw, 1.75rem);
}
.bento-card,
.finding-item,
.model-card {
  padding: var(--card-pad);
}
```
Reference layouts 3 and 4 both use tight (~1.5rem), equal internal card padding across all cards in their grids. The uniform inset is what makes mixed-content cards (text-only, text+icon, text+image) read as part of the same system.

---

### 14.5 — Add a thin section-transition accent strip

**Current:** There is nothing that visually marks the *join* between sections. The transition is a colour shift (if 14.1 is implemented) or simply a gap (if not). On a long scroll this can feel abrupt.

**Recommendation:** Add a 4px full-width accent strip between sections using a corridor token colour. This is a single CSS addition — no new component:

```css
.models-section,
.findings-section {
  border-top: 4px solid var(--c-1a); /* use the first corridor's accent as a global accent */
}
```

Use sparingly — one colour, consistent thickness. This matches the dark-band section dividers used in layout2 and layout4 as a structural anchor, and gives the vertical scroll a metered feel that matches the "road" metaphor.

---

### 14.6 — Unify `border-radius` across all editorial cards

**Current:** Cards in Briefing, Models, and Findings use different `border-radius` values (`0.75rem`, `1rem`, `1.25rem`, none). This subtle inconsistency registers subconsciously as the sections being from different design systems.

**Recommendation:** Define one token and apply it universally:
```css
:root {
  --card-radius: 0.875rem;
}
.bento-card,
.finding-item,
.model-card {
  border-radius: var(--card-radius);
}
```

---

### 14.7 — Mobile: single-column stack with section fills intact

On mobile, all editorial grids should collapse to a single column. The section background fills (14.1) must be preserved — they provide the only visual section separation once the multi-column layout is gone.

```css
@media (max-width: 768px) {
  .bento-grid-3,
  .bento-row-asymmetric {
    grid-template-columns: 1fr;
  }

  /* Restore edge-to-edge section fills on mobile */
  .bento-briefing,
  .models-section,
  .findings-section {
    padding-inline: 1.25rem;
  }
}
```

---

### Summary — Editorial Cohesion Quick Wins

| # | Change | Effort | Impact |
|:---|:---|:---|:---|
| 14.1 | Alternating section backgrounds (token-based) | 10 min | 🔴 Highest — eliminates disconnected feel immediately |
| 14.2 | Shared `--section-vpad` token via `clamp()` | 15 min | 🟠 High — removes the "too much whitespace" complaint |
| 14.3 | Normalise bento grid to 1 pattern per section | 30 min | 🟠 High — eliminates inconsistent card proportions |
| 14.4 | Standardise card padding via `--card-pad` token | 10 min | 🟡 Medium — reinforces grid alignment |
| 14.5 | Thin section-transition accent strip | 5 min | 🟡 Medium — adds rhythm and road-metaphor anchor |
| 14.6 | Unified `--card-radius` token | 5 min | 🟡 Medium — removes "three different design systems" feel |
| 14.7 | Mobile single-column stack + fill preservation | 20 min | 🟠 High — essential with the new fills in place |

Implementing **14.1 + 14.2 + 14.3** in sequence will resolve the core disconnection complaint. The remaining items compound the improvement.

---

## Quick Reference — Priority Order for Developer

### Implement first (Critical / site-breaking)
1. Add `@media (max-width: 768px)` breakpoints for all editorial sections
2. Fix the mobile barrier disclaimer column stacking
3. Fix the stats pill mobile selector mismatch (`.scrolling-stats-row` → `.scrolling-stats-pill`)
4. Make the header sticky
5. Fix ROAD LOG clipping on mobile controls bar

### Implement second (High / significant UX impact)
6. Increase minimum type size to 0.65rem across all sub-threshold elements
7. Add `:focus-visible` focus rings globally
8. Replace all emoji/unicode icons with Lucide equivalents
9. Convert hover popovers to click/tap handlers
10. Fix `bento-briefing` background to `var(--canvas)` and remove `border-top`
11. Replace all hardcoded `#374151` / `#4b5563` values with tokens
12. Fix native checkbox → custom toggle in map legend

### Implement second-and-a-half (Editorial cohesion — §14)
13. Add alternating section background tokens (§14.1)
14. Replace section padding with `--section-vpad` `clamp()` token (§14.2)
15. Normalise bento grids to one consistent pattern per section (§14.3)
16. Add mobile single-column collapse + fill preservation (§14.7)

### Implement third (Medium / polish & consistency)
17. Reorder corridor cards (1A first)
18. Add `clamp()` to all fixed padding values
19. Implement deselected card height collapse
20. Standardise congestion bar hot colour to `#8B1A1A`
21. Standardise card padding + border-radius tokens (§14.4, §14.6)
22. Add thin section-transition accent strip (§14.5)
23. Fix `100vh` → `100dvh` for iOS
24. Add `lang="en"` and OG meta tags
25. Add `prefers-reduced-motion` query
20. Style Leaflet zoom controls to match design system
