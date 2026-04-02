# WEB COPY

## Modal overlay
### Title: Tokai High School Traffic Simulator

Text: Hi there! As a Bervliet resident, I wanted to visually understand what an additional 800 cars, would do to the suburban streets of Bergvliet. And given that the WCED-commisioned Traffic Impact Assessment <draft> is woefully limited in its scope, I built a thing.

**Disclaimer: I am just a guy, with AI. I am not a traffic-assessor, or have any deep knowledge on traffic flow, stalling phsyics or back-pressure. My AI agents helped with that. They could be wrong. And this is just **one possible scenario**. It's fun and informative, but not definitive in its modelling. Don't use this site to make any life-changing decisions, or say things you might regret to WCED, City of Cape Town or anyone else.

This site is also not formally associated with the Bergvliet Volunteers Association (BVA) https://www.facebook.com/CommunityResponseBergvlietSchool, although I am a member of the Community Response: Tokai School Whatsapp group https://chat.whatsapp.com/J7ooHVb9tdr4n9PLf76wYy?mode=ems_wa_t.

Just be lekker!

## MENU
You can reduce the height of the menu and call it "Tokai-Sim". Menu items should be:
- Simulator 
- Models
- Findings
- Contact

##  SIMULATOR
### Heading: Pick a scenario and watch the traffic wiggle! 
Then include the map and the dashboard stats on the right. They must all fit above the fold.
Although the controls could "hover" " in  the map window, given the map can zoom, they may get in the way. find a smart way to manage this.
Use the map styles and colours from the C:\Users\neill\Github\tokai-sim\design\STYLE_GUIDE.md

Below the map there needs to be a paragraph that reads:
"Tokai-Sim is like a super-realistic video game that lets you watch exactly what happens during the morning school drop-off at Tokai High. It models every car, every slow-down at a speed hump, and every frustrated parent trying to squeeze in a quick drop-off. The heart of the simulation is the Intelligent Driver Model — that decides how close cars follow each other, how fast they accelerate, and when they brake gently instead of slamming on the anchors. 
Hover here to see the key drivers (pun-intended) used from the CTC TIA report.  (on hover show the TIA hover text, but also handle mobile click). There are other assumptions we had to make too. Hover here. (on hover show the model assumptions hover text, but also handle mobile click)

IMPORTANT MODELLING LIMITATION: 
• NO SWEET VALLEY SCHOOL TRAFFIC CONDITIONS ARE MODELLED 
• NO TRAFFIC CONDITIONS FOR EXITING TO FIRGROVE, LADIES MILE OR MAIN RD ARE MODELLED
• 30% "local" traffic has NOT been modelled. While this assumption is unrealistic, we are assuming the "local" students will walk or cycle

## TIA Hover
### Heading: TIA assumptions
• **Cars per hour:** L: 500, M: 650, H: 840 
• **Cars per entryway:** 
  • Children’s Way: 36%
  • Homestead Ave: 30%
  • Firgrove Way: 18%
  • Dreyersdal North: 16%
• **School Drop-offs** 
  • Parking bays: 120 (98 on-site + 22 on-street)
  • Avg stop time: 45 seconds
  • One-way system
  • Traffic circle at Aristea Rd / Ruskin Rd

## Model Assumptions Hover
### Heading: Model paremeters
• **Driving behavour:** 
  • Arterial speed: 60 km/h
  • Collector roads: 40 km/h
  • Local streets: 30 km/h
  • Safe time gap: 1.5 – 2.5 seconds
  • Junction wait: 4–8 seconds (stop signs)
  • Yield gap: 2.5 seconds
• **Driving conditions:** 
  • 11 junctions modelled
  • 28 road signs modelled
  • 4 main entry/exit points have a primary route to the school   
  • Rat-runs trigger at: 6–10% congestion
  • Max rat-run chance: 85% during jams

## MODELS
### The Western Cape Mobility Department (https://www.westerncape.gov.za/mobility) TIA Approach
The official Traffic Impact Assessment (TIA) for Tokai High School follows South Africa’s TMH 16 guidelines. It uses a straightforward, analytical method based on standard traffic engineering formulas (similar to the Highway Capacity Manual). The TIA calculates expected trip numbers, splits them by direction, and checks road and intersection capacity using averaged flows — basically a “worst-case 15-minute peak” snapshot to see if the morning drop-off rush stays within acceptable limits. It gives planners and authorities a reliable, deterministic baseline.

