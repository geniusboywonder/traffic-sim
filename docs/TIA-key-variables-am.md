# Tokai High School TIA - AM Peak Traffic Modelling Inputs

**Report Reference:** ITS 4839 | Draft | July 2025  
**Site:** Erf 1061, Bergvliet, Cape Town  
**Proposed Development:** Tokai High School – 1,120 learners (Grades 8–12)  
**Focus:** AM Peak Hour only (07:00–08:00)

---

## 1. AM Peak Trip Generation (COTO TMH17 Code 530)

No reduction factors applied (middle to high-income residential area).

| Parameter                  | Value          | Details |
|----------------------------|----------------|---------|
| Number of learners         | 1,120         | Grades 8–12 |
| AM Peak Vehicle Trips      | **840**       | Total two-way |
| Inbound trips              | 420           | 50% split |
| Outbound trips             | 420           | 50% split |

---

## 2. AM Peak Trip Distribution Percentages

### Overall Split
- **30%** – Immediate surrounding residential areas  
- **70%** – External road network  

### External Network Distribution (70% of total AM trips)

| Route / Direction                     | % of Total Development Trips |
|---------------------------------------|------------------------------|
| North along Dreyersdal Road           | 11%                         |
| East along Homestead Avenue           | 21%                         |
| East along Children's Way             | 25%                         |
| South along Dreyersdal Road           | 13%                         |

### Local Residential Distribution (30% of total AM trips)

| Route / Direction                     | % of Total Development Trips |
|---------------------------------------|------------------------------|
| East along Christopher Road           | 4%                          |
| North along Starke Road               | 10%                         |
| South along Starke Road               | 12%                         |
| North along Leyden Road               | 3%                          |
| East along Ruskin Road                | 1%                          |

---

## 3. AM Peak Development Trip Turning Volumes (Figure A12)

| Intersection                          | Key Turning/Approach Volumes (veh/hr)                  |
|---------------------------------------|--------------------------------------------------------|
| 1. Firgrove Way / Dreyersdal Road     | 15, 30, <5, 15, <5, 30                                |
| 2. Ladies Mile Rd / Homestead Ave     | 50 (in), 40, 40, 50 (out)                             |
| 3. Ladies Mile Rd / Children's Way    | 20 (in), 45, 20, 40, 40, 45                           |
| 4. Main Road / Dreyersdal Road        | 25, 30, 30, 25                                        |
| 5. Starke Rd / Christopher Rd         | **310 (in), 50, 310 (out), 40, 40, 50**              |
| 6. Ruskin Rd / Aristea Rd             | **100 (in), 140, 280 (out)**                          |

**Note:** Intersections 5 and 6 receive the highest school-generated loading in the AM peak.

---

## 4. AM Peak Background Traffic Growth

| Parameter              | Value                  | Notes |
|------------------------|------------------------|-------|
| Annual growth rate     | **1.5%** per annum    | Compounded |
| Horizon year           | 2030 (5 years from 2025) | Low-growth residential area |
| Approximate total growth | **~7.7%** over 5 years | Apply to all 2025 base volumes |

---

## 5. AM Peak Base Year (2025 Existing) Volumes & Operations

**Counts conducted:** Tuesday 10 June 2025

| Int. | Intersection                        | LOS | Delay (s) | V/C  | Key Volumes (veh/hr) |
|------|-------------------------------------|-----|-----------|------|----------------------|
| 1    | Firgrove Way / Dreyersdal Road      | A   | 6.8      | 0.49 | Major: 290 NB thru, 410 SB thru<br>Minor: 525 thru, 220 right |
| 2    | Ladies Mile Rd / Homestead Ave      | A   | 4.5      | 0.34 | 310 NB thru, 495 SB thru |
| 3    | Ladies Mile Rd / Children's Way     | B   | 17.6     | 0.34 | 460 thru |
| 4    | Main Road / Dreyersdal Road         | B   | 13.2     | 0.77 | 1,040 NB thru, 830 SB thru |
| 5    | Starke Rd / Christopher Rd          | A   | 8.9      | 0.01 | Very low (<5 per movement) |
| 6    | Ruskin Rd / Aristea Rd              | A   | 9.0      | 0.00 | Very low (<5 per movement) |

---

## 6. AM Peak 2030 Background Operations (After 1.5% Growth)

| Int. | Intersection                        | LOS | Delay (s) | V/C  | Notes |
|------|-------------------------------------|-----|-----------|------|-------|
| 4    | Main Road / Dreyersdal Road         | D   | 32.9     | 1.00 | Capacity reached on critical movement |

(All other intersections remain LOS A or B under background growth.)

---

## 7. AM Peak Site Access & Mitigation

| Item                               | Details |
|------------------------------------|---------|
| Ingress                            | Ruskin Road (at Leyden Road) – ~275 m west of Ruskin/Aristea |
| Egress                             | Aristea Road (cul-de-sac) – ~150 m south of Ruskin/Aristea |
| Internal circulation               | One-way system with on-site drop-off/pick-up (assumes no external queuing) |
| Access design                      | Raised intersections |
| Proposed mitigation                | Mini-roundabout at Ruskin Road / Aristea Road |

---

## 8. AM Peak Model Setup Summary

| Category                     | Value / Setting |
|------------------------------|-----------------|
| **Base Year**                | 2025 |
| **Future Year**              | 2030 |
| **Growth Rate**              | **1.5%** p.a. (~7.7% total) |
| **AM Development Trips**     | **840** veh/hr (420 in / 420 out) |
| **Local vs External Split**  | **30% local** / **70% external** |
| **Heaviest Loaded Int.**     | 5 (Starke/Christopher) & 6 (Ruskin/Aristea) |
| **Critical Int. (without upgrades)** | 4 (Main Road / Dreyersdal) – LOS F in Total scenario |

**Key Modelling Notes (AM Peak):**
- High car dependency assumed.
- 2030 Total scenario modelled **without** planned Main Road (M4) upgrades.
- On-site circulation assumed to contain drop-off activity.

**End of AM Peak Document**  
*Extracted & compiled from TIA ITS 4839 – Tokai High School, Bergvliet (July 2025 Draft)*