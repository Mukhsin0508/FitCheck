import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Pressable, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends PressableProps {
  /** Scale while pressed. Default 0.97. */
  pressedScale?: number;
  haptic?: boolean;
}

/** Pressable with a spring scale-down and a light haptic tick — the app's default touch feel. */
export function PressableScale({
  pressedScale = 0.97,
  haptic = true,
  onPressIn,
  onPress,
  style,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[animatedStyle, style as never]}
      onPressIn={(event) => {
        scale.value = withSpring(pressedScale, { damping: 20, stiffness: 400 });
        onPressIn?.(event);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 20, stiffness: 400 });
      }}
      onPress={(event) => {
        if (haptic && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(event);
      }}
    />
  );
}
