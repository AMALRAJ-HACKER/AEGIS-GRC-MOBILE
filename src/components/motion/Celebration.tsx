import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/lib/design-tokens';

export type CelebrationEvent = { title: string; subtitle?: string };
type Celebration = CelebrationEvent & { id: number };

const CelebrationContext = createContext<(event: CelebrationEvent) => void>(() => {});

/** Fire a celebration from anywhere: const celebrate = useCelebration(); */
export function useCelebration() {
  return useContext(CelebrationContext);
}

const PALETTE = [colors.teal, colors.amber, colors.success, '#3B82F6', '#F472B6', colors.navy];

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<Celebration | null>(null);
  const celebrate = useCallback((e: CelebrationEvent) => {
    setEvent({ ...e, id: Date.now() });
  }, []);

  return (
    <CelebrationContext.Provider value={celebrate}>
      <View style={{ flex: 1 }}>
        {children}
        {event ? (
          <CelebrationOverlay key={event.id} event={event} onDone={() => setEvent(null)} />
        ) : null}
      </View>
    </CelebrationContext.Provider>
  );
}

function CelebrationOverlay({ event, onDone }: { event: Celebration; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const banner = useRef(new Animated.Value(0)).current;

  const particles = useMemo(() => {
    if (reduced) return [];
    return Array.from({ length: 38 }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const speed = 130 + Math.random() * 240;
      return {
        id: i,
        color: PALETTE[i % PALETTE.length],
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        rot: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 7,
        delay: Math.random() * 160,
        duration: 1100 + Math.random() * 700,
        value: new Animated.Value(0),
      };
    });
  }, [reduced, width, height]);

  useEffect(() => {
    if (reduced) {
      banner.setValue(1);
      const t = setTimeout(onDone, 1800);
      return () => clearTimeout(t);
    }

    Animated.spring(banner, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();

    Animated.parallel(
      particles.map((p) =>
        Animated.timing(p.value, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();

    const t = setTimeout(onDone, 2900);
    return () => clearTimeout(t);
  }, [banner, onDone, particles, reduced]);

  const bannerScale = banner.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const bannerShift = banner.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {particles.map((p) => {
        const opacity = p.value.interpolate({
          inputRange: [0, 0.72, 1],
          outputRange: [1, 1, 0],
        });
        const translateX = p.value.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const translateY = p.value.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0, p.dy, p.dy + 340],
        });
        const rotate = p.value.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rot}deg`],
        });
        const scale = p.value.interpolate({
          inputRange: [0, 0.12, 1],
          outputRange: [0.2, 1, 0.85],
        });

        return (
          <Animated.View
            key={p.id}
            style={{
              position: 'absolute',
              left: width / 2 - p.size / 2,
              top: height * 0.42,
              width: p.size,
              height: p.size * 1.7,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scale }],
            }}
          />
        );
      })}

      <Animated.View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          right: 16,
          alignItems: 'center',
          opacity: banner,
          transform: [{ translateY: bannerShift }, { scale: bannerScale }],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            maxWidth: 520,
            width: '100%',
            backgroundColor: colors.white,
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: colors.navy,
            shadowOpacity: 0.14,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.tealLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="m5 12.5 4.2 4.2L19 6.8"
                fill="none"
                stroke={colors.teal}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.navy, fontSize: 14 }}>{event.title}</Text>
            {event.subtitle ? (
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textMuted }}>
                {event.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
