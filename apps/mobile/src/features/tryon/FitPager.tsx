/**
 * Horizontal pager of finished renders — flick between this fit and the ones
 * you've rendered before. Page dots underneath when there's more than one.
 */

import type { TryOnRender } from '@fitcheck/tryon';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  FlatList,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { resolveImageRef } from '@/lib/images';
import { radius, spacing, useTheme } from '@/theme';

const DOTS_ZONE = 24;

function Dots({ count, active }: { count: number; active: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: DOTS_ZONE,
        flexDirection: 'row',
        gap: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: radius.pill,
            backgroundColor: i === active ? colors.accent : colors.borderStrong,
          }}
        />
      ))}
    </View>
  );
}

export interface FitPagerProps {
  renders: TryOnRender[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

export function FitPager({ renders, activeIndex, onIndexChange }: FitPagerProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [pagerHeight, setPagerHeight] = useState(0);
  const multiple = renders.length > 1;

  // 3:4 image sized to fit both the page width and the measured height.
  const availableHeight = Math.max(pagerHeight - (multiple ? DOTS_ZONE : 0), 0);
  const imageWidth = Math.max(
    Math.min(width - spacing.l * 2, Math.floor((availableHeight * 3) / 4)),
    0,
  );

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(event.nativeEvent.contentOffset.x / width);
    const index = Math.min(Math.max(raw, 0), renders.length - 1);
    if (index !== activeIndex) onIndexChange(index);
  };

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}>
      {pagerHeight > 0 ? (
        <>
          <FlatList
            data={renders}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            initialNumToRender={2}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={handleMomentumEnd}
            renderItem={({ item, index }) => (
              <View
                style={{
                  width,
                  height: availableHeight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Animated.View
                  entering={FadeIn.duration(index === 0 ? 400 : 250)}
                  style={{
                    width: imageWidth,
                    aspectRatio: 3 / 4,
                    borderRadius: radius.xl,
                    overflow: 'hidden',
                    // Quiet placeholder while the render image streams in.
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Image
                    source={resolveImageRef(item.imageUrl)}
                    recyclingKey={item.id}
                    contentFit="cover"
                    transition={200}
                    style={{ width: '100%', height: '100%' }}
                    accessibilityLabel="Your try-on render"
                  />
                </Animated.View>
              </View>
            )}
          />
          {multiple ? <Dots count={renders.length} active={activeIndex} /> : null}
        </>
      ) : null}
    </View>
  );
}
