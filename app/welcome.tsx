import { useEffect, useRef, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useResponsive } from '@/lib/responsive';
import { radius, spacing } from '@/lib/design-tokens';
import { FadeIn } from '@/components/motion/FadeIn';
import { useTheme } from '@/theme/ThemeProvider';
import {
  ActivityIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  LayersIcon,
  LockIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@/components/icons/ActionIcons';

const CONTENT_MAX = 1120;

const NAV = [
  { key: 'platform', label: 'Platform' },
  { key: 'capabilities', label: 'Capabilities' },
  { key: 'industries', label: 'Industries' },
  { key: 'solutions', label: 'Solutions' },
] as const;

type NavKey = (typeof NAV)[number]['key'];

const FRAMEWORK_CHIPS = [
  'ISO/IEC 27001:2022',
  'SOC 2',
  'NIST CSF 2.0',
  'GDPR',
  'DPDPA 2023',
  'CERT-In',
  'RBI',
  'UGC',
];

type Tone = 'ok' | 'warn' | 'neutral';

const TONES: Record<Tone, { lightBg: string; lightFg: string; darkBg: string; darkFg: string }> = {
  ok: { lightBg: '#DCFCE7', lightFg: '#166534', darkBg: '#0F2E2E', darkFg: '#6EE7B7' },
  warn: { lightBg: '#FEF3C7', lightFg: '#92400E', darkBg: '#3A2A08', darkFg: '#FCD34D' },
  neutral: { lightBg: '#F1F5F9', lightFg: '#475569', darkBg: '#1F2937', darkFg: '#CBD5E1' },
};

const PREVIEW_FRAMEWORKS: { name: string; meta: string; value: string; tone: Tone }[] = [
  { name: 'GDPR', meta: 'Data protection', value: '87%', tone: 'warn' },
  { name: 'NIS2', meta: 'Supply chain security', value: 'Compliant', tone: 'ok' },
  { name: 'DORA', meta: 'ICT risk management', value: '92%', tone: 'warn' },
  { name: 'ISO 27001', meta: 'Access control', value: 'Compliant', tone: 'ok' },
  { name: 'SOC 2', meta: 'Availability', value: 'Review', tone: 'neutral' },
];

function Cta({
  label,
  onPress,
  variant = 'primary',
  compact = false,
  stretch = false,
  showArrow = true,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  compact?: boolean;
  stretch?: boolean;
  showArrow?: boolean;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number) => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue: to,
      friction: 8,
      tension: 240,
      useNativeDriver: true,
    }).start();
  };

  const bg = variant === 'primary' ? colors.primary : colors.surface;
  const fg = variant === 'primary' ? colors.onPrimary : colors.heading;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, stretch ? { width: '100%' } : null]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.97)}
        onPressOut={() => press(1)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          {
            backgroundColor: bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: compact ? 9 : 14,
            paddingHorizontal: compact ? 14 : 22,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: pressed ? 0.88 : 1,
          },
        ]}
      >
        <Text style={{ color: fg, fontWeight: '700', fontSize: compact ? 13 : 15 }}>{label}</Text>
        {showArrow && !compact ? <ArrowRightIcon color={fg} size={16} /> : null}
      </Pressable>
    </Animated.View>
  );
}

function LiveDot({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);

  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      {reduced ? null : (
        <Animated.View
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }}
        />
      )}
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

