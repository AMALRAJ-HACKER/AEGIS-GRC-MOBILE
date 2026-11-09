import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'index' | 'frameworks' | 'risks' | 'tasks' | 'ai';

// Reference design colors (sampled from user image)
const ACTIVE_COLOR = '#8FB2FB'; // Vibrant periwinkle blue for active tab
const INACTIVE_COLOR = '#FFFFFF'; // Crisp white for inactive tabs

export function TabIcon({ name, color, size = 21 }: { name: TabIconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* 1. Dashboard — Solid Home with chimney & door cutout */}
      {name === 'home' || name === 'index' ? (
        <>
          <Path
            d="M 12 2.8 L 2.5 10.8 L 4.5 10.8 L 4.5 20 A 1 1 0 0 0 5.5 21 L 9.5 21 L 9.5 15 L 14.5 15 L 14.5 21 L 18.5 21 A 1 1 0 0 0 19.5 20 L 19.5 10.8 L 22 10.8 Z"
            fill={color}
          />
          <Path d="M 16.5 4 L 19 4 L 19 8.5 L 16.5 6.5 Z" fill={color} />
        </>
      ) : null}

      {/* 2. Frameworks — Solid Compliance Shield with checkmark cutout */}
      {name === 'frameworks' ? (
        <>
          <Path
            d="M 12 2.5 C 16.5 4 19.5 5 20 5.2 C 20.4 5.4 20.7 5.8 20.7 6.2 C 20.7 12 17.5 17.5 12.5 21 C 12.2 21.2 11.8 21.2 11.5 21 C 6.5 17.5 3.3 12 3.3 6.2 C 3.3 5.8 3.6 5.4 4 5.2 C 4.5 5 7.5 4 12 2.5 Z"
            fill={color}
          />
          <Path
            d="M 8.5 11.8 L 11 14.3 L 15.8 9.2"
            stroke="#141828"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : null}

      {/* 3. Risks — Solid Hazard Warning Triangle with exclamation cutout */}
      {name === 'risks' ? (
        <>
          <Path
            d="M 10.8 3.6 C 11.3 2.8 12.7 2.8 13.2 3.6 L 21.8 18.2 C 22.3 19 21.7 20 20.7 20 L 3.3 20 C 2.3 20 1.7 19 2.2 18.2 Z"
            fill={color}
          />
          <Path d="M 12 8.5 L 12 13.5" stroke="#141828" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <Circle cx="12" cy="16.8" r="1.1" fill="#141828" />
        </>
      ) : null}

      {/* 4. Tasks — Solid Task Board with checkmark & task line */}
      {name === 'tasks' ? (
        <>
          <Rect x="3.5" y="3.5" width="17" height="17" rx="3.5" fill={color} />
          <Path
            d="M 7.5 11 L 9.8 13.3 L 14.5 8.5"
            stroke="#141828"
            strokeWidth="2.0"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M 7.5 16.5 L 16.5 16.5"
            stroke="#141828"
            strokeWidth="2.0"
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : null}

      {/* 5. Assistant — Solid AI Sparkles */}
      {name === 'ai' ? (
        <>
          <Path
            d="M 10.5 2 C 10.5 6.8 6.8 10.5 2 10.5 C 6.8 10.5 10.5 14.2 10.5 19 C 10.5 14.2 14.2 10.5 19 10.5 C 14.2 10.5 10.5 6.8 10.5 2 Z"
            fill={color}
          />
          <Path
            d="M 18 13 C 18 15.2 16.2 17 14 17 C 16.2 17 18 18.8 18 21 C 18 18.8 19.8 17 22 17 C 19.8 17 18 15.2 18 13 Z"
            fill={color}
          />
        </>
      ) : null}
    </Svg>
  );
}

/**
 * Tab bar icon that smoothly eases between states (220ms, no bounce).
 */
export function AnimatedTabIcon({ name, focused }: { name: TabIconName; focused: boolean }) {
  const v = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [focused, v]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
      }}
    >
      <TabIcon name={name} color={focused ? ACTIVE_COLOR : INACTIVE_COLOR} size={21} />
    </Animated.View>
  );
}
