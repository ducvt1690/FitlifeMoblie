import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import { colors, radius } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN');
const TILES = [
  { key: 'users', label: 'Thành viên' },
  { key: 'new_users_7d', label: 'Mới trong 7 ngày' },
  { key: 'premium_members', label: 'Premium' },
  { key: 'locked', label: 'Bị khóa' },
  { key: 'active_challenges', label: 'Thử thách mở' },
  { key: 'available_rewards', label: 'Phần thưởng' },
  { key: 'purchases_7d', label: 'Lượt đổi 7 ngày' },
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
      {error ? <Surface radius={radius.sm} style={styles.alert}><Text variant="label" tone="danger">{error}</Text></Surface> : null}

      <Surface radius={radius.lg} style={styles.revenue}>
        <Text variant="label" tone="dim">Doanh thu Premium</Text>
        <Text variant="display" numberOfLines={1} adjustsFontSizeToFit>{fmt(c.revenue_vnd)} ₫</Text>
        <Text variant="label" tone="dim">{fmt(c.paid_orders)} đơn đã thanh toán · {fmt(c.coins_spent_7d)} xu đã dùng trong 7 ngày</Text>
      </Surface>

      <View style={styles.grid}>
        {TILES.map(t => (
          <Surface key={t.key} radius={radius.md} style={styles.tile}>
            <Text variant="caption" tone="dim" numberOfLines={2} style={styles.tileLabel}>{t.label}</Text>
            <Text variant="metric" numberOfLines={1} color={t.key === 'locked' && c.locked ? colors.danger : undefined}>{data ? fmt(c[t.key]) : '—'}</Text>
          </Surface>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 18 },
  alert: { padding: 12, marginBottom: 12, backgroundColor: colors.dangerSoft },
  revenue: { padding: 18, marginBottom: 12, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '30%', flexGrow: 1, minWidth: 100, padding: 14, gap: 6, justifyContent: 'space-between' },
  tileLabel: { minHeight: 34 },
});
