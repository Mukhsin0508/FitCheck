/**
 * The try-on moment. ~5s of rendering theatre, then the fit — full bleed,
 * swipeable against your past renders, with save / share / buy underneath.
 *
 * Route: /tryon/[productId]. Special case productId === 'pasted' + ?url=…
 * renders a garment from a pasted product link instead of the catalog.
 */

import { getProductById } from '@fitcheck/catalog';
import type { TryOnRender } from '@fitcheck/tryon';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { FitPager } from '@/features/tryon/FitPager';
import { RenderingPhase } from '@/features/tryon/RenderingPhase';
import { useTryOnRun } from '@/features/tryon/useTryOnRun';
import { openBuyLink } from '@/lib/affiliate';
import { productImageSource } from '@/lib/images';
import { useStore } from '@/state/store';
import { radius, spacing, useTheme } from '@/theme';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function successBuzz() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

export default function TryOnScreen() {
  const params = useLocalSearchParams<{ productId: string; url?: string }>();
  const productId = String(params.productId ?? '');
  const pastedUrl = params.url ? String(params.url) : undefined;
  const isPasted = productId === 'pasted';

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { status, render, retry } = useTryOnRun(productId, pastedUrl);

  const product = isPasted ? undefined : getProductById(productId);
  const renders = useStore((s) => s.renders);
  const closet = useStore((s) => s.closet);
  const addToCloset = useStore((s) => s.addToCloset);

  // This render first, then everything else you've tried on, newest first.
  const pages = useMemo<TryOnRender[]>(() => {
    if (!render) return [];
    const previous = Object.values(renders)
      .filter((r) => r.productId && r.id !== render.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return [render, ...previous];
  }, [render, renders]);

  const [activeIndex, setActiveIndex] = useState(0);
  const active = pages[activeIndex] ?? render;
  const activeProduct = active?.productId ? getProductById(active.productId) : undefined;
  const inCloset = active ? closet.some((c) => c.renderId === active.id) : false;

  // One success buzz, the moment the fit lands.
  const buzzedRef = useRef(false);
  useEffect(() => {
    if (status === 'done' && !buzzedRef.current) {
      buzzedRef.current = true;
      successBuzz();
    }
  }, [status]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const save = () => {
    if (!active || inCloset) return;
    addToCloset({
      renderId: active.id,
      productId: active.productId,
      imageRef: active.imageUrl,
      title: activeProduct?.title ?? 'From a link',
      brand: activeProduct?.brand,
      productUrl: activeProduct?.productUrl,
      provider: active.provider,
      costUsd: active.costUsd,
      createdAt: active.createdAt,
    });
    successBuzz();
  };

  const share = () => {
    if (active) router.push(`/share/${active.id}`);
  };

  const buy = () => {
    if (active && activeProduct) openBuyLink(activeProduct, active.id).catch(() => {});
  };

  const garmentSource = isPasted
    ? pastedUrl
      ? { uri: pastedUrl }
      : undefined
    : product
      ? productImageSource(product)
      : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Top-left close, present in every state. */}
      <View style={{ paddingHorizontal: spacing.l, paddingVertical: spacing.s }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={goBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <AppText style={{ fontSize: 16, lineHeight: 18, fontWeight: '600' }}>✕</AppText>
        </PressableScale>
      </View>

      {status === 'error' ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.l }}>
          <EmptyState
            title="That render slipped"
            body="Happens. Try again — it's on us."
            actionLabel="Retry"
            onAction={retry}
          />
        </View>
      ) : status === 'done' && active ? (
        <Animated.View entering={FadeIn.duration(400)} style={{ flex: 1 }}>
          {/* Header row: overline + cost note for the fit you're looking at. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.l,
              paddingBottom: spacing.m,
            }}
          >
            <AppText variant="micro" muted>
              On you
            </AppText>
            {active.cached ? (
              <View
                style={{
                  borderRadius: radius.pill,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.m,
                  paddingVertical: spacing.xs,
                }}
              >
                <AppText variant="caption" muted style={{ fontSize: 11, lineHeight: 14 }}>
                  from cache — cost {usd.format(0)}
                </AppText>
              </View>
            ) : (
              <AppText
                variant="caption"
                muted
                style={{ fontSize: 11, lineHeight: 14, opacity: 0.45 }}
              >
                render ~{usd.format(active.costUsd)}
              </AppText>
            )}
          </View>

          <FitPager renders={pages} activeIndex={activeIndex} onIndexChange={setActiveIndex} />

          {/* Action bar */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(120)}
            style={{
              paddingHorizontal: spacing.l,
              paddingTop: spacing.l,
              paddingBottom: insets.bottom + spacing.m,
              gap: spacing.m,
            }}
          >
            <Button
              label={inCloset ? 'In your closet ✓' : 'Save to closet'}
              variant="primary"
              size="l"
              fullWidth
              disabled={inCloset}
              onPress={save}
            />
            <View style={{ flexDirection: 'row', gap: spacing.m }}>
              <Button label="Share" variant="accent" size="m" style={{ flex: 1 }} onPress={share} />
              {activeProduct ? (
                <Button label="Buy" variant="ghost" size="m" style={{ flex: 1 }} onPress={buy} />
              ) : (
                <Button
                  label="Find it to buy"
                  variant="ghost"
                  size="m"
                  style={{ flex: 1 }}
                  disabled
                />
              )}
            </View>
          </Animated.View>
        </Animated.View>
      ) : (
        <RenderingPhase garmentSource={garmentSource} complete={status === 'finishing'} />
      )}
    </View>
  );
}
