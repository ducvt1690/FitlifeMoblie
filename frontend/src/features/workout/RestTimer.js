import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import { colors, themed } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Countdown between sets, floating above the tab bar. `rest` is { seconds, label, key }; a new key restarts it.
// The end time is kept rather than ticking a counter down, so the timer stays right after the app was in the background.
export default function RestTimer({ rest, onClose }) {
  const { insets } = useLayout();
  const [end, setEnd] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (rest) { setEnd(Date.now() + rest.seconds * 1000); setNow(Date.now()); } }, [rest?.key]);
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  useEffect(() => {
    if (!rest || !end) return;
    if (left === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const t = setTimeout(onClose, 2500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setNow(Date.now()), 250);
    return () => clearTimeout(t);
  }, [rest, end, now]);
  // One tap per second over the last three seconds.
  useEffect(() => { if (rest && end && left > 0 && left <= 3) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }, [left]);
  if (!rest || !end) return null;
  const share = rest.seconds ? Math.min(1, left / rest.seconds) : 0;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 96 + insets.bottom }]}>
      <Surface radius={22} raised style={styles.bar}>
        <View style={[styles.fill, { width: `${share * 100}%` }]} />
        <Ionicons name={left ? 'timer-outline' : 'flash'} size={22} color={colors.accentText} />
        <View style={styles.flex}>
          <Text variant="caption" tone="dim" numberOfLines={1}>{left ? `Nghỉ · ${rest.label}` : 'Hết giờ nghỉ'}</Text>
          <Text variant="heading" accessibilityLiveRegion="polite">{left ? clock(left) : 'Vào hiệp tiếp!'}</Text>
        </View>
        {left ? (
          <Pressable onPress={() => setEnd(e => e + 15000)} hitSlop={8} style={styles.chip} accessibilityRole="button" accessibilityLabel="Thêm 15 giây">
            <Text variant="label">+15s</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onClose} hitSlop={8} style={styles.chip} accessibilityRole="button" accessibilityLabel="Bỏ qua thời gian nghỉ">
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 520, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.stroke, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accentSoft },
  flex: { flex: 1 },
  chip: { minWidth: 40, height: 36, paddingHorizontal: 10, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
}));
