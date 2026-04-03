import { useState } from 'react';
import { Bot, Map, Monitor, MessageCircleMore } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'simulator', icon: Map, label: 'The Road Map', href: '#simulator' },
  { id: 'models', icon: Bot, label: 'Under the Hood', href: '#models' },
  { id: 'findings', icon: Monitor, label: 'The Damage Report', href: '#findings' },
  { id: 'contact', icon: MessageCircleMore, label: 'Pit Stop', href: '#contact' },
];

export default function Header() {
  const [active, setActive] = useState('simulator');

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
              onClick={() => setActive(item.id)}
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
