import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import { colors, radius, themed } from '../../theme/tokens';

// Small pieces shared by the admin screens.

// Paged admin list: fetch(page) returns { [key]: rows, total }. reload() starts again at page 1.
export function usePaged(fetch, key, deps) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const load = useCallback(async (next = 1) => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await fetch(next);
      if (mine !== seq.current) return;
      setRows(prev => (next === 1 ? res[key] : [...prev, ...res[key]]));
      setTotal(res.total ?? res[key].length);
      setPage(next); setError('');
    } catch (e) { if (mine === seq.current) setError(e.message); } finally { if (mine === seq.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(1); }, [load]);
  return { rows, total, loading, error, reload: () => load(1), more: () => load(page + 1), setRows };
}
export const fmt = (n) => (n ?? 0).toLocaleString('vi-VN');
export const vnd = (n) => `${fmt(n)} ₫`;
export const dmy = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');
export const dmyhm = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

export const PRODUCT_NAMES = { premium_month: 'Premium 1 tháng', premium_year: 'Premium 12 tháng', coins_200: 'Gói 200 xu', coins_550: 'Gói 550 xu' };
export const STATUS = {
  pending: { label: 'Chờ thanh toán', color: () => colors.water },
  paid: { label: 'Đã thanh toán', color: () => colors.accentText },
  failed: { label: 'Thất bại', color: () => colors.danger },
  expired: { label: 'Hết hạn', color: () => colors.textFaint },
  refunded: { label: 'Đã hoàn tiền', color: () => colors.move },
};
export const ACTIONS = {
  lock_account: 'Khóa tài khoản', unlock_account: 'Mở khóa', grant_admin: 'Cấp quyền admin', grant_premium: 'Cấp Premium',
  revoke_premium: 'Thu hồi Premium', adjust_coins: 'Điều chỉnh xu', force_logout: 'Buộc đăng xuất', delete_ai_data: 'Xóa dữ liệu AI',
  refund_payment: 'Hoàn tiền', update_ai_limits: 'Đổi hạn mức AI', create_challenge: 'Tạo thử thách', update_challenge: 'Sửa thử thách',
  create_reward_item: 'Tạo vật phẩm', update_reward_item: 'Sửa vật phẩm', create_exercise: 'Tạo bài tập', update_exercise: 'Sửa bài tập',
  hide_exercise: 'Ẩn bài tập', show_exercise: 'Hiện bài tập',
};

export function ErrorBox({ message }) {
  if (!message) return null;
  return <Surface radius={radius.sm} style={styles.alert}><Text variant="label" tone="danger">{message}</Text></Surface>;
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" style={styles.flex}>{children}</Text>
      {right}
    </View>
  );
}

// One label/value line inside a card.
export function Field({ label, value, color }) {
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="dim" style={styles.flex}>{label}</Text>
      <Text variant="label" color={color} style={styles.value} numberOfLines={2}>{value ?? '—'}</Text>
    </View>
  );
}

export function Pill({ label, color }) {
  return <View style={[styles.pill, { borderColor: color }]}><Text variant="caption" color={color}>{label}</Text></View>;
}

// A tappable list row: title, subtitle and a trailing value.
export function ListRow({ title, subtitle, right, rightColor, onPress, icon }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <Surface radius={radius.md} style={styles.row}>
        {icon ? <Ionicons name={icon} size={20} color={colors.textDim} /> : null}
        <View style={styles.flex}>
          <Text variant="label" numberOfLines={1}>{title}</Text>
          {subtitle ? <Text variant="caption" tone="dim" numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {typeof right === 'string' ? <Text variant="label" color={rightColor}>{right}</Text> : right}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} /> : null}
      </Surface>
    </Pressable>
  );
}

// "Load more" under a paged list.
export function Pager({ shown, total, loading, onMore }) {
  if (!total) return null;
  return (
    <View style={styles.pager}>
      <Text variant="caption" tone="faint">Đang hiện {fmt(shown)} / {fmt(total)}</Text>
      {shown < total ? <Button title="Tải thêm" variant="ghost" loading={loading} onPress={onMore} /> : null}
    </View>
  );
}

// Inline confirm form for a sensitive action: optional number, a required reason, and a confirm word when asked.
export function ActionForm({ action, onCancel, onSubmit }) {
  const [amount, setAmount] = useState(action.amount?.initial ?? '');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const n = Number(amount);
    if (action.amount && (!/^-?\d+$/.test(String(amount).trim()) || !action.amount.valid(n))) return setError(action.amount.hint);
    if (!note.trim()) return setError('Nhập lý do (bắt buộc, được ghi vào nhật ký quản trị).');
    if (action.confirm && confirm.trim().toLowerCase() !== action.confirm.toLowerCase()) return setError(`Gõ đúng "${action.confirm}" để xác nhận.`);
    setBusy(true); setError('');
    try { await onSubmit({ amount: n, note: note.trim() }); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Surface radius={radius.lg} style={[styles.form, action.danger && styles.formDanger]}>
      <Text variant="heading">{action.title}</Text>
      {action.detail ? <Text variant="caption" tone="dim">{action.detail}</Text> : null}
      {action.amount ? (
        <TextField label={action.amount.label} value={String(amount)} onChangeText={setAmount}
          keyboardType="numbers-and-punctuation" placeholder={action.amount.placeholder} />
      ) : null}
      <TextField label="Lý do" value={note} onChangeText={setNote} placeholder="VD: người dùng yêu cầu, hỗ trợ sự cố…" maxLength={500} multiline />
      {action.confirm ? (
        <TextField label={`Gõ "${action.confirm}" để xác nhận`} value={confirm} onChangeText={setConfirm} autoCapitalize="none" />
      ) : null}
      <ErrorBox message={error} />
      <View style={styles.formButtons}>
        <Button title="Hủy" variant="glass" onPress={onCancel} style={styles.flex} />
        <Button title="Xác nhận" onPress={submit} loading={busy} style={styles.flex} />
      </View>
    </Surface>
  );
}

// Tiny bar chart: one bar per day, height proportional to the largest value.
export function Bars({ days, value, color }) {
  const max = Math.max(1, ...days.map(value));
  return (
    <View style={styles.bars} accessibilityLabel="Biểu đồ theo ngày">
      {days.map(d => (
        <View key={d.date} style={styles.barSlot}>
          <View style={[styles.bar, { height: `${Math.max(2, (value(d) / max) * 100)}%`, backgroundColor: color }]} />
        </View>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  flex: { flex: 1 },
  alert: { padding: 12, backgroundColor: colors.dangerSoft },
  section: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  value: { flexShrink: 1, textAlign: 'right', maxWidth: '62%' },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pager: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  form: { padding: 16, gap: 12, borderWidth: 1, borderColor: colors.stroke },
  formDanger: { borderColor: colors.danger },
  formButtons: { flexDirection: 'row', gap: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 2 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 3, minHeight: 2 },
}));
