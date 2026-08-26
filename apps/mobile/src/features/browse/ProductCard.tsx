import type { Product } from '@fitcheck/affiliates';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { formatPrice } from '@/features/browse/format';
import { productImageSource } from '@/lib/images';
import { radius, spacing, useTheme } from '@/theme';

export interface ProductCardProps {
  product: Product;
}

/** Grid card for Browse: 3:4 image, brand/title/price, and a direct 'Try on' pill. */
export function ProductCard({ product }: ProductCardProps) {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  // Text sitting on the dark image overlay — light in both schemes.
  const onOverlay = scheme === 'dark' ? colors.ink : colors.bg;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, maxWidth: '50%' }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${product.brand} ${product.title}`}
        onPress={() => router.push(`/product/${product.id}`)}
      >
        <View
          style={{
            aspectRatio: 3 / 4,
            borderRadius: radius.l,
            overflow: 'hidden',
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Image
            source={productImageSource(product)}
            recyclingKey={product.id}
            contentFit="cover"
            transition={200}
            style={{ width: '100%', height: '100%' }}
          />
          {product.featured ? (
            <View
              style={{
                position: 'absolute',
                top: spacing.s,
                left: spacing.s,
                backgroundColor: colors.overlay,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.s,
                paddingVertical: spacing.xs,
              }}
            >
              <AppText variant="micro" color={onOverlay}>
                ✦ shot on Soul
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={{ paddingTop: spacing.s, gap: spacing.xs }}>
          <AppText variant="micro" muted>
            {product.brand}
          </AppText>
          <AppText variant="caption" numberOfLines={2}>
            {product.title}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: spacing.xs,
            }}
          >
            <AppText variant="caption" style={{ fontWeight: '700' }}>
              {formatPrice(product.priceCents, product.currency)}
            </AppText>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Try ${product.title} on me`}
              onPress={() => router.push(`/tryon/${product.id}`)}
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.m,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="caption" color={colors.accentInk} style={{ fontWeight: '600' }}>
                Try on
              </AppText>
            </PressableScale>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}
