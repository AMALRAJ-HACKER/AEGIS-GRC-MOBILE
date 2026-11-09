import { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { PulseOutline } from './Pulse';

/**
 * Watches react-query for in-flight requests and shows a soft pulsing outline
 * around the screen. Debounced so realtime invalidations don't strobe.
 */
export function GlobalLoadingPulse({ enabled }: { enabled: boolean }) {
  // Only count first loads (no cached data yet) — background refetches from
  // realtime updates should not strobe the outline.
  const fetching = useIsFetching({ predicate: (q) => q.state.data === undefined });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled) { setShow(false); return; }
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (fetching > 0) {
      showTimer = setTimeout(() => setShow(true), 220);
    } else {
      hideTimer = setTimeout(() => setShow(false), 260);
    }

    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [fetching, enabled]);

  if (!enabled || !show) return null;
  return <PulseOutline inset={4} radius={30} />;
}
