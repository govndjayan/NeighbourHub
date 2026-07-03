import React, { useRef } from 'react';
import { PanResponder, Dimensions, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

const TABS = ['index', 'food', 'experts', 'complaints', 'directory'];

export default function SwipeWrapper({ children, style }) {
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef(segments);

  // Keep segmentsRef always up to date
  segmentsRef.current = segments;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 30 &&
          Math.abs(gestureState.dy) < 30 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentSegments = segmentsRef.current;
        const currentTab = currentSegments.length === 1 ? 'index' : currentSegments[1];
        const currentIndex = TABS.indexOf(currentTab);
        const prevTab = currentIndex > 0 ? TABS[currentIndex - 1] : null;

       console.log('SWIPE DEBUG:', {
    currentSegments,
    currentTab,
    currentIndex,
    prevTab,
    dx: gestureState.dx,
    navigatingTo: gestureState.dx > 50 && currentIndex > 0 ? `/(tabs)/${prevTab === 'index' ? 'index' : prevTab}` : 'none'
  });

        if (gestureState.dx < -50 && currentIndex < TABS.length - 1) {
          const nextTab = TABS[currentIndex + 1];
          router.replace(`/(tabs)/${nextTab}`);
        } else if (gestureState.dx > 50 && currentIndex > 0) {
          const prevTab = TABS[currentIndex - 1];
          if (prevTab === 'index') {
            router.replace('/');
          } else {
            router.replace(`/(tabs)/${prevTab}`);
          }
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