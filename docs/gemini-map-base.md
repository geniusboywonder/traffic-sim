# REPORT: TOKAI HS TRAFFIC SIMULATOR BASE MAP LAYERS

## 1. Technical Objective
Implementation of three schematic map layers for a browser-based traffic simulator. These layers utilize geocoded road network data to visualize the morning school run impact (07:00–08:30) at Erf 1061, Bergvliet.

## 2. Base Tile Configuration (OpenFreeMap)
- **Provider:** OpenFreeMap
- **Style URL:** `https://tiles.openfreemap.org/styles/positron`
- **Primary Coordinates:** `[-34.0505, 18.4575]` (N7 Ingress)
- **Initial Zoom:** 16
- **Bounding Box:** `SW: -34.055, 18.455 | NE: -34.045, 18.470`

---

## 3. Schematic Layer Artifacts

### 3.1 Artifact 1: Geo-Rectilinear Schematic
Concept: Snapped geographic view. Maintains intersection relative positioning while constraining road segments to 90° and 45° angles.

```xml
<svg viewBox="0 0 800 600" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
  <g stroke="#94a3b8" stroke-width="4" stroke-linecap="round">
    <line x1="100" y1="300" x2="300" y2="300" /> 
    <line x1="300" y1="300" x2="300" y2="100" />
    <line x1="100" y1="300" x2="100" y2="500" />
    <path d="M 100 300 L 250 450 L 450 450" fill="none" stroke="#ef4444" stroke-width="6" />
  </g>
  <g fill="#1e293b">
    <circle cx="100" cy="300" r="6" /> <text x="80" y="290" font-size="12">N1: Main/Dreyersdal</text>
    <circle cx="450" cy="450" r="8" fill="#ef4444" /> <text x="465" y="455" font-size="12" font-weight="bold">N7: INGRESS</text>
  </g>
</svg>
```

### 3.2 Artifact 2: Topological "Tube Map" Funnel
Concept: Logical flow visualization. Distorts physical distance to emphasize the systemic bottleneck at the school entrance (N7/N8).

```xml
<svg viewBox="0 0 800 400" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)">
  <g fill="none" stroke-width="8" stroke-linecap="round">
    <path d="M 50 50 L 200 200" stroke="#3b82f6" />
    <path d="M 50 200 L 200 200" stroke="#3b82f6" />
    <path d="M 50 350 L 200 200" stroke="#3b82f6" />
    <path d="M 200 200 L 400 200" stroke="#f97316" stroke-width="12" />
    <path d="M 400 200 L 600 200" stroke="#ef4444" stroke-width="16" />
    <path d="M 600 200 L 750 100" stroke="#22c55e" stroke-width="6" />
    <path d="M 600 200 L 750 300" stroke="#22c55e" stroke-width="6" />
  </g>
  <text x="210" y="190" font-size="14" font-weight="bold">CONVERGENCE ZONE</text>
  <text x="580" y="230" font-size="14" font-weight="bold">SCHOOL (N7/N8)</text>
</svg>
```

### 3.3 Artifact 3: Operational Impact & TIA Coverage
Concept: Gap analysis. High-contrast visual distinction between arterial infrastructure studied in the TIA and local Class 5 roads excluded from the report.

```xml
<svg viewBox="0 0 800 500" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)">
  <rect x="20" y="20" width="180" height="60" fill="white" stroke="#ccc" />
  <line x1="30" y1="40" x2="60" y2="40" stroke="#3b82f6" stroke-width="4" /> <text x="70" y="45" font-size="12">TIA Studied</text>
  <line x1="30" y1="65" x2="60" y2="65" stroke="#ef4444" stroke-dasharray="4" stroke-width="2" /> <text x="70" y="70" font-size="12">Unstudied (Reality)</text>
  <g fill="none">
    <path d="M 100 100 L 100 450" stroke="#3b82f6" stroke-width="6" />
    <path d="M 100 400 L 600 400" stroke="#3b82f6" stroke-width="6" />
    <path d="M 100 250 L 350 250" stroke="#ef4444" stroke-width="3" stroke-dasharray="8" />
    <path d="M 350 250 L 350 150 L 500 150" stroke="#ef4444" stroke-width="4" stroke-dasharray="4" />
  </g>
  <circle cx="500" cy="150" r="20" fill="rgba(239, 68, 68, 0.2)" />
  <text x="530" y="155" font-size="14" fill="#b91c1c" font-weight="bold">⚠ 100% Load Point (Unstudied)</text>
</svg>
```

---

## 4. Implementation Requirements
- **Framework:** React / SVG layer overlay.
- **Data Model:** Integrated with `tokai_traffic_geocoded_network_L2.md` node IDs.
- **Interaction:** Layer-toggle logic for comparative stakeholder analysis.