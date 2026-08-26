import { getProductById } from '@fitcheck/catalog';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const product = getProductById(typeof id === 'string' ? id : '');
  const renders = useStore((state) => state.renders);
  const cachedRender = useMemo(
    () => Object.values(renders).find((render) => render.productId === product?.id),
    [renders, product?.id],
  );

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 200 }}
      >
        <View style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surfaceAlt }}>
          <Image
            source={productImageSource(product)}
            contentFit="cover"
            transition={200}
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel={`${product.brand} ${product.title}`}
          />
        </View>

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

          <View style={{ gap: spacing.xs }}>
            <AppText variant="heading">{formatPrice(product.priceCents, product.currency)}</AppText>
            <AppText variant="caption" muted>
              {merchant} pays us ~{Math.round(product.commissionPct)}% if you buy. Your price
              doesn't change.
            </AppText>
          </View>

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
                  <Chip key={size} label={size} />
                ))}
              </View>
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
      </ScrollView>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={goBack}
        style={{
          position: 'absolute',
          top: insets.top + spacing.s,
          left: spacing.l,
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${colors.bg}E6`,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        }}
      >
        <AppText variant="body" style={{ fontWeight: '600' }}>
          ←
        </AppText>
      </PressableScale>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.bg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
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
              style={{ width: 36, height: 48, borderRadius: radius.s }}
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
  );
}
