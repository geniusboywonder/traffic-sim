# Tokai High School Traffic Simulator — Geocoded Road Network

## 1. Core Network Nodes (Intersections)

| Node ID | Description | Lat | Lon |
|---|---|---|---|
| N1 | Main Rd / Dreyersdal Rd | -34.0508 | 18.4605 |
| N2 | Dreyersdal Rd / Firgrove Way | -34.0482 | 18.4635 |
| N3 | Ladies Mile Rd / Children’s Way | -34.0529 | 18.4685 |
| N4 | Ladies Mile Rd / Homestead Ave | -34.0520 | 18.4660 |
| N5 | Starke Rd / Christopher Rd | -34.0495 | 18.4628 |
| N6 | Ruskin Rd / Aristea Rd | -34.0502 | 18.4598 |
| N7 | Ruskin Rd / Leyden Rd (INGRESS) | -34.0505 | 18.4575 |
| N8 | Aristea Rd cul-de-sac (EGRESS) | -34.0522 | 18.4595 |
| N9 | Starke Rd / Ruskin Rd | -34.0498 | 18.4588 |
| N10 | Christopher Rd / Ruskin Rd | -34.0492 | 18.4592 |
| N11 | Vineyard Rd / Ruskin Rd | -34.0507 | 18.4585 |
| N12 | Vineyard Rd / Dreyersdal Rd | -34.0488 | 18.4615 |

---

## 2. Road Segments (Edges)

### Primary / Arterial Feeders

| Edge ID | From → To | Road | Class | Notes |
|---|---|---|---|---|
| E1 | N1 → N2 | Dreyersdal Rd (north) | Collector | External flow |
| E2 | N2 → N1 | Dreyersdal Rd (south) | Collector | External flow |
| E3 | N3 → N4 | Ladies Mile Rd | Arterial | East-west feeder |
| E4 | N4 → N3 | Ladies Mile Rd | Arterial | Reverse |
| E5 | N1 → South | Main Rd | Arterial | Boundary |
| E6 | North → N1 | Main Rd | Arterial | Boundary |

---

### Secondary Feeders

| Edge ID | From → To | Road |
|---|---|---|
| E7 | N4 → N9 | Homestead Ave → Starke |
| E8 | N3 → N5 | Children’s Way → Christopher |
| E9 | N2 → N12 | Firgrove Way → Vineyard |

---

### Critical “Last Mile” Network

| Edge ID | From → To | Road | Role |
|---|---|---|---|
| E10 | N9 → N7 | Starke Rd → Ruskin | Major funnel |
| E11 | N5 → N10 | Christopher Rd | Secondary funnel |
| E12 | N10 → N7 | Ruskin Rd (east) | Final merge |
| E13 | N11 → N7 | Vineyard shortcut | Rat-run ingress |
| E14 | N7 → SCHOOL | Ruskin Rd ingress | 100% inflow |
| E15 | SCHOOL → N8 | Aristea Rd egress | 100% outflow |
| E16 | N8 → N6 | Aristea Rd northbound | Exit path |

---

### Rat-Run / Overflow Network

| Edge ID | From → To | Road | Trigger |
|---|---|---|---|
| E17 | N6 → Dante Rd south | Dante Rd | Egress overflow |
| E18 | Dante Rd → Airlie Rd | Airlie connector | Shortcut |
| E19 | Airlie Rd → Aristea Rd | Loop-back | Grid spread |
| E20 | N12 → N11 | Vineyard Rd | Ingress bypass |
| E21 | Homestead → Protea/Clement | Grid | East overflow |

---

## 3. Origin Injection Points

| Origin | Node | % | Vehicles (840) |
|---|---|---|---|
| North (Dreyersdal) | N2 | 11% | 92 |
| South (Dreyersdal via N1) | N1 | 13% | 109 |
| Homestead Ave | N4 | 21% | 176 |
| Children’s Way | N3 | 25% | 210 |
| Starke North | N9 | 10% | 84 |
| Starke South | N9 | 12% | 101 |
| Christopher Rd | N5 | 4% | 34 |
| Leyden Rd | N7 | 3% | 25 |
| Ruskin East | N10 | 1% | 8 |

---

## 4. Minimal Graph JSON

```json
{
  "nodes": [
    {"id":"N1","lat":-34.0508,"lon":18.4605},
    {"id":"N7","lat":-34.0505,"lon":18.4575},
    {"id":"N8","lat":-34.0522,"lon":18.4595}
  ],
  "edges": [
    {"id":"E10","from":"N9","to":"N7","capacity":600},
    {"id":"E12","from":"N10","to":"N7","capacity":400},
    {"id":"E14","from":"N7","to":"SCHOOL","capacity":500},
    {"id":"E15","from":"SCHOOL","to":"N8","capacity":500}
  ]
}
```

---

## 5. Structural Insight

- 100% convergence at Ruskin Rd (N7)
- 70% of traffic flows through local streets
- Funnel topology → high risk of upstream failure
