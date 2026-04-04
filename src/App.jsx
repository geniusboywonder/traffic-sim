import { useState, useCallback, useRef, useEffect } from 'react';
import { PersonStanding, Database, Activity, FileText, Search, Info, AlertTriangle, Clock, CheckCircle, Split, Car, Play, Monitor, Timer, Map, Bot, OctagonX, ChevronUp, ChevronDown } from 'lucide-react';
import Header from './components/Header';
import SimMap from './components/SimMap';
import StatsPanel from './components/StatsPanel';
import { SmokeBackground } from './components/SmokeBackground';
import { AccessBarrier } from './components/AccessBarrier';
import { PlaybackSource } from './engine/playback';
import './App.css';

function formatClock(simTime) {
  const totalSec  = Math.floor(simTime ?? 0);
  const baseMin   = 6 * 60 + 40;
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
                    <li>• <strong>Cars per hour:</strong> L: 500, M: 650, H: 840</li>
                    <li>• <strong>Cars per entryway:</strong> Children's Way: 36% | Homestead Av: 30% | Firgrove Way: 18% | Dreyersdal North: 16%</li>
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
                    <li>• <strong>Logic:</strong> Rat-runs trigger at 6–10% congestion | 85% chance</li>
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

        <div className="model-entry">
          <span className="model-chain-badge">5</span>
          <div className="model-entry-body">
            <h3>Reading the Instruments</h3>
            <p>Our Live engine and the Lab model are stochastic — each run includes realistic random variation in driver behaviour, so exact numbers shift slightly between runs. The TIA and UXSim use deterministic, averaged flows, so they always return the same result. Our Live engine also adds layers the others don't: dynamic egress holds at J8 during peak, dwell time at the school, and real-time rat-run activation based on live congestion.</p>
          </div>
        </div>

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
            <span className="findings-stat-num">~32 min</span>
            <span className="findings-stat-label">Lab model mean trip — High scenario</span>
          </div>
          <div className="findings-stat findings-stat--alert">
            <span className="findings-stat-num">108</span>
            <span className="findings-stat-label">vehicles still active after 08:30 — every scenario</span>
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
            <AlertTriangle size={20} color="#8B1A1A" />
          </div>
          <h3 className="findings-col-heading">Total System Failure</h3>
          <ul className="findings-bullets">
            <li><strong>Traffic does not clear by 08:30.</strong> The TIA assumes the school run is done by 08:30 AM. The Lab model records <span className="stat-pill" data-source="Lab model — all scenarios">~108 vehicles</span> still active at 08:29 in every scenario — including Low demand. Our Live engine shows <span className="stat-pill" data-source="Live engine, High scenario, 23% of 840 trips">192 vehicles</span> unfinished at sim end in the High scenario.</li>
            <li><strong>Delays aren't measured in seconds.</strong> A school-run trip takes <span className="stat-pill" data-source="TIA free-flow baseline, ~3km route">~7 min</span> in free flow. Under High demand the Lab model records a mean trip of <span className="stat-pill" data-source="Lab model mean trip duration, High scenario">~32 min</span> with an average <span className="stat-pill" data-source="Lab model avg waiting time (fully stopped), High scenario">16 min spent completely stopped</span>. <span className="stat-pill" data-source="P95 trip time: Live 65 min, Lab 69 min — High scenario">1 in 20 drivers</span> takes over an hour.</li>
          </ul>
        </div>

        {/* FENDER-BENDER */}
        <div className="findings-col findings-col--fender">
          <div className="findings-col-top">
            <span className="findings-badge findings-badge--fender">Fender-bender</span>
            <Clock size={20} color="#A05E3D" />
          </div>
          <h3 className="findings-col-heading">Significant Damage</h3>
          <ul className="findings-bullets">
            <li><strong>The school gate is the single point of failure.</strong> Delay at the entrance doubles — from <span className="stat-pill" data-source="Validation model avg delay, school internal road, Low scenario">33s</span> to <span className="stat-pill" data-source="Validation model avg delay, school internal road, High scenario">71s</span> per vehicle — between Low and High demand. 14 speed humps and a single-entry gate mean one stalled car stalls the entire queue.</li>
            <li><strong>Rat-run pressure is structural.</strong> Dreyersdal Rd is the single most loaded road in Medium and High scenarios (Lab model). The Validation model records average delays of <span className="stat-pill" data-source="Validation model avg delay, Ruskin Rd across scenarios">74–106s on Ruskin Rd</span> and up to <span className="stat-pill" data-source="Validation model avg delay, Vineyard Rd, High scenario">86s on Vineyard Rd</span>. When the main routes fill, the rat-runs fill too.</li>
            <li><strong>Christopher Rd is the final funnel.</strong> The main route and four separate rat-run paths — from all three entry corridors — converge on Christopher Rd before the school gate. Two consecutive junctions compress all of that volume: a stop at <span className="stat-pill" data-source="Validation model — Christopher Rd top-5 most-loaded road, even in Low scenario">Starke/Christopher</span> and a yield at <span className="stat-pill" data-source="Lab model — all 3 entry corridors converge here; absorbs overflow from every direction in M &amp; H">Christopher/Vineyard</span>.</li>
          </ul>
        </div>

        {/* SIDE-SWIPE */}
        <div className="findings-col findings-col--sideswipe">
          <div className="findings-col-top">
            <span className="findings-badge findings-badge--sideswipe">Side-swipe</span>
            <CheckCircle size={20} color="var(--c-3a)" />
          </div>
          <h3 className="findings-col-heading">Telling Details</h3>
          <ul className="findings-bullets">
            <li><strong>The queue peaks at 08:15, not 07:45.</strong> The TIA's critical window is 07:30–08:00, with demand peaking at 07:45. But the school gate is a hard bottleneck — vehicles queue to reach it, not just to enter the suburb. Peak network loading doesn't hit until <span className="stat-pill" data-source="Lab model peak vehicles on network — High scenario 08:17, Med scenario 08:15">08:15–08:17</span>. The TIA captures when parents arrive. The crunch happens 30 minutes later, when they still can't reach the gate.</li>
            <li><strong>Three models, one conclusion.</strong> Live, Lab, and the Validation model — three entirely different mathematical frameworks — independently flag the same roads: Starke Rd and the Dreyersdal/Vineyard corridor in the top 5 across every Medium and High scenario. That's not a modelling quirk. It's the road.</li>
          </ul>
        </div>

      </div>

      <div className="road-closed-block">
        <div className="road-closed-header">
          <OctagonX size={26} strokeWidth={3} />
          <span>✕ &nbsp;ROAD CLOSED&nbsp; ✕</span>
          <OctagonX size={26} strokeWidth={3} />
        </div>
        <p className="road-closed-intro">Everything shown is <strong>inbound school traffic only.</strong> This modelling excludes:</p>
        <ul className="road-closed-list">
          <li><span className="stat-pill stat-pill--dark" data-source="Sweet Valley Primary is ~200m away. Their school-run parents use the same roads and are entirely unmodelled.">Sweet Valley Primary school runs</span></li>
          <li><span className="stat-pill stat-pill--dark" data-source="All non-school trips through the study area — commuters, local errands, other school runs — are excluded. These roads carry far more than Tokai High traffic alone.">All Bergvliet local and commuter traffic</span></li>
          <li><span className="stat-pill stat-pill--dark" data-source="Post drop-off vehicles leaving via Firgrove Rd, Ladies Mile Rd and Main Rd create a counter-flow on the same streets. None of this is modelled. Real congestion will be worse."><em>All</em> outbound traffic after drop-off</span></li>
          <li><span className="stat-pill stat-pill--dark" data-source="The TIA proposes calming on rat-run routes. Excluding these means modelled rat-run speeds may be slightly faster than reality — which would make congestion slightly worse than shown.">Proposed traffic calming on Dante Rd, Vineyard Rd, Ruskin Rd, Leyden Rd</span></li>
        </ul>
        <p className="road-closed-footer">Every exit time shown is a <strong>minimum bound</strong>. The real wait is longer.</p>
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
      <div className="footer-credits">
        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <PersonStanding size={20} color="var(--c-3a)" />
          Built by <a href="https://neill.adamson.co.za/" target="_blank" className="editorial-link">Neill Adamson</a> <a href="https://x.com/geniusboywonder" target="_blank" className="editorial-link">@geniusboywonder</a>
        </p>
        <p className="sub">Need a lift building with AI? <a href="mailto:nadamson@gmail.com" className="editorial-link">nadamson@gmail.com</a></p>
      </div>
    </div>
  </footer>
);

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
          <div className="header-right-empty" />
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
