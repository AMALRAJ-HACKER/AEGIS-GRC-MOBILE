import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useResponsive } from '@/lib/responsive';
import { Aurora } from '@/components/motion/Aurora';
import { FadeIn } from '@/components/motion/FadeIn';
import { PulseOutline } from '@/components/motion/Pulse';
import { useWorkspaceMotion } from '@/components/motion/WorkspaceMotion';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Screen — safe-area aware page container.
 * - Keeps content clear of notch / Dynamic Island (top) and home indicator (bottom)
 * - Responsive horizontal padding for every phone width
 * - On tablets, caps content width and centers it (maxWidth)
 * - Ambient Aurora backdrop + a soft entrance animation inside the workspace
 * - `loading` shows a gently pulsing outline while data is in flight
 *
 * `style` applies to the inner content node (gap, justifyContent, etc.).
 */
export function Screen({
  children,
  style,
  background,
  maxWidth,
  safeTop = 6,
  loading = false,
  aurora,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  background?: string;
  maxWidth?: number;
  safeTop?: number;
  loading?: boolean;
  aurora?: boolean;
}) {
  const { topInset, bottomInset, hPad, maxContent } = useResponsive();
  const { colors } = useTheme();
  const workspaceMotion = useWorkspaceMotion();
  const showAurora = aurora ?? workspaceMotion;
  const cap = maxWidth ?? maxContent;
  const contentStyle = {
    flex: 1,
    width: '100%' as const,
    maxWidth: cap,
    alignSelf: cap ? ('center' as const) : ('stretch' as const),
    paddingTop: topInset + safeTop,
    paddingBottom: bottomInset + 8,
    paddingHorizontal: hPad,
  };

  return (
    <View style={{ flex: 1, backgroundColor: background ?? colors.bg }}>
      {showAurora ? <Aurora /> : null}
      {workspaceMotion ? (
        <FadeIn style={[contentStyle, style]}>{children}</FadeIn>
      ) : (
        // Auth / onboarding stay exactly as they were — no entrance motion.
        <View style={[contentStyle, style]}>{children}</View>
      )}
      {loading ? <PulseOutline inset={6} radius={26} /> : null}
    </View>
  );
}
