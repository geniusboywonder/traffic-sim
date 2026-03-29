// ── SimMap.jsx ────────────────────────────────────────────────────────────────
// Leaflet map + canvas vehicle overlay + rAF animation loop.

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  JUNCTIONS, VISIBLE_JUNCTIONS, CTRL_STYLE, ROAD_LINES, ROUTE_CONFIG,
  getWaypointPositions, getRouteJunctions,
} from '../engine/routes';
import { stepAllVehicles, junctionHoldDuration, getParkingOccupancy, PARKING_CAPACITY } from '../engine/idm';
import {
  spawnTick, processDwell, createSpawnerState, resetVehicleIds,
  pickEgressRoute, estimateRouteLength,
} from '../engine/spawner';
import { logEvent, logSchoolEvent, loggerClear } from '../engine/logger';

// Vehicle colours and corridor palette
const COLOUR = {
  dwell:    '#6b7280', // grey
  delayed:  '#ef4444', // red
  '1A':     { base: '#3b82f6', light: '#93c5fd' }, // Blue
  '2A':     { base: '#06b6d4', light: '#67e8f9' }, // Cyan
  '2B':     { base: '#6366f1', light: '#a5b4fc' }, // Indigo
  '3A':     { base: '#10b981', light: '#6ee7b7' }, // Emerald
  'egress': { base: '#f97316', light: '#fdba74' }, // Orange (Visual Only)
};

function posToLatLng(geometry, pos) {
  if (!geometry || geometry.length === 0) return null;
  const idx = Math.max(0, Math.min(1, pos)) * (geometry.length - 1);
  const lo = Math.floor(idx), hi = Math.min(lo + 1, geometry.length - 1), t = idx - lo;
  return [
    geometry[lo][0] + t * (geometry[hi][0] - geometry[lo][0]),
    geometry[lo][1] + t * (geometry[hi][1] - geometry[lo][1]),
  ];
}

