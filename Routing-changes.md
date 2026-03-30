These changes need to be noted on the simulation-data.json.
I assume `yield` is not for regular right turn that require for the road to be clear before turinng or for natural t-junctions. Let me know if this is not true.

Junctions:
| no | Intersection | control | explanation
| 2 | Dreyersdal Rd / Dreyersdal Farm Rd | yield |  only when coming from Dreyersdal Farm Rd (egress). Not from Dreyersdal Rd onto Dreyersdal Farm Rd
| 3 | Dreyersdal Farm Rd / Starke Rd south | yield | only when coming from Starke Rd south (egress). Not from Dreyersdal Farm Rd onto Starke Rd
| 22 | Starke Rd / Airlie Rd | stop_directional | only when coming from Starke onto Airlie in both directions. Not from Airlie onto Starke.
| 4 | Starke Rd / Christopher Rd | priority_stop | only when traveling up or down Christopher. Starke Rd remains stop free.
| 18 | Dreyersdal Rd / Christopher Rd east | yield | no yield here. but it is a T-junction from Chistopher onto Dreysersdal
| 16 | Dante Rd / Vineyard Rd | stop | t junction. stop only when coming from Dante onto Vineyard. Not from Vineyard onto Dante.
| 17 | Dante Rd / Ruskin Rd | yield | t junction. stop only when coming from Ruskin onto Dante. Not from Dante onto Ruskin.
| 7 | School Ingress — Leyden Rd / Ruskin Rd | critical | must apply if cars are entering via Ruskin or via Leyden.
| 23 | Tussendal Avenue / Airlie Rd | yield | t junction. yield only when coming from Tussendal onto Airlie. Not from Airlie onto Tussendal.
| 14 | Airlie Rd south / Dante Rd south | yield | there is no yield here at all.
| 21 | Dreyersdal Farm Rd / Tussendal Avenue | yield | there is no yield here at all.
| 19 | Vineyard Rd east / Airlie Rd | yield | t junction. no formal yield only from Vineyard into Arilie. Not from Airlie into Vineyard.
| 24 | Starke Rd / Clement Rd | stop | only from Clement onto Starke. Not from Starke onto Clement.
| 25 | Clement Rd / Leyden Rd | yield | no yield here. but it is a T-junction from Clement onto Leyden.
| 6 | Vineyard Rd / Leyden Rd | yield | no yield here. but it is a T-junction from Vineyard to Leyden
| 12 | Starke Rd north / Firgrove Rd | merge | this is actually Firgrove Service Rd
