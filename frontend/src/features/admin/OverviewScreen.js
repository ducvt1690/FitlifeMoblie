import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Segmented from '../../ui/Segmented';
import { colors, radius, themed } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { ACTIONS, Bars, SectionTitle, dmyhm, fmt, vnd } from './kit';

const RANGES = [{ value: '7d', label: '7 ngày' }, { value: '30d', label: '30 ngày' }, { value: '90d', label: '90 ngày' }];
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
  const [range, setRange] = useState('7d');
  const [stats, setStats] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api.admin.overview());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [api]);
  const loadStats = useCallback(async () => {
    try { setStats(await api.admin.analytics(range)); } catch (e) { setError(e.message); }
  }, [api, range]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { loadStats(); }, [loadStats]);

  const c = data?.counts ?? {};
  return (
    <Screen tabBar refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([load(), loadStats()]); setRefreshing(false); }}>
      <Text variant="label" tone="dim">Xin chào, {user?.name?.trim().split(' ').pop()}</Text>
      <Text variant="title" style={styles.title}>Tổng quan</Text>
      {error ? <Surface radius={radius.sm} style={styles.alert}><Text variant="label" tone="danger">{error}</Text></Surface> : null}

      <Surface radius={radius.lg} style={styles.revenue}>
        <Text variant="label" tone="dim">Tổng doanh thu</Text>
        <Text variant="display" numberOfLines={1} adjustsFontSizeToFit>{vnd(c.revenue_vnd)}</Text>
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

      <SectionTitle>Thống kê</SectionTitle>
      <Segmented options={RANGES} value={range} onChange={setRange} />
      {stats ? (
        <>
          <Surface radius={radius.lg} style={styles.chart}>
            <Text variant="label" tone="dim">Doanh thu theo ngày</Text>
            <Text variant="metric">{vnd(stats.totals.revenue_premium_vnd + stats.totals.revenue_coins_vnd)}</Text>
            <Text variant="caption" tone="faint">Premium {vnd(stats.totals.revenue_premium_vnd)} · gói xu {vnd(stats.totals.revenue_coins_vnd)}</Text>
            <Bars days={stats.days} value={d => d.revenue_premium_vnd + d.revenue_coins_vnd} color={colors.accent} />
          </Surface>
          <Surface radius={radius.lg} style={styles.chart}>
            <Text variant="label" tone="dim">Người hoạt động mỗi ngày (DAU)</Text>
            <Text variant="metric">{fmt(stats.days.at(-1)?.dau)} <Text variant="caption" tone="faint">hôm nay</Text></Text>
            <Bars days={stats.days} value={d => d.dau} color={colors.water} />
          </Surface>
          <View style={styles.grid}>
            {[['Đăng ký mới', stats.totals.signups], ['Buổi tập', stats.totals.workouts], ['Bữa ăn đã log', stats.totals.meals], ['Tin nhắn AI', stats.totals.ai_messages]].map(([label, n]) => (
              <Surface key={label} radius={radius.md} style={styles.tile}>
                <Text variant="caption" tone="dim" numberOfLines={2} style={styles.tileLabel}>{label}</Text>
                <Text variant="metric" numberOfLines={1}>{fmt(n)}</Text>
              </Surface>
            ))}
          </View>
          <Surface radius={radius.md} style={styles.chart}>
            <Text variant="label" tone="dim">Tỉ lệ Free → Premium</Text>
            <Text variant="metric">{(stats.conversion.rate * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</Text>
            <Text variant="caption" tone="faint">{fmt(stats.conversion.new_premium_members)} người lên Premium / {fmt(stats.conversion.free_members_at_start)} người Free đầu kỳ</Text>
          </Surface>
        </>
      ) : null}

      <SectionTitle>Hoạt động gần đây</SectionTitle>
      {data?.recent_logs?.length ? data.recent_logs.map(l => (
        <Surface key={l.log_id} radius={radius.md} style={styles.log}>
          <Text variant="label">{ACTIONS[l.action] ?? l.action}</Text>
          <Text variant="caption" tone="dim" numberOfLines={2}>{l.admin_name || l.admin_email}{l.note ? ` · ${l.note}` : ''}</Text>
          <Text variant="caption" tone="faint">{dmyhm(l.created_at)}</Text>
        </Surface>
      )) : <Text variant="caption" tone="faint">Chưa có thao tác quản trị nào.</Text>}
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  title: { marginBottom: 18 },
  alert: { padding: 12, marginBottom: 12, backgroundColor: colors.dangerSoft },
  revenue: { padding: 18, marginBottom: 12, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '30%', flexGrow: 1, minWidth: 100, padding: 14, gap: 6, justifyContent: 'space-between' },
  tileLabel: { minHeight: 34 },
  chart: { padding: 16, marginTop: 12, gap: 6 },
  log: { padding: 12, marginTop: 8, gap: 2 },
}));