export default function SimMap({ scenario, playing, speed, activeRoutes, onSimUpdate, onStatsUpdate, onAutoStop }) {
  const containerRef = useRef(null), canvasRef = useRef(null), mapRef = useRef(null);
  const vehiclesRef = useRef([]), simTimeRef = useRef(0), spawnerStateRef = useRef(createSpawnerState());
  const rafRef = useRef(null), loopRef = useRef(null), lastUpdateRef = useRef(0);
  const junctionStateRef = useRef(new Map()), junctionMarkersRef = useRef({});
  const corridorTotalsRef = useRef({ '1A': 0, '2A': 0, '2B': 0, '3A': 0 });
  const corridorExitsRef = useRef({ '1A': 0, '2A': 0, '2B': 0, '3A': 0 });
  const inboundDelayRef = useRef({ '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } });
  const outboundDelayRef = useRef({ '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } });
  const pulsePhaseRef = useRef(0);

  const scenarioRef = useRef(scenario), speedRef = useRef(speed), activeRoutesRef = useRef(activeRoutes);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { activeRoutesRef.current = activeRoutes; }, [activeRoutes]);

  const resetSim = useCallback(() => {
    loggerClear();
    vehiclesRef.current = []; simTimeRef.current = 0; spawnerStateRef.current = createSpawnerState();
    junctionStateRef.current = new Map(); resetVehicleIds();
    corridorTotalsRef.current = { '1A': 0, '2A': 0, '2B': 0, '3A': 0 };
    corridorExitsRef.current = { '1A': 0, '2A': 0, '2B': 0, '3A': 0 };
    inboundDelayRef.current = { '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } };
    outboundDelayRef.current = { '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } };
    const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  const syncCanvas = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    canvasRef.current.width = containerRef.current.offsetWidth;
    canvasRef.current.height = containerRef.current.offsetHeight;
  }, []);

  const computeStats = useCallback((vehicles, totals, exits, inDelays, outDelays) => {
    const res = { corridors: {}, bottlenecks: {}, parking: {} };
    ['1A','2A','2B','3A'].forEach(cid => {
      const current = vehicles.filter(v => v.corridorId === cid && v.state === 'inbound').length;
      const inD = inDelays[cid], outD = outDelays[cid];
      res.corridors[cid] = {
        label: cid === '1A' ? 'Dreyersdal N' : cid === '2A' ? 'Homestead' : cid === '2B' ? "Children's Way" : 'Firgrove Way',
        current, total: totals[cid], exited: exits[cid], maxVehicles: 50,
        avgInDelay: inD.count > 0 ? Math.round(inD.total / inD.count) : 0,
        avgOutDelay: outD.count > 0 ? Math.round(outD.total / outD.count) : 0
      };
    });
    res.bottlenecks = {
      christopher: { label: 'Christopher Rd', current: vehicles.filter(v => v.state === 'inbound' && v.pos > 0.6 && ['1A','2A','2B','3A'].some(r => v.routeId.includes(r))).length, maxVehicles: 15 },
      ruskin: { label: 'Ruskin Rd (ingress)', queued: vehicles.filter(v => v.state === 'inbound' && v.pos > 0.85 && v.v < 0.5).length, maxVehicles: 20 },
      aristea: { label: 'Aristea Rd (egress)', current: vehicles.filter(v => v.state === 'outbound').length, maxVehicles: 10 }
    };
    const p = getParkingOccupancy(vehicles);
    res.parking = { onSite: p.onSite, onStreet: p.onStreet };
    return res;
  }, []);

  const drawFrame = useCallback(() => {
    const map = mapRef.current, canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Route Overlays
    if (activeRoutesRef.current.size > 0) {
      Object.values(ROUTE_CONFIG).forEach(route => {
        if (!route.geometry || !activeRoutesRef.current.has(route.corridor)) return;
        ctx.beginPath(); ctx.strokeStyle = COLOUR[route.corridor].base; ctx.lineWidth = route.type === 'ratrun' ? 2 : 3;
        ctx.globalAlpha = 0.3; if (route.type === 'ratrun') ctx.setLineDash([5,5]); else ctx.setLineDash([]);
        route.geometry.forEach((ll, i) => { const pt = map.latLngToContainerPoint(L.latLng(ll[0], ll[1])); if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
        ctx.stroke();
      });
    }

    // Vehicles
    vehiclesRef.current.forEach(v => {
      const route = ROUTE_CONFIG[v.routeId]; if (!route?.geometry) return;
      const latlng = posToLatLng(route.geometry, v.pos); if (!latlng) return;
      const pt = map.latLngToContainerPoint(L.latLng(latlng[0], latlng[1]));
      
      let col;
      if (v.state === 'dwell' || v.isParking) {
        col = COLOUR.dwell; // grey: parked or driving to bay
      } else if (v.v < 2) {
        col = COLOUR.delayed; // red: stopped/queued in street network
      } else if (v.state === 'inbound' && route.type === 'ratrun') {
        col = COLOUR[v.corridorId]?.light || COLOUR['1A'].light;
      } else {
        col = COLOUR[v.corridorId]?.base || COLOUR['1A'].base; // corridor colour throughout
      }
      
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2); ctx.fillStyle = col; ctx.fill();
    });

    // Internal Road Visuals (Grey Dotted Line)
    const internal = ROAD_LINES.find(f => f.properties.name?.toLowerCase().includes('internal road'));
    if (internal) {
      ctx.beginPath(); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.setLineDash([4,4]); ctx.globalAlpha = 0.8;
      internal.geometry.coordinates.forEach((cl, i) => { const pt = map.latLngToContainerPoint(L.latLng(cl[1], cl[0])); if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }, []);

  const loop = useCallback(() => {
    const dt = 0.5 * speedRef.current; simTimeRef.current += dt;
    const t = simTimeRef.current;
    if (t >= 9000) { drawFrame(); onAutoStop(); return; }

    const newV = spawnTick(spawnerStateRef.current, t, dt, scenarioRef.current, vehiclesRef.current);
    newV.forEach(v => {
      corridorTotalsRef.current[v.corridorId]++;
      logEvent('SPAWN', v, { simTime: t, detail: `route=${v.routeId}` });
      if (ROUTE_CONFIG[v.routeId]?.type === 'ratrun') {
        logEvent('RAT_RUN', v, { simTime: t, detail: `corridor=${v.corridorId} route=${v.routeId}` });
      }
    });
    vehiclesRef.current.push(...newV);

    junctionStateRef.current.forEach(s => s.frameReleases = 0);
    stepAllVehicles(vehiclesRef.current, dt, ROUTE_CONFIG, t);

    vehiclesRef.current.forEach(v => {
      if (v.state === 'dwell') {
        processDwell(v, t, vehiclesRef.current);
        if (v.state === 'outbound') logEvent('OUTBOUND_START', v, { simTime: t });
      }
      v.simTime = t; if (!v.allJunctions) v.allJunctions = getRouteJunctions(v.routeId);

      // Distributed Drop-off: Pull into bay once target position reached
      if (v.isParking && v.pos >= (v.targetDwellPos ?? 0.1)) {
        v.state = 'dwell';
        v.dwellStart = t;
        v.isParking = false;
        v.v = 0;
        delete v._delayedSince;
        const pk = getParkingOccupancy(vehiclesRef.current);
        v.parkingType = pk.onSite < PARKING_CAPACITY.ON_SITE ? 'on-site' : 'on-street';
        logSchoolEvent('DWELL_START', v, t, pk.onSite, pk.onStreet);
      }

      // Delay tracking
      if ((v.state === 'inbound' || (v.state === 'outbound' && !v.isParking)) && v.v < 0.5) {
        if (!v._delayedSince) {
          v._delayedSince = t;
          logEvent('DELAY_START', v, { simTime: t, detail: `jIdx=${v.lastJunctionIdx} holdAt=${v.holdingAt ?? 'none'}` });
        }
      } else if (v._delayedSince && v.v >= 0.5) {
        logEvent('DELAY_END', v, { simTime: t, detail: `delayedFor=${(t - v._delayedSince).toFixed(1)}s` });
        delete v._delayedSince;
      }

      if (v.state === 'inbound' || v.state === 'outbound') {
        const juncs = v.allJunctions; if (v.lastJunctionIdx === undefined) v.lastJunctionIdx = 0;
        if (v.holdUntil !== null && v.holdUntil <= t && v.pos < 1.0) { v.holdUntil = null; v.holdingAt = null; }
        if (v.holdUntil === null) {
          while (v.lastJunctionIdx < juncs.length - 1 && v.pos >= juncs[v.lastJunctionIdx + 1].pos) {
            const jid = juncs[v.lastJunctionIdx+1].junctionId, j = JUNCTIONS[jid];
            if (j && !['egress','roundabout_planned'].includes(j.control)) {
              const s = junctionStateRef.current.get(jid) ?? { lastRelease: 0, frameReleases: 0 };
              const h = junctionHoldDuration(j.control, t, s.frameReleases, s.lastRelease, v.routeId, v.corridorId);
              if (h > 0) {
                v.holdUntil = t + h; v.holdingAt = jid;
                junctionStateRef.current.set(jid, s);
                logEvent('JUNCTION_HOLD', v, { simTime: t, detail: `J${jid}(${j.control}) hold=${h.toFixed(1)}s` });
                break;
              }
              logEvent('JUNCTION_PASS', v, { simTime: t, detail: `J${jid}(${j.control})` });
              s.lastRelease = t; s.frameReleases++; junctionStateRef.current.set(jid, s);
            }
            v.lastJunctionIdx++;
          }
        }
      }

      // School Gate (J7) Transition
      if (v.state === 'inbound' && v.pos >= 1.0) {
        v.pos = 1.0; v.v = 0;
        if (v.holdUntil === null) {
          const s = junctionStateRef.current.get(7) ?? { lastRelease: 0 };
          const h = junctionHoldDuration('critical', t, 0, s.lastRelease);
          if (h > 0) {
            v.holdUntil = t + h;
            logEvent('AT_J7_WAITING', v, { simTime: t, detail: `hold=${h.toFixed(1)}s` });
          } else {
            const p = getParkingOccupancy(vehiclesRef.current);
            if (!p.isFull) {
              const d = inboundDelayRef.current[v.corridorId]; d.total += (t - v.spawnTime); d.count++;
              const wasRatRun = ROUTE_CONFIG[v.routeId]?.type === 'ratrun';
              logSchoolEvent('AT_J7', v, t, p.onSite, p.onStreet, `inboundDelay=${(t - v.spawnTime).toFixed(0)}s${wasRatRun ? ' ratrun=true' : ''}`);
              const egressId = pickEgressRoute();
              const route = ROUTE_CONFIG[egressId];
              v.state = 'outbound';
              v.routeId = egressId;
              v.pos = 0;
              v.routeLen = estimateRouteLength(route.geometry);
              v.allJunctions = getRouteJunctions(egressId);
              v.lastJunctionIdx = 0;
              v.targetDwellPos = 0.02 + Math.random() * 0.08;
              v.isParking = true;
              v.holdUntil = null; v.holdingAt = null;
              junctionStateRef.current.set(7, { lastRelease: t });
            } else {
              v.holdingAt = 7;
              logEvent('AT_J7_WAITING', v, { simTime: t, detail: 'parking_full' });
            }
          }
        } else if (v.holdUntil <= t) {
          const p = getParkingOccupancy(vehiclesRef.current);
          if (!p.isFull) {
            const d = inboundDelayRef.current[v.corridorId]; d.total += (t - v.spawnTime); d.count++;
            const wasRatRun2 = ROUTE_CONFIG[v.routeId]?.type === 'ratrun';
            logSchoolEvent('AT_J7', v, t, p.onSite, p.onStreet, `inboundDelay=${(t - v.spawnTime).toFixed(0)}s${wasRatRun2 ? ' ratrun=true' : ''}`);
            const egressId = pickEgressRoute();
            const route = ROUTE_CONFIG[egressId];
            v.state = 'outbound';
            v.routeId = egressId;
            v.pos = 0;
            v.routeLen = estimateRouteLength(route.geometry);
            v.allJunctions = getRouteJunctions(egressId);
            v.lastJunctionIdx = 0;
            v.targetDwellPos = 0.02 + Math.random() * 0.08;
            v.isParking = true;
            v.holdUntil = null; v.holdingAt = null;
            junctionStateRef.current.set(7, { lastRelease: t });
          } else { v.holdingAt = 7; v.holdUntil = null; logEvent('AT_J7_WAITING', v, { simTime: t, detail: 'parking_full' }); }
        }
      }
    });

    const remaining = [];
    vehiclesRef.current.forEach(v => {
      if (v.state === 'outbound' && v.pos >= 1.0) {
        if (corridorExitsRef.current[v.corridorId] !== undefined) {
          corridorExitsRef.current[v.corridorId]++;
          const d = outboundDelayRef.current[v.corridorId];
          d.total += Math.max(0, t - (v.dwellStart + 45));
          d.count++;
        }
        logEvent('EGRESS_COMPLETE', v, { simTime: t, detail: `route=${v.routeId}` });
      } else remaining.push(v);
    });
    vehiclesRef.current = remaining; drawFrame();

    const now = performance.now();
    if (now - lastUpdateRef.current >= 250) {
      lastUpdateRef.current = now;
      const active = vehiclesRef.current.filter(v => v.state !== 'dwell').length;
      const total = Object.values(corridorTotalsRef.current).reduce((a,b) => a+b, 0);
      onSimUpdate(t, active, total);
      onStatsUpdate(computeStats(vehiclesRef.current, corridorTotalsRef.current, corridorExitsRef.current, inboundDelayRef.current, outboundDelayRef.current));
      
      pulsePhaseRef.current = (pulsePhaseRef.current + 1) % 4;
      VISIBLE_JUNCTIONS.forEach(jid => {
        const ent = junctionMarkersRef.current[jid]; if (!ent) return;
        const q = vehiclesRef.current.filter(v => v.holdingAt === jid).length, isB = q >= 2;
        ent.marker.setStyle({ color: isB ? '#ef4444' : ent.baseColor, fillOpacity: isB ? 0.35 : ([1,8,9,13,20].includes(jid) ? 0.8 : 0) });
        ent.marker.setRadius(isB && pulsePhaseRef.current < 2 ? 11 : 7);
      });
    }
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [drawFrame, computeStats, onSimUpdate, onStatsUpdate, onAutoStop]);
  loopRef.current = loop;

  useEffect(() => { if (playing) rafRef.current = requestAnimationFrame(loopRef.current); else if (rafRef.current) cancelAnimationFrame(rafRef.current); return () => rafRef.current && cancelAnimationFrame(rafRef.current); }, [playing, loop]);
  useEffect(() => resetSim(), [scenario, resetSim]);
  useEffect(() => drawFrame(), [activeRoutes, drawFrame]);

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, { zoomSnap: 0.1 }); mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    map.fitBounds([[-34.0568, 18.4465], [-34.0400, 18.4625]], { padding: [18, 18] });
    const outer = [[-40, 14], [-40, 23], [-30, 23], [-30, 14]], study = [[-34.0585, 18.4435], [-34.0395, 18.4435], [-34.0395, 18.4635], [-34.0585, 18.4635]];
    L.polygon([outer, study], { fillColor: '#050d1a', fillOpacity: 0.6, fillRule: 'evenodd', stroke: false }).addTo(map);
    VISIBLE_JUNCTIONS.forEach(jid => {
      const j = JUNCTIONS[jid], style = CTRL_STYLE[j.control] || CTRL_STYLE.stop;
      let col = style.color, isE = [1,8,9,13,20].includes(jid);
      if (jid===1) col=COLOUR['1A'].base; if (jid===9) col=COLOUR['2A'].base; if (jid===8) col=COLOUR['2B'].base; if (jid===13) col=COLOUR['3A'].base; if (jid===20) col=COLOUR['egress'].base;
      const m = L.circleMarker([j.lat, j.lng], { radius: 7, color: col, weight: isE ? 2 : 1.5, opacity: isE ? 1 : 0.6, fill: true, fillColor: isE ? col : 'transparent', fillOpacity: isE ? 0.8 : 0 }).addTo(map).bindPopup(`<b>${j.name}</b><br>${j.control}`);
      junctionMarkersRef.current[jid] = { marker: m, baseColor: col };
    });
    const sync = () => { syncCanvas(); drawFrame(); }; map.on('moveend zoomend', sync);
    map.whenReady(() => requestAnimationFrame(() => { syncCanvas(); drawFrame(); }));
    const ro = new ResizeObserver(sync); ro.observe(containerRef.current);
    window.addEventListener('resize', syncCanvas);
    return () => { map.remove(); mapRef.current = null; ro.disconnect(); window.removeEventListener('resize', syncCanvas); };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 450 }} />
      <div style={{ position: 'absolute', bottom: 30, left: 8, zIndex: 500, background: 'rgba(13,21,38,0.85)', border: '1px solid #1e3a5f', borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[[COLOUR['1A'].base, 'Dreyersdal N'], [COLOUR['2A'].base, 'Homestead'], [COLOUR['2B'].base, "Children's Way"], [COLOUR['3A'].base, 'Firgrove Way'], [COLOUR.delayed, 'Delayed'], [COLOUR.dwell, 'Parked']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={c} /></svg>{l}</div>
        ))}
      </div>
    </div>
  );
}
