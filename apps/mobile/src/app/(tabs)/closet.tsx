/**
 * Closet tab: the fits you saved, two-up. Tap to open the share view,
 * long-press to take one out.
 */

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Platform, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { resolveImageRef } from '@/lib/images';
import { useStore, type ClosetItem } from '@/state/store';
import { radius, spacing } from '@/theme';

export default function ClosetScreen() {
  const router = useRouter();
  const closet = useStore((s) => s.closet);
  const removeFromCloset = useStore((s) => s.removeFromCloset);

  const confirmRemove = (item: ClosetItem) => {
    if (Platform.OS === 'web') {
      // Alert.alert is a no-op on react-native-web — confirm and remove directly.
      if (globalThis.confirm(`Take it out?\n\n${item.title}`)) {
        removeFromCloset(item.renderId);
      }
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('Take it out?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeFromCloset(item.renderId),
      },
    ]);
  };

  if (closet.length === 0) {
    return (
      <Screen scroll={false}>
        <View style={{ paddingTop: spacing.l }}>
          <SectionHeader overline="Your fits" title="Closet" />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            title="Nothing in your closet yet"
            body="Try something on and save the ones that look right."
            actionLabel="Browse"
            onAction={() => router.push('/(tabs)')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false} contentStyle={{ paddingBottom: 0 }}>
      <FlatList
        data={closet}
        numColumns={2}
        keyExtractor={(item) => item.renderId}
        initialNumToRender={8}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: spacing.m }}
        contentContainerStyle={{
          paddingHorizontal: spacing.l,
          paddingTop: spacing.l,
          paddingBottom: spacing.xxl,
          gap: spacing.l,
        }}
        ListHeaderComponent={<SectionHeader overline="Your fits" title="Closet" />}
        ListFooterComponent={
          <AppText variant="caption" muted align="center" style={{ paddingTop: spacing.s }}>
            {closet.length === 1 ? '1 fit saved' : `${closet.length} fits saved`}
          </AppText>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.duration(300).delay(Math.min(index, 6) * 40)}
            style={{ flex: 1 }}
          >
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
              accessibilityHint="Long press to remove it from your closet"
              onPress={() => router.push(`/share/${item.renderId}`)}
              onLongPress={() => confirmRemove(item)}
              style={{ gap: spacing.s }}
            >
              <Image
                source={resolveImageRef(item.imageRef)}
                recyclingKey={item.renderId}
                contentFit="cover"
                transition={200}
                style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.l }}
                accessibilityLabel={item.title}
              />
              <View style={{ gap: 2, paddingHorizontal: spacing.xs }}>
                <AppText variant="caption" numberOfLines={1}>
                  {item.title}
                </AppText>
                {item.brand ? (
                  <AppText variant="micro" muted numberOfLines={1}>
                    {item.brand}
                  </AppText>
                ) : null}
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </Screen>
  );
}
