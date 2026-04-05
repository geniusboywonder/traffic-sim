// ── ProductTour.jsx ───────────────────────────────────────────────────────────
// 3-step spotlight tour. Auto-activates on first visit after access barrier.
// Stores completion in localStorage — never shows again once dismissed.

import { useEffect, useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

const TOUR_KEY = 'traffik_tour_seen_v1';

const STEPS = [
  {
    target: '.map-viewport-container',
    title: 'The Map',
    body: 'The map shows the Bergvliet road network. Pulsing markers highlight the 4 entry/exit points and the school. Moving dots represent cars navigating the streets. Click any road to inspect it.',
    position: 'right',
  },
  {
    target: '.sim-controls',
    title: 'Run the simulation',
    body: 'Pick a scenario — Low (336 cars), Medium (420, the TIA baseline), or High (504). Hit play, adjust playback speed, and watch the network load up in real time. Lab shows the independent model to validate results.',
    position: 'bottom',
  },
  {
    target: '.scrolling-stats-pill',
    title: 'Live telemetry',
    body: 'The header stats shows the clock, total vehicles in/out, and average trip times — updating live as the simulation runs.',
    position: 'bottom',
  },
  {
    target: '.stats-panel',
    title: 'Watch the corridors',
    body: 'Each card tracks one entry point — vehicles in, vehicles out, and how congested that corridor is right now. Click a card to select/deselect it from the simulation run.',
    position: 'left',
  },
];

function getRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function getElement(selector) {
  return document.querySelector(selector);
}

export default function ProductTour({ active, restartKey = 0 }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [visible, setVisible] = useState(false);

  const measure = useCallback((s) => {
    const target = STEPS[s ?? step]?.target;
    const r = getRect(target);
    setRect(r ?? null);
  }, [step]);

  // Start tour (auto on first visit, or when restartKey changes)
  useEffect(() => {
    if (!active) return;
    if (restartKey === 0 && localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => {
      setStep(0);
      setVisible(true);
      measure(0);
    }, 600);
    return () => clearTimeout(t);
  }, [active, restartKey, measure]);

  // Re-measure whenever step changes
  useEffect(() => {
    if (!visible) return;
    const target = STEPS[step]?.target;
    const el = getElement(target);
    const isMobile = window.innerWidth < 768;

    const ensureVisibleAndMeasure = () => {
      const r = getRect(target);
      setRect(r ?? null);
    };

    const maybeScrollIntoView = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const offscreenTop = r.top < 96;
      const offscreenBottom = r.bottom > window.innerHeight - 96;

      if (isMobile && (offscreenTop || offscreenBottom)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.setTimeout(ensureVisibleAndMeasure, 320);
      } else {
        ensureVisibleAndMeasure();
      }
    };

    const id = requestAnimationFrame(maybeScrollIntoView);
    return () => cancelAnimationFrame(id);
  }, [step, visible]);

  // Re-measure on resize/scroll
  useEffect(() => {
    if (!visible) return;
    const handler = () => {
      const r = getRect(STEPS[step]?.target);
      setRect(r ?? null);
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, { passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler);
    };
  }, [visible, step]);

  const dismiss = useCallback(() => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const prev = useCallback(() => setStep(s => Math.max(0, s - 1)), []);

  // Keyboard
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, next, prev, dismiss]);

  if (!visible) return null;

  const PAD = 10;
  const spotlight = rect ? {
    top:    rect.top    - PAD,
    left:   rect.left   - PAD,
    width:  rect.width  + PAD * 2,
    height: rect.height + PAD * 2,
  } : { top: -9999, left: -9999, width: 0, height: 0 };

  // Tooltip positioning
  const pos = STEPS[step].position;
  const TIP_W = Math.min(320, window.innerWidth - 24);
  const TIP_GAP = 16;
  const TIP_H = Math.min(260, window.innerHeight - 24);
  const isMobile = window.innerWidth < 768;
  let tipStyle = {};
  if (pos === 'bottom') {
    tipStyle = { top: spotlight.top + spotlight.height + TIP_GAP, left: spotlight.left + spotlight.width / 2 - TIP_W / 2 };
  } else if (pos === 'left') {
    tipStyle = isMobile
      ? { top: spotlight.top + spotlight.height + TIP_GAP, left: spotlight.left + spotlight.width / 2 - TIP_W / 2 }
      : { top: spotlight.top + spotlight.height / 2 - 80, left: spotlight.left - TIP_W - TIP_GAP };
  } else if (pos === 'right') {
    tipStyle = isMobile
      ? { top: spotlight.top + spotlight.height + TIP_GAP, left: spotlight.left + spotlight.width / 2 - TIP_W / 2 }
      : { top: spotlight.top + spotlight.height / 2 - 80, left: spotlight.left + spotlight.width + TIP_GAP };
  }
  // Clamp to viewport
  tipStyle.left = Math.max(12, Math.min(tipStyle.left, window.innerWidth - TIP_W - 12));
  // Clamp top — ensure tooltip fits within viewport height
  const maxTop = window.innerHeight - TIP_H - 12;
  tipStyle.top = Math.max(12, Math.min(tipStyle.top, maxTop));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      {/* Dark overlay with spotlight hole via box-shadow */}
      <div
        style={{
          position: 'absolute',
          top:    spotlight.top,
          left:   spotlight.left,
          width:  spotlight.width,
          height: spotlight.height,
          borderRadius: 10,
          boxShadow: '0 0 0 9999px rgba(5,13,26,0.78)',
          pointerEvents: 'none',
          transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      />

      {/* Spotlight border pulse */}
      <div
        style={{
          position: 'absolute',
          top:    spotlight.top,
          left:   spotlight.left,
          width:  spotlight.width,
          height: spotlight.height,
          borderRadius: 10,
          border: '2px solid rgba(161,204,165,0.8)',
          boxShadow: '0 0 0 4px rgba(161,204,165,0.15)',
          animation: 'school-shadow-pulse 2s ease-in-out infinite',
          pointerEvents: 'none',
          transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      />

      {/* Tooltip card */}
      <div
        style={{
          position: 'absolute',
          ...tipStyle,
          width: TIP_W,
          maxHeight: TIP_H,
          overflowY: 'auto',
          background: 'rgba(10,20,12,0.97)',
          border: '1px solid rgba(161,204,165,0.25)',
          borderRadius: 12,
          padding: '1.1rem 1.25rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          pointerEvents: 'all',
          transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Nav row — at top so it's always reachable */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', color: 'rgba(241,245,241,0.35)', fontSize: '0.7rem', cursor: 'pointer', padding: 0, letterSpacing: '0.05em' }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={prev} style={{
                background: 'rgba(161,204,165,0.1)', border: '1px solid rgba(161,204,165,0.2)',
                borderRadius: 6, padding: '0.35rem 0.6rem', cursor: 'pointer', color: '#A1CCA5', display: 'flex', alignItems: 'center',
              }}>
                <ChevronLeft size={14} />
              </button>
            )}
            <button onClick={next} style={{
              background: '#2D5438', border: 'none', borderRadius: 6,
              padding: '0.35rem 0.9rem', cursor: 'pointer', color: '#f1f5f1',
              fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {step < STEPS.length - 1 ? <><span>Next</span><ChevronRight size={14} /></> : 'Got it'}
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '0.75rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? '#A1CCA5' : 'rgba(161,204,165,0.25)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <h3 style={{ color: '#f1f5f1', fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>
          {STEPS[step].title}
        </h3>
        <p style={{ color: 'rgba(241,245,241,0.72)', fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>
          {STEPS[step].body}
        </p>
      </div>
    </div>
  );
}
