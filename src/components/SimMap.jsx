// ── SimMap.jsx ────────────────────────────────────────────────────────────────
// Leaflet map + canvas vehicle overlay + rAF animation loop.

import { useEffect, useRef, useCallback, useState } from 'react';
import { Play, Pause, RotateCcw, Download, GripVertical, Car, Map as MapIcon, GraduationCap } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  JUNCTIONS, VISIBLE_JUNCTIONS, CTRL_STYLE, ROAD_LINES, ROUTE_CONFIG,
  getRouteJunctions, RAT_RUN_SWITCHES
} from '../engine/routes';
import { stepAllVehicles, junctionHoldDuration, getParkingOccupancy, PARKING_CAPACITY } from '../engine/idm';
import {
  spawnTick, processDwell, createSpawnerState, resetVehicleIds,
  pickEgressRoute, estimateRouteLength,
} from '../engine/spawner';
import { logEvent, logSchoolEvent, loggerClear, logRoadSnapshot, loggerDownload, loggerDownloadRoadStats } from '../engine/logger';
import RoadWatcher from './RoadWatcher';

// Vehicle colours — aligned with design token palette
const COLOUR = {
  dwell:    '#717977',
  delayed:  '#A64D4D',
  '1A':     { base: '#2D5438', light: '#4A7A56', dark: '#111D13' }, // dark forest  — Main Rd
  '2A':     { base: '#709775', light: '#A1CCA5', dark: '#415D43' }, // celadon      — Homestead
  '2B':     { base: '#C4864A', light: '#E0B88A', dark: '#8B5A28' }, // warm amber   — Children's Way
  '3A':     { base: '#A1CCA5', light: '#C8E0C8', dark: '#709775' }, // sage         — Firgrove
  'egress': { base: '#D4732E', light: '#F0A870', dark: '#A04E18' }, // amber        — egress
};

const ENTRY_JUNCTIONS = {
  '1A': 1,
  '2A': 9,
  '2B': 8,
  '3A': 13
};

