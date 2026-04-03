import { useState } from 'react';
import { Bot, Map, Monitor, MessageCircleMore } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'simulator', icon: Bot, label: 'Simulator', href: '#simulator' },
  { id: 'models', icon: Map, label: 'Models', href: '#models' },
  { id: 'findings', icon: Monitor, label: 'Findings', href: '#findings' },
  { id: 'contact', icon: MessageCircleMore, label: 'Contact', href: '#contact' },
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
