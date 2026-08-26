/**
 * Share sheet — the growth loop. Renders a fit-check card built for posting,
 * captures it as a PNG, and hands it to the OS share sheet or the photo roll.
 */

import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import { getProductById } from '@fitcheck/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { FitCard, type FitCardLayout } from '@/features/share/FitCard';
import { ModalHeader } from '@/features/share/ModalHeader';
import { productImageSource } from '@/lib/images';
import { useStore } from '@/state/store';
import { spacing } from '@/theme';

interface ShareableFit {
  renderId: string;
  imageRef: string;
  productId?: string;
  createdAt: string;
}

export default function ShareScreen() {
  const router = useRouter();
  const { renderId } = useLocalSearchParams<{ renderId: string }>();
  const closet = useStore((state) => state.closet);
  const renders = useStore((state) => state.renders);

  const fit = useMemo<ShareableFit | undefined>(() => {
    const closetItem = closet.find((item) => item.renderId === renderId);
    if (closetItem) {
      return {
        renderId: closetItem.renderId,
        imageRef: closetItem.imageRef,
        productId: closetItem.productId,
        createdAt: closetItem.createdAt,
      };
    }
    const cached = Object.values(renders).find((render) => render.id === renderId);
    if (cached) {
      return {
        renderId: cached.id,
        imageRef: cached.imageUrl,
        productId: cached.productId,
        createdAt: cached.createdAt,
      };
    }
    return undefined;
  }, [closet, renders, renderId]);

  const product = fit?.productId ? getProductById(fit.productId) : undefined;
  const garmentSource = product ? productImageSource(product) : undefined;

  const gridRefs = useMemo(() => {
    if (!fit) return [];
    return [
      fit.imageRef,
      ...closet.filter((item) => item.renderId !== fit.renderId).map((item) => item.imageRef),
    ].slice(0, 4);
  }, [closet, fit]);

  const cardRef = useRef<View>(null);
  const [layout, setLayout] = useState<FitCardLayout>(garmentSource ? 'side' : 'grid');
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function switchLayout(next: FitCardLayout) {
    if (next === layout) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setLayout(next);
    // The new card hasn't been saved yet — re-enable "Save to photos".
    setSaved(false);
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  async function captureCard(): Promise<string | null> {
    const node = cardRef.current;
    if (!node) return null;
    const uri = await captureRef(node, { format: 'png', quality: 1 });
    return uri.startsWith('file://') || uri.startsWith('data:') ? uri : `file://${uri}`;
  }

  async function handleShare() {
    if (Platform.OS === 'web') {
      setNote('Sharing needs a phone.');
      return;
    }
    setNote(null);
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setNote('Sharing needs a phone.');
        return;
      }
      const uri = await captureCard();
      if (!uri) return;
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Share your fit check',
      });
    } catch {
      setNote("Couldn't open the share sheet. Give it another go.");
    } finally {
      setSharing(false);
    }
  }

  async function handleSave() {
    if (Platform.OS === 'web') {
      setNote('Saving needs a phone.');
      return;
    }
    setNote(null);
    setSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        setNote("We can't reach your photos. You can allow access in Settings.");
        return;
      }
      const uri = await captureCard();
      if (!uri) return;
      await MediaLibrary.saveToLibraryAsync(uri);
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setNote("Couldn't save that one. Give it another go.");
    } finally {
      setSaving(false);
    }
  }

  if (!fit) {
    return (
      <Screen safeTop={Platform.OS !== 'ios'}>
        <ModalHeader overline="Your fit check" />
        <EmptyState
          title="Can't find that fit"
          body="It may have been cleared when your avatar changed. Render it again and it'll be right here."
          actionLabel="Close"
          onAction={close}
        />
      </Screen>
    );
  }

  return (
    <Screen safeTop={Platform.OS !== 'ios'}>
      <ModalHeader overline="Your fit check" />

      <Animated.View
        entering={FadeInDown.duration(300)}
        style={{ flexDirection: 'row', gap: spacing.s, marginVertical: spacing.l }}
      >
        <Chip label="Side by side" selected={layout === 'side'} onPress={() => switchLayout('side')} />
        <Chip label="The grid" selected={layout === 'grid'} onPress={() => switchLayout('grid')} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(60)}>
        <FitCard
          cardRef={cardRef}
          layout={layout}
          renderRef={fit.imageRef}
          garmentSource={garmentSource}
          gridRefs={gridRefs}
          createdAt={fit.createdAt}
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(300).delay(120)}
        style={{ gap: spacing.m, marginTop: spacing.xl }}
      >
        <Button label="Share it" variant="primary" fullWidth loading={sharing} onPress={handleShare} />
        <Button
          label={saved ? 'Saved ✓' : 'Save to photos'}
          variant="ghost"
          fullWidth
          loading={saving}
          disabled={saved}
          onPress={handleSave}
        />
        {note ? (
          <AppText variant="caption" muted align="center">
            {note}
          </AppText>
        ) : null}
      </Animated.View>
    </Screen>
  );
}
