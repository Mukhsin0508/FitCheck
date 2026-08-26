/**
 * The try-on moment. ~5s of rendering theatre, then the fit — full bleed,
 * swipeable against your past renders, with save / share / buy underneath.
 *
 * Route: /tryon/[productId]. Special case productId === 'pasted' + ?url=…
 * renders a garment from a pasted product link instead of the catalog.
 */

import { getProductById } from '@fitcheck/catalog';
import type { TryOnRender } from '@fitcheck/tryon';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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

/** Height of the action row inside the floating bar. */
const ACTION_ROW_HEIGHT = 48;

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
  const { colors, scheme } = useTheme();

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

  // The result settles in: fade + a soft scale from 0.96 on the pager.
  const entrance = useSharedValue(0.96);
  useEffect(() => {
    if (status === 'done') {
      entrance.value = withSpring(1, { damping: 18 });
    }
  }, [status, entrance]);
  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entrance.value }],
  }));

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

  // A pasted value is the product PAGE url, not an image — never feed it to
  // <Image>. Undefined shows RenderingPhase's skeleton placeholder instead.
  const garmentSource = isPasted
    ? undefined
    : product
      ? productImageSource(product)
      : undefined;

  // Room the content keeps clear of the floating action bar.
  const barClearance = spacing.l + ACTION_ROW_HEIGHT + spacing.m + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Top-left close, present in every state. */}
      <View style={{ paddingHorizontal: spacing.l, paddingVertical: spacing.s }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={goBack}
          style={{
            width: 44,
            height: 44,
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
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingBottom: barClearance }}>
            {/* Header row: overline + cost note for the fit you're looking at. */}
            <Animated.View
              entering={FadeIn.duration(300)}
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
                    overflow: 'hidden',
                    paddingHorizontal: spacing.m,
                    paddingVertical: spacing.xs,
                  }}
                >
                  {/* Lime wash in light; in dark the accent text carries it alone. */}
                  {scheme === 'light' ? (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: colors.accent, opacity: 0.2 },
                      ]}
                    />
                  ) : null}
                  <AppText
                    variant="micro"
                    color={scheme === 'dark' ? colors.accent : colors.accentInk}
                    style={{ fontSize: 10, lineHeight: 14, letterSpacing: 1.2 }}
                  >
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
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(400)}
              style={[{ flex: 1 }, entranceStyle]}
            >
              <FitPager
                renders={pages}
                activeIndex={activeIndex}
                onIndexChange={setActiveIndex}
              />
            </Animated.View>
          </View>

          {/* Floating action bar on blur, hairline on top, safe-bottom padded. */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(120)}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          >
            <BlurView
              tint={scheme === 'dark' ? 'dark' : 'light'}
              intensity={50}
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              {/* Translucent token wash so the bar reads on platforms without blur. */}
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: 0.72 }]}
              />
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.s,
                  paddingHorizontal: spacing.l,
                  paddingTop: spacing.l,
                  paddingBottom: insets.bottom + spacing.m,
                }}
              >
                <Button
                  label={inCloset ? 'In your closet ✓' : 'Save to closet'}
                  variant="primary"
                  size="m"
                  disabled={inCloset}
                  onPress={save}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Share"
                  variant="accent"
                  size="m"
                  onPress={share}
                  style={{ width: 96, paddingHorizontal: 0 }}
                />
                <Button
                  label="Buy"
                  variant="ghost"
                  size="m"
                  disabled={!activeProduct}
                  onPress={buy}
                  style={{ width: 76, paddingHorizontal: 0 }}
                />
              </View>
            </BlurView>
          </Animated.View>
        </View>
      ) : (
        <RenderingPhase garmentSource={garmentSource} complete={status === 'finishing'} />
      )}
    </View>
  );
}
