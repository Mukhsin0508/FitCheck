/**
 * You tab — avatar identity, honest stats, the privacy story, and the
 * open-source pitch.
 */

import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { demoImages } from '@/lib/images';
import { selectRenderCount, selectTotalSpendUsd, useStore } from '@/state/store';
import { radius, spacing, useTheme } from '@/theme';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Native Alert with a window.confirm fallback so the flows work on web too. */
function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Never mind', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

function StatCard({ value, label, footnote }: { value: string; label: string; footnote?: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="heading">{value}</AppText>
        <AppText variant="micro" muted>
          {label}
        </AppText>
        {footnote ? (
          <AppText muted style={{ fontSize: 10, lineHeight: 13 }}>
            {footnote}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const avatar = useStore((state) => state.avatar);
  const closetCount = useStore((state) => state.closet.length);
  const renderCount = useStore(selectRenderCount);
  const spendUsd = useStore(selectTotalSpendUsd);
  const resetAvatar = useStore((state) => state.resetAvatar);

  const portrait = avatar.localUri
    ? { uri: avatar.localUri }
    : demoImages[avatar.imageKey ?? 'avatar'];

  function handleRedoAvatar() {
    confirmDestructive(
      'Redo your avatar?',
      "New avatar wipes your renders — they won't look like you anymore.",
      'Redo it',
      () => resetAvatar(),
    );
  }

  function handleDeleteEverything() {
    confirmDestructive(
      'Delete everything?',
      'Selfies, renders, closet — all of it, gone from this phone.',
      'Delete it',
      () => resetAvatar(),
    );
  }

  function handleOpenGitHub() {
    WebBrowser.openBrowserAsync('https://github.com/Mukhsin0508/FitCheck').catch(() => {});
  }

  return (
    <Screen contentStyle={{ gap: spacing.xl }}>
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={{ alignItems: 'center', gap: spacing.m, paddingTop: spacing.l }}
      >
        <View
          style={{
            width: 136,
            height: 136,
            borderRadius: radius.pill,
            borderWidth: 3,
            borderColor: colors.accent,
            padding: 5,
          }}
        >
          {portrait ? (
            <Image
              source={portrait}
              contentFit="cover"
              transition={200}
              accessibilityLabel="Your avatar portrait"
              style={{ width: '100%', height: '100%', borderRadius: radius.pill }}
            />
          ) : (
            <View
              style={{
                width: '100%',
                height: '100%',
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceAlt,
              }}
            />
          )}
        </View>
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="title">{avatar.name ?? 'Your avatar'}</AppText>
          <AppText variant="micro" muted>
            {`avatar v${avatar.version}`}
          </AppText>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(300).delay(60)}
        style={{ flexDirection: 'row', gap: spacing.m }}
      >
        <StatCard value={String(renderCount)} label="fits tried" />
        <StatCard value={String(closetCount)} label="closet" />
        <StatCard value={usd.format(spendUsd)} label="render spend" footnote="our cost, not yours" />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(120)} style={{ gap: spacing.m }}>
        <SectionHeader title="Avatar" />
        <AppText muted>
          Not feeling the likeness? Retake your selfies and we'll rebuild you from scratch.
        </AppText>
        <Button label="Redo my avatar" variant="ghost" size="m" onPress={handleRedoAvatar} />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(180)} style={{ gap: spacing.m }}>
        <SectionHeader title="Privacy" />
        <AppText muted>
          Your selfies live on this phone. Production FitCheck encrypts them, never trains on
          them, and deletes everything with your account.
        </AppText>
        <Button
          label="Delete everything on this phone"
          variant="ghost"
          size="m"
          onPress={handleDeleteEverything}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(240)} style={{ gap: spacing.m }}>
        <SectionHeader title="Open source" />
        <Card>
          <View style={{ gap: spacing.m, alignItems: 'flex-start' }}>
            <AppText>FitCheck is MIT-licensed. Read the code, file an issue, or star it.</AppText>
            <Button label="GitHub" variant="primary" size="s" onPress={handleOpenGitHub} />
          </View>
        </Card>
      </Animated.View>

      <AppText variant="micro" muted align="center" style={{ marginTop: spacing.l }}>
        FitCheck 0.1.0 · renders by Higgsfield Soul
      </AppText>
    </Screen>
  );
}
