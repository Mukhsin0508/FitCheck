/**
 * Paste-a-link modal — the wow trick. Take any product URL, hand it to the
 * try-on pipeline as a pasted garment.
 */

import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ModalHeader } from '@/features/share/ModalHeader';
import { radius, spacing, useTheme } from '@/theme';

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function PasteUrlScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [value, setValue] = useState('');

  const trimmed = value.trim();
  const valid = useMemo(() => trimmed.length > 0 && isHttpUrl(trimmed), [trimmed]);
  const showError = trimmed.length > 0 && !valid;

  async function handlePaste() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setValue(text.trim());
    } catch {
      // Clipboard unavailable — nothing to do.
    }
  }

  function handleSubmit() {
    if (!valid) return;
    router.push({
      pathname: '/tryon/[productId]',
      params: { productId: 'pasted', url: trimmed },
    });
  }

  return (
    <Screen safeTop={Platform.OS !== 'ios'} contentStyle={{ flexGrow: 1 }}>
      <ModalHeader overline="The wow trick" />

      <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.m, marginTop: spacing.xl }}>
        <AppText variant="title">Paste any product link</AppText>
        <AppText muted>Drop a link from any store. We grab the photo and put the piece on you.</AppText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(300).delay(80)}
        style={{ gap: spacing.s, marginTop: spacing.xl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="https://…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            accessibilityLabel="Product link"
            style={{
              flex: 1,
              height: 52,
              backgroundColor: colors.surface,
              borderRadius: radius.m,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              paddingHorizontal: spacing.l,
              color: colors.ink,
              fontSize: 16,
            }}
          />
          <Button label="Paste" variant="ghost" size="s" onPress={handlePaste} />
        </View>
        {showError ? (
          <AppText variant="caption" color={colors.danger}>
            That doesn't look like a link yet.
          </AppText>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(300).delay(160)}
        style={{ marginTop: spacing.xl }}
      >
        <Button label="Put it on me" variant="primary" fullWidth disabled={!valid} onPress={handleSubmit} />
      </Animated.View>

      <View style={{ flex: 1 }} />
      <AppText variant="caption" muted align="center" style={{ marginTop: spacing.xl }}>
        Demo mode renders a lookalike from our shelf. The real pipeline scrapes the product page.
      </AppText>
    </Screen>
  );
}
