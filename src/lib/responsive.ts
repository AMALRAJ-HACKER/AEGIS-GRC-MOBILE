import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from './design-tokens';

/**
 * Device-frame aware layout values.
 * - Safe-area insets (notch / Dynamic Island / home indicator)
 * - Responsive horizontal padding (small phone -> tablet)
 * - Max content width so tablets don't stretch rows edge-to-edge
 *
 * Breakpoints: phone < 692 <= tablet < 1024 <= desktop-size tablet
 */
export function useResponsive(){
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 692;
  const isDesktop = width >= 1024;
  const hPad = isDesktop ? 48 : isTablet ? 32 : width < 360 ? 12 : spacing.md;
  const maxContent = isDesktop ? 960 : isTablet ? 760 : undefined;
  return {
    width,
    height,
    insets,
    isTablet,
    isDesktop,
    hPad,
    maxContent,
    topInset: insets.top,
    bottomInset: insets.bottom,
  };
}
