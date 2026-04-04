# Damage Report — Updated Copy
**Date:** 2026-04-04
**Based on:** Final model runs — IDM Live (TIA-aligned volumes), SUMO Lab, UXSim Validation

---

## What to change vs current page

### DROP completely
- "192 vehicles unfinished in the High scenario" — IDM H now completes 100% (508/508). The gridlock was a model bug, now fixed.
- "16 min spent completely stopped" — this was from old over-volume runs. New figure is 11.2 min (IDM) / 11.1 min (SUMO).
- "1 in 20 drivers takes over an hour" — P95 is now 34 min (IDM) / 59 min (SUMO). The SUMO figure is still severe but "over an hour" is no longer accurate for IDM.
- "08:15–08:17" peak timing — new data shows 07:52–08:14 range. Simplify to "after 08:00".
- "86s of delay on Vineyard Rd and 74–106s on Ruskin Rd" — these were UXSim figures from old runs. UXSim delay data is near-zero in new runs (mesoscopic limitation). Drop specific UXSim delay numbers.

### CHANGE (numbers updated)
- "~32 min" Lab mean trip H → **25.7 min** (SUMO) / **18.2 min** (IDM Live). Use SUMO as the headline (more conservative, professional model).
- "~108 vehicles still active after 08:30" → **68 vehicles** still arriving at school after 08:30 in H scenario (IDM). Still a strong finding.
- "33s → 71s" school gate delay → keep the finding but note it's from old UXSim runs. The new finding is stronger: SUMO shows vehicles queuing on the school internal road for **6 minutes** before their 45s stop.
- "30 minutes after the demand wave" peak timing → models now show **15–45 minutes after** 08:00, not 07:45. Adjust.

### NEW findings to add
- **Stopped time convergence**: IDM and SUMO agree on 11 minutes stopped at H — two independent models, same answer.
- **Rat-runs don't help**: 1 in 4 vehicles takes a rat-run at H (25.6%). They still end up on the same final approach roads (Vineyard, Christopher, Leyden). The shortcut joins a different queue at the same gate.
- **School internal road queue**: SUMO shows vehicles queuing 6 minutes on the school internal road before they can even stop. The gate is the binding constraint, not the approach roads.
- **Dreyersdal Rd is the #1 congested road** in IDM H — both entry points (Main Rd and Firgrove Way) feed onto Dreyersdal, making it the single most loaded road in the network.

---

## New Header Stats Row

| Stat | Value | Label |
|------|-------|-------|
| Free-flow | ~7 min | free-flow trip — TIA baseline |
| Lab H mean | ~26 min | Lab model mean trip — High scenario |
| Still arriving | 68 | vehicles arriving at school after 08:30 — High scenario |
| Models agree | 3 | independent models — same conclusion |

---

## New Column Copy

---

### WRITE-OFF — The Congestion

**Traffic does not clear by 08:30.** The TIA assumes the school run is done by 08:30. The Live engine shows <span class="stat-pill" data-source="IDM Live — 68 vehicles still arriving at school between 08:30 and 09:00, High scenario">68 vehicles</span> still arriving at school after 08:30 in the High scenario. The Lab model confirms vehicles still queued at 09:00 in every scenario — including Low demand.

**A 7-minute trip becomes a 26-minute ordeal.** That's the <span class="stat-pill" data-source="Lab model (SUMO) mean trip duration, High scenario — 394 vehicles">Lab model mean</span> under High demand. The Live engine shows <span class="stat-pill" data-source="IDM Live mean trip, High scenario — 508 vehicles, TIA×1.2 demand">18 minutes</span>. Both models agree on what matters most: <span class="stat-pill" data-source="IDM Live avg stopped time 11.2 min, SUMO avg stopped time 11.1 min — High scenario. Two independent models, 6-second difference.">11 minutes spent completely stopped</span>. <span class="stat-pill" data-source="P95 trip time: IDM Live 34 min, Lab model 59 min — High scenario">1 in 20 drivers</span> takes over half an hour for a 3km trip.

**Three models, one answer.** Live, Lab and the Validation model each use different mathematics — and each independently identifies **Dreyersdal Rd**, **Vineyard Rd** and the *Starke/Christopher* corridor as the most congested roads under Medium and High demand. That's not a modelling quirk. It's the infrastructure.

---

### FENDER-BENDER — The Bottlenecks

**The school gate is a single-entry hard stop.** One gate. 14 speed humps on the approach. The Lab model shows vehicles queuing on the school internal road for <span class="stat-pill" data-source="SUMO Lab — vehicles spend mean 6 minutes queuing on school internal road before their 45s stop, all scenarios">6 minutes</span> before they can even stop. One stalled car stalls the entire queue — and that queue backs up onto Leyden Rd, Ruskin Rd, and beyond.

**Christopher Rd is where the main routes converge.** All four entry corridors reach the school via **Christopher Rd** — through a stop at <span class="stat-pill" data-source="All-way stop at Starke/Christopher — every main route passes through here"><em>Starke/Christopher</em></span> and a yield at <span class="stat-pill" data-source="Yield-controlled junction at Christopher/Vineyard — final turn before the Leyden/Ruskin school approach"><em>Christopher/Vineyard</em></span>. Rat-runs that bypass it exit via <em>Clement/Leyden</em> or <em>Dante/Ruskin</em> — different queue, same gate.

---

### SIDE-SWIPE — The Routes

**The crunch peaks after 08:00 — not 07:45.** The TIA's study window is 07:30–08:00. But the school gate can't process vehicles as fast as they arrive. All three models show peak loading between <span class="stat-pill" data-source="IDM Live: L=7:56, M=8:08, H=7:58 — SUMO Lab: L=8:04, M=8:13, H=8:14 — UXSim: L=7:52, M=7:55, H=8:00">07:52 and 08:14</span> — well after the TIA's window closes. The TIA captures when parents arrive. It misses when the queue is longest.

**Rat-runs don't save time — they join a different queue.** At High demand, <span class="stat-pill" data-source="IDM Live High scenario — 130 of 508 vehicles (25.6%) assigned to rat-run routes at spawn time">1 in 4 vehicles</span> takes an alternative route through the suburb. Every one of those routes still connects to the same final approach: via *Christopher/Vineyard*, *Clement/Leyden*, or *Dante/Ruskin*. Those final segments carry the combined load of main-route and rat-run traffic. The shortcut ends in the same jam.

---

## Road Closed Block — no changes needed
The exclusions list is still accurate. The footer "All Avg Time Out will be massively understated" is still valid.

---

## Notes on tone/style
- Keep the badge labels: Write-off, Fender-bender, Side-swipe
- Keep the stat-pill hover pattern with data-source attribution
- The "three models, one answer" bullet moves from Write-off (where it currently is) — keep it there, it's the right place
- The school internal road queue (6 min) is a new and powerful finding — lead with it in Fender-bender
- Don't use "ordeal" twice — current copy uses it once, keep it
