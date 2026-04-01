// ── Header.jsx ────────────────────────────────────────────────────────────────
// Desktop: single row with all controls.
// Mobile: row-1 = logo + playback; row-2 = scenario + clock + speed.
// Active/total vehicle counts are hidden on mobile (shown in StatsPanel instead).

import { loggerDownload, loggerDownloadRoadStats } from '../engine/logger';

function formatClock(simTime) {
  // simTime = seconds since 06:30
  const totalSec  = Math.floor(simTime);
  const baseMin   = 6 * 60 + 30; // 390 min from midnight
  const totalMin  = baseMin + Math.floor(totalSec / 60);
  const hours24   = Math.floor(totalMin / 60) % 24;
  const mins      = totalMin % 60;
  const h12       = hours24 % 12 || 12;
  const ampm      = hours24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
}

export default function Header({
  scenario, playing, speed, simTime,
  activeVehicles, totalVehicles, totalIn, totalOut,
  source, resultsLoading,
  onScenarioChange, onPlay, onPause, onReset, onSpeedChange, onSourceChange,
}) {
  const clock = formatClock(simTime);

  const scenarioBtns = ['L', 'M', 'H'].map((s) => (
    <button
      key={s}
      className={`scenario-btn ${scenario === s ? 'active' : ''}`}
      onClick={() => onScenarioChange(s)}
      title={{ L: 'Low — 500 trips', M: 'Medium — 650 trips', H: 'High (TIA) — 840 trips' }[s]}
    >
      {s}
    </button>
  ));

  const speedBtns = [1, 2, 5, 10].map((s) => (
    <button
      key={s}
      className={`speed-btn ${speed === s ? 'active' : ''}`}
      onClick={() => onSpeedChange(s)}
    >
      {s}×
    </button>
  ));

  const sourceBtns = (
    <div className="source-btns">
      {['live', 'results'].map(s => (
        <button
          key={s}
          className={`source-btn ${source === s ? 'active' : ''}`}
          onClick={() => onSourceChange(s)}
          title={s === 'live' ? 'Live IDM simulation' : 'Pre-computed UXsim results'}
        >
          {s === 'live' ? 'Live' : resultsLoading ? '⟳' : 'Results'}
        </button>
      ))}
    </div>
  );

  const playbackBtns = (
    <div className="playback-btns">
      {playing
        ? <button className="ctrl-btn" onClick={onPause} title="Pause">⏸</button>
        : <button className="ctrl-btn play-btn" onClick={onPlay} title="Play">▶</button>
      }
      <button className="ctrl-btn reset-btn" onClick={onReset} title="Reset">↺</button>
      <button className="ctrl-btn" onClick={loggerDownload} title="Download vehicle log (CSV)" style={{fontSize:'11px',padding:'2px 6px'}}>LOG</button>
      <button className="ctrl-btn" onClick={loggerDownloadRoadStats} title="Download road stats log (CSV)" style={{fontSize:'11px',padding:'2px 6px',marginLeft:'2px'}}>ROAD LOG</button>
    </div>
  );

  return (
    <header className="header">
      {/* ── Row 1 ─────────────────────────────────────────────────────────── */}
      <div className="header-row1">
        <span className="header-logo desktop-only">🏫 Tokai HS — Morning Traffic</span>

        {/* Desktop-only: scenario + clock + speed + counts */}
        <div className="scenario-btns desktop-only">{scenarioBtns}</div>
        <span className="sim-clock desktop-only">{clock}</span>
        <div className="speed-btns desktop-only">{speedBtns}</div>

        {/* Playback always visible */}
        {playbackBtns}
        {sourceBtns}

        {/* Desktop-only: vehicle counts */}
        <div className="header-counts desktop-only">
          <div className="count-chip">
            <span className="count-label">Active</span>
            <span className="count-value">{activeVehicles}</span>
          </div>
          <div className="count-chip">
            <span className="count-label">Total In</span>
            <span className="count-value">{totalIn}</span>
          </div>
          <div className="count-chip">
            <span className="count-label">Total Out</span>
            <span className="count-value">{totalOut}</span>
          </div>
        </div>
      </div>

      {/* ── Row 2 — mobile only ───────────────────────────────────────────── */}
      <div className="header-row2 mobile-only">
        <div className="scenario-btns">{scenarioBtns}</div>
        <span className="sim-clock">{clock}</span>
        <div className="speed-btns">{speedBtns}</div>
        {sourceBtns}
      </div>
    </header>
  );
}
