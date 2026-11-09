import React, { useEffect, useRef } from 'react';
import { View, PanResponder, BackHandler, type StyleProp, type ViewStyle, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';

export function SwipeBackContainer({
  onBack,
  children,
  style,
  edgeOnly = false,
}: {
  onBack: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edgeOnly?: boolean;
}) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const hasTriggeredRef = useRef(false);

  const triggerBack = () => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    onBackRef.current();
  };

  // 1. Android hardware back button & system back gesture
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      triggerBack();
      return true; // Prevents default app-closing behavior
    });
    return () => sub.remove();
  }, []);

  // Check if a move gesture qualifies as an intentional left-to-right swipe
  const isSwipeRight = (gestureState: PanResponderGestureState) => {
    // Must be moving towards the right with meaningful distance
    if (gestureState.dx <= 16) return false;

    // Must be horizontally dominant (not vertical scrolling)
    if (Math.abs(gestureState.dx) < Math.abs(gestureState.dy) * 1.25) return false;

    // If edgeOnly is specified, start touch must be within 120px of left screen edge
    if (edgeOnly && gestureState.x0 > 120) return false;

    return true;
  };

  // 2. Left-to-right swipe gesture detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // Capture on move so inner ScrollViews or FlatLists don't eat horizontal swipes
      onMoveShouldSetPanResponderCapture: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return isSwipeRight(gestureState);
      },
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return isSwipeRight(gestureState);
      },

      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        hasTriggeredRef.current = false;
      },

      onPanResponderMove: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Direct slide across screen: trigger if dragged far enough (> 90px)
        if (
          gestureState.dx > 90 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3
        ) {
          triggerBack();
        }
      },

      onPanResponderRelease: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        // Quick flick right or drag right
        const isFlickRight = gestureState.dx > 35 && gestureState.vx > 0.15;
        const isDragRight = gestureState.dx > 65;
        if (isFlickRight || isDragRight) {
          triggerBack();
        }
      },

      onPanResponderTerminate: (_evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const isFlickRight = gestureState.dx > 35 && gestureState.vx > 0.15;
        const isDragRight = gestureState.dx > 65;
        if (isFlickRight || isDragRight) {
          triggerBack();
        }
      },
    })
  ).current;

  return (
    <View style={[{ flex: 1 }, style]} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
