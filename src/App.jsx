import { useState, useCallback, useRef, useEffect } from 'react';
import Header from './components/Header';
import SimMap from './components/SimMap';
import StatsPanel from './components/StatsPanel';
import { PlaybackSource } from './engine/playback';
import './App.css';

function formatSimTime(simTime) {
  const totalSec = Math.floor(simTime);
  const baseMin  = 6 * 60 + 30; // 06:30 AM
  const totalMin = baseMin + Math.floor(totalSec / 60);
  const hours24  = Math.floor(totalMin / 60) % 24;
  const mins     = totalMin % 60;
  const h12      = hours24 % 12 || 12;
  const ampm     = hours24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
}

const INITIAL_STATS = {
  corridors: {
    '3A': { label: 'Firgrove Way',     current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
    '2A': { label: 'Homestead Ave',    current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
    '2B': { label: "Children's Way",   current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
    '1A': { label: 'Main Rd',  current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, active: 0, slowing: 0, stopped: 0 },
  },
  parking: { onSite: 0, onStreet: 0 }
};

const AccessBarrier = ({ onInitialize }) => (
  <div className="access-barrier" id="access-barrier">
    <div className="bezel-outer barrier-card">
      <div className="bezel-inner barrier-content">
        <header style={{ textAlign: 'center' }}>
          <div className="barrier-title-box">
            <h2>Tokai High School Traffic Simulator</h2>
          </div>
        </header>

        <div className="barrier-grid">
          <div className="barrier-narrative">
            <p>Hi there! As a Bergvliet resident, I wanted to visually understand what an additional 800 cars would do to the suburban streets of Bergvliet. And given that the WCED-commissioned Traffic Impact Assessment is woefully limited in its scope, I built a thing.</p>
            <p>This site is also not formally associated with the <a href="https://www.facebook.com/CommunityResponseBergvlietSchool" target="_blank" className="editorial-link">Bergvliet Volunteers Association (BVA)</a>, although I am a member of the <a href="https://chat.whatsapp.com/J7ooHVb9tdr4n9PLf76wYy?mode=ems_wa_t" target="_blank" className="editorial-link">Community Response: Tokai School WhatsApp group</a>.</p>
            <p className="barrier-lekker">Just be lekker!<br /><span className="barrier-sig">ɲeill</span></p>
          </div>
          <div className="barrier-disclaimer">
            <span className="disclaimer-label">DISCLAIMER</span>
            <p className="disclaimer-text">I am just a guy, with AI. I am not a traffic-assessor, or have any deep knowledge on traffic flow, stalling physics or back-pressure. My AI agents helped with that. They could be wrong. And this is just <strong>one possible scenario</strong>. It's fun and informative, but not definitive in its modelling. Don't use this site to make any life-changing decisions, or say things you might regret to WCED, City of Cape Town or anyone else.</p>
          </div>
        </div>

        <div className="barrier-action">
          <button className="init-sim-btn" onClick={onInitialize}>Initialize Simulator →</button>
        </div>
      </div>
    </div>
  </div>
);

const BentoBriefing = () => (
  <section className="bento-briefing" id="briefing">
    <div className="bento-content">
      <div className="narrative-block">
        <div className="narrative-item">
          <h3 className="narrative-subtitle">Microscopic Logic</h3>
          <p className="narrative-text-large">
            Tokai-Sim is like a super-realistic video game that lets you watch exactly what happens during the morning school drop-off at Tokai High.
          </p>
        </div>
        <div className="narrative-item">
          <p className="narrative-text-medium">
            It models every car, every slow-down at a speed hump, and every frustrated parent trying to squeeze in a quick drop-off. The heart of the simulation is the Intelligent Driver Model — that decides how close cars follow each other, how fast they accelerate, and when they brake gently instead of slamming on the anchors.
          </p>
          <p className="narrative-text-body" style={{ textAlign: 'justify', maxWidth: 'none' }}>
            The model uses a "main route" for each entry / exit corridor from Firgrove Way, Homestead Rd, Children's Way and Main Rd. This is the route most cars will follow — until traffic starts to build up. Then cars will find and follow multiple rat-runs to the school. The model attempts to avoid the normal Sweet Valley routes at the top of Dreyersdal Rd and exiting via Homestead.
          </p>
        </div>
      </div>

      <div className="tech-hub-block">
        <div className="meta-hovers-box">
          <div className="hover-trigger">
            TIA Assumptions
            <div className="hover-target">
              <div className="popover-card">
                <h4>TIA assumptions</h4>
                <ul className="popover-list">
                  <li>• <strong>Cars per hour:</strong> L: 500, M: 650, H: 840</li>
                  <li>• <strong>Cars per entryway:</strong> Children’s Way: 36% | Homestead Ave: 30% | Firgrove Way: 18% | Dreyersdal North: 16%</li>
                  <li>• <strong>School Drop-offs:</strong> 120 bays (98 on-site + 22 on-street)</li>
                  <li>• <strong>Avg stop time:</strong> 45 seconds | One-way system | Aristea Traffic Circle</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="hover-trigger">
            Model Parameters
            <div className="hover-target">
              <div className="popover-card">
                <h4>Model parameters</h4>
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

        <div className="limitations-card">
          <span className="limitations-title">IMPORTANT MODELLING LIMITATION</span>
          <ul className="limitations-list">
            <li>• NO SWEET VALLEY SCHOOL TRAFFIC CONDITIONS ARE AVAILABLE</li>
            <li>• NO TRAFFIC CONDITIONS FOR EXITING TO FIRGROVE, LADIES MILE OR MAIN RD ARE AVAILABLE</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
);

const ModelsSection = () => (
  <section className="models-section" id="models">
    <div className="models-grid">
      <div className="models-header">
        <h2 className="models-title">Models & Validation</h2>
      </div>

      <div className="models-content">
        <div className="model-entry">
          <h3>The Western Cape Mobility Department <a href="https://www.westerncape.gov.za/mobility" target="_blank" className="editorial-link">(WCMD)</a> TIA Approach</h3>
          <p>The official Traffic Impact Assessment (TIA) for Tokai High School follows South Africa’s TMH 16 guidelines. It uses a straightforward, analytical method based on standard traffic engineering formulas. The TIA calculates expected trip numbers, splits them by direction, and checks road and intersection capacity using averaged flows — basically a "worst-case 15-minute peak" snapshot. It gives planners and authorities a reliable, deterministic baseline.</p>
        </div>

        <div className="model-entry">
          <h3>SUMO & UXsim: Professional Pedigree & Model Validation</h3>
          <div className="pedigree-grid">
            <div className="pedigree-item">
              <h4>SUMO (Simulation of Urban MObility)</h4>
              <p style={{fontSize: '14px'}}>Developed by the German Aerospace Center (DLR), SUMO is a world-leading microscopic simulator. It tracks every individual car, using proven car-following mathematics such as the Intelligent Driver Model (IDM). It covers acceleration, braking, reactions to others, the 28 speed humps, the 11 special junctions, and realistic rat-running behaviour.</p>
            </div>
            <div className="pedigree-item">
              <h4>UXsim</h4>
              <p style={{fontSize: '14px'}}>Created by Dr. Toru Seo at the Institute of Science Tokyo, UXsim is a fast, modern mesoscopic simulator. It models traffic as flow rather than individual vehicles — using the same kinematic wave mathematics that underpin the TIA’s own capacity calculations. This makes it the ideal cross-check: it speaks the same mathematical language as the TIA, but runs the full network rather than a snapshot.</p>
            </div>
          </div>
        </div>

        <div className="calibration-box">
          <h3>TOKAI-SIM CALIBRATION</h3>
          <p>We calibrated Tokai-Sim’s live engine directly to the TIA’s peak-hour volumes, origin splits, and 840-vehicle baseline. SUMO then runs the same network at microscopic level (with all 28 speed humps, 11 junction overrides, and realistic rat-run logic), while UXsim independently validates total network throughput against the TIA’s flow-density curves. The three layers are deliberately cross-checked so any "what-if" scenario sits on the same mathematical foundation.</p>
        </div>

        <div className="model-entry">
          <h3>Why small differences appear — and why the trend matters</h3>
          <p>Microscopic tools like SUMO are stochastic (they include realistic random driver behaviour), while the TIA and UXsim use averaged, deterministic flows. This means queue lengths or exact travel times can vary slightly between runs. We validated by running multiple SUMO simulations and comparing the average results to both UXsim and the TIA baselines. The overall trends match extremely closely. The small differences you may notice are exactly why we built the Live vs SUMO toggle.</p>
        </div>
      </div>
    </div>
  </section>
);

const FindingsSection = () => (
  <section className="findings-section" id="findings">
    <div className="findings-grid">
      <div className="findings-header">
        <h2 className="models-title">What the Models Say</h2>
        <p className="findings-intro">UXsim analysed all three scenarios using kinematic wave theory — the same mathematics as the TIA. Here is what it found, compared against SUMO’s microscopic simulation.</p>
      </div>

      <div className="findings-content">

        {/* Key finding 1 — clearance */}
        <div className="finding-card finding-card--alert">
          <div className="finding-icon">⚠</div>
          <div className="finding-body">
            <h3>Traffic does not clear by 08:30</h3>
            <p>The TIA assumes all 840 vehicles complete their trips by 08:30 AM. Both SUMO and UXsim show significant residual congestion at 08:30 across all three scenarios. In the High scenario, SUMO records ~480 vehicles still active at 08:29. UXsim confirms continued network loading well past 08:30. <strong>The TIA’s clearance assumption is not supported by dynamic modelling.</strong></p>
          </div>
        </div>

        {/* Key finding 2 — peak timing */}
        <div className="finding-card">
          <div className="finding-icon">⏱</div>
          <div className="finding-body">
            <h3>Peak congestion hits at 07:45 — not 08:00</h3>
            <p>The TIA’s own trapezoidal demand profile places 35% of all trips in the 07:30–08:00 window, with the effective peak around 07:45. Both SUMO and the Live engine confirm peak network density at approximately 07:45 AM. The critical window for rat-run activation and junction back-pressure is therefore earlier than the TIA’s "peak 15-minute" analysis suggests.</p>
          </div>
        </div>

        {/* Key finding 3 — UXsim vs SUMO agreement */}
        <div className="finding-card">
          <div className="finding-icon">✓</div>
          <div className="finding-body">
            <h3>UXsim and SUMO agree on congestion patterns</h3>
            <p>Despite operating at different abstraction levels, UXsim and SUMO identify the same roads as highest-stress: the Children’s Way / Dreyersdal approach, the Homestead Ave corridor, and the Aristea Road school frontage. This cross-model agreement strengthens confidence that the congestion picture is real, not an artefact of any single model’s assumptions.</p>
          </div>
        </div>

        {/* Key finding 4 — rat runs */}
        <div className="finding-card">
          <div className="finding-icon">🔀</div>
          <div className="finding-body">
            <h3>Rat-runs activate in Medium and High scenarios</h3>
            <p>SUMO’s dynamic rerouting shows rat-run activity emerging at ~6–10% corridor congestion — consistent with the Live engine’s threshold. In the High scenario, over 30% of inbound vehicles divert via secondary residential streets. UXsim’s network flow confirms the same secondary corridors reach capacity limits, validating that rat-run pressure is a structural feature of the network, not a modelling quirk.</p>
          </div>
        </div>

        {/* Limitation callout */}
        <div className="finding-card finding-card--muted">
          <div className="finding-icon">ℹ</div>
          <div className="finding-body">
            <h3>What UXsim cannot tell us</h3>
            <p>UXsim models traffic as flow, not individual cars. It cannot reproduce speed-hump braking events, junction hold behaviour, or individual rat-run decisions. Its role here is <em>network-level validation</em> — confirming that the overall demand exceeds the network’s capacity envelope under TIA assumptions. The Live and SUMO engines carry the detailed behavioural story.</p>
          </div>
        </div>

      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="site-footer" id="contact">
    <div className="footer-content">
      <div className="footer-brand">
        <h2>Tokai-Sim</h2>
        <p className="footer-slogan">"putting you in the driving seat"</p>
      </div>
      <div className="footer-credits">
        <p>Built by <a href="https://x.com/geniusboywonder" target="_blank" className="editorial-link">Neill Adamson @geniusboywonder</a></p>
        <p className="sub">Help building with AI? <a href="mailto:nadamson@gmail.com" className="editorial-link">nadamson@gmail.com</a></p>
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
  const playbackRef                             = useRef(new PlaybackSource());

  useEffect(() => {
    document.body.style.overflow = initialized ? 'auto' : 'hidden';
  }, [initialized]);

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

  return (
    <div className="app">
      <div className="noise-overlay" />

      {!initialized && <AccessBarrier onInitialize={() => setInitialized(true)} />}

      <Header simTime={simTime} statsData={statsData} />

      <main className="main-layout" id="simulator">
        <header className="hero-header">
          {/* Overall summary and titles moved to Header and Controls */}
        </header>

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
                playbackSource={playbackRef.current}
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
      <ModelsSection />
      <FindingsSection />
      <Footer />
    </div>
  );
}
