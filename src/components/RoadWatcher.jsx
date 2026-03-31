// src/components/RoadWatcher.jsx
// Displays per-road vehicle stats when a road is selected on the map.
// In Results mode: allFrames is the full frame array → totals computed up front.
// In Live mode: allFrames is null → shows accumulated stats so far.

import React from 'react';

const START_SEC = 23400; // 06:30
const END_SEC   = 30600; // 08:30
const BUCKET_COUNT = 8;
const BUCKET_SECS  = (END_SEC - START_SEC) / BUCKET_COUNT; // 900s = 15 min

function computeTotals(roadId, allFrames) {
  let totalInbound = 0, totalOutbound = 0;
  let delayInSum = 0, delayInCount = 0;
  let delayOutSum = 0, delayOutCount = 0;

  for (const frame of allFrames) {
    const rs = frame.road_stats.find(r => r.road_id === roadId);
    if (!rs) continue;
    totalInbound  += rs.inbound;
    totalOutbound += rs.outbound;
    if (rs.avg_delay_in != null)  { delayInSum  += rs.avg_delay_in;  delayInCount++; }
    if (rs.avg_delay_out != null) { delayOutSum += rs.avg_delay_out; delayOutCount++; }
  }

  return {
    totalInbound,
    totalOutbound,
    total: totalInbound + totalOutbound,
    avgDelayIn:  delayInCount  > 0 ? Math.round(delayInSum  / delayInCount)  : null,
    avgDelayOut: delayOutCount > 0 ? Math.round(delayOutSum / delayOutCount) : null,
  };
}

function computeBuckets(roadId, allFrames) {
  const buckets = Array.from({ length: BUCKET_COUNT }, () => ({ inbound: 0, outbound: 0 }));
  for (const frame of allFrames) {
    const rs = frame.road_stats.find(r => r.road_id === roadId);
    if (!rs) continue;
    const bucketIdx = Math.min(
      BUCKET_COUNT - 1,
      Math.floor((frame.t - START_SEC) / BUCKET_SECS)
    );
    if (bucketIdx >= 0) {
      buckets[bucketIdx].inbound  += rs.inbound;
      buckets[bucketIdx].outbound += rs.outbound;
    }
  }
  return buckets;
}

function formatDelay(sec) {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function TimeSeriesChart({ buckets }) {
  const maxVal = Math.max(1, ...buckets.map(b => b.inbound + b.outbound));
  const barW = 100 / BUCKET_COUNT;
  return (
    <svg viewBox="0 0 100 40" style={{ width: '100%', height: 40, display: 'block', marginTop: 8 }}>
      {buckets.map((b, i) => {
        const totalH = ((b.inbound + b.outbound) / maxVal) * 38;
        const inboundH = (b.inbound / maxVal) * 38;
        const x = i * barW + 0.5;
        const w = barW - 1;
        return (
          <g key={i}>
            <rect
              data-testid="timeseries-bar"
              x={x} y={40 - totalH} width={w} height={totalH}
              fill="#475569"
            />
            <rect
              x={x} y={40 - inboundH} width={w} height={inboundH}
              fill="#3b82f6"
            />
          </g>
        );
      })}
    </svg>
  );
}

export default function RoadWatcher({ road, allFrames, onClose }) {
  const roadId = road.id ?? road.name?.toLowerCase().replace(/\s+/g, '_');

  if (!allFrames) {
    return (
      <div className="road-watcher">
        <div className="rw-header">
          <span className="rw-title">{road.name}</span>
          <button className="rw-close" aria-label="close" onClick={onClose}>×</button>
        </div>
        <div className="rw-loading">Simulation running — stats accumulate as vehicles pass</div>
      </div>
    );
  }

  const { total, totalInbound, totalOutbound, avgDelayIn, avgDelayOut } = computeTotals(roadId, allFrames);
  const buckets = computeBuckets(roadId, allFrames);

  return (
    <div className="road-watcher">
      <div className="rw-header">
        <span className="rw-title">{road.name}</span>
        <button className="rw-close" aria-label="close" onClick={onClose}>×</button>
      </div>

      <div className="rw-totals">
        <div className="rw-stat">
          <div className="rw-stat-label">Total</div>
          <div className="rw-stat-value">{total}</div>
        </div>
        <div className="rw-stat">
          <div className="rw-stat-label">Inbound</div>
          <div className="rw-stat-value" data-testid="total-inbound">{totalInbound}</div>
        </div>
        <div className="rw-stat">
          <div className="rw-stat-label">Outbound</div>
          <div className="rw-stat-value">{totalOutbound}</div>
        </div>
      </div>

      <div className="rw-delays">
        <div>Avg delay inbound: <strong>{formatDelay(avgDelayIn)}</strong></div>
        <div>Avg delay outbound: <strong>{formatDelay(avgDelayOut)}</strong></div>
      </div>

      <TimeSeriesChart buckets={buckets} />
      <div className="rw-axis">
        <span>06:30</span><span>08:30</span>
      </div>
    </div>
  );
}
