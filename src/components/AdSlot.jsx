import { memo, useEffect, useRef } from 'react';

// AdSense unit — React.memo prevents re-renders after mount.
// variant="rectangle"   → 300×250 fixed (Findings grid card)   slot: 5022443765
// variant="strip"       → responsive auto (Models section)      slot: 4973304892
// variant="leaderboard" → responsive auto (above footer)        slot: 8443542979

const AD_CLIENT = 'ca-pub-4744444280795001';

const AdSlot = memo(function AdSlot({ variant = 'strip' }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded (dev / ad-blocker) — silent fail
    }
  }, []);

  if (variant === 'rectangle') {
    return (
      <div className="ad-rectangle">
        <ins
          className="adsbygoogle"
          style={{ display: 'inline-block', width: '300px', height: '250px' }}
          data-ad-client={AD_CLIENT}
          data-ad-slot="5022443765"
        />
      </div>
    );
  }

  if (variant === 'leaderboard') {
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '1.5rem 0 0' }}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={AD_CLIENT}
          data-ad-slot="8443542979"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // strip (default) — Models section
  return (
    <div className="ad-strip">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot="4973304892"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
});

export default AdSlot;
