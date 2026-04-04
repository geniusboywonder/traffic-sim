# UI Refinement & Navigation Rebuild Plan V2

## Objective
Revert the hamburger mobile menu and replace it with an expanding-icon navigation bar. Ensure precise grid alignment between the nav bar, stats pill, map, and corridor cards. Fix remaining bugs with hover cards and average times.

## Key Layout Changes
1. **Grid Alignment**:
   - The navigation bar will sit in an 8-column span, left-aligned with the map's left edge, and right-aligned with the map's right edge.
   - The stats pill will sit in a 4-column span, left-aligned with the corridor cards, and right-aligned with the corridor cards.
   - Both will scroll naturally with the page content.
   
2. **Expanding Icon Navigation**:
   - The hamburger menu and full-screen overlay (`MobileMenu.jsx`) will be removed.
   - The navigation bar will be refactored into a modern, icon-based menu.
   - It will feature 4 items (Simulator, Models, Findings, Contact) represented by distinct icons (Home, Briefcase, Calendar, Settings/Shield).
   - The active item will expand to show its text label and a green underline (matching `--c-3a`), exactly as demonstrated in the provided reference images.

## Refinements & Fixes
1. **Corridor Card Padding**:
   - Adjust padding and gap spacing in `.stat-card` and `.holo-card` to expand content and eliminate excessive white space at the bottom of the cards.

2. **Road Watcher Average Times**:
   - Investigate and fix the missing `avgInDelay` and `avgOutDelay` data in `SimMap.jsx` and `StatsPanel.jsx` when a specific road is selected in both Live and SUMO modes. We will verify the `cid` proxy mapping and ensure the stats object correctly computes and passes these values.

3. **Viewport-Aware Hover Cards**:
   - The hover targets (e.g., TIA Assumptions) will be updated with dynamic CSS or React logic to prevent them from rendering off-screen. We will apply robust boundary checks or flexible alignment (`right: 0` or dynamic translation based on viewport proximity).

## Implementation Steps

### Phase 1: Clean Up & Layout Structure
- Delete `MobileMenu.jsx` and remove its references in `App.jsx`.
- Update `App.jsx` layout to place the Navigation Bar and Stats Pill in a CSS Grid row immediately above the `.content` grid, matching the `span 8` and `span 4` layout exactly.

### Phase 2: Expanding Icon Menu
- Update `Header.jsx` to render the new navigation array with SVG icons.
- Add CSS transitions for width, opacity, and the active indicator line.

### Phase 3: Corridor Cards & Hover Pop-ups
- Adjust CSS for `.stat-card` to distribute space evenly (e.g., tweaking `justify-content` or `gap`).
- Refine `.hover-target` CSS, possibly anchoring it to the right or adding safe viewport limits (`max-width`, `right: auto`).

### Phase 4: Data Debugging
- Debug `SimMap.jsx` line ~250 where `stats.avgInDelay` is set, and confirm the `roadStats` prop flows properly to the "Watch My Road" render block in `StatsPanel.jsx`.

## Verification
- Scroll behavior works for both nav and stats pill.
- Expanding icons trigger smoothly.
- Hover pop-ups remain fully visible on screen.
- Average times are rendered when a road is clicked.