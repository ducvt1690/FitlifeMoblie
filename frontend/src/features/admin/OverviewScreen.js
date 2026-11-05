import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import DateField from '../../ui/DateField';
import Button from '../../ui/Button';
import { colors, radius, themed } from '../../theme/tokens';
import { money, dateTime } from '../../ui/Management';
import { useAuth } from '../../context/AuthContext';

const fmt = n => Number(n ?? 0).toLocaleString('vi-VN');
const TILES = [{ key: 'users', label: 'Thành viên' }, { key: 'new_users_7d', label: 'Mới trong 7 ngày' }, { key: 'premium_members', label: 'Premium' }, { key: 'locked', label: 'Bị khóa' }, { key: 'active_challenges', label: 'Thử thách mở' }];

export default function OverviewScreen() {
  const { api, call, user } = useAuth();
  const [data, setData] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [period, setPeriod] = useState({});
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true); setError('');
    try {
      const params = new URLSearchParams(Object.entries(period).filter(([, v]) => v));
      const [overview, report] = await Promise.all([api.admin.overview(), call(`/api/admin/revenue?${params}`)]);
      setData(overview); setRevenue(report);
    } catch (e) { setError(e.message); setRevenue(null); }
    finally { setRefreshing(false); }
  }, [api, call, period]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const counts = data?.counts ?? {};
  return <Screen tabBar refreshing={refreshing} onRefresh={load}>
    <Text variant="label" tone="dim">Xin chào, {user?.name}</Text>
    <Text variant="title" style={styles.title}>Tổng quan</Text>
    {error ? <Surface style={styles.alert}><Text tone="danger">{error}</Text><Button title="Thử lại" variant="glass" onPress={load} /></Surface> : null}
    {refreshing ? <Text tone="dim">Đang tải thống kê…</Text> : null}
    <Surface radius={radius.lg} style={styles.revenue}>
      <Text variant="heading">Khoảng thống kê doanh thu</Text>
      <Text variant="caption" tone="dim">Ngày lọc tính theo UTC; thời điểm hiển thị theo thiết bị.</Text>
      <DateField label="Từ ngày" value={from} onChange={setFrom} maxDate={to || undefined} placeholder="Từ trước đến nay" />
      <DateField label="Đến ngày" value={to} onChange={setTo} minDate={from || undefined} placeholder="Đến hiện tại" />
      <Button title="Xem doanh thu" variant="glass" disabled={refreshing} onPress={() => setPeriod({ from: from.trim(), to: to.trim() })} />
    </Surface>
    {revenue ? <>
      <Text tone="dim">Đơn vị: {revenue.currency} · {revenue.period?.from ? dateTime(revenue.period.from) : 'Từ đầu'} → {revenue.period?.to ? dateTime(revenue.period.to) : 'Hiện tại'}</Text>
      {[['premium', 'Doanh thu Premium'], ['coins', 'Tiền mua Coin'], ['other', 'Giao dịch khác']].map(([key, label]) => <Surface key={key} radius={radius.lg} style={styles.revenue}>
        <Text tone="dim">{label}</Text><Text variant="title">{money(revenue[key]?.amount_vnd)}</Text><Text>{fmt(revenue[key]?.count)} giao dịch hợp lệ</Text>
      </Surface>)}
      <Surface radius={radius.md} style={styles.revenue}>
        <Text variant="caption" tone="dim">Công thức: {revenue.formula}</Text>
        {revenue.excluded ? <><Text tone="dim">Không tính: {fmt(revenue.excluded.pending?.count)} đơn chờ ({money(revenue.excluded.pending?.amount_vnd)}) · {fmt(revenue.excluded.failed?.count)} đơn thất bại ({money(revenue.excluded.failed?.amount_vnd)})</Text><Text variant="caption" tone="dim">Hủy / hoàn tiền: {revenue.excluded.refunded == null ? 'Hệ thống chưa có nghiệp vụ hoàn tiền hoặc hủy thanh toán.' : `${fmt(revenue.excluded.refunded.count)} giao dịch hoàn tiền`}</Text></> : null}
        <Text variant="caption" tone="dim">Premium và Coin được tổng hợp riêng tại máy chủ.</Text>
      </Surface>
    </> : null}
    <View style={styles.grid}>{TILES.map(t => <Surface key={t.key} radius={radius.md} style={styles.tile}><Text variant="caption" tone="dim">{t.label}</Text><Text variant="metric" color={t.key === 'locked' && counts.locked ? colors.danger : undefined}>{data ? fmt(counts[t.key]) : '—'}</Text></Surface>)}</View>
  </Screen>;
}
const styles = themed(() => StyleSheet.create({ title: { marginBottom: 18 }, alert: { padding: 12, marginBottom: 12, backgroundColor: colors.dangerSoft }, revenue: { padding: 18, marginBottom: 12, gap: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, tile: { flexGrow: 1, flexBasis: '45%', padding: 16, gap: 8 } }));
