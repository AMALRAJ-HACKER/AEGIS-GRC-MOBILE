
import { View, Text } from 'react-native';
import { radius } from '@/lib/design-tokens';
import { useTheme } from '@/theme/ThemeProvider';

export function Badge({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'success' | 'warning' | 'critical' | 'info' | 'default';
}) {
  const { colors, isDark } = useTheme();
  const map: any = {
    success: { bg: colors.successBg, fg: isDark ? colors.teal : '#0A6B78' },
    warning: { bg: colors.warningBg, fg: isDark ? colors.amber : '#92400E' },
    critical: { bg: colors.criticalBg, fg: isDark ? colors.red : '#B91C1C' },
    info: { bg: colors.infoBg, fg: colors.heading },
    default: { bg: colors.neutralBg, fg: isDark ? colors.textMuted : '#475569' },
  };
  const c = map[tone] || map.default;
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}>
      <Text style={{ color: c.fg, fontSize: 11, fontWeight: '700' }}>{label.toUpperCase()}</Text>
    </View>
  );
}
