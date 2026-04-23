# Traffik — Tokai High Traffic Simulator

**URL:** https://traffic.adamson.co.za  
**Description:** Interactive microscopic traffic simulation showing what 800 extra cars do to Bergvliet's streets during morning school drop-off for the proposed Tokai High School development.

---

## What This Is

Traffik is a browser-based traffic simulation calibrated to the official Traffic Impact Assessment (TIA) for a proposed Tokai High School in the Bergvliet/Tokai suburb of Cape Town, South Africa. It models every vehicle individually using the Intelligent Driver Model (IDM) — the same car-following mathematics used in professional-grade simulators.

The simulation runs from **06:30 to approximately 09:00**, covering the morning school drop-off peak. It tracks vehicles entering via four corridors, navigating 11 junctions and 28 road signs, and queuing at the school gate.

---

## The Study Area

- **Suburb:** Bergvliet/Tokai, Cape Town, South Africa
- **School site:** Proposed Tokai High School (development site)
- **Corridors modelled:**
  - Firgrove Way (Dreyersdal North + Starke) — 14% of inbound vehicles
  - Homestead Avenue — 25% of inbound vehicles
  - Children's Way — 47% of inbound vehicles
  - Main Road (Dreyersdal South) — 14% of inbound vehicles
- **Key roads:** Dreyersdal Rd, Vineyard Rd, Christopher Rd, Aristea Rd, Dante Rd, Ruskin Rd, Leyden Rd, Starke Rd, Clement Rd

---

## Demand Scenarios

Three demand levels based on the TIA's trip generation figures:

| Scenario | Label | Inbound vehicles |
|----------|-------|-----------------|
| L | Low | 336 |
| M | Medium | 420 |
| H | High | 504–508 |

Demand peaks at **07:45** following the TIA's peak-hour demand curve.

---

## Simulation Models

### 1. Our Live Simulation (IDM)
The interactive engine on the page. Uses the Intelligent Driver Model — every vehicle moves individually, second by second. Models speed humps, junction holds, rat-run decisions, school dwell time, and dynamic egress holds at the Ladies Mile signal during peak.

### 2. Lab Model (SUMO)
Cross-check using SUMO (Simulation of Urban MObility), developed by the German Aerospace Center (DLR). One of the world's most widely used microscopic traffic simulators. Lab outputs closely match the Live engine across all scenarios.

### 3. Validation Model (UXSim)
Mesoscopic model by Dr. Toru Seo (Institute of Science Tokyo). Uses kinematic wave theory — the same mathematics as the TIA's capacity calculations. Audits the other models from the network level.

### 4. The Official TIA
The Traffic Impact Assessment commissioned under Western Cape Mobility Department (WCMD) guidelines, following South Africa's TMH 16 standard. Analytical method — standardised traffic engineering formulas applied to the worst-case 15-minute peak window.

---

## Key Findings

### Congestion (Critical)

- **Traffic does not clear by 08:30.** The TIA assumes the school run ends by 08:30. The Live engine shows **68 vehicles still arriving after 08:30** in the High scenario. The Lab model confirms vehicles still queued at 09:00 in every scenario — including Low demand.

- **A 7-minute trip becomes a 26-minute ordeal.** Lab model mean trip duration under High demand is ~26 minutes (free-flow baseline: ~7 minutes). The Live engine shows ~18 minutes mean. Both models agree: **11 minutes spent completely stopped**. The P95 trip time is 34 min (Live) to 59 min (Lab) — 1 in 20 drivers takes over half an hour for a 3 km trip.

- **Three independent models, one answer.** Live, Lab, and Validation each independently identify Dreyersdal Rd, Vineyard Rd, and the Starke/Christopher corridor as the most congested roads in Medium and High demand.

### Bottlenecks

- **Single school gate entry.** One gate, 14 speed humps on approach. Lab model shows vehicles spending **6 minutes on the school internal road** at walking pace (0.6 km/h vs 5 km/h free-flow) while waiting for a drop-off bay.

- **Christopher Rd is the convergence point.** All four entry corridors reach the school via Christopher Rd — through a stop at Starke/Christopher and a yield at Christopher/Vineyard.

- **Aristea Rd is the only exit.** Every vehicle leaving the school must exit via Aristea Rd onto the Ruskin/Aristea roundabout. Every exiting vehicle then turns onto Dante Rd first — a structural pinch point regardless of exit direction.

### Peak Timing

The crunch peaks **after 08:00, not 07:45.** The TIA's analysis window is 07:30–08:00. All three models show peak loading between 07:52 and 08:14 — well after the TIA's window closes. The TIA captures when parents arrive; it misses when the queue is longest.

### Rat-Runs

At High demand, **1 in 4 vehicles** (25.6%) takes an alternative route through the suburb. All rat-run routes still connect to the same final approach: Christopher/Vineyard, Clement/Leyden, or Dante/Ruskin. Those final segments carry the combined load of main-route and rat-run traffic. The shortcut ends in the same jam.

---

## What the Model Excludes

This simulation models **inbound school traffic only.** It explicitly excludes:

- Sweet Valley Primary school runs (~200m away, same roads)
- All Bergvliet residents' local traffic movements (commuters, errands, other school runs)
- All traffic exiting to Firgrove Rd, Ladies Mile Rd and Main Rd after drop-off
- New traffic calming measures proposed for Dante Rd, Vineyard Rd, Ruskin Rd, Leyden Rd

**All average trip-out times are massively understated** as a result of these exclusions.

---

## Technical Specifications

- **Speeds modelled:** Arterial 60 km/h | Collector 40 km/h | Local 30 km/h
- **Safe gap:** 1.5–2.5 s | Yield gap: 2.5 s
- **Network scale:** 11 junctions, 28 road signs
- **Rat-run logic:** Triggers at 6–15% corridor congestion, 85% activation probability
- **School bays:** 120 total (98 on-site + 22 on-street) | Avg stop time: 45 seconds | One-way system | Aristea Traffic Circle

---

## Built By

Neill Adamson — [neill.adamson.co.za](https://neill.adamson.co.za) · [@geniusboywonder](https://x.com/geniusboywonder)  
Contact: nadamson@gmail.com

Built with: React, Leaflet, SUMO (DLR), UXSim (Dr. Toru Seo), OpenStreetMap

© Neill Adamson 2026. All rights reserved.