### SUMO & UXsim: Professional Pedigree & Model Validation
We have layered two professional simulation tools with strong academic and industry pedigrees:
**SUMO (Simulation of Urban MObility)**, developed by the German Aerospace Center (DLR), is a world-leading microscopic simulator. It tracks every individual car, using proven car-following mathematics such as the Intelligent Driver Model (IDM). It covers acceleration, braking, reactions to others, the 28 speed humps, the 11 special junctions, and realistic rat-running behaviour.
**UXsim**, created by Dr. Toru Seo at the Institute of Science Tokyo, is a fast, modern macroscopic/mesoscopic simulator. It focuses on overall network flow using fundamental traffic theory (speed-density relationships) and runs large-scale checks quickly. It gives us a “big picture” check against the official Traffic Impact Assessment (TIA) curves and trip-generation numbers.

### TOKAI-SIM
We calibrated Tokai-Sim’s live engine directly to the TIA’s peak-hour volumes, origin splits, and 840-vehicle baseline. SUMO then runs the same network at microscopic level (with all 28 speed humps, 11 junction overrides, and realistic rat-run logic), while UXsim independently validates total network throughput against the TIA’s flow-density curves. The three layers — our IDM live model, SUMO, and UXsim — are deliberately cross-checked so any “what-if” scenario sits on the same mathematical foundation as the professional TIA report.

### Discrepencies between model and why the trend is what matters
Microscopic tools like **SUMO** are stochastic (they include realistic random driver behaviour), while the **TIA** and ***UXsim** use averaged, deterministic flows. This means queue lengths or exact travel times can vary slightly between runs. We validated by running multiple SUMO simulations and comparing the average results to both UXsim and the TIA baselines. The overall trends — where congestion builds, how rat-runs appear, and how the three scenarios (Low/Medium/High) scale — match extremely closely. The small differences you may notice are exactly why we built the “Live vs Results” toggle: it shows you the real-world variability while confirming the big-picture story remains the same.

## FINDINGS
What the Models Say
UXsim analysed all three scenarios using kinematic wave theory — the same mathematics as the TIA. Here is what it found, compared against SUMO’s microscopic simulation.

⚠
Traffic does not clear by 08:30
The TIA assumes all 840 vehicles complete their trips by 08:30 AM. Both SUMO and UXsim show significant residual congestion at 08:30 across all three scenarios. In the High scenario, SUMO records ~480 vehicles still active at 08:29. UXsim confirms continued network loading well past 08:30. The TIA’s clearance assumption is not supported by dynamic modelling.

⏱
Peak congestion hits at 07:45 — not 08:00
The TIA’s own trapezoidal demand profile places 35% of all trips in the 07:30–08:00 window, with the effective peak around 07:45. Both SUMO and the Live engine confirm peak network density at approximately 07:45 AM. The critical window for rat-run activation and junction back-pressure is therefore earlier than the TIA’s "peak 15-minute" analysis suggests.

✓
UXsim and SUMO agree on congestion patterns
Despite operating at different abstraction levels, UXsim and SUMO identify the same roads as highest-stress: the Children’s Way / Dreyersdal approach, the Homestead Ave corridor, and the Aristea Road school frontage. This cross-model agreement strengthens confidence that the congestion picture is real, not an artefact of any single model’s assumptions.

🔀
Rat-runs activate in Medium and High scenarios
SUMO’s dynamic rerouting shows rat-run activity emerging at ~6–10% corridor congestion — consistent with the Live engine’s threshold. In the High scenario, over 30% of inbound vehicles divert via secondary residential streets. UXsim’s network flow confirms the same secondary corridors reach capacity limits, validating that rat-run pressure is a structural feature of the network, not a modelling quirk.

ℹ
What UXsim cannot tell us
UXsim models traffic as flow, not individual cars. It cannot reproduce speed-hump braking events, junction hold behaviour, or individual rat-run decisions. Its role here is network-level validation — confirming that the overall demand exceeds the network’s capacity envelope under TIA assumptions. The Live and SUMO engines carry the detailed behavioural story.

## CONTACT / FOOTER
Created by **Neill Adamson** @geniusboywonder (https://x.com/geniusboywonder). Need some help building with AI? @: nadamson@gmail.com (sendto link)
