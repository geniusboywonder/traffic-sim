import { useState, useMemo } from 'react';
import { Bot, Map, Monitor, MessageCircleMore } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'simulator', icon: Map, label: 'The Road Map', href: '#simulator' },
  { id: 'findings', icon: Monitor, label: 'The Damage Report', href: '#findings' },
  { id: 'models', icon: Bot, label: 'Under the Hood', href: '#models' },
  { id: 'contact', icon: MessageCircleMore, label: 'Pit Stop', href: '#contact' },
];

export default function Header({ activeSection }) {
  const [manualActive, setManualActive] = useState(null);
  const [lastObserved, setLastObserved] = useState(activeSection);

  // If the observer reports a change, clear the manual override
  if (activeSection !== lastObserved) {
    setLastObserved(activeSection);
    setManualActive(null);
  }

  const active = useMemo(() => {
    if (manualActive) return manualActive;
    
    const sectionToNav = {
      'simulator': 'simulator',
      'briefing': 'simulator',
      'findings': 'findings',
      'models': 'models',
      'contact': 'contact'
    };
    return sectionToNav[activeSection] || 'simulator';
  }, [activeSection, manualActive]);

  return (
    <div className="header-brand-nav">
      <div className="app-logo">
        Traff<span>✱</span>k
      </div>
      <nav className="expanding-nav">
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={item.href}
              onClick={() => setManualActive(item.id)}
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
  );
}
