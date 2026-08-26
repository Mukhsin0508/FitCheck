/**
 * Horizontal pager of finished renders — flick between this fit and the ones
 * you've rendered before. Page dots underneath when there's more than one.
 *
 * Web notes: onMomentumScrollEnd never fires on react-native-web, so the
 * index also tracks onScroll there; mice can't drag-scroll, so the dots are
 * pressable and chevrons appear on web.
 */

import type { TryOnRender } from '@fitcheck/tryon';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { resolveImageRef } from '@/lib/images';
import { radius, spacing, useTheme } from '@/theme';

const DOTS_ZONE = 24;

function Dots({
  count,
  active,
  onSelect,
}: {
  count: number;
  active: number;
  onSelect: (index: number) => void;
}) {
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
        <Pressable
          key={i}
          accessibilityRole="button"
          accessibilityLabel={`Go to fit ${i + 1} of ${count}`}
          hitSlop={{ top: 9, bottom: 9, left: 5, right: 5 }}
          onPress={() => onSelect(i)}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: i === active ? colors.accent : colors.borderStrong,
            }}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** Web-only prev/next chevron — mice can't drag-scroll a snap pager. */
function Chevron({
  direction,
  onPress,
}: {
  direction: 'prev' | 'next';
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'prev' ? 'Previous fit' : 'Next fit'}
      onPress={onPress}
      style={{
        position: 'absolute',
        top: '50%',
        marginTop: -18,
        [direction === 'prev' ? 'left' : 'right']: spacing.s,
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${colors.bg}CC`,
        borderWidth: 1,
        borderColor: colors.border,
        zIndex: 2,
      }}
    >
      <AppText style={{ fontSize: 18, lineHeight: 22 }}>
        {direction === 'prev' ? '‹' : '›'}
      </AppText>
    </Pressable>
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
  const listRef = useRef<FlatList<TryOnRender>>(null);
  const multiple = renders.length > 1;

  // 3:4 image sized to fit both the page width and the measured height.
  const availableHeight = Math.max(pagerHeight - (multiple ? DOTS_ZONE : 0), 0);
  const imageWidth = Math.max(
    Math.min(width - spacing.l * 2, Math.floor((availableHeight * 3) / 4)),
    0,
  );

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(event.nativeEvent.contentOffset.x / width);
    const index = Math.min(Math.max(raw, 0), renders.length - 1);
    if (index !== activeIndex) onIndexChange(index);
  };

  const goTo = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), renders.length - 1);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    onIndexChange(clamped);
  };

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}>
      {pagerHeight > 0 ? (
        <>
          <FlatList
            ref={listRef}
            data={renders}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            initialNumToRender={2}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={handleScrollEnd}
            // react-native-web never emits onMomentumScrollEnd; its trailing
            // onScroll (~100ms after the snap settles) carries the final offset.
            onScroll={Platform.OS === 'web' ? handleScrollEnd : undefined}
            scrollEventThrottle={16}
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
          {Platform.OS === 'web' && multiple && activeIndex > 0 ? (
            <Chevron direction="prev" onPress={() => goTo(activeIndex - 1)} />
          ) : null}
          {Platform.OS === 'web' && multiple && activeIndex < renders.length - 1 ? (
            <Chevron direction="next" onPress={() => goTo(activeIndex + 1)} />
          ) : null}
          {multiple ? <Dots count={renders.length} active={activeIndex} onSelect={goTo} /> : null}
        </>
      ) : null}
    </View>
  );
}
