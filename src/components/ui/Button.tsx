import { useRef } from 'react';
import { Animated, Pressable, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { radius, spacing } from '@/lib/design-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useWorkspaceMotion } from '@/components/motion/WorkspaceMotion';
import { useTheme } from '@/theme/ThemeProvider';

export function Button({ title, onPress, variant = 'primary', loading, style, disabled, accessibilityLabel, accessibilityHint }: any) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.secondaryBg : colors.lightBlue2;
  const color = variant === 'primary' ? colors.onPrimary : colors.heading;
  const reduced = useReducedMotion();
  const workspace = useWorkspaceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number) => {
    if (reduced || !workspace) return;
    Animated.spring(scale, {
      toValue: to,
      friction: 8,
      tension: 240,
      useNativeDriver: true,
    }).start();
  };

  const body = (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => press(0.97)}
      onPressOut={() => press(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: 14,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          alignItems: 'center',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style as ViewStyle,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={{ color, fontWeight: '700', fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );

  // Auth / onboarding keep the original, motion-free button.
  if (!workspace) return body;

  return <Animated.View style={{ transform: [{ scale }] }}>{body}</Animated.View>;
}
