import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import ProgressRing from '../../ui/ProgressRing';
import { colors, radius } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { useAuth } from '../../context/AuthContext';

const WORKOUT_GOAL_MIN = 30;
const GLASS_ML = 250;
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}
const MONTHS = ['tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6', 'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'];
const DAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
function dateLabel() {
  const d = new Date();
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
const fmt = (n) => Math.round(n ?? 0).toLocaleString('vi-VN');

export default function HomeScreen() {
  const { user, api } = useAuth();
  const { width, compact } = useLayout();
  const [stats, setStats] = useState(null);
  const [steps, setSteps] = useState(0);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([api.stats(7), api.steps()]);
      setStats(s);
      setSteps(st.steps ?? 0);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [api]);

  // Reload whenever the tab comes back into view, so numbers logged on other tabs show up.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const today = stats?.days?.at(-1);
  const targetCalories = stats?.target_calories ?? user?.profile?.target_calories ?? 2000;
  const targetWater = stats?.target_water ?? user?.profile?.target_water ?? 2000;
  const workoutMin = (today?.workout_seconds ?? 0) / 60;

  const addWater = async () => {
    if (adding) return;
    setAdding(true);
    // Show the glass right away; the reload below brings back the server's total.
    setStats(s => s && { ...s, days: s.days.map((d, i) => (i === s.days.length - 1 ? { ...d, water_ml: d.water_ml + GLASS_ML } : d)) });
    try {
      await api.addWater(GLASS_ML);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(e.message);
    }
    await load();
    setAdding(false);
  };

  const rings = [
    { key: 'cal', label: 'Ăn uống', color: colors.calories, value: today?.calories ?? 0, target: targetCalories, unit: 'kcal' },
    { key: 'water', label: 'Nước', color: colors.water, value: today?.water_ml ?? 0, target: targetWater, unit: 'ml' },
    { key: 'move', label: 'Tập luyện', color: colors.accent, value: workoutMin, target: WORKOUT_GOAL_MIN, unit: 'phút' },
  ];
  const ringSize = Math.min(compact ? 168 : 188, width * 0.46);
  const ringStroke = Math.round(ringSize * 0.09);
  const first = user?.name?.trim().split(' ').pop();
  const tiles = [
    { label: 'Bước chân', value: fmt(steps), unit: 'bước' },
    { label: 'Đã đốt', value: fmt(today?.calories_burned), unit: 'kcal' },
    { label: 'Chuỗi ngày', value: fmt(stats?.streak_days), unit: 'ngày' },
    { label: 'FitCoin', value: fmt(stats?.fit_coins ?? user?.profile?.coins), unit: 'xu' },
  ];
  const maxWater = Math.max(targetWater, ...(stats?.days ?? []).map(d => d.water_ml));

  return (
    <Screen tabBar refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="label" tone="dim">{dateLabel()}</Text>
          <Text variant="title" numberOfLines={1}>{greeting()}, {first || 'bạn'}</Text>
        </View>
        <Pressable onPress={() => router.push('/home/me')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mở hồ sơ" style={styles.avatar}>
          <Text variant="heading">{(first?.[0] ?? 'F').toUpperCase()}</Text>
        </Pressable>
      </View>

      {error ? (
        <Surface radius={radius.sm} style={styles.alert}>
          <Text variant="label" tone="danger">{error}</Text>
        </Surface>
      ) : null}

      <Surface radius={radius.lg} style={styles.hero}>
        <View style={[styles.heroRow, compact && styles.heroColumn]}>
          <ProgressRing size={ringSize} stroke={ringStroke} color={rings[0].color} track={`${rings[0].color}22`} progress={rings[0].value / rings[0].target}>
            <ProgressRing size={ringSize - ringStroke * 2 - 6} stroke={ringStroke} color={rings[1].color} track={`${rings[1].color}22`} progress={rings[1].value / rings[1].target}>
              <ProgressRing size={ringSize - ringStroke * 4 - 12} stroke={ringStroke} color={rings[2].color} track={`${rings[2].color}22`} progress={rings[2].value / rings[2].target} />
            </ProgressRing>
          </ProgressRing>
          <View style={[styles.legend, compact && styles.legendWide]}>
            {rings.map(r => (
              <View key={r.key} accessible accessibilityLabel={`${r.label}: ${fmt(r.value)} trên ${fmt(r.target)} ${r.unit}`}>
                <Text variant="caption" tone="dim">{r.label}</Text>
                <Text variant="metric" color={r.color} style={styles.legendValue}>
                  {fmt(r.value)}<Text variant="caption" tone="faint"> / {fmt(r.target)} {r.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Surface>

      <Surface radius={radius.lg} style={styles.water}>
        <View style={styles.waterTop}>
          <View style={styles.flex}>
            <Text variant="heading">Nước</Text>
            <Text variant="caption" tone="dim">
              {today ? `Còn ${fmt(Math.max(targetWater - today.water_ml, 0))} ml nữa là đủ hôm nay` : 'Đang tải…'}
            </Text>
          </View>
          <Button title={`+${GLASS_ML} ml`} onPress={addWater} loading={adding} style={styles.waterBtn} />
        </View>
        <View style={styles.bars}>
          {(stats?.days ?? []).map((d, i, all) => {
            const isToday = i === all.length - 1;
            return (
              <View key={d.date} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${Math.max((d.water_ml / maxWater) * 100, 4)}%`, backgroundColor: isToday ? colors.water : `${colors.water}55` }]} />
                </View>
                <Text variant="caption" tone={isToday ? 'default' : 'faint'}>{WEEKDAYS[new Date(`${d.date}T00:00:00`).getDay()]}</Text>
              </View>
            );
          })}
        </View>
      </Surface>

      <View style={styles.grid}>
        {tiles.map(t => (
          <Surface key={t.label} radius={radius.md} style={styles.tile}>
            <Text variant="caption" tone="dim">{t.label}</Text>
            <Text variant="metric" numberOfLines={1} adjustsFontSizeToFit>
              {t.value}<Text variant="label" tone="faint"> {t.unit}</Text>
            </Text>
          </Surface>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  alert: { padding: 12, marginBottom: 12, backgroundColor: colors.dangerSoft },
  hero: { padding: 18, marginBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  heroColumn: { flexDirection: 'column' },
  legend: { flex: 1, gap: 12 },
  legendWide: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between' },
  legendValue: { fontSize: 28, lineHeight: 32 },
  water: { padding: 16, marginBottom: 12 },
  waterTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  waterBtn: { minWidth: 104 },
  bars: { flexDirection: 'row', gap: 8, marginTop: 16, height: 88 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', maxWidth: 28, borderRadius: 6, backgroundColor: colors.strokeSoft, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 16, gap: 4 },
});
