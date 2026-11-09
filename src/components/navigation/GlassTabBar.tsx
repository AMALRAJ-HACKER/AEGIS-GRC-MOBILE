import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter, usePathname, useSegments } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedTabIcon } from '@/components/icons/TabIcon';

type TabRoute = { key: string; name: string };

type GlassTabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: { title?: string; href?: any; tabBarItemStyle?: any; tabBarIcon?: any }; navigation?: any }>;
  navigation?: any;
  emitter?: any;
  navigateToTab?: (routeKey: string) => void;
  insets?: any;
};

const CONTENT_PAD_X = 6;
const DOCK_HEIGHT = 66; // Compact, balanced stadium dock height
const PILL_TOP = 4;
const PILL_BOTTOM = 4;

export function GlassTabBar(props: GlassTabBarProps) {
  const router = useRouter();
  const safeAreaInsets = useSafeAreaInsets();
  const insets = props.insets || safeAreaInsets;
  const { state, descriptors, navigation, emitter, navigateToTab } = props;

  const [contentWidth, setContentWidth] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  // Filter out any hidden/nested routes (e.g. href: null)
  const visibleRoutes = state.routes.filter((route) => {
    const opts = descriptors[route.key]?.options as any;
    return opts?.href !== null && opts?.tabBarItemStyle?.display !== 'none';
  });

  const count = visibleRoutes.length || 1;
  const pillWidth = contentWidth ? (contentWidth - CONTENT_PAD_X * 2) / count : 0;

  const pathname = (usePathname?.() || '').toLowerCase();
  const segments = (useSegments?.() || []) as string[];

  // Find active index within visible tabs
  const currentRoute = state.routes[state.index];
  const currentRouteName = (currentRoute?.name || '').toLowerCase();
  const normalizedCurrent = currentRouteName
    .replace(/^\/+/, '')
    .replace(/^\([^)]+\)\/+/, '');

  let activeIndex = visibleRoutes.findIndex((r) => {
    const normalizedTab = r.name
      .toLowerCase()
      .replace(/^\/+/, '')
      .replace(/^\([^)]+\)\/+/, '');

    return (
      normalizedCurrent === normalizedTab ||
      normalizedCurrent.startsWith(`${normalizedTab}/`) ||
      currentRouteName === r.name ||
      currentRouteName.startsWith(r.name)
    );
  });

  // Semantic fallbacks for nested screens (e.g. risks/new, risks/[riskId], tasks/new, etc.):
  // Ensures indicator reliably stays on the parent tab and never wrongly slides to Dashboard!
  if (activeIndex === -1) {
    const isRisk =
      normalizedCurrent.includes('risk') ||
      currentRouteName.includes('risk') ||
      pathname.includes('/risks') ||
      segments.some((s) => String(s).toLowerCase().includes('risk'));

    const isTask =
      normalizedCurrent.includes('task') ||
      currentRouteName.includes('task') ||
      pathname.includes('/tasks') ||
      segments.some((s) => String(s).toLowerCase().includes('task'));

    const isFramework =
      normalizedCurrent.includes('framework') ||
      currentRouteName.includes('framework') ||
      pathname.includes('/frameworks') ||
      segments.some((s) => String(s).toLowerCase().includes('framework'));

    const isAi =
      normalizedCurrent.includes('ai') ||
      currentRouteName.includes('ai') ||
      pathname.includes('/ai') ||
      segments.some((s) => String(s).toLowerCase().includes('ai'));

    if (isRisk) {
      activeIndex = visibleRoutes.findIndex((r) => r.name.toLowerCase().includes('risk'));
    } else if (isTask) {
      activeIndex = visibleRoutes.findIndex((r) => r.name.toLowerCase().includes('task'));
    } else if (isFramework) {
      activeIndex = visibleRoutes.findIndex((r) => r.name.toLowerCase().includes('framework'));
    } else if (isAi) {
      activeIndex = visibleRoutes.findIndex((r) => r.name.toLowerCase().includes('ai'));
    }
  }

  if (activeIndex === -1) {
    activeIndex = 0;
  }

  // Smooth 220ms capsule slide — fluid aquatic motion
  useEffect(() => {
    if (!pillWidth) return;
    Animated.timing(slideX, {
      toValue: CONTENT_PAD_X + activeIndex * pillWidth,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, pillWidth, slideX]);

  // Handle tab press safely across React Navigation 7, navigation prop, and expo router
  const handlePress = (route: TabRoute, isFocused: boolean) => {
    const event = navigation?.emit
      ? navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        })
      : emitter?.emit
      ? emitter.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        })
      : { defaultPrevented: false };

    if (event?.defaultPrevented) return;

    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate(route.name);
    } else if (typeof navigateToTab === 'function') {
      navigateToTab(route.key);
    }
  };

  const handleLongPress = (route: TabRoute) => {
    emitter?.emit?.({
      type: 'tabLongPress',
      target: route.key,
    });
  };

  // Safe area handling: snugly positioned to bottom across all devices
  const bottomMargin = insets.bottom > 0 ? Math.max(insets.bottom - 12, 10) : 8;

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: bottomMargin }]}>
      {/* Outer shadow layer for dark midnight floating elevation */}
      <View style={styles.shadowLayer}>
        {/* Dock with midnight navy glass surface (matching reference image) */}
        <View style={styles.dock}>
          {/* Midnight navy blue gradient base */}
          <LinearGradient
            colors={['#232B46', '#1A2138', '#141828']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Expo-blur native blur layer */}
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={25}
            tint="dark"
          />

          {/* Subtle top specular glass reflection */}
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View
            style={styles.content}
            onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
          >
            {/* Sliding active capsule pill (matching reference image) */}
            {pillWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pill,
                  { width: pillWidth, transform: [{ translateX: slideX }] },
                ]}
              />
            ) : null}

            {visibleRoutes.map((route, index) => {
              const isFocused = activeIndex === index;
              const label = descriptors[route.key]?.options.title || route.name;
              const iconName = (route.name === 'index' ? 'home' : route.name) as any;
              const customIcon = descriptors[route.key]?.options?.tabBarIcon;
              return (
                <TouchableOpacity
                  key={route.key}
                  style={styles.tabItem}
                  onPress={() => handlePress(route, isFocused)}
                  onLongPress={() => handleLongPress(route)}
                  accessibilityState={{ selected: isFocused }}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  activeOpacity={0.75}
                >
                  {typeof customIcon === 'function' ? (
                    customIcon({ focused: isFocused, color: isFocused ? '#8FB2FB' : '#FFFFFF', size: 21 })
                  ) : (
                    <AnimatedTabIcon name={iconName} focused={isFocused} />
                  )}
                  <Text
                    numberOfLines={1}
                    style={[styles.tabLabel, isFocused ? styles.activeLabel : styles.inactiveLabel]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  shadowLayer: {
    width: '100%',
    maxWidth: 500, // Compact tablet responsive constraint
    borderRadius: 32, // Smooth stadium pill radius
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 3px 10px rgba(22,27,46,0.25)',
        }
      : {}),
  },
  dock: {
    width: '100%',
    height: DOCK_HEIGHT,
    borderRadius: 32, // Compact stadium pill curve
    borderTopWidth: 1.2,
    borderTopColor: 'rgba(255, 255, 255, 0.16)', // Subtle top reflection
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)', // Clean border
    backgroundColor: '#1A2138', // Midnight navy blue base
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? {
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
        }
      : {}),
  },
  content: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CONTENT_PAD_X,
  },
  pill: {
    position: 'absolute',
    top: PILL_TOP,
    bottom: PILL_BOTTOM,
    left: 0,
    borderRadius: 20, // Compact rounded capsule
    backgroundColor: 'rgba(75, 95, 145, 0.38)', // Soft slate-blue capsule from reference image
    borderWidth: 1,
    borderColor: 'rgba(140, 175, 250, 0.20)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabItem: {
    flex: 1, // Equal distribution, no crowding
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    zIndex: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  activeLabel: {
    fontWeight: '600',
    color: '#8FB2FB', // Vibrant periwinkle blue from reference image
  },
  inactiveLabel: {
    fontWeight: '500',
    color: '#D6DBEF', // Clean ice-white from reference image
  },
});
