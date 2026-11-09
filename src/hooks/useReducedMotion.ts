import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Respects the OS "Reduce Motion" setting. Every animated component in
 * src/components/motion falls back to a calm static state when this is true.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (mounted) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);

  return reduced;
}
