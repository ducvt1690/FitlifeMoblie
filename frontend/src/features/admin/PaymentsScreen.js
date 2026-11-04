import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';
import Sheet from '../../ui/Sheet';
import { colors, radius, themed } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { ActionForm, ErrorBox, Field, ListRow, Pager, PRODUCT_NAMES, STATUS, SectionTitle, dmyhm, fmt, usePaged, vnd } from './kit';

const FILTERS = [
  { value: '', label: 'Tất cả' },
  { value: 'paid', label: 'Đã trả' },
  { value: 'pending', label: 'Chờ' },
  { value: 'failed', label: 'Lỗi' },
  { value: 'refunded', label: 'Hoàn' },
];

export default function PaymentsScreen() {
  const { api } = useAuth();
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null);
  const list = usePaged(page => api.admin.payments({ status, page }), 'payments', [api, status]);

  return (
    <Screen tabBar contentStyle={styles.page} refreshing={false} onRefresh={list.reload}>
      <Text variant="title" style={styles.title}>Thanh toán</Text>
      <Segmented options={FILTERS} value={status} onChange={setStatus} />
      <ErrorBox message={list.error} />
      <Text variant="caption" tone="dim">{fmt(list.total)} đơn VNPay · xuất CSV đối soát dùng trên web admin.</Text>
      <View style={styles.list}>
        {list.rows.map(o => (
          <ListRow key={o.order_id} icon="card" onPress={() => setOpenId(o.order_id)}
            title={`${PRODUCT_NAMES[o.product] ?? o.product} · ${vnd(o.amount_vnd)}`}
            subtitle={`${o.full_name || o.email || o.user_id} · ${dmyhm(o.created_at)}`}
            right={STATUS[o.status]?.label ?? o.status} rightColor={STATUS[o.status]?.color()} />
        ))}
        {!list.loading && !list.rows.length && !list.error ? <Text tone="dim" align="center">Chưa có đơn nào.</Text> : null}
      </View>
      <Pager shown={list.rows.length} total={list.total} loading={list.loading} onMore={list.more} />
      <PaymentSheet id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </Screen>
  );
}

function PaymentSheet({ id, onClose, onChanged }) {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try { setData(await api.admin.payment(id)); setError(''); } catch (e) { setError(e.message); }
  }, [api, id]);
  useEffect(() => { setData(null); setRefunding(false); setNotice(''); load(); }, [load]);

  const o = data?.order;
  const refund = async ({ note }) => {
    const res = await api.admin.refund(id, note);
    const parts = [];
    if (res.revoked_premium_days) parts.push(`thu hồi ${res.revoked_premium_days} ngày Premium`);
    if (res.revoked_coins) parts.push(`thu hồi ${fmt(res.revoked_coins)} xu`);
    if (res.coins_not_recovered) parts.push(`${fmt(res.coins_not_recovered)} xu đã tiêu, không thu lại được`);
    setNotice(`Đã đánh dấu hoàn tiền${parts.length ? `: ${parts.join(', ')}` : ''}. Nhớ hoàn tiền thật trên cổng VNPay.`);
    setRefunding(false);
    await load();
    onChanged();
  };

  return (
    <Sheet visible={!!id} title="Chi tiết đơn" subtitle={id} onClose={onClose}>
      <ErrorBox message={error} />
      {!data && !error ? <ActivityIndicator color={colors.text} style={styles.spinner} /> : null}
      {o ? (
        <>
          {notice ? <Surface radius={radius.sm} style={styles.notice}><Text variant="label" color={colors.accentText}>{notice}</Text></Surface> : null}
          <Surface radius={radius.md} style={styles.card}>
            <Field label="Trạng thái" value={STATUS[o.status]?.label ?? o.status} color={STATUS[o.status]?.color()} />
            <Field label="Gói" value={PRODUCT_NAMES[o.product] ?? o.product} />
            <Field label="Số tiền" value={vnd(o.amount_vnd)} />
            <Field label="Người mua" value={data.user ? `${data.user.full_name || ''} ${data.user.email}` : o.user_id} />
            <Field label="Tạo lúc" value={dmyhm(o.created_at)} />
            <Field label="Thanh toán lúc" value={dmyhm(o.paid_at)} />
            {o.refunded_at ? <Field label="Hoàn tiền lúc" value={dmyhm(o.refunded_at)} /> : null}
            <Field label="Mã giao dịch VNPay" value={o.vnp_transaction_no} />
            <Field label="Ngân hàng" value={o.bank_code} />
            <Field label="Mã phản hồi" value={o.response_code} />
          </Surface>

          {o.status === 'paid' ? (refunding ? (
            <ActionForm action={{ title: 'Đánh dấu đã hoàn tiền', danger: true,
              detail: 'Chỉ đánh dấu trên hệ thống và thu hồi Premium/xu của đơn. Tiền hoàn thì làm thủ công trên cổng VNPay.' }}
              onCancel={() => setRefunding(false)} onSubmit={refund} />
          ) : <Button title="Đánh dấu đã hoàn tiền" icon="return-up-back" variant="glass" onPress={() => setRefunding(true)} />) : null}

          <SectionTitle>Phản hồi VNPay</SectionTitle>
          <Surface radius={radius.md} style={styles.card}>
            {o.vnp_response ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text variant="caption" tone="dim" style={styles.mono}>{JSON.stringify(o.vnp_response, null, 2)}</Text>
              </ScrollView>
            ) : <Text variant="caption" tone="faint">Chưa nhận phản hồi từ VNPay.</Text>}
          </Surface>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { gap: 12 },
  title: { marginBottom: 6 },
  list: { gap: 10 },
  spinner: { marginTop: 40 },
  notice: { padding: 12, backgroundColor: colors.accentSoft },
  card: { padding: 14, gap: 2 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
}));
