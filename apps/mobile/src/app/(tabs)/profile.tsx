/**
 * You tab — avatar identity, honest stats, the privacy story, and the
 * open-source pitch.
 */

import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState, type PropsWithChildren } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
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
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText variant="title" align="center">
          {value}
        </AppText>
        <AppText variant="micro" muted align="center">
          {label}
        </AppText>
        {footnote ? (
          <AppText muted align="center" style={{ fontSize: 10, lineHeight: 13 }}>
            {footnote}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

/** Settings section: hairline divider on top, micro overline, then content. */
function Section({
  overline,
  delay,
  children,
}: PropsWithChildren<{ overline: string; delay: number }>) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(delay)}
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        paddingTop: spacing.l,
        gap: spacing.m,
      }}
    >
      <AppText variant="micro" muted>
        {overline}
      </AppText>
      {children}
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const avatar = useStore((state) => state.avatar);
  const closetCount = useStore((state) => state.closet.length);
  const renderCount = useStore(selectRenderCount);
  const spendUsd = useStore(selectTotalSpendUsd);
  const resetAvatar = useStore((state) => state.resetAvatar);
  const purgeEverything = useStore((state) => state.purgeEverything);
  const [failedUri, setFailedUri] = useState<string | null>(null);

  // cacheKey: the portrait file is overwritten in place on rebuild, so the
  // avatar version keeps expo-image from serving a stale cached copy.
  const portrait =
    avatar.localUri && avatar.localUri !== failedUri
      ? { uri: avatar.localUri, cacheKey: `avatar-v${avatar.version}` }
      : demoImages[avatar.imageKey ?? 'avatar'];

  function handleRedoAvatar() {
    confirmDestructive(
      'Redo your avatar?',
      "New avatar wipes your renders and saved closet — they won't look like you anymore.",
      'Redo it',
      () => resetAvatar(),
    );
  }

  function handleDeleteEverything() {
    confirmDestructive(
      'Delete everything?',
      'Selfies, renders, closet, try-on history — all of it, gone from this phone.',
      'Delete it',
      () => purgeEverything(),
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
              onError={() => {
                // Portrait file went missing — fall back to the demo face.
                if (avatar.localUri) setFailedUri(avatar.localUri);
              }}
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

      <Section overline="Avatar" delay={120}>
        <AppText muted>
          Not feeling the likeness? Retake your selfies and we'll rebuild you from scratch.
        </AppText>
        <Button label="Redo my avatar" variant="ghost" size="m" onPress={handleRedoAvatar} />
      </Section>

      <Section overline="Privacy" delay={180}>
        <AppText muted>
          Your selfies stay on this phone — this build never uploads them. Delete below and
          they're gone, along with your renders, closet, and try-on history.
        </AppText>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Delete everything on this phone"
          onPress={handleDeleteEverything}
          style={{
            minHeight: 48,
            alignSelf: 'stretch',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText color={colors.danger} style={{ fontWeight: '600' }}>
            Delete everything on this phone
          </AppText>
        </PressableScale>
      </Section>

      <Section overline="Open source" delay={240}>
        <Card>
          <View style={{ gap: spacing.m, alignItems: 'flex-start' }}>
            <AppText>FitCheck is MIT-licensed. Read the code, file an issue, or star it.</AppText>
            <Button label="GitHub" variant="primary" size="s" onPress={handleOpenGitHub} />
          </View>
        </Card>
      </Section>

      <AppText variant="micro" muted align="center" style={{ marginTop: spacing.l }}>
        FitCheck 0.1.0 · renders by Higgsfield Soul
      </AppText>
    </Screen>
  );
}
