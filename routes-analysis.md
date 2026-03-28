# Tokai HS — Route Analysis: All Paths to School Ingress

**School entry point:** Ruskin Rd / Leyden Rd intersection (N7) → Ruskin Rd → School gate
**School exit point:** Aristea Rd cul-de-sac (N8) → Aristea Rd → Ruskin/Aristea jct (N6)
**AM Peak window:** 07:00–08:30 | Total vehicles (High scenario): 840 trips

Road class key: `[ART]` Arterial · `[COL]` Collector · `[L5]` Class 5 Local · `⚠` Unstudied in TIA

---

## Ingress Road 1 — Main Rd (M4)

**Road class:** `[ART]`
**TIA share:** ~24% of total trips (~202 vehicles) — splits north and south approach
**Entry point into study area:** N1 (Main Rd / Dreyersdal Rd intersection)

### Route 1A — Main Rd → Dreyersdal → Starke → Ruskin *(primary, 11% north)*
```
Main Rd (M4) [ART]
  → turn at N1: Dreyersdal Rd [COL]
  → Starke Rd North [L5] ⚠
  → Starke Rd South [L5] ⚠
  → N7: Ruskin Rd / Leyden Rd ingress [L5] ⚠
  → School gate
```
**Vehicles (High):** ~92 veh
**Critical segment:** Starke Rd — Class 5, single lane, no footpaths, never assessed
**Bottleneck:** N7 ingress — stop-controlled, queues form here for all routes

---

### Route 1B — Main Rd → Dreyersdal → Christopher → Ruskin *(secondary, south approach 13%)*
```
Main Rd (M4) [ART] (northbound, south approach)
  → turn at N1: Dreyersdal Rd [COL]
  → N5: Starke/Christopher junction [L5] ⚠
  → Christopher Rd [L5] ⚠
  → N10: Christopher / Ruskin junction [L5] ⚠
  → Ruskin Rd [L5] ⚠
  → N7: Ruskin / Leyden ingress
  → School gate
```
**Vehicles (High):** ~109 veh
**Note:** Christopher Rd is narrower than Starke — more susceptible to opposing traffic friction

---

### Route 1C — Main Rd → Leyden Rd → Ruskin *(minor direct, 3%)*
```
Main Rd (M4) [ART]
  → Leyden Rd [L5] ⚠
  → N7: Ruskin / Leyden ingress (arrives at the bottleneck directly)
  → School gate
```
**Vehicles (High):** ~25 veh
**Note:** Shortest path from Main Rd. Leyden Rd is single-lane residential. N7 is the unstudied critical intersection.

---

### Route 1D — Main Rd → Dreyersdal → Firgrove → Vineyard → Ruskin *(rat-run)*
```
Main Rd (M4) [ART]
  → Dreyersdal Rd [COL]
  → N2: Dreyersdal / Firgrove Way junction
  → Firgrove Way [COL]
  → N12: Vineyard / Dreyersdal junction [L5] ⚠
  → Vineyard Rd [L5] ⚠
  → N11: Vineyard / Ruskin junction [L5] ⚠
  → Ruskin Rd [L5] ⚠
  → N7 ingress → School gate
```
**Trigger:** Activated when Dreyersdal/Starke corridor backs up (>70% capacity in High scenario)
**Effect:** Pushes traffic onto Vineyard Rd — an even narrower residential street, completely unstudied

---

## Ingress Road 2 — Ladies Mile Rd (MR127)

