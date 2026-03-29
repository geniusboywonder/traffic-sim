import { useState, useCallback } from 'react';
import Header from './components/Header';
import SimMap from './components/SimMap';
import StatsPanel from './components/StatsPanel';
import AdSlot from './components/AdSlot';
import './App.css';

const INITIAL_STATS = {
  corridors: {
    '1A': { label: 'Dreyersdal Rd N',  current: 0, total: 0, exited: 0, maxVehicles: 50, avgDelaySec: null },
    '2A': { label: 'Homestead Ave',     current: 0, total: 0, exited: 0, maxVehicles: 60, avgDelaySec: null },
    '2B': { label: "Children's Way",    current: 0, total: 0, exited: 0, maxVehicles: 70, avgDelaySec: null },
    '3A': { label: 'Firgrove Way',      current: 0, total: 0, exited: 0, maxVehicles: 40, avgDelaySec: null },
  },
  bottlenecks: {
    christopher: { label: 'Christopher Rd',         current: 0, maxVehicles: 15 },
    ruskin:      { label: 'Ruskin Rd (ingress)',     queued: 0,  maxVehicles: 20 },
    aristea:     { label: 'Aristea Rd (egress)',     current: 0, maxVehicles: 10 },
  },
};

export default function App() {
  const [scenario, setScenario]             = useState('M');
  const [playing, setPlaying]               = useState(false);
  const [speed, setSpeed]                   = useState(1);
  const [simTime, setSimTime]               = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);
  const [totalVehicles, setTotalVehicles]   = useState(0);
  const [statsData, setStatsData]           = useState(INITIAL_STATS);
  const [activeRoutes, setActiveRoutes]     = useState(new Set(['1A', '2A', '2B', '3A']));

  const handleToggleRoute = useCallback((id) => {
    setActiveRoutes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleScenarioChange = useCallback((s) => {
    setScenario(s);
    setPlaying(false);
    setSimTime(0);
    setActiveVehicles(0);
    setTotalVehicles(0);
    setStatsData(INITIAL_STATS);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'scenario_change', scenario: s });
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'simulation_play' });
  }, []);

  const handlePause = useCallback(() => {
    setPlaying(false);
  }, []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setSimTime(0);
    setActiveVehicles(0);
    setTotalVehicles(0);
    setStatsData(INITIAL_STATS);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'simulation_reset' });
  }, []);

  const handleSpeedChange = useCallback((s) => setSpeed(s), []);

  const handleSimUpdate = useCallback((time, active, total) => {
    setSimTime(time);
    setActiveVehicles(active);
    setTotalVehicles(total);
  }, []);

  const handleStatsUpdate = useCallback((data) => {
    setStatsData(data);
  }, []);

  const handleAutoStop = useCallback(() => {
    setPlaying(false);
  }, []);

  return (
    <div className="app">
      <Header
        scenario={scenario}
        playing={playing}
        speed={speed}
        simTime={simTime}
        activeVehicles={activeVehicles}
        totalVehicles={totalVehicles}
        onScenarioChange={handleScenarioChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
      />
      <AdSlot />
      <div className="content">
        <div className="map-container">
          <SimMap
            scenario={scenario}
            playing={playing}
            speed={speed}
            activeRoutes={activeRoutes}
            onSimUpdate={handleSimUpdate}
            onStatsUpdate={handleStatsUpdate}
            onAutoStop={handleAutoStop}
          />
        </div>
        <StatsPanel
          statsData={statsData}
          activeVehicles={activeVehicles}
          totalVehicles={totalVehicles}
          activeRoutes={activeRoutes}
          onToggleRoute={handleToggleRoute}
        />
      </div>
    </div>
  );
}
