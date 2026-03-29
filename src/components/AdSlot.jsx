import { memo, useEffect, useRef } from 'react';

// AdSense unit — React.memo prevents any re-renders after mount.
// adsbygoogle.push fires exactly once in useEffect([]).
const AdSlot = memo(function AdSlot() {
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

  return (
    <div className="ad-strip">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-4744444280795001"
        data-ad-slot="2095203571"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
});

export default AdSlot;
