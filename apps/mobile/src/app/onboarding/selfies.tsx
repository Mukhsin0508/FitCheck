/**
 * Selfie capture — 4 face angles plus one full-body shot. Camera when we have
 * it, photo library as the always-there fallback (the main path on
 * simulators). Uris are stashed in the onboarding draft, not the store.
 */

import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { draft } from '@/features/onboarding/session';
import { radius, spacing, useTheme } from '@/theme';

const TOTAL = 5;
const MIN_OK = 3;

const PROMPTS = [
  'Look straight at it',
  'Chin up a little',
  'Now your left side',
  'And the right',
  'One full-body, arms relaxed',
] as const;

/** Corner-guide geometry: thin ink Ls framing where the face goes. */
const GUIDE_LENGTH = 28;
const GUIDE_WEIGHT = 2;
const GUIDE_INSET = 24;

/**
 * Four L-shaped corner guides drawn over the live camera feed. Quiet by
 * design — 2pt strokes in the strong hairline token (~30% ink) so they frame
 * without competing with the face.
 */
function CornerGuides({ color }: { color: string }) {
  const corners = [
    { top: GUIDE_INSET, left: GUIDE_INSET, borderTopWidth: GUIDE_WEIGHT, borderLeftWidth: GUIDE_WEIGHT },
    { top: GUIDE_INSET, right: GUIDE_INSET, borderTopWidth: GUIDE_WEIGHT, borderRightWidth: GUIDE_WEIGHT },
    { bottom: GUIDE_INSET, left: GUIDE_INSET, borderBottomWidth: GUIDE_WEIGHT, borderLeftWidth: GUIDE_WEIGHT },
    { bottom: GUIDE_INSET, right: GUIDE_INSET, borderBottomWidth: GUIDE_WEIGHT, borderRightWidth: GUIDE_WEIGHT },
  ] as const;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {corners.map((corner, index) => (
        <View
          key={index}
          style={[
            {
              position: 'absolute',
              width: GUIDE_LENGTH,
              height: GUIDE_LENGTH,
              borderColor: color,
            },
            corner,
          ]}
        />
      ))}
    </View>
  );
}

