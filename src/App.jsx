import { useState, useCallback, useRef } from 'react';
import Header from './components/Header';
import SimMap from './components/SimMap';
import StatsPanel from './components/StatsPanel';
import RoadWatcher from './components/RoadWatcher';
import AdSlot from './components/AdSlot';
import { PlaybackSource } from './engine/playback';
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
  const [showRoutes, setShowRoutes]         = useState(false);
  const [selectedCorridors, setSelectedCorridors] = useState(new Set(['1A', '2A', '2B', '3A']));
  
  const [source, setSource]                 = useState('live');
  const [resultsLoading, setResultsLoading] = useState(false);
  const [playbackFrames, setPlaybackFrames] = useState([]);
  const [selectedRoad, setSelectedRoad]     = useState(null);
  const [roadStats, setRoadStats]           = useState(null);
  const playbackRef                         = useRef(new PlaybackSource());

  const handleToggleRoutes = useCallback(() => {
    setShowRoutes(prev => !prev);
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

  const handleSourceChange = useCallback(async (s) => {
    setSource(s);
    setPlaying(false);
    setSimTime(0);
    setActiveVehicles(0);
    setTotalVehicles(0);
    setStatsData(INITIAL_STATS);
    setSelectedRoad(null);
    if (s === 'results') {
      setResultsLoading(true);
      try {
        const pb = playbackRef.current;
        pb.reset();
        await pb.loadScenario(scenario);
        setPlaybackFrames(pb.getAllFrames());
      } catch (err) {
        console.error('Failed to load scenario results:', err);
      } finally {
        setResultsLoading(false);
      }
    }
  }, [scenario]);

  const handleScenarioChange = useCallback(async (s) => {
    setScenario(s);
    setPlaying(false);
    setSimTime(0);
    setActiveVehicles(0);
    setTotalVehicles(0);
    setStatsData(INITIAL_STATS);
    setSelectedRoad(null);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'scenario_change', scenario: s });
    if (source === 'results') {
      setResultsLoading(true);
      try {
        const pb = playbackRef.current;
        pb.reset();
        await pb.loadScenario(s);
        setPlaybackFrames(pb.getAllFrames());
      } catch (err) {
        console.error('Failed to load scenario results:', err);
      } finally {
        setResultsLoading(false);
      }
    }
  }, [source]);

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

  const handleRoadSelect = useCallback((road) => {
    if (!road) {
      setSelectedRoad(null);
      setRoadStats(null);
      return;
    }
    setSelectedRoad(prev => {
      if (prev && prev.name === road.name) {
        setRoadStats(null);
        return null;
      }
      
      if (source === 'results') {
        const roads = playbackRef.current.getRoads();
        const found = roads.find(r => r.name === road.name);
        return found ? { name: road.name, id: found.id } : { name: road.name, id: road.name };
      }
      return { name: road.name, id: road.name };
    });
  }, [source]);

  const handleRoadStatsUpdate = useCallback((stats) => {
    setRoadStats(stats);
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
        source={source}
        resultsLoading={resultsLoading}
        onScenarioChange={handleScenarioChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
        onSourceChange={handleSourceChange}
      />
      <AdSlot />
      <div className="content">
        <div className="map-container">
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
            onRoadSelect={handleRoadSelect}
            selectedRoad={selectedRoad}
            allPlaybackFrames={playbackFrames}
          />
        </div>
        <StatsPanel
          statsData={statsData}
          activeVehicles={activeVehicles}
          totalVehicles={totalVehicles}
          selectedCorridors={selectedCorridors}
          onToggleCorridor={handleToggleCorridor}
          selectedRoad={selectedRoad}
          roadStats={roadStats}
          onCloseRoad={() => handleRoadSelect(null)}
        />
      </div>
    </div>
  );
}
