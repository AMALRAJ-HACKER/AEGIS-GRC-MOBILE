import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Fade + gentle rise on mount, so content settles into place instead of
 * snapping. Used by Screen and any list/section that wants a soft entrance.
 */
export function FadeIn({
  children,
  style,
  delay = 0,
  distance = 10,
  duration = 280,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  distance?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) { v.setValue(1); return; }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, delay, duration, v]);

  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
