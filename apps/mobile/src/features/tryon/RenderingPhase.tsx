/**
 * The wait while a try-on renders: the garment breathing in the middle of the
 * screen, rotating status lines, and a thin bar easing toward done.
 */

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Skeleton } from '@/components/Skeleton';
import { radius, spacing, useTheme } from '@/theme';

const STATUS_LINES = [
  'Pinning the hem',
  'Matching your light',
  'Checking the drape',
  'Fitting the shoulders',
] as const;

const LINE_INTERVAL_MS = 1400;
/** Roughly the demo render time — the bar eases to ~90% over this window. */
const RENDER_ETA_MS = 5000;

function StatusTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % STATUS_LINES.length),
      LINE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const line = STATUS_LINES[index % STATUS_LINES.length] ?? STATUS_LINES[0];

  return (
    <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View key={index} entering={FadeIn.duration(420)} exiting={FadeOut.duration(300)}>
        <AppText
          variant="displayItalic"
          align="center"
          style={{ fontSize: 26, lineHeight: 32 }}
          accessibilityLiveRegion="polite"
        >
          {line}
        </AppText>
      </Animated.View>
    </View>
  );
}

function ProgressBar({ complete }: { complete: boolean }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(0.9, {
      duration: RENDER_ETA_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  useEffect(() => {
    if (complete) {
      progress.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
    }
  }, [complete, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Rendering your fit"
      style={{
        height: 3,
        borderRadius: radius.pill,
        backgroundColor: colors.shimmer,
        overflow: 'hidden',
        alignSelf: 'stretch',
      }}
    >
      <Animated.View
        style={[
          { height: '100%', borderRadius: radius.pill, backgroundColor: colors.ink },
          fill,
        ]}
      />
    </View>
  );
}

export interface RenderingPhaseProps {
  /** The garment being tried on; a skeleton block stands in when missing. */
  garmentSource?: ImageSourcePropType;
  /** True once the render resolved — snaps the bar to 100%. */
  complete?: boolean;
}

export function RenderingPhase({ garmentSource, complete = false }: RenderingPhaseProps) {
  const { width } = useWindowDimensions();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [scale]);

  const breathing = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const imageWidth = Math.round(width * 0.45);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xxl,
        paddingHorizontal: spacing.xl,
      }}
    >
      <Animated.View
        style={[
          {
            width: imageWidth,
            aspectRatio: 3 / 4,
            borderRadius: radius.l,
            overflow: 'hidden',
          },
          breathing,
        ]}
      >
        {garmentSource ? (
          <Image
            source={garmentSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityLabel="The garment being fitted"
          />
        ) : (
          <Skeleton width="100%" height={Math.round((imageWidth * 4) / 3)} />
        )}
      </Animated.View>

      <StatusTicker />

      <View style={{ alignSelf: 'stretch', paddingHorizontal: spacing.xxl }}>
        <ProgressBar complete={complete} />
      </View>
    </View>
  );
}