**Road class:** `[ART]` (dual carriageway, 2 lanes each direction)
**TIA share:** ~46% of total trips (~386 vehicles) — the dominant feeder
**Entry points:** N3 (Ladies Mile / Children's Way) and N4 (Ladies Mile / Homestead Ave)

### Route 2A — Ladies Mile → Homestead Ave → Starke → Ruskin *(primary east, 21%)*
```
Ladies Mile Rd (MR127) [ART]
  → N4: Ladies Mile / Homestead Ave junction (stop-controlled)
  → Homestead Ave [L5] ⚠
  → N9: Homestead / Starke junction [L5] ⚠
  → Starke Rd South [L5] ⚠
  → N7: Ruskin / Leyden ingress
  → School gate
```
**Vehicles (High):** ~176 veh
**Note:** N4 is stop-controlled — minor street gives way to Ladies Mile. Queue on Homestead Ave forms rapidly in High scenario.

---

### Route 2B — Ladies Mile → Children's Way → Christopher → Ruskin *(primary east, 25%)*
```
Ladies Mile Rd (MR127) [ART]
  → N3: Ladies Mile / Children's Way junction (signalised)
  → Children's Way [L5] ⚠
  → N5: Starke / Christopher convergence (all-way stop) [L5] ⚠
  → Christopher Rd [L5] ⚠
  → N10: Christopher / Ruskin junction [L5] ⚠
  → Ruskin Rd [L5] ⚠
  → N7 ingress → School gate
```
**Vehicles (High):** ~210 veh — **largest single origin stream**
**Critical segment:** Children's Way + Christopher Rd — both Class 5, combined carry 210 veh in 45-min window
**N5 convergence:** Where Children's Way and Starke/Homestead traffic merge — all-way stop, no capacity analysis done

---

### Route 2C — Ladies Mile → Children's Way → Starke → Ruskin *(alternate east)*
```
Ladies Mile Rd (MR127) [ART]
  → N3: Children's Way junction
  → Children's Way [L5] ⚠
  → N5 convergence
  → Starke Rd [L5] ⚠  (instead of Christopher)
  → N7 ingress → School gate
```
**Vehicles:** Subset of 2B flow that prefers Starke over Christopher at N5
**Note:** Drivers choose Starke vs Christopher based on perceived queue — both end at N7

---

### Route 2D — Ladies Mile → Homestead → Vineyard → Ruskin *(rat-run)*
```
Ladies Mile Rd (MR127) [ART]
  → Homestead Ave [L5] ⚠
  → Vineyard Rd [L5] ⚠  (shortcuts past Starke/Christopher)
  → N11: Vineyard / Ruskin [L5] ⚠
  → Ruskin Rd [L5] ⚠
  → N7 ingress → School gate
```
**Trigger:** Activated when Homestead/Starke corridor backs up (bypasses N9 and N5)
**Effect:** Adds load to Vineyard Rd on top of any Firgrove/Dreyersdal rat-run traffic

---

## Ingress Road 3 — Firgrove Rd (Firgrove Way)

**Road class:** `[COL]` Collector
**TIA share:** Serves the 11% north Dreyersdal corridor — Firgrove is the distributor, not the origin
**Entry point:** N2 (Dreyersdal / Firgrove Way)
**Note:** Firgrove Way is the only collector-class connector between Dreyersdal Rd and the local street network north of Ruskin Rd. All traffic that doesn't use the Main Rd / Dreyersdal direct route passes through N2.

### Route 3A — Firgrove → Vineyard → Ruskin *(primary via Firgrove)*
```
Firgrove Way [COL]
  → N12: Firgrove / Vineyard junction [L5] ⚠
  → Vineyard Rd [L5] ⚠
  → N11: Vineyard / Ruskin [L5] ⚠
  → Ruskin Rd [L5] ⚠
  → N7 ingress → School gate
```
**Vehicles (High):** ~92 veh (north Dreyersdal share)
**Note:** Vineyard Rd is the only collector-to-local link on the north side. It feeds N11, which merges onto Ruskin Rd upstream of N7.

---

### Route 3B — Firgrove → (back to Dreyersdal) → Starke → Ruskin *(alternate)*
```
Firgrove Way [COL]
  → returns to Dreyersdal Rd [COL]
  → Starke Rd North [L5] ⚠
  → Starke Rd South [L5] ⚠
  → N7 ingress → School gate
```
**Note:** Longer path, used when Vineyard Rd is already backing up

---

## Summary: All Routes Converge at N7

```
INGRESS SOURCES                COLLECTOR STREETS           LAST-MILE (ALL UNSTUDIED)     INGRESS POINT
─────────────────────────────────────────────────────────────────────────────────────────────────────
Main Rd North   (11%)  ──→  Dreyersdal Rd  ──┐
                                              ├──→  Starke Rd (N→S)  ──→  ─────────────────┐
Ladies Mile / Homestead (21%) ─────────────────┘                                           │
                                                                                            ├──→ N7
Ladies Mile / Children's Way (25%) ──→  Christopher Rd  ──────────────────────────────────┤     │
                                    └──→  Starke Rd  ────────────────────────────────────→─┘     │
                                                                                                  ▼
Main Rd South   (13%)  ──→  Dreyersdal Rd  ──→  Christopher Rd  ──→  Ruskin Rd  ──→  SCHOOL
                                                                                          ↑
Firgrove Way    (11%)  ──→  Vineyard Rd  ─────────────────────────────────────────────→──┘
                                                                                          ↑
Main Rd / Leyden       (3%)  ──→  Leyden Rd  ─────────────────────────────────────────→──┘
                                                                                          ↑
Rat-runs (overflow)    ──→  Vineyard Rd / Dante / Airlie  ──────────────────────────→──┘
```

---

## Route Load Summary (High Scenario — 840 trips)

| Route | Origin | Via | Vehicles | TIA Status |
|---|---|---|---|---|
| 1A | Main Rd North | Dreyersdal → Starke | ~92 | Starke Rd ⚠ unstudied |
| 1B | Main Rd South | Dreyersdal → Christopher | ~109 | Christopher Rd ⚠ unstudied |
| 1C | Main Rd | Leyden Rd direct | ~25 | Leyden Rd ⚠ unstudied |
| 1D | Main Rd | Firgrove → Vineyard *(rat-run)* | overflow | Vineyard Rd ⚠ unstudied |
| 2A | Ladies Mile | Homestead → Starke | ~176 | Homestead + Starke ⚠ unstudied |
| 2B | Ladies Mile | Children's Way → Christopher | ~210 | Children's Way + Christopher ⚠ unstudied |
| 2C | Ladies Mile | Children's Way → Starke | subset of 2B | Starke ⚠ unstudied |
| 2D | Ladies Mile | Homestead → Vineyard *(rat-run)* | overflow | Vineyard ⚠ unstudied |
| 3A | Firgrove Way | Vineyard → Ruskin | ~92 | Vineyard ⚠ unstudied |
| 3B | Firgrove Way | Dreyersdal → Starke | overflow | Starke ⚠ unstudied |

**Total at N7 ingress:** 840 vehicles — 100% of peak trips pass through Ruskin Rd / Leyden Rd
**Unstudied segment count:** 9 of 10 last-mile road segments
**Single point of failure:** N7 is the only vehicle ingress. There is no secondary entrance.

---

## Key Observations for Map Design

1. **Every route ends at N7.** The map should make this visually obvious — all roads funnel to one point.
2. **The "last mile" is entirely unstudied.** All Class 5 segments in the convergence zone have zero TIA analysis.
3. **Starke Rd is the dominant last-mile carrier** — serves routes 1A, 2A, 2C, 3B (~470 vehicles in High scenario if all use Starke).
4. **N5 (Starke/Christopher convergence)** is a critical unmarked node — two major streams merge here with no signal, no analysis.
5. **Rat-runs via Vineyard Rd** will activate in High scenario — they hit Ruskin Rd at N11, upstream of N7, adding load to the already-critical ingress segment.
6. **Aristea Rd egress** (N8) is entirely separate from ingress — but the cul-de-sac geometry means queued exit vehicles spill back onto the school site, blocking new ingress. The TIA never modelled this interaction.
