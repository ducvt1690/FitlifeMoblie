import { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Text from './Text';
import { colors, radius } from '../theme/tokens';

const TRIGGER = 90;

// Swipe a row from right to left past TRIGGER to toggle it done. Vertical drags still scroll the page.
export default function SwipeToDone({ done, onToggle, disabled, children }) {
  const x = useRef(new Animated.Value(0)).current;
  const passed = useRef(false);
  const toggle = useRef(onToggle);
  toggle.current = onToggle;

  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      const dx = Math.min(0, g.dx);
      x.setValue(dx);
      if (!passed.current && dx < -TRIGGER) { passed.current = true; Haptics.selectionAsync().catch(() => {}); }
      if (passed.current && dx > -TRIGGER) passed.current = false;
    },
    onPanResponderRelease: () => {
      if (passed.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toggle.current?.();
      }
      passed.current = false;
      Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    },
    onPanResponderTerminate: () => {
      passed.current = false;
      Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  const reveal = x.interpolate({ inputRange: [-TRIGGER, 0], outputRange: [1, 0], extrapolate: 'clamp' });
  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.behind, { opacity: reveal, backgroundColor: done ? colors.surfaceHigh : colors.accent }]}>
        <Ionicons name={done ? 'arrow-undo' : 'checkmark-circle'} size={22} color={done ? colors.text : colors.accentInk} />
        <Text variant="label" style={{ color: done ? colors.text : colors.accentInk }}>{done ? 'Bỏ đánh dấu' : 'Xong'}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...(disabled ? {} : responder.panHandlers)}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  behind: { ...StyleSheet.absoluteFillObject, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', gap: 6, paddingRight: 20 },
});
