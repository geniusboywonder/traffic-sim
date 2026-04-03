# UI/UX Refinement Plan (Traff✱k v3.1)

## Phase 1: Critical Fixes & Mobile Responsiveness
- [ ] **Access Barrier**: Stack disclaimer column on mobile (`grid-template-columns: 1fr`).
- [ ] **Access Barrier**: Fluid title size using `clamp()`.
- [ ] **Access Barrier**: Set `font-style: normal` on disclaimer text.
- [ ] **Main Layout**: Switch `100vh` to `100dvh` for iOS Safari compatibility.
- [ ] **Stats Pill**: Fix mobile selector mismatch to ensure collapse/hide logic works.
- [ ] **Editorial Mobile**: Add breakpoints for Briefing, Models, Findings, and Footer sections.

## Phase 2: Header & Navigation
- [ ] **Persistence**: Ensure floating header remains visible during editorial scroll.
- [ ] **Active State**: Implement `IntersectionObserver` to auto-update active nav pill.
- [ ] **Grid Balance**: Reduce dead space between logo and stats pill.
- [ ] **Stats Pill**: Enforce uppercase/letter-spacing labels for consistency.

## Phase 3: Components & Sidebar
- [ ] **Corridor Order**: Verify Firgrove (3A) -> Homestead (2A) -> Children's (2B) -> Main Rd (1A) sequence.
- [ ] **Typography**: Increase floor for small labels to `0.65rem`.
- [ ] **Deselected Cards**: Implement `48px` max-height collapse with transition.
- [ ] **Hot Color**: Standardize all critical reds to `#8B1A1A`.
- [ ] **Legend**: Replace native checkbox with custom-styled toggle pill.
- [ ] **Legend**: Implement shape vocabulary (Circles, Diamonds, Squares).

## Phase 4: Editorial Cohesion & Interactivity
- [ ] **Alternating Sections**: Canvas -> Surface-Low -> Surface-High edge-to-edge backgrounds.
- [ ] **Responsive Padding**: Replace fixed padding with `--section-vpad` `clamp()` token.
- [ ] **Interactive Briefing**: Convert hover popovers to click-to-flip cards using React state.
- [ ] **Token Audit**: Replace hardcoded Tailwind greys with `var(--on-surface)` and `var(--muted-text)`.
- [ ] **Accent Strips**: Add thin corridor-colored accent lines between sections.

## Phase 5: Accessibility & Polish
- [ ] **Focus Rings**: Add global `:focus-visible` outline using brand Celadon.
- [ ] **Meta Tags**: Add OG tags and meta description to `index.html`.
- [ ] **Reduced Motion**: Add `prefers-reduced-motion` safety query.
- [ ] **Leaflet**: Style zoom controls to match the glassmorphic theme.
