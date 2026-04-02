# TIA Parameter Audit
## TokaiSim vs TIA ITS4839 — Parameter Compliance Review
**Date:** 2026-04-02  
**TIA Reference:** ITS 4839, Innovative Transport Solutions, July 2025 (Draft)

---

## Purpose

This document records the cross-check of all key TIA parameters against the live (IDM) model and the SUMO microscopic model, performed on 2026-04-02. It documents what is correctly reflected, what diverges, and what fixes were applied.

---

## Parameters Checked

### 1. Trip Generation

| Parameter | TIA (Section 12) | Live Model | SUMO |
|---|---|---|---|
| AM Peak trips (H scenario) | 840 | 840 ✓ | 840 ✓ |
| L scenario trips | N/A | 500 | **420 → fixed to 500** |
| M scenario trips | N/A | 650 | 650 ✓ |
| School roll | 1,120 learners | (informational) | (informational) |
| COTO530 rate | 0.75/student → 840 trips | implicit | implicit |

**L scenario mismatch:** SUMO used 420 trips; live model uses 500. Neither is from TIA directly (TIA only specifies 840 for AM peak). Aligned SUMO L → 500 for consistency.

---

### 2. Corridor Trip Distribution

TIA Section 13 defines two groups: **External (70%)** across 4 main corridors, and **Residential (30%)** across 5 local streets.

#### External Corridors (70%) — normalized to 100% for the 4-corridor model

| Corridor | TIA raw | TIA normalized | Live Model | SUMO (old) | SUMO (fixed) |
|---|---|---|---|---|---|
| 1A — Dreyersdal North | 11% | 15.7% | 15.9% ✓ | **24.0% ✗** | 15.7% ✓ |
| 2A — Homestead Avenue | 21% | 30.0% | 30.4% ✓ | **20.0% ✗** | 30.0% ✓ |
| 2B — Children's Way   | 25% | 35.7% | 36.2% ✓ | 35.0% ✓ | 35.7% ✓ |
| 3A — Dreyersdal South | 13% | 18.6% | **17.4% (was 12/70)** | 21.0% ≈ | 18.6% ✓ |

**Fixes applied:**
- SUMO `CORRIDORS` shares corrected to TIA-exact values (1A=0.157, 2A=0.300, 2B=0.357, 3A=0.186)
- Live model `RAW['3A']` corrected 12 → 13 (was a rounding error)

**SUMO 1A/2A divergence explained:** The old SUMO shares (1A=24%, 2A=20%) appear to have been set manually without reference to TIA. Dreyersdal North was over-loaded by 53%; Homestead was under-loaded by 33%. This would have produced misleading congestion patterns at the Main Road/Dreyersdal intersection.

#### Residential Corridors (30%) — NOT modelled separately

| TIA Route | TIA Share | Model Status |
|---|---|---|
| Christopher Road (east) | 4% | Not modelled as separate corridor |
| Starke Road (north) | 10% | Not modelled as separate corridor |
| Starke Road (south) | 12% | Not modelled as separate corridor |
| Leyden Road (north) | 3% | Not modelled as separate corridor |
| Ruskin Road (east) | 1% | Not modelled as separate corridor |

**Impact:** 252 vehicles (30% of 840) from local residential streets are not assigned to their own corridor routes. They are absorbed proportionally into the 4 main corridors via normalization. This means:
- Local street loading on Starke/Christopher/Leyden is **not simulated**
- The 4-corridor total appears to represent 100% of demand instead of 70%
- This is a **known model simplification**, acceptable for visualisation but should be flagged in any formal validation context

---

### 3. Analysis Period

| Parameter | TIA (Section 7) | Live Model | SUMO |
|---|---|---|---|
| AM count period | 06:30 – 09:00 | 06:30 – 09:00 ✓ | 06:30 – 09:00 ✓ |
| AM peak hour | 07:00 – 08:00 | peak at 07:45 ✓ | peak at ~07:45 ✓ |
| Peak demand window | 07:30 – 08:00 (35%) | Gaussian centred 07:45 ✓ | Step profile peaking 07:45–08:00 ✓ |

Peak timing was corrected earlier (IDM `centre` was 07:30 → fixed to 07:45 to match TIA trapezoidal profile).

---

### 4. Site Access

