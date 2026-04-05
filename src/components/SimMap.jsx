// ── SimMap.jsx ────────────────────────────────────────────────────────────────
// Leaflet map + canvas vehicle overlay + rAF animation loop.

import { useEffect, useRef, useCallback, useState } from 'react';
import { Play, Pause, RotateCcw, Download, GripVertical, Map as MapIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  JUNCTIONS, VISIBLE_JUNCTIONS, CTRL_STYLE, ROAD_LINES, ROUTE_CONFIG,
  getRouteJunctions, RAT_RUN_SWITCHES
} from '../engine/routes';
import { stepAllVehicles } from '../engine/idm';
import {
  spawnTick, processDwell, createSpawnerState, resetVehicleIds,
} from '../engine/spawner';
import { logEvent, logSchoolEvent, loggerClear, logRoadSnapshot, loggerDownload, loggerDownloadRoadStats } from '../engine/logger';
import {
  SIM_MAP_COLOURS as COLOUR,
  ENTRY_JUNCTIONS,
  SHOW_DEBUG_LOGGER,
  buildPlaybackRoadCoordMap,
  computeCorridorStats,
  createCorridorCountMap,
  createDelayBuckets,
  createRoadVisitTracker,
  findCorridorForRoadName,
  interpolateRoutePosition,
} from './simMapUtils';
import {
  buildInboundRoadCounts,
  logRoadSnapshotIfDue,
  refreshJunctionMarkers,
  renderPlaybackVehicles,
  updateRoadVisitTracker,
} from './simMapFrameHandlers';
import { finalizeOutboundVehicles, updateVehicleState } from './simMapLiveSim';

