/**
 * Onboarding welcome — the brand moment. Big serif wordmark, a collage of
 * demo renders, and two ways in: set up your own avatar or borrow Amara's.
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { demoImages } from '@/lib/images';
import { useStore } from '@/state/store';
import { radius, spacing, useTheme } from '@/theme';

const COLLAGE = [
  {
    key: 'fit-trench',
    source: demoImages['fit-trench'] as number,
    style: { left: '2%', top: 18, transform: [{ rotate: '-6deg' }] },
    delay: 150,
  },
  {
    key: 'fit-slip',
    source: demoImages['fit-slip'] as number,
    style: { right: '2%', top: 0, transform: [{ rotate: '5deg' }] },
    delay: 280,
  },
  {
    key: 'avatar',
    source: demoImages['avatar'] as number,
    style: { left: '29%', top: 96, transform: [{ rotate: '-2deg' }] },
    delay: 410,
  },
] as const;

export default function OnboardingWelcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const completeAvatar = useStore((s) => s.completeAvatar);

  const useDemoAvatar = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    completeAvatar({ name: 'Amara', imageKey: 'avatar' });
    router.replace('/');
  };

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: 'flex-end' }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.xl }}>
        <Animated.View entering={FadeIn.duration(500)}>
          <AppText variant="display" style={{ fontSize: 58, lineHeight: 64 }}>
            Fit
            <AppText variant="displayItalic" style={{ fontSize: 58, lineHeight: 64 }}>
              Check
            </AppText>
          </AppText>
          <AppText muted style={{ marginTop: spacing.s }}>
            See it on you before you buy it.
          </AppText>
        </Animated.View>

        <View
          style={{ height: 300, marginTop: spacing.xl }}
          accessible
          accessibilityLabel="Collage of outfits tried on a virtual avatar"
        >
          {COLLAGE.map((card) => (
            <Animated.View
              key={card.key}
              entering={FadeInDown.duration(550).delay(card.delay)}
              style={[
                {
                  position: 'absolute',
                  width: '44%',
                  aspectRatio: 3 / 4,
                  borderRadius: radius.l,
                  overflow: 'hidden',
                  borderWidth: 3,
                  borderColor: colors.surface,
                  backgroundColor: colors.surfaceAlt,
                },
                card.style,
              ]}
            >
              <Image
                source={card.source}
                contentFit="cover"
                transition={200}
                style={{ width: '100%', height: '100%' }}
              />
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.m }}>
        <Button
          label="Set up my avatar"
          variant="primary"
          fullWidth
          onPress={() => router.push('/onboarding/selfies')}
        />
        <Button label="Use the demo avatar" variant="ghost" fullWidth onPress={useDemoAvatar} />
        <AppText variant="caption" muted align="center" style={{ marginTop: spacing.xs }}>
          Selfies stay on this phone in the demo. In production they're encrypted, never used for
          training, and gone the moment you delete your account.
        </AppText>
      </View>
    </Screen>
  );
}
