import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/lib/design-tokens';

/**
 * A soft outline that breathes while data loads. Rendered as an absolute
 * overlay, so it hugs whatever container it is dropped into.
 */
export function PulseOutline({
  color = colors.teal,
  inset = 6,
  radius = 26,
  style,
}: {
  color?: string;
  inset?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);

  const opacity = reduced ? 0.3 : v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.5] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: radius,
          borderWidth: 1.5,
          borderColor: color,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** A single shimmering placeholder block. */
export function Skeleton({
  height = 14,
  width = '100%',
  radius = 8,
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);

  const opacity = reduced ? 0.6 : v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

/** Card-shaped skeleton rows for list screens while their first fetch lands. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            backgroundColor: colors.white,
            padding: 14,
            gap: 9,
          }}
        >
          <Skeleton width="62%" height={13} />
          <Skeleton width="38%" height={11} />
          <Skeleton width="84%" height={11} />
        </View>
      ))}
    </View>
  );
}
