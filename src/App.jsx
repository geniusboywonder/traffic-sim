import { useState, useCallback } from 'react';
import Header from './components/Header';
import SimMap from './components/SimMap';
import StatsPanel from './components/StatsPanel';
import AdSlot from './components/AdSlot';
import './App.css';

const INITIAL_STATS = {
  corridors: {
    '3A': { label: 'Firgrove Way',      current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, slowing: 0, stopped: 0 },
    '2A': { label: 'Homestead Ave',     current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, slowing: 0, stopped: 0 },
    '2B': { label: "Children's Way",    current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, slowing: 0, stopped: 0 },
    '1A': { label: 'Dreyersdal Rd N',  current: 0, spawned: 0, exited: 0, avgInDelay: 0, avgOutDelay: 0, congestion: 0, slowing: 0, stopped: 0 },
  },
  bottlenecks: {
    christopher: { label: 'Christopher Rd', active: 0, slowing: 0, stopped: 0 },
    leyden:      { label: 'Leyden Rd',      active: 0, slowing: 0, stopped: 0 },
    ruskin:      { label: 'Ruskin Rd',      active: 0, slowing: 0, stopped: 0 },
    aristea:     { label: 'Aristea Rd',     active: 0, slowing: 0, stopped: 0 },
  },
  parking: {
    onSite: 0,
    onStreet: 0
  }
};

export default function App() {
  const [scenario, setScenario]             = useState('M');
  const [playing, setPlaying]               = useState(false);
  const [speed, setSpeed]                   = useState(1);
  const [simTime, setSimTime]               = useState(0);
  const [activeVehicles, setActiveVehicles] = useState(0);
  const [totalVehicles, setTotalVehicles]   = useState(0);
  const [statsData, setStatsData]           = useState(INITIAL_STATS);
  const [activeRoutes, setActiveRoutes]     = useState(new Set([]));
  const [selectedCorridors, setSelectedCorridors] = useState(new Set(['1A', '2A', '2B', '3A']));

  const handleToggleRoute = useCallback((id) => {
    setActiveRoutes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleCorridor = useCallback((id) => {
    setSelectedCorridors(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
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
            selectedCorridors={selectedCorridors}
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
          selectedCorridors={selectedCorridors}
          onToggleRoute={handleToggleRoute}
          onToggleCorridor={handleToggleCorridor}
        />
      </div>
    </div>
  );
}
