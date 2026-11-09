import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Blob = {
  size: number;
  fx: number;
  fy: number;
  color: string;
  alpha: number;
  dx: number;
  dy: number;
  duration: number;
};

/**
 * Slow, ambient colour fields. Extremely low alpha and 24-32 s cycles: the
 * screen should feel alive when you look for it, never distracting.
 */
const BLOBS: Blob[] = [
  { size: 620, fx: -0.38, fy: -0.16, color: '#0FA3B1', alpha: 0.055, dx: 70, dy: 55, duration: 24000 },
  { size: 520, fx: 0.52, fy: 0.06, color: '#3B82F6', alpha: 0.05, dx: -60, dy: 75, duration: 28000 },
  { size: 560, fx: -0.08, fy: 0.6, color: '#0A1931', alpha: 0.04, dx: 55, dy: -65, duration: 32000 },
];

const RING_FACTORS = [1, 0.74, 0.5, 0.3];
const RING_ALPHA = [0.22, 0.34, 0.6, 1];

function AuroraBlob({ blob, width, height }: { blob: Blob; width: number; height: number }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) { t.setValue(0.5); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: blob.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: blob.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blob.duration, reduced, t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: blob.fx * width,
        top: blob.fy * height,
        width: blob.size,
        height: blob.size,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, blob.dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, blob.dy] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
        ],
      }}
    >
      {RING_FACTORS.map((factor, i) => (
        <View
          key={factor}
          style={{
            position: 'absolute',
            left: (blob.size * (1 - factor)) / 2,
            top: (blob.size * (1 - factor)) / 2,
            width: blob.size * factor,
            height: blob.size * factor,
            borderRadius: (blob.size * factor) / 2,
            backgroundColor: blob.color,
            opacity: blob.alpha * RING_ALPHA[i],
          }}
        />
      ))}
    </Animated.View>
  );
}

export function Aurora() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {BLOBS.map((blob) => (
        <AuroraBlob key={blob.color} blob={blob} width={width} height={height} />
      ))}
    </View>
  );
}
