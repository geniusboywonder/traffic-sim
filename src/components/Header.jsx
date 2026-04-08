import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Map, Monitor, MessageCircleMore, X } from 'lucide-react';
import { trackEvent } from '../analytics';

const NAV_ITEMS = [
  { id: 'simulator', icon: Map,             label: 'The Road Map',    href: '#simulator' },
  { id: 'findings',  icon: Monitor,         label: 'The Damage Report', href: '#findings' },
  { id: 'models',    icon: Bot,             label: 'Under the Hood',  href: '#models' },
  { id: 'contact',   icon: MessageCircleMore, label: 'Pit Stop',      href: '#contact' },
];

export default function Header({ activeSection }) {
  const [manualActive, setManualActive] = useState(null);
  const [lastSection, setLastSection]   = useState(activeSection);
  const [menuOpen, setMenuOpen]         = useState(false);

  if (activeSection !== lastSection) {
    setLastSection(activeSection);
    setManualActive(null);
  }

  const active = useMemo(() => {
    if (manualActive) return manualActive;
    const map = { simulator: 'simulator', briefing: 'simulator', findings: 'findings', models: 'models', contact: 'contact' };
    return map[activeSection] || 'simulator';
  }, [activeSection, manualActive]);

  const handleNavClick = (id) => {
    setManualActive(id);
    setMenuOpen(false);
    trackEvent('nav_clicked', { section: id });
  };

  return (
    <>
      <div className="header-brand-nav">
        {/* Logo — tapping on mobile opens the menu */}
        <button
          className="app-logo mobile-menu-logo-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Traff<span>✱</span>k
        </button>

        {/* Desktop nav */}
        <nav className="expanding-nav desktop-nav">
          {NAV_ITEMS.map(item => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={() => handleNavClick(item.id)}
                className={`nav-pill ${isActive ? 'active' : ''}`}
              >
                <div className="nav-pill-content">
                  <Icon size={20} strokeWidth={2.5} />
                  <span className="nav-pill-label">{item.label}</span>
                </div>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Mobile menu — portalled to document.body to escape fixed header stacking context */}
      {menuOpen && createPortal(
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu-content" onClick={e => e.stopPropagation()}>
            <button className="mobile-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={22} />
            </button>

            <div className="mobile-menu-logo">
              Traff<span>✱</span>k
            </div>

            <nav className="mobile-menu-nav">
              {NAV_ITEMS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className="mobile-menu-link"
                    style={{ animationDelay: `${i * 0.07}s` }}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <span className="mobile-menu-link-num">0{i + 1}</span>
                    <Icon size={20} strokeWidth={2} style={{ opacity: 0.5 }} />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="mobile-menu-footer">
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-text)', margin: 0 }}>
                Traff✱k — Tokai High Traffic Simulator
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
