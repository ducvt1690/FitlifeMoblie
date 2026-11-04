import { useRef } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Glass from './Glass';
import Text from './Text';
import { colors, radius } from '../theme/tokens';

// Pressable that shrinks slightly and ticks the haptic engine, like system buttons.
// `style` sizes the visible content; `containerStyle` positions the pressable itself (e.g. flex: 1 in a row).
export function PressScale({ children, onPress, disabled, haptic = true, style, containerStyle, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value) => Animated.spring(scale, { toValue: value, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  return (
    <Pressable disabled={disabled} style={containerStyle} onPressIn={() => to(0.97)} onPressOut={() => to(1)}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }} {...rest}>
      <Animated.View style={[{ transform: [{ scale }] }, disabled && { opacity: 0.5 }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// variant: primary (lime), glass (frosted), ghost (text only).
// Forward arrows read better after the label, so they trail automatically.
export default function Button({ title, onPress, variant = 'primary', icon, loading, disabled, blur, style }) {
  const busy = loading || disabled;
  const ink = variant === 'primary' ? colors.accentInk : colors.text;
  const trailing = icon?.startsWith('arrow-forward') || icon?.startsWith('chevron-forward');
  const content = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator color={ink} />
        : <>
          {icon && !trailing && <Ionicons name={icon} size={18} color={ink} />}
          <Text variant="label" style={styles.title} color={ink}>{title}</Text>
          {icon && trailing && <Ionicons name={icon} size={18} color={ink} />}
        </>}
    </View>
  );
  return (
    <PressScale onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ disabled: !!busy, busy: !!loading }} style={style}>
      {variant === 'primary' && <View style={[styles.base, styles.primary]}>{content}</View>}
      {variant === 'glass' && <Glass blur={blur} radius={radius.pill} interactive style={styles.base}>{content}</Glass>}
      {variant === 'ghost' && <View style={styles.base}>{content}</View>}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: 22 },
  primary: { backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontFamily: 'BeVietnamPro_600SemiBold', fontSize: 16 },
});
