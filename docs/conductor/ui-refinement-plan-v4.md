# UI Refinement Plan (Regressions & Final Polish)

## Objective
Surgically fix 6 UI/UX regressions introduced during the implementation of the UI/UX review, ensuring layout stability, correct component rendering, and fluid navigation.

## Scope of Work

### 1. Fix Map Layout & Scroll Offsets (App.css)
*   **Action:** Remove the duplicate `.main-layout` definition at line 598 in `App.css`.
*   **Action:** Ensure the primary `.main-layout` uses `height: calc(100dvh - 78px)` to account for the sticky header.
*   **Action:** Add `html { scroll-padding-top: 80px; scroll-behavior: smooth; }` to `App.css` so anchor links do not get hidden under the sticky header.

### 2. Fix Nav & Stats Pill Overlap (App.css)
*   **Action:** Change `.scrolling-top-bar-inner` from a rigid 12-column grid (`grid-template-columns: repeat(12, 1fr)`) to a flexible layout (`display: flex; justify-content: space-between; align-items: center;`).
*   **Action:** Ensure the Nav container, Logo, and Stats pill flex appropriately without overlapping when the Nav pill text expands.

### 3. Restore "Damage Report" 3-Column Layout (App.jsx)
*   **Action:** Rewrite the `FindingsSection` component in `App.jsx`.
*   **Action:** Replace the current `.finding-card` list with the 3-column `.findings-col` layout defined in the CSS (`findings-col--sideswipe`, `findings-col--fender`, `findings-col--writeoff`) as originally intended.

### 4. Fix Text Overflow in Corridor Cards (StatsPanel.jsx)
*   **Action:** Add `minWidth: 0` to flex containers within the `CorridorCard` in `StatsPanel.jsx` to allow text truncation.
*   **Action:** Ensure `StatBlock` values scale correctly or use `textOverflow: 'ellipsis'` for extremely narrow container widths.

### 5. Tune Scroll-Spy / Intersection Observer (App.jsx & Header.jsx)
*   **Action:** Adjust the `IntersectionObserver` root margin in `App.jsx` from `'-10% 0px -40% 0px'` to `'-20% 0px -50% 0px'` to better trigger section changes when scrolling.
*   **Action:** Remove `manualActive` overrides in `Header.jsx` if they are causing race conditions with the scroll spy.

### 6. Refine "Road Closed" Block (App.jsx & App.css)
*   **Action:** Change `.road-closed-block` background from the dark `var(--on-surface)` to a complementary warning surface (e.g., a muted delay color or a softer surface with a prominent border).
*   **Action:** Ensure text colors within the block meet contrast requirements against the new background and fit the editorial flow.

## Verification
1.  Verify the map fits exactly within the viewport (no vertical scrolling beyond the header on desktop).
2.  Click a nav link and verify the section title is fully visible below the header.
3.  Hover over nav items and verify they do not overlap the stats pill.
4.  Verify the Findings section renders as 3 columns.
5.  Scroll the page and verify the active nav pill updates accurately.