function PreviewCard({ onAdd }: { onAdd: () => void }) {
  const { colors, isDark } = useTheme();
  const accent = isDark ? colors.teal : colors.water800;

  const badgeStyle = (tone: Tone) => {
    const t = TONES[tone];
    return {
      bg: isDark ? t.darkBg : t.lightBg,
      fg: isDark ? t.darkFg : t.lightFg,
    };
  };

  const progress = (item: (typeof PREVIEW_FRAMEWORKS)[number]) => {
    if (item.value.endsWith('%')) return item.value;
    return item.tone === 'ok' ? '100%' : '60%';
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 5,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.heading, fontSize: 15, fontWeight: '800' }}>Compliance Overview</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            Acme Security · live workspace
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 5,
            paddingHorizontal: 9,
            borderRadius: 999,
            backgroundColor: isDark ? '#0F2E2E' : '#DCFCE7',
          }}
        >
          <LiveDot color={isDark ? '#34D399' : '#16A34A'} />
          <Text style={{ color: isDark ? '#6EE7B7' : '#166534', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>
            LIVE
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {[
          { value: '6', label: 'Frameworks' },
          { value: '94%', label: 'Risk score' },
          { value: '12/15', label: 'Compliant' },
        ].map((stat, i) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 9,
              paddingHorizontal: 4,
              backgroundColor: colors.surfaceAlt,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: colors.border,
            }}
          >
            <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '800' }}>{stat.value}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 9.5, marginTop: 1, textAlign: 'center' }}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 6 }}>
        {PREVIEW_FRAMEWORKS.map((item) => {
          const b = badgeStyle(item.tone);
          return (
            <View
              key={item.name}
              style={{ paddingTop: 9, paddingBottom: 7, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.heading, fontSize: 12.5, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 1 }}>{item.meta}</Text>
                </View>
                <View style={{ backgroundColor: b.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 }}>
                  <Text style={{ color: b.fg, fontSize: 9.5, fontWeight: '800' }}>{item.value}</Text>
                </View>
              </View>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.neutralBg,
                  marginTop: 6,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 4,
                    width: progress(item),
                    borderRadius: 2,
                    backgroundColor: item.tone === 'ok' ? colors.success : accent,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add Framework"
        accessibilityHint="Create an account to add frameworks to your workspace"
        style={({ pressed }) => ({
          marginTop: 10,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: isDark ? '#155E63' : colors.water300,
          backgroundColor: isDark ? '#0D1B22' : colors.water100,
          borderRadius: 10,
          paddingVertical: 9,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 6,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <PlusIcon color={accent} size={14} />
        <Text style={{ color: accent, fontSize: 12, fontWeight: '800' }}>Add Framework</Text>
      </Pressable>

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: colors.heading, fontSize: 11, fontWeight: '700' }}>Cross-framework coverage</Text>
          <Text style={{ color: accent, fontSize: 10.5, fontWeight: '800' }}>327 controls · 82%</Text>
        </View>
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.neutralBg,
            marginTop: 7,
            overflow: 'hidden',
          }}
        >
          <View style={{ height: 6, width: '82%', borderRadius: 3, backgroundColor: accent }} />
        </View>
      </View>
    </View>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  width,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  width: string | number;
  delay: number;
}) {
  const { colors, isDark } = useTheme();
  return (
    <FadeIn delay={delay} style={{ width }}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 20,
          gap: 10,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#0F2E2E' : colors.water100,
            borderWidth: 1,
            borderColor: isDark ? '#155E63' : colors.water200,
          }}
        >
          {icon}
        </View>
        <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 21 }}>{body}</Text>
      </View>
    </FadeIn>
  );
}

