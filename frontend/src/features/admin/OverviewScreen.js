import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Screen from '../../ui/Screen';
import Glass from '../../ui/Glass';
import Text from '../../ui/Text';
import { colors, radius } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN');
const TILES = [
  { key: 'users', label: 'Thành viên', icon: 'people', color: colors.accent },
  { key: 'new_users_7d', label: 'Mới trong 7 ngày', icon: 'person-add', color: colors.water },
  { key: 'premium_members', label: 'Premium', icon: 'star', color: colors.calories },
  { key: 'trainers', label: 'Huấn luyện viên', icon: 'fitness', color: colors.sleep },
  { key: 'active_trainer_links', label: 'Đang được kèm', icon: 'link', color: colors.water },
  { key: 'locked', label: 'Bị khóa', icon: 'lock-closed', color: colors.danger },
  { key: 'active_challenges', label: 'Thử thách mở', icon: 'trophy', color: colors.calories },
  { key: 'available_rewards', label: 'Phần thưởng', icon: 'gift', color: colors.move },
  { key: 'purchases_7d', label: 'Lượt đổi 7 ngày', icon: 'bag', color: colors.accent },
];

export default function OverviewScreen() {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.admin.overview());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const c = data?.counts ?? {};
  return (
    <Screen tabBar refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Text variant="label" tone="dim">Xin chào, {user?.name?.trim().split(' ').pop()}</Text>
      <Text variant="title" style={styles.title}>Tổng quan</Text>
      {error ? <Glass radius={radius.sm} tint={colors.dangerSoft} style={styles.alert}><Text variant="label" tone="danger">{error}</Text></Glass> : null}

      <Glass radius={radius.lg} style={styles.revenue}>
        <Text variant="caption" tone="faint" style={styles.eyebrow}>DOANH THU PREMIUM</Text>
        <Text variant="display" tone="accent" numberOfLines={1} adjustsFontSizeToFit>{fmt(c.revenue_vnd)} ₫</Text>
        <Text variant="label" tone="dim">{fmt(c.paid_orders)} đơn đã thanh toán · {fmt(c.coins_spent_7d)} xu đã dùng trong 7 ngày</Text>
      </Glass>

      <View style={styles.grid}>
        {TILES.map(t => (
          <Glass key={t.key} radius={radius.md} style={styles.tile}>
            <View style={[styles.icon, { backgroundColor: `${t.color}22` }]}><Ionicons name={t.icon} size={18} color={t.color} /></View>
            <Text variant="metric" numberOfLines={1}>{data ? fmt(c[t.key]) : '—'}</Text>
            <Text variant="caption" tone="dim" numberOfLines={2}>{t.label}</Text>
          </Glass>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 18 },
  alert: { padding: 12, marginBottom: 12 },
  revenue: { padding: 18, marginBottom: 12, gap: 4 },
  eyebrow: { letterSpacing: 1.6, fontFamily: 'BeVietnamPro_700Bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '30%', flexGrow: 1, minWidth: 100, padding: 14, gap: 4 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
