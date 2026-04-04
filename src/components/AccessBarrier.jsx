import { Activity, Play } from 'lucide-react';
import { SmokeBackground } from './SmokeBackground';

export const AccessBarrier = ({ onInitialize }) => {
  return (
    <div className="access-barrier" id="access-barrier">
      <div className="barrier-smoke-bg">
        <SmokeBackground smokeColor="#4a7c59" />
      </div>
      
      <div className="barrier-veil" />

      <div className="barrier-content-wrapper">
        <header className="barrier-header">
          <div className="barrier-title-box">
            <Activity size={32} color="var(--c-3a)" />
            <h2>Traff<span>✱</span>k - Tokai High Traffic Simulator</h2>
          </div>
        </header>

        <div className="barrier-main-grid">
          <div className="barrier-narrative">
            <p>Hi there! As a Bergvliet resident, I wanted to visually understand what an additional 800 cars would do to the suburban streets of Bergvliet. And given that the WCED-commissioned Traffic Impact Assessment is woefully limited in its scope, I built a thing.</p>
            <p>This site is also not formally associated with the <a href="https://www.facebook.com/CommunityResponseBergvlietSchool" target="_blank" className="editorial-link">Bergvliet Volunteers Association (BVA)</a>, although I am a member of the <a href="https://chat.whatsapp.com/J7ooHVb9tdr4n9PLf76wYy?mode=ems_wa_t" target="_blank" className="editorial-link">Community Response: Tokai School WhatsApp group</a>.</p>
            <div className="barrier-narrative-btn">
              <button className="init-sim-btn" onClick={onInitialize}>
                Start the Engine
                <Play size={20} fill="currentColor" />
              </button>
            </div>
          </div>

          <div className="barrier-disclaimer">
            <span className="disclaimer-label">ROAD WARNING</span>
            <p className="disclaimer-text">I am just a guy, with AI. I am not a traffic-assessor, or have any deep knowledge on traffic flow, stalling physics or back-pressure. My AI agents helped with that. They could be wrong. And this is just <strong>one possible scenario</strong>. It's fun and informative, but not definitive in its modelling. Don't use this site to make any life-changing decisions, or say things you might regret to WCED, City of Cape Town or anyone else.</p>
            <div className="disclaimer-lekker">
              <span className="barrier-lekker">Just be lekker!</span>
              <span className="barrier-lekker-sub">(no cars or humans were harmed while making this)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
