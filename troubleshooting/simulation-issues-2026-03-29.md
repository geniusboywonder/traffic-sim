# Simulation Issue Analysis — 2026-03-29

**Source log:** `traffic-sim-log-2026-03-29T18-10-55.csv` (13,636 events, 648 vehicles)

---

## Issue 1 — J4 (Starke Rd / Christopher Rd) `priority_stop` Caps Throughput at 450 veh/hr

**Junction:** J4 — Starke Rd / Christopher Rd
**Control type:** `priority_stop` (8s minimum inter-vehicle gap)
**Max throughput:** 3600 / 8 = 450 veh/hr
**Required throughput:** 840 veh/hr (TIA spec)

**Evidence from log:**
- 468 of 803 total junction holds (58%) are at J4
- 221 of 648 vehicles (34%) never reach the school gate
- Average gate inter-arrival: 14.3s (expected 4.3s) → throughput only 252 veh/hr
- Early gaps at J7 arrivals from simTime 2600 (7:13 AM), before peak

**Impact:** All four inbound corridors (1A, 2A, 2B, 3A) converge through J4. The 8s hold throttles the entire network.

**Fix:** Change J4 from `priority_stop` to `stop` (4s gap → max 900 veh/hr, matching spec).

---

## Issue 2 — `parkingType` Never Assigned → Occupancy Always Zero

**Evidence from log:**
- Every `DWELL_START` event reports `onSite=0/98 onStreet=0/22` (427 observations)
- `isFull` never returns `true` → gate parking-full block never fires

**Root cause:** The dwell transition in `SimMap.jsx` sets `v.state='dwell'` but never assigns `v.parkingType`. `getParkingOccupancy()` filters on `v.parkingType === 'on-site'` — no assignment means it always counts zero.

**Fix:** Assign `v.parkingType` at the dwell transition in the `isParking` block, before the log call:
```js
v.parkingType = pk.onSite < 98 ? 'on-site' : 'on-street';
```

---

## Issue 3 — 121 Vehicles Stranded on Egress at Simulation End

**Evidence from log:**
- 427 `OUTBOUND_START` events, 306 `EGRESS_COMPLETE` → 121 vehicles (28%) never exit
- All worst delays (2000s+) are on EG-A/B/C/D egress routes
- Stuck vehicles show `DELAY_START` with `jIdx=4, holdAt=none` (physics jam, not junction hold)

**Root cause:** The sim ends at t=7200 (8:30 AM) but the egress queue from the peak wave hasn't drained. Vehicles are physically queued on egress roads and simply run out of time.

**Fix:** Extend sim end from `t >= 7200` to `t >= 9000` (9:00 AM), giving 30 extra minutes for the egress queue to clear.

---

## Issue 4 — `DELAY_END` Never Fires for Slow-Moving Queued Vehicles

**Evidence from log:**
- 186 vehicles have `DELAY_START` with no `DELAY_END`
- Threshold requires `v.v >= 2 m/s` — vehicles crawling in a queue (0.5–1.5 m/s) never clear the flag

**Fix:** Lower `DELAY_END` speed threshold from `v.v >= 2` to `v.v >= 0.5` m/s in `SimMap.jsx`.

---

## Issue 5 — Ruskin/Aristea Roundabout (J29) Missing from Map

**Junction:** J29 — Ruskin Rd / Aristea Rd — roundabout
**Control type:** `roundabout_planned`

**Root cause:** J29 is not included in `VISIBLE_JUNCTIONS` in `routes.js`. The array `[1, 4, 5, 6, 7, 8, 9, 10, 13, 18, 20, 26, 28]` omits J29, so no marker is ever created.

**Fix:** Add `29` to `VISIBLE_JUNCTIONS`.

---

## Summary Table

| # | Junction/File | Issue | Severity | Fix |
|---|---|---|---|---|
| 1 | J4 `routes.js` | `priority_stop` 8s gap throttles all inbound to 450/hr | **Critical** | Change to `stop` (4s gap) |
| 2 | `SimMap.jsx` | `parkingType` never set → occupancy always 0 | **Critical** | Assign at dwell transition |
| 3 | `SimMap.jsx` | Sim ends before egress queue drains | High | Extend end from 7200s→9000s |
| 4 | `SimMap.jsx` | `DELAY_END` threshold too high for creeping queues | Medium | Lower from 2 m/s → 0.5 m/s |
| 5 | `routes.js` | J29 roundabout circle not rendered | Low | Add 29 to `VISIBLE_JUNCTIONS` |
