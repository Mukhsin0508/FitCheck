import { getProductById } from '@fitcheck/catalog';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { formatPrice, merchantName } from '@/features/browse/format';
import { openBuyLink } from '@/lib/affiliate';
import { productImageSource, resolveImageRef } from '@/lib/images';
import { useStore } from '@/state/store';
import { radius, spacing, useTheme } from '@/theme';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const product = getProductById(typeof id === 'string' ? id : '');
  const renders = useStore((state) => state.renders);
  const cachedRender = useMemo(
    () => Object.values(renders).find((render) => render.productId === product?.id),
    [renders, product?.id],
  );

  // Visual-only size selection; availability still comes from the merchant.
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Pull-down parallax: within the pull range the hero scales 1 -> 1.08
  // while translating by half the pull, which keeps its top edge pinned
  // (a top-anchored stretch) with no seam against the content below.
  const heroHeight = (width * 4) / 3;
  const pullRange = heroHeight * 0.08;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(scrollY.value, [-pullRange, 0], [-pullRange / 2, 0], Extrapolation.CLAMP),
      },
      { scale: interpolate(scrollY.value, [-pullRange, 0], [1.08, 1], Extrapolation.CLAMP) },
    ],
  }));

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!product) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            title="That one's gone"
            body="It's not in the catalog anymore. The rack moves fast."
            actionLabel="Back to browsing"
            onAction={goBack}
          />
        </View>
      </Screen>
    );
  }

  const merchant = merchantName(product.programId);
  const goTryOn = () => router.push(`/tryon/${product.id}`);
  const onBuy = () => {
    openBuyLink(product, cachedRender?.id).catch(() => {});
  };
  const blurTint = scheme === 'dark' ? 'dark' : 'light';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 200 }}
      >
        <Animated.View
          style={[
            { width: '100%', height: heroHeight, backgroundColor: colors.surfaceAlt },
            heroStyle,
          ]}
        >
          <Image
            source={productImageSource(product)}
            contentFit="cover"
            transition={200}
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel={`${product.brand} ${product.title}`}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{ paddingHorizontal: spacing.l, paddingTop: spacing.xl, gap: spacing.m }}
        >
          <View style={{ gap: spacing.xs }}>
            <AppText variant="micro" muted>
              {product.brand}
            </AppText>
            <AppText variant="title">{product.title}</AppText>
          </View>

          <AppText variant="heading">{formatPrice(product.priceCents, product.currency)}</AppText>

          <Card
            padded={false}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.s,
              paddingHorizontal: spacing.m,
              paddingVertical: spacing.m,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
              }}
            />
            <AppText variant="caption" muted style={{ flex: 1 }}>
              {merchant} pays us ~{Math.round(product.commissionPct)}% if you buy. Your price
              doesn't change.
            </AppText>
          </Card>

          {product.colors && product.colors.length > 0 ? (
            <View style={{ gap: spacing.s, marginTop: spacing.s }}>
              <AppText variant="micro" muted>
                Colors
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s }}>
                {product.colors.map((color) => (
                  <Chip key={color} label={color} />
                ))}
              </View>
            </View>
          ) : null}

          {product.sizes && product.sizes.length > 0 ? (
            <View style={{ gap: spacing.s, marginTop: spacing.s }}>
              <AppText variant="micro" muted>
                Sizes
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s }}>
                {product.sizes.map((size) => (
                  <Chip
                    key={size}
                    label={size}
                    selected={selectedSize === size}
                    onPress={() =>
                      setSelectedSize((current) => (current === size ? null : size))
                    }
                  />
                ))}
              </View>
              <AppText variant="micro" muted>
                sizes from the merchant feed
              </AppText>
            </View>
          ) : null}

          <View style={{ gap: spacing.s, marginTop: spacing.s }}>
            <AppText variant="micro" muted>
              Materials & fit
            </AppText>
            <AppText variant="body" muted>
              Details come from the merchant feed.
            </AppText>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={goBack}
        style={{
          position: 'absolute',
          top: insets.top + spacing.s,
          left: spacing.l,
          width: 44,
          height: 44,
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor: `${colors.bg}99`,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        }}
      >
        <BlurView tint={blurTint} intensity={30} style={StyleSheet.absoluteFill} />
        <View
          style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
        >
          <AppText style={{ fontSize: 26, lineHeight: 30, marginTop: -2, marginLeft: -1 }}>
            ‹
          </AppText>
        </View>
      </PressableScale>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `${colors.bg}B3`,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        }}
      >
        <BlurView tint={blurTint} intensity={40} style={StyleSheet.absoluteFill} />
        <View
          style={{
            paddingHorizontal: spacing.l,
            paddingTop: spacing.m,
            paddingBottom: Math.max(insets.bottom, spacing.m),
          }}
        >
          {cachedRender ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Already on you — see it"
              onPress={goTryOn}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.m,
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.m,
                padding: spacing.s,
                marginBottom: spacing.m,
              }}
            >
              <Image
                source={resolveImageRef(cachedRender.imageUrl)}
                contentFit="cover"
                transition={200}
                style={{
                  width: 36,
                  height: 48,
                  borderRadius: radius.s,
                  backgroundColor: colors.surfaceAlt,
                }}
              />
              <AppText variant="caption" style={{ fontWeight: '600', flex: 1 }}>
                Already on you — see it
              </AppText>
              <AppText variant="caption" muted>
                →
              </AppText>
            </PressableScale>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.m }}>
            <Button
              label="Try it on me"
              variant="primary"
              size="m"
              onPress={goTryOn}
              style={{ flex: 1 }}
            />
            <Button label={`Buy at ${merchant}`} variant="ghost" size="m" onPress={onBuy} />
          </View>
        </View>
      </View>
    </View>
  );
}
