// ── logger.js ─────────────────────────────────────────────────────────────────
// Vehicle event logger. Accumulates events in memory, downloadable as CSV.

const MAX_EVENTS = 50000; // cap to avoid OOM on long runs

const _events = [];
let _enabled = true;

export function loggerEnable(val) { _enabled = val; }
export function loggerClear() { _events.length = 0; }

export function logEvent(type, vehicle, extra = {}) {
  if (!_enabled) return;
  if (_events.length >= MAX_EVENTS) return;
  _events.push({
    t:          extra.simTime ?? vehicle?.simTime ?? 0,
    id:         vehicle?.id ?? '—',
    state:      vehicle?.state ?? '—',
    routeId:    vehicle?.routeId ?? '—',
    corridorId: vehicle?.corridorId ?? '—',
    pos:        vehicle?.pos != null ? vehicle.pos.toFixed(4) : '—',
    v_ms:       vehicle?.v  != null ? vehicle.v.toFixed(2)   : '—',
    jIdx:       vehicle?.lastJunctionIdx ?? '—',
    holdUntil:  vehicle?.holdUntil != null ? vehicle.holdUntil.toFixed(1) : '—',
    event:      type,
    detail:     extra.detail ?? '',
  });
}

// School-specific event logger — records parking occupancy snapshot alongside vehicle event.
// onSite / onStreet: counts at the moment of the event (pass from getParkingOccupancy result).
export function logSchoolEvent(type, vehicle, simTime, onSite, onStreet, extraDetail = '') {
  if (!_enabled) return;
  if (_events.length >= MAX_EVENTS) return;
  const parkingDetail = `onSite=${onSite}/98 onStreet=${onStreet}/22${extraDetail ? ' ' + extraDetail : ''}`;
  _events.push({
    t:          simTime,
    id:         vehicle?.id ?? '—',
    state:      vehicle?.state ?? '—',
    routeId:    vehicle?.routeId ?? '—',
    corridorId: vehicle?.corridorId ?? '—',
    pos:        vehicle?.pos != null ? vehicle.pos.toFixed(4) : '—',
    v_ms:       vehicle?.v  != null ? vehicle.v.toFixed(2)   : '—',
    jIdx:       vehicle?.lastJunctionIdx ?? '—',
    holdUntil:  vehicle?.holdUntil != null ? vehicle.holdUntil.toFixed(1) : '—',
    event:      type,
    detail:     parkingDetail,
  });
}

export function loggerDownload() {
  if (_events.length === 0) { alert('No log events recorded.'); return; }

  const header = 'simTime,id,state,routeId,corridorId,pos,v_ms,jIdx,holdUntil,event,detail';
  const rows = _events.map(e =>
    [e.t.toFixed(1), e.id, e.state, e.routeId, e.corridorId,
     e.pos, e.v_ms, e.jIdx, e.holdUntil, e.event,
     `"${String(e.detail).replace(/"/g,'""')}"`
    ].join(',')
  );
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `traffic-sim-log-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
