# UI Refinement & Feature Expansion Plan

## Objective
Fix layout inconsistencies in the navigation bar, improve card aesthetics, ensure data visibility for road selection, and implement a modern mobile menu and viewport-aware hover cards.

## Key Changes

### 1. Layout & Navigation Refactor
- **Shortened Header**: Align the main navigation bar (`nav-deck`) with the width of the map (8/12 of the layout).
- **Scrolling Stats Pill**: Move simulation statistics (Time, Total In/Out, Avg Times) into a separate "Stats Pill" that lives above the main grid and scrolls off the page with the map.
- **Robust Sizing**: Apply fixed-width containers to stats values to prevent layout jumps and wrapping.

### 2. Corridor Card Improvements
- **Vertical Balance**: Increase internal gaps and padding to better distribute content and eliminate excessive white space at the bottom of cards.
- **Visibility Toggle**: Add an "Eye/Hide" icon to the top-right corner of each corridor card to indicate and control its selection state.

### 3. Logic & Data Fixes
- **Road Selection Stats**: Debug and fix the display of average travel times when a specific road is selected in both Live and Playback modes.
- **Viewport Awareness**: Refactor hover cards (TIA Assumptions, Model Parameters) to ensure they are aware of viewport boundaries and never render off-screen.

### 4. Modern Mobile Menu
- **Implementation**: Create a sleek, full-screen mobile menu with staggered animations and a distinct aesthetic that matches the "Tokai-Sim" color scheme.
- **Integration**: Add a functional hamburger trigger to the navigation bar.

## Implementation Steps

### Phase 1: Navigation & Layout
1.  **CSS Updates**: Modify `.nav-deck` to align with map width. Create styles for the new `.scrolling-stats-pill`.
2.  **Header Component**: Remove stats from `Header.jsx`.
3.  **App Component**: Integrate the stats pill into the `main-layout` in `App.jsx`.

### Phase 2: Corridor Cards & Icons
1.  **StatsPanel Updates**: Add `Eye` / `EyeOff` icons (using simple SVG or characters).
2.  **Styling**: Refine `.stat-card` and `.holo-grid` spacing in `App.css`.

### Phase 3: Hover Cards & Viewport Logic
1.  **CSS Refactor**: Update `.hover-target` to use a more centered or boundary-aware positioning strategy.

### Phase 4: Road Stats Debugging
1.  **SimMap / Playback Check**: Verify `roadStats` object contains `avgInDelay` and `avgOutDelay`.
2.  **UI Verification**: Ensure these values are rendered in `StatsPanel`.

### Phase 5: Mobile Menu
1.  **New Component**: Create `MobileMenu.jsx`.
2.  **Trigger Logic**: Add state to `App.jsx` to toggle the menu.

## Verification & Testing
- Toggle corridors and verify map zoom/fade and card collapse.
- Select various roads and confirm Avg Time In/Out appears.
- Resize viewport to test mobile menu and hover card placement.
- Scroll down the page to ensure the stats pill scrolls while the shortened nav bar stays fixed.