export default function SimMap({ scenario, playing, speed, showRoutes, onToggleRoutes, selectedCorridors, source, playbackSource, onSimUpdate, onStatsUpdate, onRoadStatsUpdate, onAutoStop, onRoadSelect, selectedRoad, onPlayPause, onReset, onSpeedChange, onScenarioChange, onSourceChange }) {
  const containerRef = useRef(null), canvasRef = useRef(null), mapRef = useRef(null);
  const vehiclesRef = useRef([]), simTimeRef = useRef(0), spawnerStateRef = useRef(createSpawnerState());
  const rafRef = useRef(null), loopRef = useRef(null), lastUpdateRef = useRef(0);
  const isMobile = window.innerWidth < 768;

  // Draggable controls and legend
  const [controlsOffset, setControlsOffset] = useState({ x: 0, y: 0 });
  const [legendOffset, setLegendOffset]     = useState({ x: 0, y: 0 });
  const [legendOpen, setLegendOpen]         = useState(true);
  const controlsDragRef = useRef(null);
  const legendDragRef   = useRef(null);

  const startDrag = useCallback((dragRef, currentOffset, setOffset, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: currentOffset.x,
      origY: currentOffset.y,
    };

    const onMove = (moveEvent) => {
      if (!dragRef.current || moveEvent.pointerId !== dragRef.current.pointerId) return;
      setOffset({
        x: dragRef.current.origX + (moveEvent.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (moveEvent.clientY - dragRef.current.startY),
      });
    };

    const onUp = (upEvent) => {
      if (!dragRef.current || upEvent.pointerId !== dragRef.current.pointerId) return;
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    event.preventDefault();
  }, []);
  const junctionStateRef = useRef(new Map()), junctionMarkersRef = useRef({});
  const corridorTotalsRef = useRef(createCorridorCountMap());
  const corridorExitsRef = useRef(createCorridorCountMap());
  const inboundDelayRef = useRef(createDelayBuckets());
  const outboundDelayRef = useRef(createDelayBuckets());
  const pulsePhaseRef = useRef(0);
  const congestionScoresRef = useRef({ '1A': 0, '2A': 0, '2B': 0, '3A': 0 });
  const roadVisitTrackerRef = useRef(createRoadVisitTracker());
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
      const latlng = interpolateRoutePosition(route.geometry, v.pos); if (!latlng) return;
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
      const cid = findCorridorForRoadName(selName);

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

  const handlePlaybackFrame = useCallback((t) => {
    const pb = playbackSource?.current ?? playbackSource;
    if (!pb?.isLoaded()) {
      rafRef.current = requestAnimationFrame(loopRef.current);
      return true;
    }

    const absT = pb.getStartTime() + t;
    const vehicles = pb.getVehicles(absT);
    const ctx = canvasRef.current?.getContext('2d');

    renderPlaybackVehicles({
      ctx,
      map: mapRef.current,
      canvas: canvasRef.current,
      vehicles,
      selectedCorridors: selectedCorridorsRef.current,
      isMobile: window.innerWidth < 768,
    });

    onSimUpdate(t, vehicles.length, vehicles.length);
    const stats = pb.getStats(absT);
    if (stats) onStatsUpdate(stats);

    const selected = selectedRoadRef.current;
    if (selected) {
      onRoadStatsUpdate(pb.getRoadStatsDetailed(absT, selected.name));
    } else {
      onRoadStatsUpdate(null);
    }

    if (pb.isFinished(absT)) {
      onAutoStop();
      return true;
    }

    rafRef.current = requestAnimationFrame(loopRef.current);
    return true;
  }, [onAutoStop, onRoadStatsUpdate, onSimUpdate, onStatsUpdate, playbackSource]);

  const finalizeLiveFrame = useCallback((t) => {
    const now = performance.now();
    if (now - lastUpdateRef.current < 250) return;

    lastUpdateRef.current = now;
    const active = vehiclesRef.current.filter(v => v.state !== 'dwell').length;
    const total = Object.values(corridorTotalsRef.current).reduce((a, b) => a + b, 0);

    onSimUpdate(t, active, total);
    onStatsUpdate(computeCorridorStats(
      vehiclesRef.current,
      corridorTotalsRef.current,
      corridorExitsRef.current,
      inboundDelayRef.current,
      outboundDelayRef.current,
      congestionScoresRef.current,
    ));
    updateRoadStats();

    logRoadSnapshotIfDue({
      simTime: t,
      lastRoadLogRef,
      source: sourceRef.current,
      roadLines: ROAD_LINES,
      vehicles: vehiclesRef.current,
      routeConfig: ROUTE_CONFIG,
      roadVisitTracker: roadVisitTrackerRef.current,
      logRoadSnapshot,
    });

    pulsePhaseRef.current = (pulsePhaseRef.current + 1) % 4;
    refreshJunctionMarkers({
      visibleJunctions: VISIBLE_JUNCTIONS,
      junctionMarkers: junctionMarkersRef.current,
      vehicles: vehiclesRef.current,
      pulsePhase: pulsePhaseRef.current,
      entryJunctionIds: [1, 8, 9, 13, 20],
    });
  }, [onSimUpdate, onStatsUpdate, updateRoadStats]);

  const resetSim = useCallback(() => {
    loggerClear();
    vehiclesRef.current = []; simTimeRef.current = 0; spawnerStateRef.current = createSpawnerState();
    junctionStateRef.current = new Map(); resetVehicleIds();
    corridorTotalsRef.current = createCorridorCountMap();
    corridorExitsRef.current = createCorridorCountMap();
    inboundDelayRef.current = createDelayBuckets();
    outboundDelayRef.current = createDelayBuckets();
    roadVisitTrackerRef.current = createRoadVisitTracker();
    onRoadStatsUpdate(null);
    const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [onRoadStatsUpdate]);

  const loop = useCallback(() => {
    const dt = 0.5 * speedRef.current; simTimeRef.current += dt;
    const t = simTimeRef.current;
    
    if (sourceRef.current === 'sumo' || sourceRef.current === 'uxsim') {
      if (handlePlaybackFrame(t)) return;
      return;
    }

    if (t >= 9000) { drawFrame(); onAutoStop(); return; }

    // ── Road vehicle counts for traffic-aware junction holds ─────────────────
    // Count inbound vehicles currently on each named road segment.
    const roadCounts = buildInboundRoadCounts(vehiclesRef.current, ROUTE_CONFIG);

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
      updateVehicleState({
        vehicle: v,
        simTime: t,
        vehicles: vehiclesRef.current,
        routeConfig: ROUTE_CONFIG,
        roadCounts,
        junctions: JUNCTIONS,
        junctionState: junctionStateRef.current,
        ratRunSwitches: RAT_RUN_SWITCHES,
        congestionScores: congestionScoresRef.current,
        scenario: scenarioRef.current,
        inboundDelay: inboundDelayRef.current,
        getRouteJunctions,
        logEvent,
        logSchoolEvent,
      });
    });

    stepAllVehicles(vehiclesRef.current, dt, ROUTE_CONFIG, t);

    updateRoadVisitTracker(roadVisitTrackerRef.current, vehiclesRef.current, ROUTE_CONFIG);

    vehiclesRef.current = finalizeOutboundVehicles({
      vehicles: vehiclesRef.current,
      simTime: t,
      roadCounts,
      junctions: JUNCTIONS,
      junctionState: junctionStateRef.current,
      corridorExits: corridorExitsRef.current,
      outboundDelay: outboundDelayRef.current,
      logEvent,
    });
    drawFrame();

    finalizeLiveFrame(t);
    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [drawFrame, finalizeLiveFrame, handlePlaybackFrame, onAutoStop]);
  
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { if (playing) rafRef.current = requestAnimationFrame(loopRef.current); else if (rafRef.current) cancelAnimationFrame(rafRef.current); return () => rafRef.current && cancelAnimationFrame(rafRef.current); }, [playing, loop]);
  useEffect(() => resetSim(), [scenario, source, resetSim]);
  useEffect(() => drawFrame(), [showRoutes, selectedCorridors, drawFrame]);

  // Supply road geometry to the playback engine so it can interpolate vehicle positions.
  // The scenario JSON uses snake_case road_ids; the GeoJSON uses display names — we normalise
  // and add aliases for the four roads whose names differ between the two datasets.
  useEffect(() => {
    const coordMap = buildPlaybackRoadCoordMap(ROAD_LINES);
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
      const isEntryPoint = [1, 8, 9, 13].includes(jid);
      const m = L.circleMarker([j.lat, j.lng], { radius: 7, color: col, weight: isE ? 2 : 1.5, opacity: isEntryPoint ? 0 : (isE ? 1 : 0.6), fill: true, fillColor: isE ? col : 'transparent', fillOpacity: isEntryPoint ? 0 : (isE ? 0.8 : 0) }).addTo(map).bindPopup(`<b>${j.name}</b><br>${j.control}`);
      junctionMarkersRef.current[jid] = { marker: m, baseColor: col };

      // Entry points get a ✱ DivIcon in their corridor colour with pulse
      if (isEntryPoint) {
        const starIcon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:900;color:${col};animation:school-shadow-pulse 2s ease-in-out infinite;animation-delay:${jid * 0.15}s;filter:drop-shadow(0 0 6px ${col}) drop-shadow(0 0 3px rgba(0,0,0,0.8));line-height:1;">✱</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([j.lat, j.lng], { icon: starIcon, interactive: false, zIndexOffset: -50 }).addTo(map);
      }
    });

    // ── School site marker — zoom-responsive GraduationCap icon ──────────────
    // Centred on the school building, sized to fill the site at current zoom.
    // Lucide GraduationCap SVG path rendered as a DivIcon so it geo-anchors correctly.
    const SCHOOL_LAT = -34.05170930678455, SCHOOL_LNG = 18.44881259634893;
    const schoolMarkerRef = { current: null };

    const makeSchoolIcon = (zoom) => {
      const size = Math.round(16 * Math.pow(2, zoom - 14) * 0.8);
      const clamped = Math.max(10, Math.min(200, size));
      const fontSize = Math.max(10, Math.min(180, clamped));
      return L.divIcon({
        className: '',
        html: `<div style="width:${clamped}px;height:${clamped}px;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-size:${fontSize}px;font-weight:900;color:#1a3d20;animation:school-shadow-pulse 2s ease-in-out infinite;filter:drop-shadow(0 0 6px rgba(161,204,165,0.8)) drop-shadow(0 0 3px rgba(0,0,0,0.8));line-height:1;">✱</div>`,
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

      {/* Legend — collapsible + draggable */}
      <div className="sim-map-legend" style={{ position: 'absolute', bottom: 90, left: 8, zIndex: 500, background: 'var(--surface-low)', borderRadius: 10, padding: isMobile ? '4px 7px' : '6px 10px', fontSize: isMobile ? 8 : 10, color: 'var(--on-surface)', display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 3, opacity: 0.95, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transform: `translate(${legendOffset.x}px,${legendOffset.y}px)`, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: legendOpen ? 4 : 0, marginBottom: legendOpen ? 2 : 0, borderBottom: legendOpen ? '1px solid var(--surface-high)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setLegendOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--on-surface)', padding: 0, fontSize: isMobile ? 8 : 10, fontWeight: 700 }}
              title={legendOpen ? 'Collapse legend' : 'Expand legend'}
            >
              <MapIcon size={isMobile ? 10 : 12} strokeWidth={2.5} />
              <span style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>Legend</span>
              <span style={{ fontSize: isMobile ? 7 : 9, opacity: 0.5 }}>{legendOpen ? '▲' : '▼'}</span>
            </button>
          </div>
          <span
            onPointerDown={(e) => startDrag(legendDragRef, legendOffset, setLegendOffset, e)}
            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--muted-text)', padding: '0 2px', touchAction: 'none' }}
            title="Drag to move"
          >
            <GripVertical size={isMobile ? 10 : 14} />
          </span>
        </div>
        {legendOpen && <>
          <button 
            className={`speed-pill${showRoutes ? ' active' : ''}`} 
            onClick={onToggleRoutes}
            style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', padding: '0.2rem 0.5rem', height: 'auto', border: 'none', marginBottom: 2 }}
          >
            Show Routes
          </button>
          {[
            { c: COLOUR['3A'].base, l: 'Firgrove Way', s: '●' },
            { c: COLOUR['2A'].base, l: 'Homestead Av', s: '●' },
            { c: COLOUR['2B'].base, l: "Children's Way", s: '●' },
            { c: COLOUR['1A'].base, l: 'Main Rd', s: '●' },
            { c: '#fff', l: 'Rat-Run', s: '◆', stroke: '#000' },
            { c: COLOUR.delayed, l: 'Delayed', s: '●' },
            { c: COLOUR.dwell, l: 'Parked', s: '■' }
          ].map(({c, l, s, stroke}) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6 }}>
              <span style={{ 
                color: c, 
                fontSize: s === '■' ? (isMobile ? 6 : 8) : (isMobile ? 9 : 12), 
                width: isMobile ? 9 : 12, 
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTextStroke: stroke ? `1px ${stroke}` : 'none'
              }}>{s}</span>
              {l}
            </div>
          ))}
        </>}
      </div>

      {/* Sim Controls Island — draggable */}
      <div className="sim-controls-wrapper" style={{ transform: `translate(${controlsOffset.x}px, ${controlsOffset.y}px)`, flexDirection: 'column', alignItems: 'center' }}>
        <div className="player-control-micro-label">
          Play a scenario and watch the traffic wiggle!
        </div>
        <div className="sim-controls">
          {/* Drag handle */}
          <span
            onPointerDown={(e) => startDrag(controlsDragRef, controlsOffset, setControlsOffset, e)}
            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'var(--muted-text)', padding: '0 4px', flexShrink: 0, touchAction: 'none' }}
            title="Drag to reposition"
          >
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
          {SHOW_DEBUG_LOGGER && (
            <>
              <button className="speed-pill" onClick={loggerDownload} title="Download vehicle log (CSV)" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Download size={14} /> Events
              </button>
              <button className="speed-pill" onClick={loggerDownloadRoadStats} title="Download road snapshot log (CSV)" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Download size={14} /> Roads
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
