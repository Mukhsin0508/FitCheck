import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radius, useTheme } from '@/theme';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  round?: boolean;
  style?: ViewStyle;
}

/** Soft breathing placeholder used while renders and images load. */
export function Skeleton({ width = '100%', height = 16, round = false, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: round ? radius.pill : radius.s,
          backgroundColor: colors.shimmer,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
