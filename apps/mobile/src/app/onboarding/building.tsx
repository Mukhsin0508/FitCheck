/**
 * Avatar build — a pulsing portrait, rotating status lines, a ~4.5s progress
 * bar, then a one-beat reveal before landing on Browse. Consumes the selfie
 * draft and writes the finished avatar to the store.
 */

import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { draft } from '@/features/onboarding/session';
import { demoImages } from '@/lib/images';
import { useStore } from '@/state/store';
import { radius, spacing, useTheme } from '@/theme';

const LINES = [
  'Reading your proportions',
  'Learning your light',
  'Locking your look',
  'Almost',
] as const;

const LINE_MS = 1200;
const BUILD_MS = 4500;
const REVEAL_MS = 1500;

/** Where the kept selfie lives once onboarding finishes. */
const PORTRAIT_FILENAME = 'avatar-portrait.jpg';

/**
 * Move the kept selfie out of the evictable cache into the document directory,
 * then sweep every draft cache file. Returns the uri to persist — the cache
 * uri as a fallback when the copy fails, so the avatar still shows.
 */
function persistPortrait(firstUri: string | undefined): string | undefined {
  let localUri = firstUri;
  if (firstUri) {
    try {
      const portrait = new File(Paths.document, PORTRAIT_FILENAME);
      new File(firstUri).copySync(portrait, { overwrite: true });
      localUri = portrait.uri;
    } catch {
      // Copy failed — keep the cache uri rather than losing the avatar.
    }
  }
  for (const uri of draft.uris) {
    if (uri === localUri) continue; // the fallback uri is still in use
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Best effort — the OS reclaims the cache eventually anyway.
    }
  }
  return localUri;
}

export default function OnboardingBuilding() {
  const router = useRouter();
  const { colors } = useTheme();
  const completeAvatar = useStore((s) => s.completeAvatar);
  const [phase, setPhase] = useState<'building' | 'done'>('building');
  const [lineIndex, setLineIndex] = useState(0);

  // Skip-ambush guard: an avatar already exists and there's nothing to build.
  const ambushed = useRef(
    useStore.getState().avatar.status === 'ready' && draft.uris.length === 0,
  );
  // First selfie for the portrait; the bundled demo face when there are none.
  const portraitUri = useRef(draft.uris[0]).current;

  const pulse = useSharedValue(1);
  const progress = useSharedValue(0);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  // Android hardware back mid-build would pop the stack before completeAvatar
  // runs; block it to match the disabled iOS swipe gesture.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ambushed.current) {
      router.replace('/');
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    progress.value = withTiming(1, { duration: BUILD_MS, easing: Easing.out(Easing.cubic) });

    const lineTimer = setInterval(
      () => setLineIndex((i) => Math.min(i + 1, LINES.length - 1)),
      LINE_MS,
    );
    const doneTimer = setTimeout(() => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setPhase('done');
    }, BUILD_MS);
    const exitTimer = setTimeout(() => {
      const firstUri = draft.uris[0];
      completeAvatar({
        name: undefined,
        imageKey: firstUri ? undefined : 'avatar',
        localUri: persistPortrait(firstUri),
        selfieCount: draft.uris.length,
      });
      draft.reset();
      router.replace('/');
    }, BUILD_MS + REVEAL_MS);

    return () => {
      clearInterval(lineTimer);
      clearTimeout(doneTimer);
      clearTimeout(exitTimer);
    };
    // Mount-only build sequence; timers own the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      scroll={false}
      contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}
    >
      <Stack.Screen options={{ gestureEnabled: false }} />

      <Animated.View
        style={[
          {
            padding: spacing.s,
            borderRadius: radius.pill,
            borderWidth: 1.5,
            borderColor: colors.borderStrong,
          },
          pulseStyle,
        ]}
      >
        <View
          style={{
            width: 180,
            height: 180,
            borderRadius: radius.pill,
            overflow: 'hidden',
            backgroundColor: colors.surfaceAlt,
          }}
          accessible
          accessibilityLabel="Your avatar taking shape"
        >
          <Image
            source={portraitUri ? { uri: portraitUri } : (demoImages['avatar'] as number)}
            contentFit="cover"
            transition={200}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </Animated.View>

      {phase === 'building' ? (
        <View style={{ alignItems: 'center', gap: spacing.l, width: '100%' }}>
          <Animated.View key={lineIndex} entering={FadeIn.duration(300)}>
            <AppText muted align="center">
              {LINES[lineIndex] ?? 'Almost'}
            </AppText>
          </Animated.View>
          <View
            style={{
              width: 220,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
              overflow: 'hidden',
            }}
            accessibilityRole="progressbar"
            accessibilityLabel="Building your avatar"
          >
            <Animated.View
              style={[
                { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
                barStyle,
              ]}
            />
          </View>
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)}>
          <AppText variant="title" align="center">
            Say hi to your avatar
          </AppText>
        </Animated.View>
      )}
    </Screen>
  );
}
