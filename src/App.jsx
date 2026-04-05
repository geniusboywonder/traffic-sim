import { useState, useCallback, useRef, useEffect } from 'react';
import { PersonStanding, Database, Activity, FileText, Search, Info, AlertTriangle, Clock, CheckCircle, Split, Car, Play, Monitor, Timer, Map, Bot, OctagonX, ChevronUp, ChevronDown, Share2, Mail, X } from 'lucide-react';

import Header from './components/Header';
import SimMap from './components/SimMap';
import StatsPanel from './components/StatsPanel';
import AdSlot from './components/AdSlot';
import { SmokeBackground } from './components/SmokeBackground';
import { AccessBarrier } from './components/AccessBarrier';
import { PlaybackSource } from './engine/playback';
import './App.css';

function formatClock(simTime) {
  const totalSec  = Math.floor(simTime ?? 0);
  const baseMin   = 6 * 60 + 30;
  const totalMin  = baseMin + Math.floor(totalSec / 60);
  const hours24   = Math.floor(totalMin / 60) % 24;
  const mins      = totalMin % 60;
  const h12       = hours24 % 12 || 12;
  const ampm      = hours24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
}

function fmtTime(minutes) {
  if (!minutes || minutes === 0) return '—';
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const INITIAL_STATS = {
  corridors: {
    '3A': { label: 'Firgrove Way',     current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
    '2A': { label: 'Homestead Av',     current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
    '2B': { label: "Children's Way",   current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
    '1A': { label: 'Main Rd',  current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
  },
  parking: { onSite: 0, onStreet: 0 }
};

const BentoBriefing = () => {
  const [tiaOpen, setTiaOpen] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);

  return (
    <section className="bento-briefing" id="briefing">
      <div className="bento-content">
        <div className="narrative-block">
          <div className="narrative-item">
            <h3 className="narrative-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Map size={14} color="var(--c-3a)" />
              Under the Hood
            </h3>
            <p className="narrative-text-large">
              Traff<span>✱</span>k is the dashcam you never knew you needed for Tokai's morning rush.
            </p>
          </div>
          <div className="narrative-item">
            <p className="narrative-text-medium">
              It models every car, every slow-down at a speed hump, and every frustrated parent trying to squeeze in a quick drop-off. The heart of the simulation is the Intelligent Driver Model — that decides how close cars follow each other, how fast they accelerate, and when they brake gently instead of slamming on the anchors.
            </p>
            <p className="narrative-text-body" style={{ textAlign: 'justify', maxWidth: 'none' }}>
              The model uses a "main route" for each entry / exit corridor from Firgrove Way, Homestead Av, Children's Way and Main Rd. This is the route most cars will follow — until traffic starts to build up. Then cars will find and follow multiple rat-runs to the school. The model attempts to avoid the normal Sweet Valley routes at the top of Dreyersdal Rd and exiting via Homestead.
            </p>
          </div>
        </div>

        <div className="tech-hub-block">
          <div className="meta-hovers-box">
            <div className={`hover-trigger interactive-card ${tiaOpen ? 'active' : ''}`} onClick={() => setTiaOpen(!tiaOpen)}>
              <div className="card-front" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <FileText size={18} style={{ marginRight: '0.5rem' }} />
                  The TIA Highway Code
                </div>
                {tiaOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              <div className="card-back">
                <div className="popover-card">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={14} />
                    The TIA Highway Code
                  </h4>
                  <ul className="popover-list">
                    <li>• <strong>Inbound vehicles:</strong> L: 336, M: 420, H: 504</li>
                    <li>• <strong>Cars per entryway:</strong> Children's Way: 47% | Homestead Av: 25% | Main Rd (Dreyersdal South): 14% | Firgrove Way (Dreyersdal North + Starke): 14%</li>
                    <li>• <strong>School Drop-offs:</strong> 120 bays (98 on-site + 22 on-street)</li>
                    <li>• <strong>Avg stop time:</strong> 45 seconds | One-way system | Aristea Traffic Circle</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className={`hover-trigger interactive-card ${specsOpen ? 'active' : ''}`} onClick={() => setSpecsOpen(!specsOpen)}>
              <div className="card-front" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Search size={18} style={{ marginRight: '0.5rem' }} />
                  Engine Specs
                </div>
                {specsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              <div className="card-back">
                <div className="popover-card">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={14} />
                    Engine Specs
                  </h4>
                  <ul className="popover-list">
                    <li>• <strong>Speeds:</strong> Arterial: 60 | Collector: 40 | Local: 30</li>
                    <li>• <strong>Safety:</strong> 1.5 – 2.5s safe gap | 2.5s yield gap</li>
                    <li>• <strong>Scale:</strong> 11 junctions & 28 road signs</li>
                    <li>• <strong>Logic:</strong> Rat-runs trigger at 6–15% congestion | 85% chance</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

const ModelsSection = () => (
  <section className="models-section" id="models">
    <div className="models-grid">

      <div className="models-header">
        <span className="models-subtitle">Under the Hood</span>
        <h2 className="models-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity size={48} color="var(--c-3a)" />
          Road Tested
        </h2>
      </div>

      <div className="models-intro">
        <p>Three independent models. One consistent conclusion. Here's how we built them — and why you can trust what they show.</p>
      </div>

      <div className="models-content">

        <div className="model-entry">
          <span className="model-chain-badge">1</span>
          <div className="model-entry-body">
            <h3>The Foundation — The Official TIA</h3>
            <p>The Traffic Impact Assessment (TIA) is the starting point — and the rulebook. Commissioned under Western Cape Mobility Department <a href="https://www.westerncape.gov.za/mobility" target="_blank" className="editorial-link">(WCMD)</a> guidelines and following South Africa's TMH 16 standard, it sets the study area's trip counts, directional splits, and the 840-vehicle High scenario demand baseline. The TIA's method is analytical: standardised traffic engineering formulas applied to the worst-case 15-minute peak window. It's a snapshot, not a simulation — but that snapshot defines the problem.</p>
          </div>
        </div>

        <div className="model-entry">
          <span className="model-chain-badge">2</span>
          <div className="model-entry-body">
            <h3>Our Live Simulation</h3>
            <p>The interactive engine running on your screen is calibrated directly to the TIA's figures — same trip volumes, same origin splits, same peak-hour demand curve peaking at 07:45. It then goes where the TIA cannot: every vehicle moves individually using the Intelligent Driver Model (IDM), the same car-following mathematics used by professional-grade simulators. Speed humps, junction holds, rat-run decisions, school dwell time — all modelled car by car, second by second.</p>
          </div>
        </div>

        <div className="model-entry">
          <span className="model-chain-badge">3</span>
          <div className="model-entry-body">
            <h3>Lab — Professional Cross-Check</h3>
            <p>Once we had a live model, we needed an independent referee. The Lab model runs on SUMO (Simulation of Urban MObility), developed by the German Aerospace Center (DLR) — one of the world's most widely used microscopic traffic simulators, trusted by governments, universities, and transport authorities globally. The Lab model's outputs closely match our Live engine across all three scenarios. That agreement is the institutional stamp on our custom model.</p>
          </div>
        </div>

        <div className="model-entry">
          <span className="model-chain-badge">4</span>
          <div className="model-entry-body">
            <h3>Validation — Network-Level Confirmation</h3>
            <p>UXSim (developed by Dr. Toru Seo, Institute of Science Tokyo) operates at a different level — mesoscopic, modelling traffic as flow rather than individual cars. Its mathematics are kinematic wave theory: the same language the TIA uses for its capacity calculations. This is why UXSim is uniquely useful here: it doesn't replace the Lab model or our Live engine, it audits them from the network level.</p>
          </div>
        </div>

        <div className="model-entry model-entry--row3-left">
          <span className="model-chain-badge">5</span>
          <div className="model-entry-body">
            <h3>Reading the Instruments</h3>
            <p>Our Live engine and the Lab model are stochastic — each run includes realistic random variation in driver behaviour, so exact numbers shift slightly between runs. The TIA and UXSim use deterministic, averaged flows, so they always return the same result. Our Live engine also adds layers the others don't: dynamic egress holds at the Ladies Mile signal during peak, dwell time at the school, and real-time rat-run activation based on live congestion.</p>
          </div>
        </div>

        <div className="model-entry model-entry--ad">
          <AdSlot variant="rectangle" />
        </div>

      </div>

      <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '2rem' }}>
        <AdSlot />
      </div>

    </div>
  </section>
);

const FindingsSection = () => (
  <section className="findings-section" id="findings">
    <div className="findings-grid">

      <div className="findings-header">
        <span className="models-subtitle">Incident Report</span>
        <h2 className="models-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Monitor size={40} color="var(--c-3a)" />
          The Damage Report
        </h2>
        <div className="findings-stats-row">
          <div className="findings-stat">
            <span className="findings-stat-num">~7 min</span>
            <span className="findings-stat-label">free-flow trip — TIA baseline</span>
          </div>
          <div className="findings-stat findings-stat--alert">
            <span className="findings-stat-num">~26 min</span>
            <span className="findings-stat-label">Lab model mean trip — High scenario</span>
          </div>
          <div className="findings-stat findings-stat--alert">
            <span className="findings-stat-num">68</span>
            <span className="findings-stat-label">vehicles still arriving at school after 08:30 — High scenario</span>
          </div>
          <div className="findings-stat findings-stat--alert">
            <span className="findings-stat-num">3</span>
            <span className="findings-stat-label">independent models — same conclusion</span>
          </div>
        </div>
      </div>

      <div className="findings-columns">

        {/* WRITE-OFF */}
        <div className="findings-col findings-col--writeoff">
          <div className="findings-col-top">
            <span className="findings-badge findings-badge--writeoff">Write-off</span>
            <h3 className="findings-col-heading">The Congestion</h3>
            <AlertTriangle size={16} color="#8B1A1A" style={{flexShrink:0}} />
          </div>
          <ul className="findings-bullets">
            <li><strong>Traffic does not clear by 08:30.</strong> The TIA assumes the school run is done by 08:30. The Live engine shows <span className="stat-pill" data-source="IDM Live — 68 vehicles still arriving at school between 08:30 and 09:00, High scenario">68 vehicles</span> still arriving at school after 08:30 in the High scenario. The Lab model confirms vehicles still queued at 09:00 in every scenario — including Low demand.</li>
            <li><strong>A 7-minute trip becomes a 26-minute ordeal.</strong> That's the <span className="stat-pill" data-source="Lab model (SUMO) mean trip duration, High scenario — 394 vehicles, TIA-aligned volumes">Lab model mean</span> under High demand. The Live engine shows <span className="stat-pill" data-source="IDM Live mean trip, High scenario — 508 vehicles, TIA×1.2 demand">18 minutes</span>. Both models agree on what matters most: <span className="stat-pill" data-source="IDM Live avg stopped 11.2 min, SUMO avg stopped 11.1 min — High scenario. Two independent models, 6-second difference.">11 minutes spent completely stopped</span>. <span className="stat-pill" data-source="P95 trip time: IDM Live 34 min, Lab model 59 min — High scenario">1 in 20 drivers</span> takes over half an hour for a 3km trip.</li>
            <li><strong>Three models, one answer.</strong> Live, Lab and the Validation model each use different mathematics — and each independently identifies <strong>Dreyersdal Rd</strong>, <strong>Vineyard Rd</strong> and the <em>Starke/Christopher</em> corridor as the most congested roads in Medium and High demand. That's not a modelling quirk. It's the infrastructure.</li>
          </ul>
        </div>

        {/* FENDER-BENDER */}
        <div className="findings-col findings-col--fender">
          <div className="findings-col-top">
            <span className="findings-badge findings-badge--fender">Fender-bender</span>
            <h3 className="findings-col-heading">The Bottlenecks</h3>
            <Clock size={16} color="#A05E3D" style={{flexShrink:0}} />
          </div>
          <ul className="findings-bullets">
            <li><strong>The school gate is a single-entry hard stop.</strong> One gate. 14 speed humps on the approach. The Lab model shows vehicles spending <span className="stat-pill" data-source="SUMO Lab — vehicles spend mean 6 minutes on the school internal road, crawling bumper-to-bumper at walking pace (0.6 km/h vs 5 km/h free-flow) while bays fill and empty. All scenarios.">6 minutes on the school internal road</span> — crawling bumper-to-bumper at walking pace while waiting for a drop-off bay. The 45-second stop is embedded inside that crawl. One stalled car stalls the entire queue.</li>
            <li><strong>Christopher Rd is where the main routes converge.</strong> All four entry corridors reach the school via <strong>Christopher Rd</strong> — through a stop at <span className="stat-pill" data-source="All-way stop at Starke/Christopher — every main route passes through here"><em>Starke/Christopher</em></span> and a yield at <span className="stat-pill" data-source="Yield-controlled junction at Christopher/Vineyard — final turn before the Leyden/Ruskin school approach"><em>Christopher/Vineyard</em></span>. Rat-runs that bypass it exit via <em>Clement/Leyden</em> or <em>Dante/Ruskin</em> — different queue, same gate.</li>
            <li><strong>Aristea Rd is the only way out.</strong> Every vehicle leaving the school must exit via <strong>Aristea Rd</strong> onto the Ruskin/Aristea roundabout — there is no alternative. From there every exiting vehicle turns onto <strong>Dante Rd</strong> first, making it a structural pinch point regardless of which exit they're heading for.</li>
          </ul>
        </div>

        {/* SIDE-SWIPE */}
        <div className="findings-col findings-col--sideswipe">
          <div className="findings-col-top">
            <span className="findings-badge findings-badge--sideswipe">Side-swipe</span>
            <h3 className="findings-col-heading">The Routes</h3>
            <CheckCircle size={16} color="var(--c-3a)" style={{flexShrink:0}} />
          </div>
          <ul className="findings-bullets">
            <li><strong>The crunch peaks after 08:00 — not 07:45.</strong> The TIA's window is 07:30–08:00. But the school gate can't process vehicles as fast as they arrive. All three models show peak loading between <span className="stat-pill" data-source="IDM Live: L=7:56, M=8:08, H=7:58 — SUMO Lab: L=8:04, M=8:13, H=8:14 — UXSim Validation: L=7:52, M=7:55, H=8:00">07:52 and 08:14</span> — well after the TIA's window closes. The TIA captures when parents arrive. It misses when the queue is longest.</li>
            <li><strong>Rat-runs don't save time — they join a different queue.</strong> At High demand, <span className="stat-pill" data-source="IDM Live High scenario — 130 of 508 vehicles (25.6%) assigned to rat-run routes. Top route: Starke→Vineyard→Ruskin (5.5% of all vehicles).">1 in 4 vehicles</span> takes an alternative route through the suburb. Every one of those routes still connects to the same final approach: via <em>Christopher/Vineyard</em>, <em>Clement/Leyden</em>, or <em>Dante/Ruskin</em>. Those final segments carry the combined load of main-route and rat-run traffic. The shortcut ends in the same jam.</li>
            <li><strong>Exiting is no easier.</strong> <strong>Dante Rd</strong> is the first turn every vehicle makes leaving the school — every egress route starts there. From Dante, 4 of 5 routes pass through <strong>Vineyard Rd</strong>. <span className="stat-pill" data-source="IDM Live — Vineyard Rd outbound, 6 vehicles stopped simultaneously at peak 08:17, High scenario. Inbound and outbound traffic competing for the same road.">Vineyard Rd backs up at 08:17</span> under High demand — inbound parents still arriving, outbound parents trying to leave, on the same residential road.</li>
          </ul>
        </div>

        {/* AD CARD */}
        <div className="findings-col findings-col--ad">
          <AdSlot variant="rectangle" />
        </div>

      </div>

      <div className="road-closed-block" style={{ marginTop: '4rem' }}>
        <div className="road-closed-header">
          <OctagonX size={26} strokeWidth={3} />
          <span>✕ &nbsp;ROAD CLOSED&nbsp; ✕</span>
          <OctagonX size={26} strokeWidth={3} />
        </div>
        <p className="road-closed-intro">Everything shown is <strong>inbound school traffic only.</strong> This modelling EXCLUDES:</p>
        <ul className="road-closed-list">
          <li><span className="stat-pill stat-pill--dark" data-source="Sweet Valley Primary is ~200m away. Their school-run parents use the same roads and are entirely unmodelled.">Sweet Valley Primary school runs</span></li>
          <li><span className="stat-pill stat-pill--dark" data-source="All non-school trips through the study area — commuters, local errands, other school runs — are excluded. These roads carry far more than Tokai High traffic alone.">All Bergvliet residents local traffic movements to work, school and university</span></li>
          <li><span className="stat-pill stat-pill--dark" data-source="Post drop-off vehicles leaving via Firgrove Rd, Ladies Mile Rd and Main Rd create a counter-flow on the same streets. None of this is modelled. Real congestion will be worse.">ALL traffic *exiting* to Firgrove Rd, Ladies Mile Rd and Main Rd</span></li>
          <li><span className="stat-pill stat-pill--dark" data-source="The TIA proposes calming on rat-run routes. Excluding these means modelled rat-run speeds may be slightly faster than reality — which would make congestion slightly worse than shown.">New essential traffic calming measures in Dante Rd, Vineyard Rd, Ruskin Rd, Leyden Rd</span></li>
        </ul>
        <p className="road-closed-footer">All <strong>Avg Time Out</strong> will be <strong>massively understated</strong> based on the above.</p>
      </div>

    </div>
  </section>
);

const Footer = () => (
  <footer className="site-footer" id="contact">
    <div className="footer-content">
      <div className="footer-brand">
        <h2>Traff<span>✱</span>k</h2>
        <p className="footer-slogan">"putting you in the driving seat"</p>
      </div>

      <div className="footer-oss">
        <p>Made possible by open-source contributions from:</p>
        <div className="oss-links">
          <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>
          <span className="oss-sep">•</span>
          <a href="https://eclipse.dev/sumo/" target="_blank" rel="noopener noreferrer">SUMO</a>
          <span className="oss-sep">•</span>
          <a href="https://toruseo.jp/UXsim/docs/" target="_blank" rel="noopener noreferrer">UXSim</a>
          <span className="oss-sep">•</span>
          <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
          <span className="oss-sep">•</span>
          <a href="https://geojson.io/" target="_blank" rel="noopener noreferrer">geojson.io</a>
          <span className="oss-sep">•</span>
          <a href="https://overpass-turbo.eu/" target="_blank" rel="noopener noreferrer">Overpass Turbo</a>
          <span className="oss-sep">•</span>
          <a href="https://www.shadcn.io/" target="_blank" rel="noopener noreferrer">shadcn/ui</a>
          <span className="oss-sep">•</span>
          <a href="https://21st.dev/home" target="_blank" rel="noopener noreferrer">21st.dev</a>
        </div>
      </div>

      <div className="footer-credits">
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <PersonStanding size={20} color="var(--c-3a)" />
          Built by <a href="https://neill.adamson.co.za/" target="_blank" className="editorial-link">Neill Adamson</a> <a href="https://x.com/geniusboywonder" target="_blank" className="editorial-link">@geniusboywonder</a>
        </p>
        <p className="sub">Need a lift building with AI? <a href="mailto:nadamson@gmail.com" className="editorial-link">nadamson@gmail.com</a></p>
        <p className="copyright">© Neill Adamson. 2026 All rights reserved.</p>
      </div>
    </div>
  </footer>
);

const SHARE_TEXT = '800 extra cars into Bergvliet — see what the traffic models really show.';
const SHARE_TITLE = 'Traff✱k — Tokai High Traffic Simulator';
const SHARE_URL = 'https://traffic.adamson.co.za';

const ShareButtons = () => {
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleNativeShare = async () => {
    try { await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL }); } catch { /* user cancelled or share not supported */ }
  };

  const waUrl  = `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + ' ' + SHARE_URL)}`;
  const xUrl   = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`;
  const mailUrl = `mailto:?subject=${encodeURIComponent(SHARE_TITLE)}&body=${encodeURIComponent(SHARE_TEXT + '\n\n' + SHARE_URL)}`;

  return (
    <div className="share-buttons">
      {canNativeShare ? (
        <button className="share-btn share-btn--native" onClick={handleNativeShare} title="Share this">
          <Share2 size={15} />
          <span>Share</span>
        </button>
      ) : (
        <>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="share-btn share-btn--wa" title="Share on WhatsApp">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
          <a href={xUrl} target="_blank" rel="noopener noreferrer" className="share-btn share-btn--x" title="Share on X">
            <X size={15} />
          </a>
          <a href={mailUrl} className="share-btn share-btn--mail" title="Share via Email">
            <Mail size={15} />
          </a>
        </>
      )}
    </div>
  );
};

export default function App() {
  const [initialized, setInitialized]           = useState(false);
  const [scenario, setScenario]                 = useState('M');
  const [playing, setPlaying]                   = useState(false);
  const [speed, setSpeed]                       = useState(1);
  const [simTime, setSimTime]                   = useState(0);
  const [activeVehicles, setActiveVehicles]     = useState(0);
  const [statsData, setStatsData]               = useState(INITIAL_STATS);
  const [selectedCorridors, setSelectedCorridors] = useState(new Set(['3A', '2A', '2B', '1A']));
  const [showRoutes, setShowRoutes]             = useState(false);
  const [source, setSource]                     = useState('live');   // 'live' | 'sumo' | 'uxsim'
  const [selectedRoad, setSelectedRoad]         = useState(null);
  const [roadStats, setRoadStats]               = useState(null);
  const [activeSection, setActiveSection]     = useState('simulator');
  const playbackRef                             = useRef(new PlaybackSource());

  useEffect(() => {
    document.body.style.overflow = initialized ? 'auto' : 'hidden';
  }, [initialized]);

  useEffect(() => {
    const options = { threshold: 0, rootMargin: '-50% 0px -50% 0px' };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, options);

    ['simulator', 'briefing', 'findings', 'models', 'contact'].forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleToggleCorridor = useCallback((id) => {
    setSelectedCorridors(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleRoutes = useCallback(() => setShowRoutes(p => !p), []);

  const handleScenarioChange = useCallback(async (s) => {
    setScenario(s);
    setPlaying(false);
    setSimTime(0);
    setStatsData(INITIAL_STATS);
    setSelectedRoad(null);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'scenario_change', scenario: s });
    if (source === 'sumo' || source === 'uxsim') {
      try { const pb = playbackRef.current; pb.reset(); await pb.loadScenario(s, source); }
      catch (err) { console.error('Failed to load scenario:', err); }
    }
  }, [source]);

  const handlePlayPause = useCallback(() => {
    setPlaying(prev => !prev);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'simulation_play' });
  }, []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setSimTime(0);
    setStatsData(INITIAL_STATS);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'simulation_reset' });
  }, []);

  const handleSpeedChange = useCallback((s) => setSpeed(s), []);

  const handleSimUpdate = useCallback((time, active) => {
    setSimTime(time);
    setActiveVehicles(active);
  }, []);

  const handleStatsUpdate = useCallback((data) => setStatsData(data), []);
  const handleAutoStop    = useCallback(() => setPlaying(false), []);

  const handleSourceChange = useCallback(async (src) => {
    setSource(src);
    setPlaying(false);
    setSimTime(0);
    setStatsData(INITIAL_STATS);
    setSelectedRoad(null);
    setRoadStats(null);
    if (src === 'sumo' || src === 'uxsim') {
      try { const pb = playbackRef.current; pb.reset(); await pb.loadScenario(scenario, src); }
      catch (err) { console.error('Failed to load scenario results:', err); }
    }
  }, [scenario]);

  const handleRoadSelect = useCallback((road) => {
    if (!road) { setSelectedRoad(null); setRoadStats(null); return; }
    setSelectedRoad(prev => {
      if (prev && prev.name === road.name) { setRoadStats(null); return null; }
      if (source === 'sumo' || source === 'uxsim') {
        const roads = playbackRef.current.getRoads();
        const found = roads.find(r => r.name === road.name);
        return found ? { name: road.name, id: found.id } : { name: road.name, id: road.name };
      }
      return { name: road.name, id: road.name };
    });
  }, [source]);

  const handleRoadStatsUpdate = useCallback((stats) => setRoadStats(stats), []);

  const corrList = Object.values(statsData.corridors);
  const totalIn = corrList.reduce((s, c) => s + (c.spawned || 0), 0);
  const totalOut = corrList.reduce((s, c) => s + (c.exited || 0), 0);
  const activeDelaysIn = corrList.filter(c => c.avgInDelay > 0);
  const avgInTime = activeDelaysIn.length > 0 ? activeDelaysIn.reduce((s, c) => s + c.avgInDelay, 0) / activeDelaysIn.length : 0;
  const activeDelaysOut = corrList.filter(c => c.avgOutDelay > 0);
  const avgOutTime = activeDelaysOut.length > 0 ? activeDelaysOut.reduce((s, c) => s + c.avgOutDelay, 0) / activeDelaysOut.length : 0;

  return (
    <div className="app">
      <div className="noise-overlay" />

      {!initialized && <AccessBarrier onInitialize={() => setInitialized(true)} />}

      <div className="scrolling-top-bar">
        <div className="scrolling-top-bar-inner">
          <div className="nav-container">
            <Header activeSection={activeSection} />
          </div>
          <div className="stats-pill-container">
            <div className="scrolling-stats-pill">
              <div className="htc-stat">
                <span className="htc-label">Time</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={28} strokeWidth={3} color="var(--muted-text)" />
                  <span className="htc-value">{formatClock(simTime)}</span>
                </div>
              </div>
              <div className="htc-divider" />
              <div className="htc-stat">
                <span className="htc-label">Total In/Out</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Car size={28} strokeWidth={3} color="var(--muted-text)" />
                  <span className="htc-value">{totalIn} / {totalOut}</span>
                </div>
              </div>
              <div className="htc-divider" />
              <div className="htc-stat">
                <span className="htc-label">Avg Time In/Out</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Timer size={28} strokeWidth={3} color="var(--muted-text)" />
                  <span className="htc-value">{fmtTime(avgInTime)} / {fmtTime(avgOutTime)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="header-share-slot"><ShareButtons /></div>
        </div>
      </div>

      <main className="main-layout" id="simulator">
        <div className="content">
          <div className="map-viewport-container bezel-outer">
            <div className="bezel-inner">
              <SimMap
                scenario={scenario}
                playing={playing}
                speed={speed}
                showRoutes={showRoutes}
                onToggleRoutes={handleToggleRoutes}
                selectedCorridors={selectedCorridors}
                source={source}
                playbackSource={playbackRef}
                onSimUpdate={handleSimUpdate}
                onStatsUpdate={handleStatsUpdate}
                onRoadStatsUpdate={handleRoadStatsUpdate}
                onAutoStop={handleAutoStop}
                onPlayPause={handlePlayPause}
                onReset={handleReset}
                onSpeedChange={handleSpeedChange}
                onScenarioChange={handleScenarioChange}
                onSourceChange={handleSourceChange}
                onRoadSelect={handleRoadSelect}
                selectedRoad={selectedRoad}
              />
            </div>
          </div>
          <div className="stats-panel-container">
            <StatsPanel
              statsData={statsData}
              activeVehicles={activeVehicles}
              selectedCorridors={selectedCorridors}
              onToggleCorridor={handleToggleCorridor}
              selectedRoad={selectedRoad}
              roadStats={roadStats}
              onCloseRoad={() => handleRoadSelect(null)}
            />
          </div>
        </div>
      </main>

      <BentoBriefing />
      <FindingsSection />
      <ModelsSection />
      <Footer />
    </div>
  );
}
