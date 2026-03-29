// ── SimMap.jsx ────────────────────────────────────────────────────────────────
// Leaflet map + canvas vehicle overlay + rAF animation loop.

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  JUNCTIONS, VISIBLE_JUNCTIONS, CTRL_STYLE, ROAD_LINES, ROUTE_CONFIG,
  getWaypointPositions, getRouteJunctions,
} from '../engine/routes';
import { stepAllVehicles, junctionHoldDuration } from '../engine/idm';
import {
  spawnTick, processDwell, createSpawnerState, resetVehicleIds,
} from '../engine/spawner';

// Leaflet default icon fix for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Vehicle colours and corridor palette
const COLOUR = {
  dwell:    '#6b7280', // grey
  delayed:  '#ef4444', // red
  '1A':     { base: '#3b82f6', light: '#93c5fd' }, // Blue
  '2A':     { base: '#06b6d4', light: '#67e8f9' }, // Cyan
  '2B':     { base: '#6366f1', light: '#a5b4fc' }, // Indigo
  '3A':     { base: '#10b981', light: '#6ee7b7' }, // Emerald
  'egress': { base: '#f97316', light: '#fdba74' }, // Orange
};

// Interpolate [lat, lon] from route geometry at fractional progress pos ∈ [0,1]
function posToLatLng(geometry, pos) {
  if (!geometry || geometry.length === 0) return null;
  if (geometry.length === 1) return geometry[0];
  const clamped = Math.max(0, Math.min(1, pos));
  const idx     = clamped * (geometry.length - 1);
  const lo      = Math.floor(idx);
  const hi      = Math.min(lo + 1, geometry.length - 1);
  const t       = idx - lo;
  return [
    geometry[lo][0] + t * (geometry[hi][0] - geometry[lo][0]),
    geometry[lo][1] + t * (geometry[hi][1] - geometry[lo][1]),
  ];
}

