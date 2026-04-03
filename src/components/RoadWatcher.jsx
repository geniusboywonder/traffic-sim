// src/components/RoadWatcher.jsx
// Displays per-road vehicle stats when a road is selected on the map.
// Updated to show 2-line Traffic In/Out format with Total, Active, Slowing, Stopped counts.

import React from 'react';
import { X } from 'lucide-react';

function computeTotals(roadId, allFrames) {
  if (!allFrames || allFrames.length === 0) return null;
  
  let totalInbound = 0, totalOutbound = 0;
  // Note: Historical frames only contain cumulative counts, not instantaneous state
  // For historical playback, we only have totals.
  for (const frame of allFrames) {
    const rs = frame.road_stats.find(r => r.road_id === roadId);
    if (!rs) continue;
    totalInbound  += rs.inbound;
    totalOutbound += rs.outbound;
  }

  return { totalInbound, totalOutbound };
}

export default function RoadWatcher({ road, allFrames, liveStats, onClose }) {
  if (!road) {
    return (
      <div className="road-watcher">
        <div className="rw-empty">
          select any street on the map to see traffic activity
        </div>
      </div>
    );
  }

  const roadId = road.id ?? road.name?.toLowerCase().replace(/\s+/g, '_');
  
  // Stats used for display
  let inbound = { total: 0, active: 0, slowing: 0, stopped: 0 };
  let outbound = { total: 0, active: 0, slowing: 0, stopped: 0 };

  if (liveStats) {
    inbound = liveStats.inbound;
    outbound = liveStats.outbound;
  } else if (allFrames) {
    const hist = computeTotals(roadId, allFrames);
    if (hist) {
      inbound.total = hist.totalInbound;
      outbound.total = hist.totalOutbound;
    }
  }

  return (
    <div className="road-watcher">
      <div className="rw-header">
        <span className="rw-title" title={road.name}>{road.name}</span>
        <button className="rw-close" aria-label="close" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="rw-line">
        <div className="rw-line-title">Traffic In</div>
        <div className="rw-stats-row">
          <span className="rw-stat-pill">Total:<b>{inbound.total}</b></span>
          <span className="rw-stat-pill">Active:<b>{inbound.active}</b></span>
          <span className="rw-stat-pill">Slowing:<b>{inbound.slowing}</b></span>
          <span className="rw-stat-pill">Stopped:<b>{inbound.stopped}</b></span>
        </div>
      </div>

      <div className="rw-line">
        <div className="rw-line-title">Traffic Out</div>
        <div className="rw-stats-row">
          <span className="rw-stat-pill">Total:<b>{outbound.total}</b></span>
          <span className="rw-stat-pill">Active:<b>{outbound.active}</b></span>
          <span className="rw-stat-pill">Slowing:<b>{outbound.slowing}</b></span>
          <span className="rw-stat-pill">Stopped:<b>{outbound.stopped}</b></span>
        </div>
      </div>
    </div>
  );
}
