# Style Guide: Editorial Organicism (Sage Edition)
**Project:** TokaiSim v3.0  
**Creative North Star:** "The Curated Earth" — Architectural Monographs meets Botanical Mineralogy.

---

## 1. Color Palette: The Mineral Spectrum
A high-contrast mineral system designed for analytical precision within a calm botanical theme.

### A. Core Surfaces
| Token | Hex | Role |
| :--- | :--- | :--- |
| `canvas` | `#F1F5F1` | Main site background. |
| `surface-low` | `#E1E9E1` | Sidebar and secondary regions. |
| `surface-high` | `#D1DAD1` | Component cards and interactive widgets. |
| `on-surface` | `#111D13` | Primary body copy and headers (Carbon Black). |
| `muted-text` | `#717977` | Metadata, disabled states, and captions (Slate Gray). |

### B. Corridor Chromatics (Telemetry & Identity)
| Corridor | Hex | Name | Application |
| :--- | :--- | :--- | :--- |
| **1A** | `#111D13` | **Carbon Black** | Primary artery anchor. |
| **2A** | `#A1CCA5` | **Bright Celadon** | High-luminance botanical green. |
| **2B** | `#D0A679` | **Mineral Ochre** | Warm mineral break. |
| **3A** | `#709775` | **Muted Teal** | Cool medium-depth green. |

### C. Condition Accents
| State | Hex | Name | Rationale |
| :--- | :--- | :--- | :--- |
| **Delay** | `#A64D4D` | **Crimson Earth** | Subdued red for congestion/distress. |
| **Egress** | `#C27D60` | **Copper** | Warm mineral for system exits. |

---

## 2. Typography: The Engineered Voice
High-contrast type system balancing precision with editorial breathing room.

### A. Font Families
- **Headlines/Metrics:** **Manrope** (Geometric, architectural).
- **Body/Labels:** **Work Sans** (Wide stance, high legibility).

### B. Typographic Hierarchy
| Role | Size | Font | Weight | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Display-LG** | `3.5rem` | Manrope | 800 | Hero titles, `-0.02em` tracking. |
| **Headline-MD** | `1.25rem` | Manrope | 700 | Component titles. |
| **Sim Clock** | `1.1rem` | Manrope | 500 | `tabular-nums` for playback stability. |
| **Metric-XL** | `1.5rem` | Manrope | 300 | Large data values. |
| **Body-LG** | `1rem` | Work Sans | 400 | `1.6` line-height for readability. |
| **Label-SM** | `0.65rem` | Work Sans | 700 | Uppercase, `0.1em` letter-spacing. |

---

## 3. Structural Philosophy: "The No-Line Rule"
**Borders are forbidden.** Boundaries are defined by tonal shifts and negative space.

- **Layout Separation:** Sidebar (`surface-low`) sits against Map/Canvas (`canvas`).
- **Nesting Hierarchy:** Canvas → Surface-Low (Region) → Surface-High (Card).
- **Elevation:** Use "Sunlight Shadows" only for floating modals:  
  `box-shadow: 0 24px 48px -12px rgba(17, 29, 19, 0.08);`

---

## 4. Components & Interactive States

### A. The Control Deck (Header)
- **Aesthetic:** Glassmorphic (`surface-low` @ 85% opacity, `24px` blur).
- **Buttons (Default):** No border. Background `surface-high`. Text `on-surface`.
- **Buttons (Active):** 135° Gradient (`primary` → `primary-container`). Text `canvas`.
- **Buttons (Hover):** Background `surface-highest`.

### B. Intelligence Cards (Sidebar)
- **Identity:** `4px` left-border using the specific Corridor color.
- **Congestion Meter:** A multi-segment horizontal bar:
    - Active: `Corridor Color`
    - Slowing: `muted-text`
    - Stopped: `delay`
- **Sparklines:** Stylized SVG paths (`stroke-width: 2`) matching corridor color.

### C. Road Analyzer (Watch My Road)
- **Aesthetic:** High-contrast "Black Box" (`on-surface` background).
- **Title:** `c-3a (Celadon)` for the street name to signify "Active Selection."

---

## 5. Tactical Map & Telemetry
The map is a "Digital Twin" plotted as an architectural blueprint.

### A. Map Tiles
- **OpenStreetMap Filter:**  
  `filter: grayscale(0.2) sepia(0.1) contrast(0.9) brightness(1.05);`

### B. Telemetry Symbolism (The Blueprint System)
| Vehicle Type | Shape | State |
| :--- | :--- | :--- |
| **Inbound Main** | ● **Solid Circle** | Arriving via primary route. |
| **Inbound Rat-Run**| ◆ **Solid Diamond** | Arriving via residential diversion. |
| **Egress Main** | ○ **Hollow Circle** | Exiting via primary route. |
| **Egress Rat-Run** | ◇ **Hollow Diamond**| Exiting via residential diversion. |
| **Parked** | ■ **Slate Square** | Static / Site Plan Plot Point. |

### C. Congestion Animation
- **Subtle Breathing:** Vehicle color fades between Corridor Color and `Crimson Earth`.
- **Duration:** 3s `ease-in-out` loop. No footprint change.

---

## 6. Sizing & Spacing
- **Sidebar Width:** `340px` (Expanded for editorial clarity).
- **Header Height:** `72px`.
- **Corner Radius:** `4px` (Standard components), `8px` (Map/Hero images).
- **Standard Padding:** `1.5rem` (`space-4`).