export default function SimMap({ scenario, playing, speed, activeRoutes, onSimUpdate, onStatsUpdate, onAutoStop }) {
  const containerRef  = useRef(null);
  const canvasRef     = useRef(null);
  const mapRef        = useRef(null);

  // Simulation state — all refs to avoid React re-render per frame
  const vehiclesRef       = useRef([]);
  const simTimeRef        = useRef(0);
  const spawnerStateRef   = useRef(createSpawnerState());
  const rafRef            = useRef(null);
  const loopRef           = useRef(null); // self-ref to avoid temporal dead zone
  const lastUpdateRef     = useRef(0);   // real timestamp of last stats push
  const vehicleRadiusRef  = useRef(4);
  const junctionStateRef   = useRef(new Map()); // junction hold state
  const corridorTotalsRef  = useRef({ '1A': 0, '2A': 0, '2B': 0, '3A': 0 });
  const corridorExitsRef   = useRef({ '1A': 0, '2A': 0, '2B': 0, '3A': 0 });
  const inboundDelayRef    = useRef({ '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } });
  const outboundDelayRef   = useRef({ '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } });
  const junctionMarkersRef = useRef({}); // jid → L.CircleMarker
  const pulsePhaseRef      = useRef(0);  // increments in stats throttle for radius oscillation

  // Props as refs for stale-closure-free rAF access
  const scenarioRef     = useRef(scenario);
  const speedRef        = useRef(speed);
  const activeRoutesRef = useRef(activeRoutes);
  useEffect(() => { scenarioRef.current     = scenario;     }, [scenario]);
  useEffect(() => { speedRef.current        = speed;        }, [speed]);
  useEffect(() => { activeRoutesRef.current = activeRoutes; }, [activeRoutes]);

  // ── Reset simulation state ─────────────────────────────────────────────
  const resetSim = useCallback(() => {
    vehiclesRef.current      = [];
    simTimeRef.current       = 0;
    spawnerStateRef.current  = createSpawnerState();
    junctionStateRef.current = new Map();
    corridorTotalsRef.current = { '1A': 0, '2A': 0, '2B': 0, '3A': 0 };
    corridorExitsRef.current  = { '1A': 0, '2A': 0, '2B': 0, '3A': 0 };
    inboundDelayRef.current   = { '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } };
    outboundDelayRef.current  = { '1A': { total: 0, count: 0 }, '2A': { total: 0, count: 0 }, '2B': { total: 0, count: 0 }, '3A': { total: 0, count: 0 } };
    resetVehicleIds();
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // ── Canvas sync ────────────────────────────────────────────────────────
  const syncCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;
    canvas.width  = container.offsetWidth;
    canvas.height = container.offsetHeight;
    vehicleRadiusRef.current = window.innerWidth < 768 ? 3 : 4;
  }, []);

  // ── Compute live stats ─────────────────────────────────────────────────
  const computeStats = useCallback((vehicles, totals, exits, inDelays, outDelays) => {
    const corridorIds = ['1A', '2A', '2B', '3A'];
    const corridors   = {};

    for (const cid of corridorIds) {
      const allRoutes = [
        ROUTE_CONFIG[cid],
        ...Object.values(ROUTE_CONFIG).filter(
          (r) => r.corridor === cid && r.type === 'ratrun',
        ),
      ].filter(Boolean);

      const maxVehicles = allRoutes.reduce((s, r) => s + r.maxVehicles, 0);
      const current = vehicles.filter(
        (v) => v.corridorId === cid && v.state === 'inbound',
      ).length;
      
      const inD = inDelays?.[cid];
      const avgInDelay = inD && inD.count > 0 ? Math.round(inD.total / inD.count) : 0;
      
      const outD = outDelays?.[cid];
      const avgOutDelay = outD && outD.count > 0 ? Math.round(outD.total / outD.count) : 0;

      corridors[cid] = { 
        current, 
        total: totals?.[cid] ?? 0, 
        exited: exits?.[cid] ?? 0, 
        maxVehicles, 
        avgInDelay,
        avgOutDelay
      };
    }

    // Bottleneck segments
    const christopherRoutes = ['1A','1A-RR1','1A-RR2','2A','2A-RR2','2B','2B-RR1','2B-RR2','3A'];
    const ruskinRoutes      = ['1A','1A-RR3','1A-RR4','1A-RR5','2A-RR1','2A-RR2','2B-RR3','3A-RR1','3A-RR2'];
    const egressRoutes      = ['EG-A','EG-B','EG-C'];

    const christopherCurrent = vehicles.filter(
      (v) => christopherRoutes.includes(v.routeId) && v.state === 'inbound' && v.pos > 0.6,
    ).length;
    const ruskinQueued = vehicles.filter(
      (v) => ruskinRoutes.includes(v.routeId) && v.state === 'inbound' && v.pos > 0.85 && v.v < 0.5,
    ).length;
    const aristeaCurrent = vehicles.filter(
      (v) => egressRoutes.includes(v.routeId) && v.state === 'outbound',
    ).length;

    const parkingOnSite = vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-site').length;
    const parkingOnStreet = vehicles.filter(v => v.state === 'dwell' && v.parkingType === 'on-street').length;

    return {
      corridors: {
        '1A': { label: 'Dreyersdal Rd N', current: corridors['1A']?.current ?? 0, total: corridors['1A']?.total ?? 0, exited: corridors['1A']?.exited ?? 0, maxVehicles: corridors['1A']?.maxVehicles ?? 50, avgInDelay: corridors['1A']?.avgInDelay ?? 0, avgOutDelay: corridors['1A']?.avgOutDelay ?? 0 },
        '2A': { label: 'Homestead Ave',    current: corridors['2A']?.current ?? 0, total: corridors['2A']?.total ?? 0, exited: corridors['2A']?.exited ?? 0, maxVehicles: corridors['2A']?.maxVehicles ?? 60, avgInDelay: corridors['2A']?.avgInDelay ?? 0, avgOutDelay: corridors['2A']?.avgOutDelay ?? 0 },
        '2B': { label: "Children's Way",   current: corridors['2B']?.current ?? 0, total: corridors['2B']?.total ?? 0, exited: corridors['2B']?.exited ?? 0, maxVehicles: corridors['2B']?.maxVehicles ?? 70, avgInDelay: corridors['2B']?.avgInDelay ?? 0, avgOutDelay: corridors['2B']?.avgOutDelay ?? 0 },
        '3A': { label: 'Firgrove Way',     current: corridors['3A']?.current ?? 0, total: corridors['3A']?.total ?? 0, exited: corridors['3A']?.exited ?? 0, maxVehicles: corridors['3A']?.maxVehicles ?? 40, avgInDelay: corridors['3A']?.avgInDelay ?? 0, avgOutDelay: corridors['3A']?.avgOutDelay ?? 0 },
      },
      bottlenecks: {
        christopher: { label: 'Christopher Rd',       current: christopherCurrent, maxVehicles: 15 },
        ruskin:      { label: 'Ruskin Rd (ingress)',   queued: ruskinQueued,        maxVehicles: 20 },
        aristea:     { label: 'Aristea Rd (egress)',   current: aristeaCurrent,     maxVehicles: 10 },
      },
      parking: {
        onSite: parkingOnSite,
        onStreet: parkingOnStreet
      }
    };
  }, []);

  // ── Draw frame ─────────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const map    = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const ctx    = canvas.getContext('2d');
    
    // Fixed radius for visual clarity
    const radius = 4;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Optional: Draw route overlays
    if (activeRoutesRef.current && activeRoutesRef.current.size > 0) {
      for (const route of Object.values(ROUTE_CONFIG)) {
        if (!route.geometry || !activeRoutesRef.current.has(route.corridor)) continue;
        const pal = COLOUR[route.corridor] || { base: '#94a3b8' };
        const isRR = route.type === 'ratrun';
        
        ctx.beginPath();
        ctx.strokeStyle = pal.base;
        ctx.lineWidth   = isRR ? 2.0 : 3.0;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.globalAlpha = 0.35;
        
        if (isRR) {
          ctx.setLineDash([5, 5]);
        } else {
          ctx.setLineDash([]);
        }

        route.geometry.forEach((latlng, idx) => {
          const pt = map.latLngToContainerPoint(L.latLng(latlng[0], latlng[1]));
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }

    // Draw vehicles
    for (const v of vehiclesRef.current) {
      const route = ROUTE_CONFIG[v.routeId];
      if (!route?.geometry) continue;

      const latlng = posToLatLng(route.geometry, v.pos);
      if (!latlng) continue;

      const pt = map.latLngToContainerPoint(L.latLng(latlng[0], latlng[1]));

      let colour;
      if (v.v < 2.0) {
        colour = COLOUR.delayed;
      } else if (v.state === 'dwell') {
        colour = COLOUR.dwell;
      } else {
        const pal = COLOUR[v.corridorId] || COLOUR['1A'];
        const isRR = ROUTE_CONFIG[v.routeId]?.type === 'ratrun';
        colour = isRR ? pal.light : pal.base;
      }

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
    }

    // Always draw internal school road as a grey dotted line
    const internalRoad = ROAD_LINES.find(f => f.properties.name === 'Tokai High School Internal Road');
    if (internalRoad) {
      ctx.beginPath();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth   = 2.0;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.6;
      internalRoad.geometry.coordinates.forEach((lonlat, idx) => {
        const pt = map.latLngToContainerPoint(L.latLng(lonlat[1], lonlat[0]));
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }
  }, []);

  // ── Animation loop ─────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const dt = 0.5 * speedRef.current; // simulated seconds per frame

    // Advance time
    simTimeRef.current += dt;

    // Auto-stop at 08:30 (7200s)
    if (simTimeRef.current >= 7200) {
      simTimeRef.current = 7200;
      drawFrame();
      onAutoStop();
      return;
    }

    // Spawn new vehicles
    const newVehicles = spawnTick(
      spawnerStateRef.current,
      simTimeRef.current,
      dt,
      scenarioRef.current,
      vehiclesRef.current,
    );
    for (const v of newVehicles) {
      if (corridorTotalsRef.current[v.corridorId] !== undefined) {
        corridorTotalsRef.current[v.corridorId]++;
      }
    }
    vehiclesRef.current.push(...newVehicles);

    // Update each vehicle's simTime (used by junction hold logic)
    const t = simTimeRef.current;

    // Physics step
    stepAllVehicles(vehiclesRef.current, dt, ROUTE_CONFIG);

    // Process dwell → outbound transitions
    for (const v of vehiclesRef.current) {
      if (v.state === 'dwell') {
        processDwell(v, simTimeRef.current, vehiclesRef.current);
      }
    }

    // Mutate vehicle state — all ref-object mutations grouped here
    /* eslint-disable react-hooks/immutability */
    for (const v of vehiclesRef.current) {
      // Keep simTime in sync for junction hold checks inside stepVehicle
      v.simTime = t;

      // Cache all junction positions for robust indexing
      if (!v.allJunctions) {
        v.allJunctions = getRouteJunctions(v.routeId);
      }

      // Junction-based holds and physical segment tracking
      if (v.state === 'inbound' || v.state === 'outbound') {
        const junctions = v.allJunctions;
        if (v.lastJunctionIdx === undefined) v.lastJunctionIdx = 0;

        // Release a held vehicle when its timer expires
        if (v.holdUntil !== null && v.holdUntil <= t) {
          v.holdUntil  = null;
          v.holdingAt  = null;
        }

        // Detect new physical junction crossings (tracks which segment we are in)
        if (v.holdUntil === null) {
          // Increment index as we pass each physical junction coordinate
          while (v.lastJunctionIdx < junctions.length - 1 && v.pos >= junctions[v.lastJunctionIdx + 1].pos) {
            const nextJid = junctions[v.lastJunctionIdx + 1].junctionId;
            const j = JUNCTIONS[nextJid];
            
            // Only apply hold logic if it's a controlled junction (skipping free-flow/egress)
            if (j && !['critical', 'egress', 'roundabout_planned'].includes(j.control)) {
              const jState = junctionStateRef.current.get(nextJid) ?? { lastRelease: 0 };
              
              // Directional logic requires knowing the vehicle's route/corridor
              const hold = junctionHoldDuration(j.control, t, 0, jState.lastRelease, v.routeId, v.corridorId);
              
              if (hold > 0) {
                v.holdUntil  = t + hold;
                v.holdingAt  = nextJid;
                junctionStateRef.current.set(nextJid, { lastRelease: t });
                // Stop advancing indices while held at this junction
                break; 
              }
              junctionStateRef.current.set(nextJid, { lastRelease: t });
            }
            v.lastJunctionIdx++;
          }
        }
      }

      // School ingress hold — vehicles queue at J7 so followers show red
      if (v.state === 'inbound' && v.pos >= 1.0) {
        v.pos = 1.0;
        v.v   = 0;
        if (v.holdUntil === null) {
          const jState = junctionStateRef.current.get(7) ?? { lastRelease: 0 };
          const hold   = junctionHoldDuration('critical', t, 0, jState.lastRelease);
          v.holdUntil  = t + hold;
          if (hold <= 0) junctionStateRef.current.set(7, { lastRelease: t });
        } else if (v.holdUntil <= t) {
          // Record inbound travel time for delay counter
          const travelSec = t - v.spawnTime;
          const d = inboundDelayRef.current[v.corridorId];
          if (d) { d.total += travelSec; d.count += 1; }

          v.state      = 'dwell';
          v.dwellStart = t;
          v.holdUntil  = null;
          v.holdingAt  = null;
          junctionStateRef.current.set(7, { lastRelease: t });
        }
      }
    }
    /* eslint-enable react-hooks/immutability */

    // Remove completed outbound vehicles; attribute exits to original corridor
    const remaining = [];
    for (const v of vehiclesRef.current) {
      if (v.state === 'outbound' && v.pos >= 1.0) {
        if (corridorExitsRef.current[v.corridorId] !== undefined) {
          corridorExitsRef.current[v.corridorId]++;
          // Record outbound travel time for delay counter
          const travelSec = t - (v.dwellStart + 45); // 45s is TIA dwell time
          const d = outboundDelayRef.current[v.corridorId];
          if (d) { d.total += Math.max(0, travelSec); d.count += 1; }
        }
      } else {
        remaining.push(v);
      }
    }
    vehiclesRef.current = remaining;

    // Draw vehicles on canvas
    drawFrame();

    // Push stats to React (throttled to max 4/sec = 250ms real time)
    const now = performance.now();
    if (now - lastUpdateRef.current >= 250) {
      lastUpdateRef.current = now;
      const active        = vehiclesRef.current.filter((v) => v.state !== 'dwell').length;
      const totalVehicles = Object.values(corridorTotalsRef.current).reduce((a, b) => a + b, 0);
      onSimUpdate(simTimeRef.current, active, totalVehicles);
      onStatsUpdate(computeStats(vehiclesRef.current, corridorTotalsRef.current, corridorExitsRef.current, inboundDelayRef.current, outboundDelayRef.current));

      // Pulse junction markers that are bottlenecks
      pulsePhaseRef.current = (pulsePhaseRef.current + 1) % 4;
      const pulseRadius = pulsePhaseRef.current < 2 ? 11 : 7;
      for (const jid of VISIBLE_JUNCTIONS) {
        const entry = junctionMarkersRef.current[jid];
        if (!entry) continue;

        const j = JUNCTIONS[jid];
        const isPointOfEntry = [1, 8, 9, 13, 20].includes(jid);

        // Count vehicles currently held at this junction
        const queuedHere = vehiclesRef.current.filter(
          (v) => v.holdingAt === jid,
        ).length;
        const isBottleneck = queuedHere >= 2;

        entry.marker.setStyle({
          color:     isBottleneck ? '#ef4444' : entry.baseColor,
          opacity:   isBottleneck ? 1.0 : (isPointOfEntry ? 1.0 : 0.6),
          weight:    isBottleneck ? 3.0 : (isPointOfEntry ? 2.0 : 1.5),
          fill:      true,
          fillColor: isBottleneck ? '#ef4444' : (isPointOfEntry ? entry.baseColor : 'transparent'),
          fillOpacity: isBottleneck ? 0.35 : (isPointOfEntry ? 0.8 : 0)
        });
        entry.marker.setRadius(isBottleneck ? pulseRadius : 7);
      }
    }

    rafRef.current = requestAnimationFrame(loopRef.current);
  }, [drawFrame, computeStats, onSimUpdate, onStatsUpdate, onAutoStop]);
  loopRef.current = loop; // keep ref in sync to avoid self-reference TDZ

  // ── Play / pause effect ────────────────────────────────────────────────
  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(loopRef.current);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playing, loop]);

  // ── Scenario change → reset ────────────────────────────────────────────
  useEffect(() => {
    resetSim();
  }, [scenario, resetSim]);

  // Redraw when toggle changes
  useEffect(() => {
    drawFrame();
  }, [activeRoutes, drawFrame]);

  // ── Leaflet initialisation ─────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, { zoomSnap: 0.1, preferCanvas: false });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.fitBounds(
      [[-34.0568, 18.4465], [-34.0400, 18.4625]],
      { padding: [18, 18] },
    );

    // Road geometry polylines — hidden (opacity: 0) but kept for reference
    for (const feat of ROAD_LINES) {
      const coords = feat.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      L.polyline(coords, {
        color: '#334155', weight: 2, opacity: 0,
        lineJoin: 'round', lineCap: 'round', interactive: false,
      }).addTo(map);
    }

    // Boundary dimming overlay — semi-transparent dark mask over areas outside study zone.
    // Uses evenodd fill rule: outer ring covers a large area, inner ring punches out the study area.
    const outerRing = [[-40, 14], [-40, 23], [-30, 23], [-30, 14]];
    const studyArea = [
      [-34.0585, 18.4435], // Bottom Left (widened)
      [-34.0395, 18.4435], // Top Left
      [-34.0395, 18.4635], // Top Right
      [-34.0585, 18.4635], // Bottom Right
    ];
    L.polygon([outerRing, studyArea], {
      fillColor:   '#050d1a',
      fillOpacity: 0.60,
      fillRule:    'evenodd',
      stroke:      false,
      interactive: false,
    }).addTo(map);

    // Junction markers (12 visible) — stored in ref for later pulsing
    for (const jid of VISIBLE_JUNCTIONS) {
      const j     = JUNCTIONS[jid];
      const ctrlStyle = CTRL_STYLE[j.control] ?? CTRL_STYLE.stop;
      let baseColor = ctrlStyle.color;
      let isPointOfEntry = false;

      // Override for entry/exit points to match corridor palette
      if (jid === 1)  { baseColor = COLOUR['1A'].base; isPointOfEntry = true; }
      if (jid === 9)  { baseColor = COLOUR['2A'].base; isPointOfEntry = true; }
      if (jid === 8)  { baseColor = COLOUR['2B'].base; isPointOfEntry = true; }
      if (jid === 13) { baseColor = COLOUR['3A'].base; isPointOfEntry = true; }
      if (jid === 20) { baseColor = COLOUR['egress'].base; isPointOfEntry = true; }

      const marker = L.circleMarker([j.lat, j.lng], {
        radius: 7, 
        color: baseColor, 
        weight: isPointOfEntry ? 2 : 1.5,
        opacity: isPointOfEntry ? 1.0 : 0.6,
        fill: true,
        fillColor: isPointOfEntry ? baseColor : 'transparent',
        fillOpacity: isPointOfEntry ? 0.8 : 0
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;font-size:12px;min-width:160px">
            <b>${j.name}</b><br>
            <span style="color:#64748b">${j.control.replace(/_/g, ' ')}</span>
          </div>`,
        );
      junctionMarkersRef.current[jid] = { marker, baseColor: baseColor };
    }

    // Re-sync canvas on map movement/zoom
    const syncAndDraw = () => { syncCanvas(); drawFrame(); };
    map.on('moveend zoomend', syncAndDraw);

    // Initial canvas sync — wait until Leaflet has finished its first layout pass
    // (offsetWidth/Height are 0 until the browser paints, so we defer via rAF)
    map.whenReady(() => {
      requestAnimationFrame(() => { syncCanvas(); drawFrame(); });
    });

    // ResizeObserver for orientation change / layout resize
    const ro = new ResizeObserver(() => { syncCanvas(); drawFrame(); });
    ro.observe(containerRef.current);

    window.addEventListener('resize', syncCanvas);

    return () => {
      map.remove();
      mapRef.current = null;
      ro.disconnect();
      window.removeEventListener('resize', syncCanvas);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 450 }}
      />
      {/* Vehicle colour legend */}
      <div style={{
        position: 'absolute', bottom: 30, left: 8, zIndex: 500,
        background: 'rgba(13,21,38,0.85)', border: '1px solid #1e3a5f',
        borderRadius: 6, padding: '6px 10px', fontSize: 10,
        color: '#cbd5e1', lineHeight: '1.5', pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', gap: 2
      }}>
        {[
          [COLOUR['1A'].base, 'Dreyersdal N'],
          [COLOUR['2A'].base, 'Homestead'],
          [COLOUR['2B'].base, "Children's Way"],
          [COLOUR['3A'].base, 'Firgrove Way'],
          [COLOUR.delayed, 'Delayed'],
          [COLOUR.dwell, 'Parked'],
        ].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="8" height="8" style={{ flexShrink: 0 }}>
              <circle cx="4" cy="4" r="3" fill={color} />
            </svg>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