function posToLatLng(geometry, pos) {
  if (!geometry || geometry.length === 0) return null;
  if (pos <= 0) return geometry[0];
  if (pos >= 1) return geometry[geometry.length - 1];

  const R = 6371000;
  const cumDist = [0];
  for (let i = 1; i < geometry.length; i++) {
    const [lat1, lon1] = geometry[i - 1];
    const [lat2, lon2] = geometry[i];
    const dlat = (lat2 - lat1) * (Math.PI / 180);
    const dlon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dlat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
    cumDist.push(cumDist[i - 1] + R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  const totalLen = cumDist[cumDist.length - 1];
  const targetDist = pos * totalLen;

  let lo = 0, hi = geometry.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (cumDist[mid] < targetDist) lo = mid;
    else hi = mid;
  }

  const d = cumDist[hi] - cumDist[lo];
  const t = d > 0 ? (targetDist - cumDist[lo]) / d : 0;
  return [
    geometry[lo][0] + t * (geometry[hi][0] - geometry[lo][0]),
    geometry[lo][1] + t * (geometry[hi][1] - geometry[lo][1]),
  ];
}

export default function SimMap({ scenario, playing, speed, showRoutes, onToggleRoutes, selectedCorridors, source, playbackSource, onSimUpdate, onStatsUpdate, onRoadStatsUpdate, onAutoStop, onRoadSelect, selectedRoad, onPlayPause, onReset, onSpeedChange, onScenarioChange, onSourceChange }) {
  const containerRef = useRef(null), canvasRef = useRef(null), mapRef = useRef(null);
  const vehiclesRef = useRef([]), simTimeRef = useRef(0), spawnerStateRef = useRef(createSpawnerState());
  const rafRef = useRef(null), loopRef = useRef(null), lastUpdateRef = useRef(0);

  // Draggable controls and legend
  const [controlsOffset, setControlsOffset] = useState({ x: 0, y: 0 });
  const [legendOffset, setLegendOffset]     = useState({ x: 0, y: 0 });
  const controlsDragRef = useRef(null);
  const legendDragRef   = useRef(null);

  const startDrag = useCallback((dragRef, currentOffset, setOffset, e) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentOffset.x, origY: currentOffset.y };
    const onMove = (e) => {
      if (!dragRef.current) return;
      setOffset({
        x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, []);
  const junctionStateRef = useRef(new Map()), junctionMarkersRef = useRef({});
  const corridorTotalsRef = useRef({ '1A': 0, '1A-NORTH': 0, '2A': 0, '2B': 0, '3A': 0 });
  const corridorExitsRef = useRef({ '1A': 0, '1A-NORTH': 0, '2A': 0, '2B': 0, '3A': 0 });
  const inboundDelayRef = useRef({ '1A': { total: 0, count: 0 }, '1A-NORTH': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } });
  const outboundDelayRef = useRef({ '1A': { total: 0, count: 0 }, '1A-NORTH': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } });
  const pulsePhaseRef = useRef(0);
  const congestionScoresRef = useRef({ '1A': 0, '2A': 0, '2B': 0, '3A': 0 });
  const roadVisitTrackerRef = useRef({ inbound: new Map(), outbound: new Map() });
  const roadPolylinesRef = useRef([]);
  const onRoadSelectRef  = useRef(onRoadSelect);
  const lastRoadLogRef   = useRef(0);

  const scenarioRef = useRef(scenario), speedRef = useRef(speed), showRoutesRef = useRef(showRoutes), sourceRef = useRef(source), selectedRoadRef = useRef(selectedRoad);
  const selectedCorridorsRef = useRef(selectedCorridors);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { showRoutesRef.current = showRoutes; }, [showRoutes]);
  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { onRoadSelectRef.current = onRoadSelect; }, [onRoadSelect]);
  useEffect(() => { selectedRoadRef.current = selectedRoad; }, [selectedRoad]);
  useEffect(() => { selectedCorridorsRef.current = selectedCorridors; }, [selectedCorridors]);

  // Define logic functions at the TOP to avoid initialization ReferenceErrors
  const computeStats = useCallback((vehicles, totals, exits, inDelays, outDelays, congScores) => {
    const res = { corridors: {}, bottlenecks: {}, parking: {} };
    ['3A', '2A', '2B', '1A'].forEach(cid => {
      // 3A (Firgrove Way) merges 1A-NORTH (Dreyersdal North) — both enter/exit via J13
      // 1A (Main Rd) shows Dreyersdal South only
      const cids = cid === '3A' ? ['3A', '1A-NORTH'] : [cid];
      const corrVehicles = vehicles.filter(v => cids.includes(v.corridorId) && v.state === 'inbound');
      const stopped = corrVehicles.filter(v => v.v < 0.5).length;
      const slowing = corrVehicles.filter(v => v.v >= 0.5 && v.v < 2).length;
      const active  = corrVehicles.filter(v => v.v >= 2).length;
      const inD  = cid === '3A'
        ? { total: (inDelays['3A'].total  + (inDelays['1A-NORTH']?.total  ?? 0)), count: (inDelays['3A'].count  + (inDelays['1A-NORTH']?.count  ?? 0)) }
        : inDelays[cid];
      const outD = cid === '3A'
        ? { total: (outDelays['3A'].total + (outDelays['1A-NORTH']?.total ?? 0)), count: (outDelays['3A'].count + (outDelays['1A-NORTH']?.count ?? 0)) }
        : outDelays[cid];
      const spawned = cid === '3A' ? (totals['3A'] + (totals['1A-NORTH'] ?? 0)) : totals[cid];
      const exited  = cid === '3A' ? (exits['3A']  + (exits['1A-NORTH']  ?? 0)) : exits[cid];
      res.corridors[cid] = {
        label: cid === '1A' ? 'Main Rd' : cid === '2A' ? 'Homestead Av' : cid === '2B' ? "Children's Way" : 'Firgrove Way',
        current: corrVehicles.length, spawned, exited,
        avgInDelay:  inD.count  > 0 ? (inD.total  / inD.count  / 60) : 0,
        avgOutDelay: outD.count > 0 ? (outD.total / outD.count / 60) : 0,
        congestion: congScores?.[cid] ?? 0, stopped, slowing, active
      };
    });
    const p = getParkingOccupancy(vehicles);
    res.parking = { onSite: p.onSite, onStreet: p.onStreet };
    return res;
  }, []);

  const drawFrame = useCallback(() => {
    const map = mapRef.current, canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showRoutesRef.current) {
      Object.values(ROUTE_CONFIG).forEach(route => {
        if (!route.geometry) return;
        ctx.beginPath(); ctx.strokeStyle = COLOUR[route.corridor].base; ctx.lineWidth = route.type === 'ratrun' ? 2 : 3;
        ctx.globalAlpha = 0.3; if (route.type === 'ratrun') ctx.setLineDash([5,5]); else ctx.setLineDash([]);
        route.geometry.forEach((ll, i) => { const pt = map.latLngToContainerPoint(L.latLng(ll[0], ll[1])); if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
        ctx.stroke();
      });
    }

    vehiclesRef.current.forEach(v => {
      const route = ROUTE_CONFIG[v.routeId]; if (!route?.geometry) return;
      const latlng = posToLatLng(route.geometry, v.pos); if (!latlng) return;
      const pt = map.latLngToContainerPoint(L.latLng(latlng[0], latlng[1]));
      
      const c = COLOUR[v.corridorId] || COLOUR['1A'];
      const isSelected = selectedCorridorsRef.current.has(v.corridorId);
      const alpha = isSelected ? 1.0 : 0.2;
      
      let col;
      if (v.state === 'dwell' || v.isParking) col = COLOUR.dwell;
      else if (v.v < 2) col = COLOUR.delayed;
      else if (v.state === 'outbound') col = c.light;
      else col = c.dark;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;

      const size = 4;
      if (route.type === 'ratrun') {
        // Rat-Run: Diamonds ◆ / ◇
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - size * 1.4);
        ctx.lineTo(pt.x + size * 1.4, pt.y);
        ctx.lineTo(pt.x, pt.y + size * 1.4);
        ctx.lineTo(pt.x - size * 1.4, pt.y);
        ctx.closePath();
        if (v.state === 'outbound' || v.state === 'dwell') {
          ctx.stroke(); // Hollow Diamond ◇
        } else {
          ctx.fill(); // Solid Diamond ◆
        }
      } else if (v.state === 'outbound' || v.state === 'dwell') {
        // Egress/Parked Main: Hollow Circle ○
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Inbound Main: Solid Circle ●
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    });

    // ── School internal road — dashed grey line ───────────────────────────────
    const internal = ROAD_LINES.find(f => f.properties.name?.toLowerCase().includes('internal road'));
    if (internal) {
      const map = mapRef.current;
      if (map) {
        ctx.beginPath(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.setLineDash([4,4]); ctx.globalAlpha = 0.8;
        internal.geometry.coordinates.forEach((cl, i) => {
          const pt = map.latLngToContainerPoint(L.latLng(cl[1], cl[0]));
          i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }

  }, []);

  const syncCanvas = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    canvasRef.current.width = containerRef.current.offsetWidth;
    canvasRef.current.height = containerRef.current.offsetHeight;
    drawFrame();
  }, [drawFrame]);

  const updateRoadStats = useCallback(() => {
    const currentSel = selectedRoadRef.current;
    if (!currentSel) { onRoadStatsUpdate(null); return; }

    if (sourceRef.current === 'live') {
      const stats = { 
        inbound:  { total: 0, active: 0, slowing: 0, stopped: 0 }, 
        outbound: { total: 0, active: 0, slowing: 0, stopped: 0 },
        avgInDelay: 0, avgOutDelay: 0
      };
      const selName = currentSel.name.toLowerCase().trim();

      vehiclesRef.current.forEach(v => {
        const route = ROUTE_CONFIG[v.routeId]; if (!route?.segments) return;
        const isOnRoad = route.segments.some(s => s.roadName.toLowerCase().trim() === selName && v.pos >= s.startPos - 0.005 && v.pos <= s.endPos + 0.005);
        if (isOnRoad) {
          const bucket = v.state === 'outbound' ? stats.outbound : stats.inbound;
          if (v.v < 0.5) bucket.stopped++; else if (v.v < 2) bucket.slowing++; else bucket.active++;
        }
      });
      
      const totalIn = roadVisitTrackerRef.current.inbound.get(selName)?.size || 0;
      const totalOut = roadVisitTrackerRef.current.outbound.get(selName)?.size || 0;
      stats.inbound.total = totalIn;
      stats.outbound.total = totalOut;

      // Use corridor average delay as a proxy if we're on a corridor road
      // Find which corridor this road belongs to (if any)
      const cid = ['1A', '2A', '2B', '3A'].find(id => {
        const keywords = {
          '1A': ['main rd', 'main road', 'dreyersdal'],
          '2A': ['homestead'],
          '2B': ['childrens', 'children\'s'],
          '3A': ['firgrove', 'timber']
        }[id];
        return keywords.some(k => selName.includes(k));
      });

      if (cid) {
        const inD = inboundDelayRef.current[cid], outD = outboundDelayRef.current[cid];
        stats.avgInDelay = inD.count > 0 ? (inD.total / inD.count / 60) : 0;
        stats.avgOutDelay = outD.count > 0 ? (outD.total / outD.count / 60) : 0;
      }

      onRoadStatsUpdate(stats);
    } else if (sourceRef.current === 'sumo' || sourceRef.current === 'uxsim') {
      // Playback mode: query playback source at current sim time so stats survive pause/stop.
      const pb = playbackSource?.current ?? playbackSource;
      if (pb?.isLoaded()) {
        const rs = pb.getRoadStatsDetailed(pb.getStartTime() + simTimeRef.current, currentSel.name);
        onRoadStatsUpdate(rs);
      }
      // If pb not loaded yet, leave existing stats in place rather than clearing.
    }
  }, [onRoadStatsUpdate, playbackSource]);

  const resetSim = useCallback(() => {
    loggerClear();
    vehiclesRef.current = []; simTimeRef.current = 0; spawnerStateRef.current = createSpawnerState();
    junctionStateRef.current = new Map(); resetVehicleIds();
    corridorTotalsRef.current = { '1A': 0, '1A-NORTH': 0, '2A': 0, '2B': 0, '3A': 0 };
    corridorExitsRef.current = { '1A': 0, '1A-NORTH': 0, '2A': 0, '2B': 0, '3A': 0 };
    inboundDelayRef.current = { '1A': { total: 0, count: 0 }, '1A-NORTH': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } };
    outboundDelayRef.current = { '1A': { total: 0, count: 0 }, '1A-NORTH': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } };
    roadVisitTrackerRef.current = { inbound: new Map(), outbound: new Map() };
    onRoadStatsUpdate(null);
    const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [onRoadStatsUpdate]);

  const loop = useCallback(() => {
    const dt = 0.5 * speedRef.current; simTimeRef.current += dt;
    const t = simTimeRef.current;
    
    if (sourceRef.current === 'sumo' || sourceRef.current === 'uxsim') {
      const pb = playbackSource?.current ?? playbackSource;
      if (!pb?.isLoaded()) { rafRef.current = requestAnimationFrame(loopRef.current); return; }
      const absT = pb.getStartTime() + t;
      const vehicles = pb.getVehicles(absT);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && mapRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        const vr = window.innerWidth < 768 ? 3 : 4;
        for (const v of vehicles) {
          const pt = mapRef.current.latLngToContainerPoint([v.lat, v.lng]);
          const c = COLOUR[v.corridorId] ?? COLOUR.egress;
          let colour;
          if (v.state === 'queued')                      colour = COLOUR.delayed;
          else if (v.state === 'outbound') colour = v.speed < 2 ? COLOUR.delayed : c.light;
          else if (v.speed < 2)                          colour = COLOUR.delayed;
          else                                           colour = c.dark;
          const isSelected = selectedCorridorsRef.current.has(v.corridorId);
          ctx.globalAlpha = isSelected ? 1.0 : 0.2;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, vr, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }
      // Pass relative time so the clock (which adds 6:30 base) shows correctly
      onSimUpdate(t, vehicles.length, vehicles.length);
      // Update dashboard stats and Watch My Road from playback data
      const stats = pb.getStats(absT);
      if (stats) onStatsUpdate(stats);
      const sel = selectedRoadRef.current;
      if (sel) {
        const rs = pb.getRoadStatsDetailed(absT, sel.name);
        onRoadStatsUpdate(rs);
      } else {
        onRoadStatsUpdate(null);
      }
      if (pb.isFinished(absT)) { onAutoStop(); return; }
      rafRef.current = requestAnimationFrame(loopRef.current);
      return;
    }

    if (t >= 9000) { drawFrame(); onAutoStop(); return; }

    // ── Road vehicle counts for traffic-aware junction holds ─────────────────
    // Count inbound vehicles currently on each named road segment.
    const roadCounts = {};
    vehiclesRef.current.forEach(v => {
      if (v.state !== 'inbound') return;
      const route = ROUTE_CONFIG[v.routeId];
      if (!route?.segments) return;
      for (const s of route.segments) {
        if (v.pos >= s.startPos - 0.005 && v.pos <= s.endPos + 0.005) {
          roadCounts[s.roadName] = (roadCounts[s.roadName] ?? 0) + 1;
        }
      }
    });

    const { newVehicles, congestionScores } = spawnTick(spawnerStateRef.current, t, dt, scenarioRef.current, vehiclesRef.current);
    Object.assign(congestionScoresRef.current, congestionScores);
    newVehicles.forEach(v => {
      corridorTotalsRef.current[v.corridorId]++;
      logEvent('SPAWN', v, { simTime: t, detail: `route=${v.routeId}` });
    });
    vehiclesRef.current.push(...newVehicles);

    vehiclesRef.current.forEach(v => {
      if (v.state === 'dwell') {
        processDwell(v, t, vehiclesRef.current);
        if (v.state === 'outbound') logEvent('OUTBOUND_START', v, { simTime: t });
      }
      v.simTime = t; if (!v.allJunctions) v.allJunctions = getRouteJunctions(v.routeId);
      if (v.isParking && v.pos >= (v.targetDwellPos ?? 0.1)) {
        v.state = 'dwell'; v.dwellStart = t; v.isParking = false; v.v = 0; delete v._delayedSince;
        const pk = getParkingOccupancy(vehiclesRef.current);
        v.parkingType = pk.onSite < PARKING_CAPACITY.ON_SITE ? 'on-site' : 'on-street';
        logSchoolEvent('DWELL_START', v, t, pk.onSite, pk.onStreet);
      }
      if ((v.state === 'inbound' || (v.state === 'outbound' && !v.isParking)) && v.v < 0.5) {
        if (!v._delayedSince) { v._delayedSince = t; logEvent('DELAY_START', v, { simTime: t, detail: `jIdx=${v.lastJunctionIdx}` }); }
      } else if (v._delayedSince && v.v >= 0.5) {
        delete v._delayedSince;
      }

      if (v.state === 'inbound' || v.state === 'outbound') {
        if (v.state === 'inbound' && v.v < 2 && !v.routeId.includes('RR')) {
          const sws = RAT_RUN_SWITCHES[v.routeId];
          if (sws) {
            const nextWp = v.allJunctions[v.lastJunctionIdx + 1];
            if (nextWp) {
              const distToNext = (nextWp.pos - v.pos) * (v.routeLen || 1000);
              if (distToNext < 50) {
                const candidates = sws.filter(sw => sw.atJid === nextWp.junctionId);
                if (candidates.length > 0 && Math.random() < (0.25 + (congestionScoresRef.current[v.corridorId] || 0) * 0.6)) {
                  const s = candidates[Math.floor(Math.random() * candidates.length)];
                  const newId = s.toRouteId;
                  v.routeId = newId; v.allJunctions = getRouteJunctions(newId);
                  const newJPos = v.allJunctions.find(nj => nj.junctionId === nextWp.junctionId);
                  if (newJPos) { v.pos = newJPos.pos; v.routeLen = estimateRouteLength(ROUTE_CONFIG[newId].geometry); logEvent('RAT_RUN_DIVERGE', v, { simTime: t, detail: `switched to ${newId}` }); }
                }
              }
            }
          }
        }
        const juncs = v.allJunctions; if (v.lastJunctionIdx === undefined) v.lastJunctionIdx = 0;
        if (v.holdUntil !== null && v.holdUntil <= t && v.pos < 1.0) { v.holdUntil = null; v.holdingAt = null; }
        if (v.holdUntil === null) {
          while (v.lastJunctionIdx < juncs.length - 1 && v.pos >= juncs[v.lastJunctionIdx + 1].pos) {
            const jid = juncs[v.lastJunctionIdx+1].junctionId, j = JUNCTIONS[jid];
            if (j && !['egress','roundabout_planned'].includes(j.control)) {
              const s = junctionStateRef.current.get(jid) ?? { lastRelease: 0, frameReleases: 0 };
              const h = junctionHoldDuration(jid, j.control, t, s.lastRelease, v.routeId, v.corridorId, roadCounts);
              if (h > 0) { v.holdUntil = t + h; v.holdingAt = jid; junctionStateRef.current.set(jid, s); break; }
              s.lastRelease = t; junctionStateRef.current.set(jid, s);
            }
            v.lastJunctionIdx++;
          }
        }
      }

      if (v.state === 'inbound' && v.pos >= 1.0) {
        v.pos = 1.0; v.v = 0;
        if (v.holdUntil === null) {
          const s = junctionStateRef.current.get(7) ?? { lastRelease: 0 };
          const h = junctionHoldDuration(7, 'critical', t, s.lastRelease, '', '', roadCounts);
          if (h > 0) { v.holdUntil = t + h; } else {
            const p = getParkingOccupancy(vehiclesRef.current);
            if (!p.isFull) {
              const d = inboundDelayRef.current[v.corridorId]; d.total += (t - v.spawnTime); d.count++;
              const egressId = pickEgressRoute(scenarioRef.current, v.corridorId, v.isLocal); v.state = 'outbound'; v.routeId = egressId; v.pos = 0;
              v.routeLen = estimateRouteLength(ROUTE_CONFIG[egressId].geometry); v.allJunctions = getRouteJunctions(egressId);
              v.lastJunctionIdx = 0; v.targetDwellPos = 0.02 + Math.random() * 0.08; v.isParking = true;
              v.holdUntil = null; v.holdingAt = null; junctionStateRef.current.set(7, { lastRelease: t });
            } else { v.holdingAt = 7; }
          }
        } else if (v.holdUntil <= t) {
          const p = getParkingOccupancy(vehiclesRef.current);
          if (!p.isFull) {
            const d = inboundDelayRef.current[v.corridorId]; d.total += (t - v.spawnTime); d.count++;
            const egressId = pickEgressRoute(scenarioRef.current, v.corridorId, v.isLocal); v.state = 'outbound'; v.routeId = egressId; v.pos = 0;
            v.routeLen = estimateRouteLength(ROUTE_CONFIG[egressId].geometry); v.allJunctions = getRouteJunctions(egressId);
            v.lastJunctionIdx = 0; v.targetDwellPos = 0.02 + Math.random() * 0.08; v.isParking = true;
            v.holdUntil = null; v.holdingAt = null; junctionStateRef.current.set(7, { lastRelease: t });
          } else { v.holdingAt = 7; v.holdUntil = null; }
        }
      }
    });

    stepAllVehicles(vehiclesRef.current, dt, ROUTE_CONFIG, t);

    vehiclesRef.current.forEach(v => {
      const route = ROUTE_CONFIG[v.routeId]; if (!route?.segments) return;
      for (const s of route.segments) {
        if (v.pos >= s.startPos - 0.005 && v.pos <= s.endPos + 0.005) {
          const tracker = v.state === 'outbound' ? roadVisitTrackerRef.current.outbound : roadVisitTrackerRef.current.inbound;
          const roadKey = s.roadName.toLowerCase().trim();
          if (!tracker.has(roadKey)) tracker.set(roadKey, new Set());
          tracker.get(roadKey).add(v.id);
        }
      }
    });

    const remaining = [];
    vehiclesRef.current.forEach(v => {
      if (v.state === 'outbound' && v.pos >= 1.0) {
        v.v = 0; v.pos = 1.0;
        if (v.holdUntil === null) {
          const finalJid = v.allJunctions[v.allJunctions.length - 1].junctionId;
          const j = JUNCTIONS[finalJid];
          if (j) {
            const s = junctionStateRef.current.get(finalJid) ?? { lastRelease: 0 };
            const h = junctionHoldDuration(finalJid, j.control, t, s.lastRelease, v.routeId, v.corridorId, roadCounts);
            if (h > 0) { v.holdUntil = t + h; v.holdingAt = finalJid; remaining.push(v); return; }
            s.lastRelease = t; junctionStateRef.current.set(finalJid, s);
          }
        } else if (v.holdUntil > t) { remaining.push(v); return; }
        if (corridorExitsRef.current[v.corridorId] !== undefined) {
          corridorExitsRef.current[v.corridorId]++;
          const d = outboundDelayRef.current[v.corridorId];
          const egressStart = v.dwellStart != null ? v.dwellStart + 45 : t;
          d.total += Math.max(0, t - egressStart); d.count++;
          logEvent('EXIT', v, { simTime: t, detail: `totalTrip=${(t - v.spawnTime).toFixed(1)}s egressRoute=${v.routeId}` });
        }
      } else remaining.push(v);
    });
    vehiclesRef.current = remaining; drawFrame();

    const now = performance.now();
    if (now - lastUpdateRef.current >= 250) {
      lastUpdateRef.current = now;
      const active = vehiclesRef.current.filter(v => v.state !== 'dwell').length;
      const total = Object.values(corridorTotalsRef.current).reduce((a,b) => a+b, 0);
      onSimUpdate(t, active, total);
      onStatsUpdate(computeStats(vehiclesRef.current, corridorTotalsRef.current, corridorExitsRef.current, inboundDelayRef.current, outboundDelayRef.current, congestionScoresRef.current));
      updateRoadStats();

      // ── Periodic Global Road Logging (every 60 sim-seconds) ────────────────
      if (t - lastRoadLogRef.current >= 60 && sourceRef.current === 'live') {
        lastRoadLogRef.current = t;
        const allRoads = {};
        ROAD_LINES.forEach(f => {
          const name = f.properties.name;
          if (name) {
            allRoads[name] = {
              inbound: { total: 0, active: 0, slowing: 0, stopped: 0 },
              outbound: { total: 0, active: 0, slowing: 0, stopped: 0 }
            };
          }
        });

        vehiclesRef.current.forEach(v => {
          const route = ROUTE_CONFIG[v.routeId];
          if (!route?.segments) return;
          route.segments.forEach(s => {
            if (v.pos >= s.startPos - 0.005 && v.pos <= s.endPos + 0.005) {
              const road = allRoads[s.roadName];
              if (road) {
                const bucket = v.state === 'outbound' ? road.outbound : road.inbound;
                if (v.v < 0.5) bucket.stopped++;
                else if (v.v < 2) bucket.slowing++;
                else bucket.active++;
              }
            }
          });
        });

        // Add cumulative totals
        Object.keys(allRoads).forEach(name => {
          const key = name.toLowerCase().trim();
          allRoads[name].inbound.total = roadVisitTrackerRef.current.inbound.get(key)?.size || 0;
          allRoads[name].outbound.total = roadVisitTrackerRef.current.outbound.get(key)?.size || 0;
        });

        logRoadSnapshot(t, allRoads);
      }

      pulsePhaseRef.current = (pulsePhaseRef.current + 1) % 4;

      VISIBLE_JUNCTIONS.forEach(jid => {
        const ent = junctionMarkersRef.current[jid]; if (!ent) return;
        const q = vehiclesRef.current.filter(v => v.holdingAt === jid).length, isB = q >= 2;
        ent.marker.setStyle({ color: isB ? '#ef4444' : ent.baseColor, fillOpacity: isB ? 0.35 : ([1,8,9,13,20].includes(jid) ? 0.8 : 0) });
        ent.marker.setRadius(isB && pulsePhaseRef.current < 2 ? 11 : 7);
      });
    }
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [drawFrame, computeStats, updateRoadStats, onSimUpdate, onStatsUpdate, onAutoStop, playbackSource, onRoadStatsUpdate]);
  
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { if (playing) rafRef.current = requestAnimationFrame(loopRef.current); else if (rafRef.current) cancelAnimationFrame(rafRef.current); return () => rafRef.current && cancelAnimationFrame(rafRef.current); }, [playing, loop]);
  useEffect(() => resetSim(), [scenario, source, resetSim]);
  useEffect(() => drawFrame(), [showRoutes, selectedCorridors, drawFrame]);

  // Supply road geometry to the playback engine so it can interpolate vehicle positions.
  // The scenario JSON uses snake_case road_ids; the GeoJSON uses display names — we normalise
  // and add aliases for the four roads whose names differ between the two datasets.
  useEffect(() => {
    const aliases = {
      'tokai_high_school_internal_road': 'school_internal_road',
      'clement_road':                    'clement_way',
      'lakeview_road':                   'lake_view_road',
      'firgrove_way_service_road':       'firgrove_service_road',
    };
    const coordMap = {};
    ROAD_LINES.forEach(feat => {
      const name = feat.properties?.name;
      if (!name) return;
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      coordMap[id] = feat.geometry.coordinates; // [lon, lat][]
      if (aliases[id]) coordMap[aliases[id]] = feat.geometry.coordinates;
    });
    const pb = playbackSource?.current || playbackSource;
    if (pb?.setRoadCoords) pb.setRoadCoords(coordMap);
  }, [playbackSource]);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const isMobile = window.innerWidth < 768;
    if (selectedCorridors.size === 0 || selectedCorridors.size === 4) {
      if (isMobile) {
        // Mobile: Tight zoom on school area
        map.fitBounds([[-34.0560, 18.4450], [-34.0410, 18.4620]], { padding: [5, 5] });
      } else {
        // Desktop: Zoomed into the 4 ingress points and school
        map.fitBounds([[-34.0550, 18.4420], [-34.0390, 18.4640]], { padding: [10, 10] });
      }
    } else {
      const points = [ [JUNCTIONS[7].lat, JUNCTIONS[7].lng] ];
      selectedCorridors.forEach(cid => { const jid = ENTRY_JUNCTIONS[cid]; if (jid && JUNCTIONS[jid]) points.push([JUNCTIONS[jid].lat, JUNCTIONS[jid].lng]); });
      if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [isMobile ? 20 : 50, isMobile ? 20 : 50], animate: true, duration: 0.5 });
    }
  }, [selectedCorridors]);

  useEffect(() => {
    if (mapRef.current) return;
    const isMobile = window.innerWidth < 768;
    const map = L.map(containerRef.current, { zoomSnap: 0.1 }); mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    
    if (isMobile) {
      map.fitBounds([[-34.0560, 18.4450], [-34.0410, 18.4620]], { padding: [5, 5] });
    } else {
      map.fitBounds([[-34.0555, 18.4435], [-34.0395, 18.4635]], { padding: [4, 4] });
    }

    const outer = [[-40, 14], [-40, 23], [-30, 23], [-30, 14]], study = [[-34.0585, 18.4435], [-34.0395, 18.4435], [-34.0395, 18.4635], [-34.0585, 18.4635]];
    L.polygon([outer, study], { fillColor: '#050d1a', fillOpacity: isMobile ? 0 : 0.6, fillRule: 'evenodd', stroke: false }).addTo(map);
    const polylines = ROAD_LINES.map(feature => {
      const pl = L.polyline(feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]), { color: 'transparent', weight: 10, opacity: 0 }).addTo(map);
      pl._osmName = feature.properties?.name ?? ''; return pl;
    });
    roadPolylinesRef.current = polylines;
    polylines.forEach(pl => { pl.on('click', (e) => { L.DomEvent.stopPropagation(e); if (onRoadSelectRef.current) onRoadSelectRef.current({ name: pl._osmName }); }); });
    VISIBLE_JUNCTIONS.forEach(jid => {
      const j = JUNCTIONS[jid], style = CTRL_STYLE[j.control] || CTRL_STYLE.stop;
      let col = style.color, isE = [1,8,9,13,20].includes(jid);
      if (jid===1) col=COLOUR['1A'].base; if (jid===9) col=COLOUR['2A'].base; if (jid===8) col=COLOUR['2B'].base; if (jid===13) col=COLOUR['3A'].base; if (jid===20) col=COLOUR['egress'].base;
      const m = L.circleMarker([j.lat, j.lng], { radius: 7, color: col, weight: isE ? 2 : 1.5, opacity: isE ? 1 : 0.6, fill: true, fillColor: isE ? col : 'transparent', fillOpacity: isE ? 0.8 : 0 }).addTo(map).bindPopup(`<b>${j.name}</b><br>${j.control}`);
      junctionMarkersRef.current[jid] = { marker: m, baseColor: col };

      // Entry/exit points get a pulsing glow DivIcon overlay
      if ([1, 8, 9, 13].includes(jid)) {
        const pulseIcon = L.divIcon({
          className: '',
          html: `<div style="width:18px;height:18px;border-radius:50%;border:2px solid ${col};animation:school-shadow-pulse 2s ease-in-out infinite;animation-delay:${jid * 0.15}s;"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([j.lat, j.lng], { icon: pulseIcon, interactive: false, zIndexOffset: -50 }).addTo(map);
      }
    });

    // ── School site marker — zoom-responsive GraduationCap icon ──────────────
    // Centred on the school building, sized to fill the site at current zoom.
    // Lucide GraduationCap SVG path rendered as a DivIcon so it geo-anchors correctly.
    const SCHOOL_LAT = -34.05170930678455, SCHOOL_LNG = 18.44881259634893;
    const schoolMarkerRef = { current: null };

    const makeSchoolIcon = (zoom) => {
      const size = Math.round(16 * Math.pow(2, zoom - 14) * 0.8);
      const clamped = Math.max(8, Math.min(200, size));
      const pad = Math.max(2, Math.round(clamped * 0.12));
      const total = clamped + pad * 2;
      return L.divIcon({
        className: '',
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="${clamped}" height="${clamped}" viewBox="0 0 24 24" fill="none" stroke="#A1CCA5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="animation:school-shadow-pulse 2s ease-in-out infinite;">
          <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/>
          <path d="M6 18h1"/><path d="M17 18h1"/>
          <path d="M12 2v6"/><path d="M6 10v8"/><path d="M18 10v8"/>
          <path d="M6 14h12"/>
        </svg>`,
        iconSize: [clamped, clamped],
        iconAnchor: [clamped / 2, clamped / 2],
      });
    };

    const schoolMarker = L.marker([SCHOOL_LAT, SCHOOL_LNG], { icon: makeSchoolIcon(map.getZoom()), interactive: false, zIndexOffset: -100 }).addTo(map);
    schoolMarkerRef.current = schoolMarker;

    map.on('zoomend', () => {
      schoolMarker.setIcon(makeSchoolIcon(map.getZoom()));
    });

    const sync = () => { syncCanvas(); drawFrame(); };
    // invalidateSize tells Leaflet the container has resized; sync then redraws the canvas.
    const syncAll = () => { map.invalidateSize({ animate: false }); syncCanvas(); drawFrame(); };
    map.on('moveend zoomend', sync);
    map.whenReady(() => requestAnimationFrame(() => { syncAll(); }));
    const ro = new ResizeObserver(syncAll); ro.observe(containerRef.current);
    window.addEventListener('resize', syncAll);
    return () => { 
      map.remove(); mapRef.current = null; ro.disconnect(); window.removeEventListener('resize', syncAll);
      roadPolylinesRef.current.forEach(p => p.remove()); roadPolylinesRef.current = [];
    };
  }, [drawFrame, syncCanvas]);

  useEffect(() => {
    roadPolylinesRef.current.forEach(p => {
      if (selectedRoad && p._osmName === selectedRoad.name) p.setStyle({ color: '#64748b', weight: 6, opacity: 0.6 });
      else p.setStyle({ color: 'transparent', weight: 10, opacity: 0 });
    });
    updateRoadStats();
  }, [selectedRoad, updateRoadStats]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 450 }} />

      {/* Legend — draggable */}
      <div style={{ position: 'absolute', bottom: 90, left: 8, zIndex: 500, background: 'var(--surface-low)', borderRadius: 10, padding: '6px 10px', fontSize: 10, color: 'var(--on-surface)', display: 'flex', flexDirection: 'column', gap: 3, opacity: 0.95, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: `translate(${legendOffset.x}px,${legendOffset.y}px)`, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 4, marginBottom: 2, borderBottom: '1px solid var(--surface-high)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapIcon size={12} strokeWidth={2.5} />
            <button 
              className={`speed-pill${showRoutes ? ' active' : ''}`} 
              onClick={onToggleRoutes}
              style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', height: 'auto', border: 'none' }}
            >
              Show Routes
            </button>
          </div>
          <span onMouseDown={(e) => startDrag(legendDragRef, legendOffset, setLegendOffset, e)} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--muted-text)', padding: '0 2px' }} title="Drag to move">
            <GripVertical size={14} />
          </span>
        </div>        {[
          { c: COLOUR['3A'].base, l: 'Firgrove Way', s: '●' },
          { c: COLOUR['2A'].base, l: 'Homestead Av', s: '●' },
          { c: COLOUR['2B'].base, l: "Children's Way", s: '●' },
          { c: COLOUR['1A'].base, l: 'Main Rd', s: '●' },
          { c: '#fff', l: 'Rat-Run', s: '◆', stroke: '#000' },
          { c: COLOUR.delayed, l: 'Delayed', s: '●' },
          { c: COLOUR.dwell, l: 'Parked', s: '■' }
        ].map(({c, l, s, stroke}) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ 
              color: c, 
              fontSize: s === '■' ? 8 : 12, 
              width: 12, 
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              WebkitTextStroke: stroke ? `1px ${stroke}` : 'none'
            }}>{s}</span>
            {l}
          </div>
        ))}
      </div>

      {/* Sim Controls Island — draggable */}
      <div className="sim-controls-wrapper" style={{ transform: `translate(${controlsOffset.x}px, ${controlsOffset.y}px)`, flexDirection: 'column', alignItems: 'center' }}>
        <div className="player-control-micro-label">
          Play a scenario and watch the traffic wiggle!
        </div>
        <div className="sim-controls">
          {/* Drag handle */}
          <span onMouseDown={(e) => startDrag(controlsDragRef, controlsOffset, setControlsOffset, e)}
            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--muted-text)', padding: '0 4px', flexShrink: 0 }} title="Drag to reposition">
            <GripVertical size={14} />
          </span>

          <div style={{ width: 1, height: '1.25rem', background: 'var(--surface-high)', flexShrink: 0 }} />

          {/* Scenario */}
          <div className="speed-selector">
            {['L', 'M', 'H'].map(s => (
              <button key={s} className={`speed-pill${scenario === s ? ' active' : ''}`} onClick={() => onScenarioChange?.(s)}
                title={{ L: 'Low — 500 trips', M: 'Medium — 650 trips', H: 'High (TIA) — 840 trips' }[s]}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: '1.25rem', background: 'var(--surface-high)', flexShrink: 0 }} />

          {/* Play / Pause */}
          <button className="play-pause-btn" onClick={onPlayPause} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>

          {/* Speed */}
          <div className="speed-selector">
            {[1, 2, 5, 10].map(s => (
              <button key={s} className={`speed-pill${speed === s ? ' active' : ''}`} onClick={() => onSpeedChange?.(s)}>{s}×</button>
            ))}
          </div>

          <div style={{ width: 1, height: '1.25rem', background: 'var(--surface-high)', flexShrink: 0 }} />

          {/* Source */}
          <div className="speed-selector">
            {[
              { id: 'live', label: 'Live', title: 'Live IDM simulation (runs in browser)' },
              { id: 'sumo', label: 'Lab', title: 'Pre-run lab simulation (SUMO microscopic model)' },
            ].map(({ id, label, title }) => (
              <button key={id} className={`speed-pill${source === id ? ' active' : ''}`}
                onClick={() => onSourceChange?.(id)} title={title}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: '1.25rem', background: 'var(--surface-high)', flexShrink: 0 }} />

          {/* Reset + Logs */}
          <button className="speed-pill" onClick={onReset} title="Reset" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={14} />
          </button>
          {/* Log download buttons — commented out for production, re-enable for analysis
          <button className="speed-pill" onClick={loggerDownload} title="Download vehicle log (CSV)" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Download size={14} /> LOG
          </button>
          <button className="speed-pill" onClick={loggerDownloadRoadStats} title="Download road snapshot log (CSV)" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Download size={14} /> ROAD LOG
          </button>
          */}
        </div>
      </div>
    </div>
  );
}