| Parameter | TIA (Section 11) | Live Model | SUMO |
|---|---|---|---|
| Ingress | Ruskin Rd at Leyden junction | J7: Ruskin/Leyden ✓ | School-Gate node ✓ |
| Egress | Aristea Road cul-de-sac | J20: Aristea Rd ✓ | south Aristea node ✓ |
| One-way internal circulation | Yes | Yes ✓ | Yes ✓ |
| Ruskin/Aristea roundabout | Proposed | J29 modelled as `roundabout_planned` ✓ | N/A |

---

### 5. Parking

| Parameter | TIA (Section 17) | Live Model | SUMO |
|---|---|---|---|
| On-site bays | 98 | 98 ✓ | N/A |
| On-street bays (Ruskin) | 22 | 22 ✓ | N/A |
| Total | 120 | 120 ✓ | N/A |
| Required minimum | 95 | (informational) | N/A |

---

### 6. Road Classifications & Speed Limits

| Corridor | TIA Road Class | TIA Speed | Live Model Class | Live Model Speed | SUMO |
|---|---|---|---|---|---|
| 1A — Dreyersdal Rd | Class 5 Local Street | ~30 km/h | `'arterial'` → **60 km/h ✗** | Over by 100% | OSM accurate ✓ |
| 2A — Homestead Ave | Class 5 Local Street | ~30 km/h | `'collector'` → 40 km/h ✗ | Over by 33% | OSM accurate ✓ |
| 2B — Children's Way | Class 5 Local Street | ~30 km/h | `'collector'` → 40 km/h ✗ | Over by 33% | OSM accurate ✓ |
| 3A — Dreyersdal S | Class 5 Local Street | ~30 km/h | `'collector'` → 40 km/h ✗ | Over by 33% | OSM accurate ✓ |

**Not fixed (deferred):** The live model uses a single road class per corridor representing the full approach route (e.g., 1A vehicles travel on Main Road arterial before entering Dreyersdal). Changing to `'local'` would underestimate speeds on the arterial approach. Properly fixing this requires per-segment road class attribution. SUMO uses OSM speed limits and is accurate; the live model is a known approximation.

**Practical impact:** The live model will slightly underestimate congestion on the local street segments (vehicles travel faster than TIA road class warrants). The Dreyersdal 1A corridor is most affected (arterial 60 km/h vs local 30 km/h). This is the intersection TIA flags as LOS F during AM peak — the live model's underestimate of congestion here is a relevant caveat.

---

### 7. Study Intersections

TIA evaluated 6 intersections (Section 6). Model coverage:

| Int. # | Intersection | TIA Control | Model |
|---|---|---|---|
| 1 | Firgrove Way / Dreyersdal Rd | Priority Stop | J13: `priority_stop` ✓ |
| 2 | Ladies Mile / Homestead Ave | Priority Stop | J9: `priority_stop` ✓ |
| 3 | Ladies Mile / Children's Way | Traffic Signal | J8: `traffic_signal` ✓ |
| 4 | Main Rd / Dreyersdal Rd | Priority Stop | J1: `priority_stop` ✓ |
| 5 | Starke Rd / Christopher Rd | Priority Stop | J4: `stop` (directional) ✓ |
| 6 | Ruskin Rd / Aristea Rd | Priority Stop | J29: `roundabout_planned` ✓ |

All 6 TIA study intersections are modelled with appropriate controls.

---

## Summary of Issues

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | SUMO corridor 1A: 24% vs TIA 15.7% | High | **Fixed** |
| 2 | SUMO corridor 2A: 20% vs TIA 30.0% | High | **Fixed** |
| 3 | SUMO L scenario: 420 vs live model 500 | Medium | **Fixed** |
| 4 | Live model 3A raw: 12 vs TIA 13 | Low | **Fixed** |
| 5 | Live model road classes above TIA classification | Medium | Flagged — deferred |
| 6 | Residential 30% not modelled as separate corridors | Low | Flagged — known simplification |

---

## Files Modified

| File | Change |
|---|---|
| `src/engine/spawner.js` | `RAW['3A']`: 12 → 13 |
| `sim/sumo_runner.py` | `CORRIDORS` shares → TIA-exact; `SCENARIO_DEMAND['L']`: 420 → 500 |

**Note:** SUMO JSON files (`scenario-L/M/H-sumo.json`) need to be regenerated on the Windows PC after the `sumo_runner.py` fix.