export default function Welcome() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { isTablet, hPad, topInset, bottomInset, width } = useResponsive();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Record<string, number>>({});

  const accent = isDark ? colors.teal : colors.water800;
  const accentBg = isDark ? '#0F2E2E' : colors.water100;
  const accentBorder = isDark ? '#155E63' : colors.water200;

  const scrollTo = (key: NavKey | 'top') => {
    if (key === 'top' || key === 'platform') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const y = offsets.current[key];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const recordOffset = (key: NavKey) => (e: LayoutChangeEvent) => {
    offsets.current[key] = e.nativeEvent.layout.y;
  };

  const signIn = () => router.push('/(auth)/login');
  const getStarted = () => router.push('/(auth)/signup');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top navigation */}
      <View
        style={{
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingTop: topInset,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: CONTENT_MAX,
            alignSelf: 'center',
            paddingHorizontal: hPad,
            minHeight: 62,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => scrollTo('top')}
            accessibilityRole="button"
            accessibilityLabel="AEGIS GRC home"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: accentBg,
                borderWidth: 1,
                borderColor: accentBorder,
              }}
            >
              <ShieldCheckIcon color={accent} size={20} />
            </View>
            <Text style={{ color: colors.heading, fontSize: 16, fontWeight: '900', letterSpacing: 0.4 }}>
              AEGIS <Text style={{ color: accent }}>GRC</Text>
            </Text>
          </Pressable>

          {isTablet ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
              {NAV.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => scrollTo(item.key)}
                  accessibilityRole="link"
                  accessibilityLabel={item.label}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {width >= 360 ? (
              <Pressable
                onPress={signIn}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingHorizontal: 4 })}
              >
                <Text style={{ color: colors.heading, fontSize: 13, fontWeight: '700' }}>Sign in</Text>
              </Pressable>
            ) : null}
            <Cta label="Get started" onPress={getStarted} compact showArrow={false} />
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 40 }}
      >
        {/* Hero */}
        <View style={{ overflow: 'hidden', backgroundColor: colors.bg }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -140,
              right: -90,
              width: 360,
              height: 360,
              borderRadius: 180,
              backgroundColor: isDark ? colors.waterDark300 : colors.water200,
              opacity: isDark ? 0.35 : 0.5,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 250,
              left: -120,
              width: 300,
              height: 300,
              borderRadius: 150,
              backgroundColor: isDark ? colors.waterDark200 : colors.water100,
              opacity: isDark ? 0.5 : 0.9,
            }}
          />

          <View
            style={{
              width: '100%',
              maxWidth: CONTENT_MAX,
              alignSelf: 'center',
              paddingHorizontal: hPad,
              paddingTop: isTablet ? 64 : 38,
              paddingBottom: isTablet ? 54 : 34,
            }}
          >
            <View
              style={{
                flexDirection: isTablet ? 'row' : 'column',
                alignItems: 'center',
                gap: isTablet ? 52 : 30,
              }}
            >
              <View style={{ flex: isTablet ? 1 : undefined, width: '100%' }}>
                <FadeIn>
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      paddingVertical: 6,
                      paddingHorizontal: 11,
                      borderRadius: 999,
                      backgroundColor: accentBg,
                      borderWidth: 1,
                      borderColor: accentBorder,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
                    <Text
                      style={{
                        color: accent,
                        fontSize: 10,
                        fontWeight: '900',
                        letterSpacing: 1.3,
                      }}
                    >
                      DETERMINISTIC GRC
                    </Text>
                  </View>
                </FadeIn>

                <FadeIn delay={70}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      color: colors.heading,
                      fontSize: isTablet ? 46 : 34,
                      lineHeight: isTablet ? 52 : 40,
                      fontWeight: '900',
                      letterSpacing: isTablet ? -1.2 : -0.7,
                      marginTop: 18,
                    }}
                  >
                    Compliance you can trust in front of an{' '}
                    <Text style={{ color: accent }}>auditor.</Text>
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: isTablet ? 18 : 14,
                      lineHeight: isTablet ? 22 : 18,
                      marginTop: 6,
                      maxWidth: 560,
                    }}
                  >
                    Verbatim citations from source regulations — grounded in law, not generated.
                  </Text>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: isTablet ? 16 : 14,
                      lineHeight: isTablet ? 22 : 18,
                      marginTop: 4,
                      maxWidth: 560,
                    }}
                  >
                    where compliance meets intelligence
                  </Text>
                </FadeIn>

                <FadeIn delay={130}>
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontSize: isTablet ? 16 : 15,
                      lineHeight: isTablet ? 25 : 23,
                      marginTop: 16,
                      maxWidth: 560,
                    }}
                  >
                    Every obligation and control traces back to a verbatim citation from the source
                    regulation — grounded in law, not generated from a model&apos;s memory. AEGIS GRC
                    keeps every claim defensible.
                  </Text>
                </FadeIn>

                <FadeIn delay={190}>
                  <View
                    style={{
                      flexDirection: isTablet ? 'row' : 'column',
                      alignItems: isTablet ? 'center' : 'stretch',
                      gap: 12,
                      marginTop: 26,
                    }}
                  >
                    <Cta
                      label="Start free"
                      onPress={getStarted}
                      stretch={!isTablet}
                      accessibilityHint="Create your AEGIS GRC account"
                    />
                    <Cta
                      label="Sign in"
                      variant="secondary"
                      onPress={signIn}
                      stretch={!isTablet}
                      showArrow={false}
                      accessibilityHint="Sign in to your workspace"
                    />
                  </View>
                </FadeIn>

                <FadeIn delay={250}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 22 }}>
                    {['No credit card required', 'Audit-ready in minutes'].map((item) => (
                      <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CheckIcon color={accent} size={14} />
                        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </FadeIn>

                <FadeIn delay={300}>
                  <Pressable
                    onPress={() => scrollTo('solutions')}
                    accessibilityRole="link"
                    accessibilityLabel="See how it works"
                    style={({ pressed }) => ({
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      marginTop: 20,
                      paddingVertical: 4,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <Text style={{ color: accent, fontSize: 13, fontWeight: '800' }}>See how it works</Text>
                    <ArrowRightIcon color={accent} size={14} />
                  </Pressable>
                </FadeIn>
              </View>

              <View style={{ flex: isTablet ? 1 : undefined, width: '100%' }}>
                <FadeIn delay={160} distance={16} duration={420}>
                  <PreviewCard onAdd={getStarted} />
                </FadeIn>
              </View>
            </View>
          </View>
        </View>

        {/* Framework coverage */}
        <View
          onLayout={recordOffset('industries')}
          style={{ backgroundColor: colors.surfaceAlt, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: CONTENT_MAX,
              alignSelf: 'center',
              paddingHorizontal: hPad,
              paddingVertical: isTablet ? 46 : 34,
            }}
          >
            <FadeIn>
              <Text
                style={{
                  color: accent,
                  fontSize: 10.5,
                  fontWeight: '900',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Built for the frameworks that matter
              </Text>
              <Text
                style={{
                  color: colors.heading,
                  fontSize: isTablet ? 30 : 24,
                  lineHeight: isTablet ? 36 : 30,
                  fontWeight: '900',
                  letterSpacing: -0.5,
                  marginTop: 10,
                  maxWidth: 720,
                }}
              >
                One register. Every standard your auditors ask for.
              </Text>
            </FadeIn>

            <FadeIn delay={90}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
                {FRAMEWORK_CHIPS.map((name) => (
                  <View
                    key={name}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <CheckIcon color={accent} size={13} />
                    <Text style={{ color: colors.heading, fontSize: 12.5, fontWeight: '700' }}>{name}</Text>
                  </View>
                ))}
              </View>
            </FadeIn>
          </View>
        </View>

        {/* Capabilities */}
        <View onLayout={recordOffset('capabilities')}>
          <View
            style={{
              width: '100%',
              maxWidth: CONTENT_MAX,
              alignSelf: 'center',
              paddingHorizontal: hPad,
              paddingTop: isTablet ? 64 : 42,
              paddingBottom: isTablet ? 12 : 8,
            }}
          >
            <FadeIn>
              <Text
                style={{
                  color: accent,
                  fontSize: 10.5,
                  fontWeight: '900',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Capabilities
              </Text>
              <Text
                style={{
                  color: colors.heading,
                  fontSize: isTablet ? 32 : 25,
                  lineHeight: isTablet ? 38 : 31,
                  fontWeight: '900',
                  letterSpacing: -0.6,
                  marginTop: 10,
                  maxWidth: 740,
                }}
              >
                Defensible by design — not assembled after the fact.
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: isTablet ? 15 : 14,
                  lineHeight: 23,
                  marginTop: 12,
                  maxWidth: 680,
                }}
              >
                The work of compliance stays in one connected system, so every control, task and piece
                of evidence tells the same story when the auditor asks.
              </Text>
            </FadeIn>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
              <FeatureCard
                width={isTablet ? '48.5%' : '100%'}
                delay={60}
                icon={<FileTextIcon color={accent} size={21} />}
                title="Verbatim citations"
                body="Every obligation links to the exact clause in the source regulation, so each control can be defended with the law itself."
              />
              <FeatureCard
                width={isTablet ? '48.5%' : '100%'}
                delay={120}
                icon={<LayersIcon color={accent} size={21} />}
                title="Cross-framework mapping"
                body="Map one control to ISO 27001, SOC 2, NIST CSF and more. Stop rewriting the same evidence five different ways."
              />
              <FeatureCard
                width={isTablet ? '48.5%' : '100%'}
                delay={180}
                icon={<LockIcon color={accent} size={21} />}
                title="Living evidence"
                body="Collect, link and reuse evidence across audits. Versioned and permissioned by default, with a 25 MB file allowance."
              />
              <FeatureCard
                width={isTablet ? '48.5%' : '100%'}
                delay={240}
                icon={<ActivityIcon color={accent} size={21} />}
                title="Audit-ready trails"
                body="An immutable activity log records who changed what, when and why — exportable as CSV or PDF when the audit lands."
              />
            </View>
          </View>
        </View>

        {/* How it works */}
        <View onLayout={recordOffset('solutions')}>
          <View
            style={{
              width: '100%',
              maxWidth: CONTENT_MAX,
              alignSelf: 'center',
              paddingHorizontal: hPad,
              paddingTop: isTablet ? 64 : 42,
              paddingBottom: isTablet ? 24 : 12,
            }}
          >
            <FadeIn>
              <Text
                style={{
                  color: accent,
                  fontSize: 10.5,
                  fontWeight: '900',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                How it works
              </Text>
              <Text
                style={{
                  color: colors.heading,
                  fontSize: isTablet ? 32 : 25,
                  lineHeight: isTablet ? 38 : 31,
                  fontWeight: '900',
                  letterSpacing: -0.6,
                  marginTop: 10,
                }}
              >
                From empty workspace to audit-ready.
              </Text>
            </FadeIn>

            <View
              style={{
                flexDirection: isTablet ? 'row' : 'column',
                gap: 16,
                marginTop: 24,
                alignItems: 'stretch',
              }}
            >
              {[
                {
                  n: '01',
                  title: 'Activate your frameworks',
                  body: 'Browse the catalogue and add the standards you need. Controls are seeded instantly as “Not Started”.',
                },
                {
                  n: '02',
                  title: 'Assign controls and evidence',
                  body: 'Owners, due dates, safeguards and mitigation plans live beside the control they belong to.',
                },
                {
                  n: '03',
                  title: 'Prove it with confidence',
                  body: 'Export audit-ready reports with citations, evidence links and a complete activity trail.',
                },
              ].map((step, i) => (
                <FadeIn key={step.n} delay={80 + i * 70} style={{ flex: isTablet ? 1 : undefined, width: isTablet ? undefined : '100%' }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 20,
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: accentBg,
                        borderWidth: 1,
                        borderColor: accentBorder,
                      }}
                    >
                      <Text style={{ color: accent, fontSize: 12, fontWeight: '900' }}>{step.n}</Text>
                    </View>
                    <Text style={{ color: colors.heading, fontSize: 15.5, fontWeight: '800', marginTop: 4 }}>
                      {step.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 21 }}>{step.body}</Text>
                  </View>
                </FadeIn>
              ))}
            </View>
          </View>
        </View>

        {/* Closing CTA */}
        <View
          style={{
            width: '100%',
            maxWidth: CONTENT_MAX,
            alignSelf: 'center',
            paddingHorizontal: hPad,
            paddingTop: isTablet ? 44 : 30,
          }}
        >
          <FadeIn delay={60}>
            <View
              style={{
                borderRadius: 22,
                borderWidth: 1,
                borderColor: accentBorder,
                backgroundColor: isDark ? colors.surfaceAlt : colors.water100,
                padding: isTablet ? 36 : 24,
                overflow: 'hidden',
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -70,
                  top: -80,
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  backgroundColor: isDark ? colors.waterDark300 : colors.water200,
                  opacity: isDark ? 0.45 : 0.7,
                }}
              />
              <Text
                style={{
                  color: accent,
                  fontSize: 10.5,
                  fontWeight: '900',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                Ready when you are
              </Text>
              <Text
                style={{
                  color: colors.heading,
                  fontSize: isTablet ? 30 : 24,
                  lineHeight: isTablet ? 36 : 30,
                  fontWeight: '900',
                  letterSpacing: -0.5,
                  marginTop: 10,
                  maxWidth: 620,
                }}
              >
                Make your next audit the boring one.
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: isTablet ? 15 : 14,
                  lineHeight: 23,
                  marginTop: 10,
                  maxWidth: 560,
                }}
              >
                Set up your workspace in minutes. Invite your team when you&apos;re ready — every role
                is added by invitation, never self-selected.
              </Text>

              <View
                style={{
                  flexDirection: isTablet ? 'row' : 'column',
                  gap: 12,
                  marginTop: 22,
                  alignItems: isTablet ? 'center' : 'stretch',
                }}
              >
                <Cta
                  label="Start free"
                  onPress={getStarted}
                  stretch={!isTablet}
                  accessibilityHint="Create your AEGIS GRC account"
                />
                <Cta
                  label="Sign in"
                  variant="secondary"
                  onPress={signIn}
                  stretch={!isTablet}
                  showArrow={false}
                  accessibilityHint="Sign in to your workspace"
                />
              </View>
            </View>
          </FadeIn>
        </View>

        {/* Footer */}
        <View
          style={{
            width: '100%',
            maxWidth: CONTENT_MAX,
            alignSelf: 'center',
            paddingHorizontal: hPad,
            paddingTop: 28,
          }}
        >
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 18,
              flexDirection: isTablet ? 'row' : 'column',
              alignItems: isTablet ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheckIcon color={accent} size={17} />
              <Text style={{ color: colors.heading, fontSize: 13, fontWeight: '800' }}>AEGIS GRC</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 11.5, lineHeight: 17 }}>
              © 2026 AEGIS GRC · Governance, risk and compliance, grounded in law.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
