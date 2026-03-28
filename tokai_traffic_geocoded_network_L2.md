# Tokai High School Traffic Simulator — Geocoded Road Network (Level 2)

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

## 2. Road Segments with Level 2 Attributes

| Edge ID | Road | From → To | Lanes | Speed (km/h) | Capacity (veh/hr) | Priority | Notes |
|---|---|---|---|---|---|---|---|
| E1 | Dreyersdal Rd | N1→N2 | 1 | 50 | 900 | Medium | Collector |
| E2 | Dreyersdal Rd | N2→N1 | 1 | 50 | 900 | Medium | Collector |
| E3 | Ladies Mile Rd | N3→N4 | 2 | 60 | 1800 | High | Arterial |
| E4 | Ladies Mile Rd | N4→N3 | 2 | 60 | 1800 | High | Arterial |
| E5 | Main Rd | Ext→N1 | 1 | 60 | 1200 | High | Arterial |
| E6 | Main Rd | N1→Ext | 1 | 60 | 1200 | High | Arterial |
| E7 | Homestead Ave | N4→N9 | 1 | 40 | 600 | Low | Local |
| E8 | Children’s Way | N3→N5 | 1 | 40 | 600 | Low | Local |
| E9 | Firgrove Way | N2→N12 | 1 | 50 | 900 | Medium | Collector |
| E10 | Starke Rd | N9→N7 | 1 | 30 | 500 | Low | Funnel |
| E11 | Christopher Rd | N5→N10 | 1 | 30 | 500 | Low | Funnel |
| E12 | Ruskin Rd | N10→N7 | 1 | 30 | 400 | Critical | Merge |
| E13 | Vineyard Rd | N11→N7 | 1 | 30 | 300 | Low | Shortcut |
| E14 | Ruskin Rd | N7→School | 1 | 20 | 350 | Critical | Ingress |
| E15 | Aristea Rd | School→N8 | 1 | 20 | 350 | Critical | Egress |
| E16 | Aristea Rd | N8→N6 | 1 | 30 | 400 | Low | Exit |
| E17 | Dante Rd | N6→South | 1 | 30 | 300 | Low | Overflow |
| E18 | Airlie Rd | Dante→Aristea | 1 | 30 | 300 | Low | Connector |
| E19 | Airlie Rd | Aristea→Dante | 1 | 30 | 300 | Low | Connector |
| E20 | Vineyard Rd | N12→N11 | 1 | 30 | 300 | Low | Bypass |

---

## 3. Turn Rules & Control

| Node | Type | Rules |
|---|---|---|
| N1 | Priority | Main Rd priority, right-turn delay |
| N3 | Signal | Controlled intersection |
| N4 | Stop | Minor stop |
| N5 | Stop | All-way |
| N7 | Stop (critical) | Ingress bottleneck |
| N6 | Roundabout (planned) | Flow smoothing |

---

## 4. Queue & Conflict Zones

| Location | Type | Effect |
|---|---|---|
| Ruskin Rd (N7) | Merge + Drop-off | Queue growth |
| Aristea Rd (N8) | Cul-de-sac | Exit delay |
| Starke Rd | Funnel | Back-propagation |
| Christopher Rd | Funnel | Spillback |
| Main/Dreyersdal | Signal delay | System constraint |

---

## 5. Demand Injection

| Node | Vehicles/hr |
|---|---|
| N2 | 92 |
| N1 | 109 |
| N4 | 176 |
| N3 | 210 |
| N9 | 185 |
| N5 | 34 |
| N7 | 25 |
| N10 | 8 |

---

## 6. Simulation Notes

- Single-lane local roads → no overtaking
- Queue propagation must be backward
- Capacity drops cascade upstream
- Critical failure originates at N7

---

## 7. Extended Graph JSON (Level 2)

```json
{
  "edges":[
    {"id":"E14","capacity":350,"speed":20,"lanes":1},
    {"id":"E10","capacity":500,"speed":30,"lanes":1},
    {"id":"E11","capacity":500,"speed":30,"lanes":1}
  ],
  "nodes":[
    {"id":"N7","type":"critical"},
    {"id":"N1","type":"signal"}
  ]
}
```
