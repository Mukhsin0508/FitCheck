import type { Product } from '@fitcheck/affiliates';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { formatPrice } from '@/features/browse/format';
import { productImageSource } from '@/lib/images';
import { radius, spacing, type, useTheme } from '@/theme';

export interface ProductCardProps {
  product: Product;
}

/**
 * Titles always reserve two caption lines so price rows align across
 * grid columns even when a title wraps to one line.
 */
const TITLE_BLOCK_HEIGHT = type.caption.lineHeight * 2;

/** The pill is 36pt tall; hitSlop stretches the touch target to >=44pt. */
const TRY_ON_HIT_SLOP = { top: 4, bottom: 4, left: 8, right: 8 } as const;

/** Grid card for Browse: 3:4 image, brand/title/price, and a direct 'Try on' pill. */
export function ProductCard({ product }: ProductCardProps) {
  const { colors } = useTheme();
  const router = useRouter();

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
            style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceAlt }}
          />
        </View>

        <View style={{ paddingTop: spacing.s, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="micro" muted numberOfLines={1} style={{ flexShrink: 1 }}>
              {product.brand}
            </AppText>
            {product.featured ? (
              <View
                accessibilityLabel="Shot on Soul"
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: radius.pill,
                    backgroundColor: colors.accent,
                  }}
                />
                <AppText variant="micro" muted>
                  Soul
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText variant="caption" numberOfLines={2} style={{ minHeight: TITLE_BLOCK_HEIGHT }}>
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
              pressedScale={0.94}
              hitSlop={TRY_ON_HIT_SLOP}
              style={{
                backgroundColor: colors.accent,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.l,
                height: 36,
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
