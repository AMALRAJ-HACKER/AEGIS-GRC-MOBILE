import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Horizontal slide-in used by create/edit screens. The content arrives from
 * the trailing edge instead of snapping into place. Honours Reduce Motion.
 */
export function SlideIn({
  children,
  style,
  distance = 28,
  duration = 300,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  distance?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, duration, v]);

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          opacity: v,
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