export default function OnboardingSelfies() {
  const router = useRouter();
  const { colors } = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [uris, setUris] = useState<string[]>(() => [...draft.uris]);
  const [facing, setFacing] = useState<CameraType>('front');
  const [busy, setBusy] = useState(false);

  const step = Math.min(uris.length, TOTAL - 1);
  const prompt = PROMPTS[step] ?? PROMPTS[0];
  const isFullBody = uris.length === TOTAL - 1;
  const done = uris.length >= TOTAL;

  // Focus-gated so returning here (e.g. Android back from the build screen)
  // re-arms the auto-advance instead of stranding a "Building…" dead end.
  useFocusEffect(
    useCallback(() => {
      if (!done) return;
      const timer = setTimeout(() => router.push('/onboarding/building'), 400);
      return () => clearTimeout(timer);
    }, [done, router]),
  );

  const addPhotos = (incoming: string[]) => {
    if (incoming.length === 0) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setUris((prev) => {
      const next = [...prev, ...incoming].slice(0, TOTAL);
      draft.uris = next;
      return next;
    });
  };

  const removePhoto = (index: number) => {
    const removed = uris[index];
    setUris((prev) => {
      const next = prev.filter((_, i) => i !== index);
      draft.uris = next;
      return next;
    });
    // A dropped photo shouldn't linger in the cache — best-effort delete.
    if (removed) {
      try {
        const file = new File(removed);
        if (file.exists) file.delete();
      } catch {
        // The OS reclaims the cache eventually anyway.
      }
    }
  };

  const takePhoto = async () => {
    if (busy || done || !cameraRef.current) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) addPhotos([photo.uri]);
    } catch {
      // Camera hiccup — leave the shutter armed so they can try again.
    } finally {
      setBusy(false);
    }
  };

  const pickFromLibrary = async () => {
    if (done) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: TOTAL - uris.length,
        quality: 0.8,
      });
      if (!result.canceled) {
        addPhotos(result.assets.map((asset) => asset.uri));
      }
    } catch {
      // Picker dismissed itself — nothing to do.
    }
  };

  const cameraAllowed = permission?.granted === true;

  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: 'row', marginBottom: spacing.s }}>
        <Button label="Back" variant="text" size="s" onPress={() => router.back()} />
      </View>

      <AppText variant="micro" muted>
        Step {Math.min(uris.length + 1, TOTAL)} of {TOTAL}
      </AppText>
      <Animated.View key={done ? 'done' : step} entering={FadeIn.duration(250)}>
        <AppText variant="title" style={{ marginTop: spacing.xs }}>
          {done ? 'Got it. Building…' : prompt}
        </AppText>
      </Animated.View>

      <View
        style={{ flexDirection: 'row', gap: spacing.s, marginTop: spacing.m }}
        accessible
        accessibilityLabel={`${uris.length} of ${TOTAL} photos taken`}
      >
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: radius.pill,
              backgroundColor:
                i < uris.length ? colors.ink : i === uris.length ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingVertical: spacing.l }}>
        <View
          style={{
            flex: 1,
            aspectRatio: 3 / 4,
            maxWidth: '100%',
            alignSelf: 'center',
            borderRadius: radius.l,
            overflow: 'hidden',
            backgroundColor: colors.surfaceAlt,
          }}
        >
          {cameraAllowed ? (
            <>
              <CameraView ref={cameraRef} facing={facing} style={{ flex: 1 }} />
              <CornerGuides color={colors.borderStrong} />
            </>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: spacing.xl,
                gap: spacing.m,
              }}
            >
              {permission === null ? null : permission.canAskAgain ? (
                <>
                  <AppText align="center">The camera does the selfie part.</AppText>
                  <AppText variant="caption" muted align="center">
                    Or skip it and pick photos from your library below.
                  </AppText>
                  <Button label="Allow camera" size="s" onPress={() => requestPermission()} />
                </>
              ) : (
                <>
                  <AppText align="center">The camera's blocked right now.</AppText>
                  <AppText variant="caption" muted align="center">
                    Flip it on in settings, or pick photos from your library instead — that works
                    just as well.
                  </AppText>
                  <Button
                    label="Open settings"
                    size="s"
                    variant="ghost"
                    onPress={() => Linking.openSettings().catch(() => {})}
                  />
                </>
              )}
            </View>
          )}
        </View>

        {cameraAllowed && isFullBody ? (
          <Button
            label={facing === 'front' ? 'Flip to the back camera' : 'Flip to the front camera'}
            variant="text"
            size="s"
            style={{ alignSelf: 'center', marginTop: spacing.s }}
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
          />
        ) : null}
      </View>

      {uris.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.s,
            justifyContent: 'center',
            marginBottom: spacing.m,
          }}
        >
          {uris.map((uri, index) => (
            <Animated.View key={uri} entering={FadeInDown.duration(300)}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => removePhoto(index)}
              >
                <Image
                  source={{ uri }}
                  recyclingKey={uri}
                  contentFit="cover"
                  transition={200}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: radius.s,
                    backgroundColor: colors.surfaceAlt,
                  }}
                />
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      ) : null}

      <View style={{ alignItems: 'center', gap: spacing.m }}>
        {cameraAllowed ? (
          <PressableScale
            haptic={false}
            accessibilityRole="button"
            accessibilityLabel={isFullBody ? 'Take full-body photo' : 'Take selfie'}
            accessibilityState={{ disabled: busy || done }}
            disabled={busy || done}
            onPress={takePhoto}
            style={{
              width: 76,
              height: 76,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy || done ? 0.5 : 1,
            }}
          >
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: radius.pill,
                borderWidth: 2,
                borderColor: colors.accentInk,
              }}
            />
          </PressableScale>
        ) : null}

        <Button label="Pick from library instead" variant="text" size="s" onPress={pickFromLibrary} />

        {uris.length >= MIN_OK && !done ? (
          <Button
            label="That's enough"
            variant="ghost"
            size="m"
            fullWidth
            onPress={() => router.push('/onboarding/building')}
          />
        ) : null}
      </View>
    </Screen>
  );
}
