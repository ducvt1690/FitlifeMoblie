import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import Sheet from '../../ui/Sheet';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import Surface from '../../ui/Surface';
import TextField from '../../ui/TextField';
import Segmented from '../../ui/Segmented';
import NumberStepper from '../../ui/NumberStepper';
import { colors, radius, themed } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { newId } from '../../api/client';

export const GOALS = [
  { value: 'lose', label: 'Giảm cân' },
  { value: 'maintain', label: 'Giữ dáng' },
  { value: 'gain', label: 'Tăng cơ' },
];
export const ACTIVITY = [
  { value: 'sedentary', label: 'Ít vận động' },
  { value: 'light', label: 'Nhẹ' },
  { value: 'moderate', label: 'Vừa phải' },
  { value: 'active', label: 'Năng động' },
];
const vnd = (n) => `${n.toLocaleString('vi-VN')} đ`;
export const dmy = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

// Name, body and goal. Saving recalculates the calorie and water targets on the server.
export function EditProfileSheet({ visible, profile, onClose, onSaved }) {
  const { api } = useAuth();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (visible && profile) {
      setForm({ full_name: profile.full_name ?? '', gender: profile.gender, height: profile.height, weight: profile.weight,
        goal: profile.goal, activity_level: profile.activity_level, date_of_birth: profile.date_of_birth ?? '' });
      setError('');
    }
  }, [visible, profile]);
  if (!form) return null;
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    setBusy(true); setError('');
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== '' && v !== profile[k]));
      if (body.full_name) body.full_name = body.full_name.trim();
      if (Object.keys(body).length) await api.updateProfile(body);
      onSaved?.();
      onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} title="Chỉnh sửa hồ sơ" subtitle="Mục tiêu kcal và nước sẽ được tính lại" onClose={onClose}>
      <TextField label="Họ và tên" value={form.full_name} onChangeText={set('full_name')} maxLength={100} autoCapitalize="words" />
      <TextField label="Ngày sinh (YYYY-MM-DD)" value={form.date_of_birth} onChangeText={set('date_of_birth')} maxLength={10}
        keyboardType="numbers-and-punctuation" placeholder="2003-05-20" />
      <Segmented value={form.gender} onChange={set('gender')} options={[{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }]} />
      <NumberStepper label="Chiều cao" value={form.height} onChange={set('height')} min={100} max={250} unit="cm" />
      <NumberStepper label="Cân nặng" value={form.weight} onChange={set('weight')} min={30} max={300} step={0.5} unit="kg" />
      <Text variant="caption" tone="dim">Mục tiêu</Text>
      <Segmented value={form.goal} onChange={set('goal')} options={GOALS} />
      <Text variant="caption" tone="dim">Mức vận động</Text>
      <Segmented stacked value={form.activity_level} onChange={set('activity_level')} options={ACTIVITY} />
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title="Lưu thay đổi" onPress={save} loading={busy} disabled={busy || !form.full_name.trim()} />
    </Sheet>
  );
}

export function PasswordSheet({ visible, onClose }) {
  const { api } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (visible) { setCurrent(''); setNext(''); setAgain(''); setMsg(null); } }, [visible]);
  const mismatch = again && next !== again ? 'Mật khẩu nhập lại chưa khớp.' : '';
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await api.changePassword(current, next);
      setMsg({ ok: true, text: res.signed_out_devices ? `${res.message} Đã đăng xuất ${res.signed_out_devices} thiết bị khác.` : res.message });
      setCurrent(''); setNext(''); setAgain('');
    } catch (e) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} title="Đổi mật khẩu" subtitle="Các thiết bị khác sẽ bị đăng xuất" onClose={onClose}>
      <TextField label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secure autoCapitalize="none" textContentType="password" />
      <TextField label="Mật khẩu mới (ít nhất 8 ký tự)" value={next} onChangeText={setNext} secure autoCapitalize="none" textContentType="newPassword" />
      <TextField label="Nhập lại mật khẩu mới" value={again} onChangeText={setAgain} secure autoCapitalize="none" error={mismatch} />
      {msg ? <Text tone={msg.ok ? 'accent' : 'danger'}>{msg.text}</Text> : null}
      <Button title="Đổi mật khẩu" onPress={save} loading={busy} disabled={busy || !current || [...next].length < 8 || next !== again} />
    </Sheet>
  );
}

const STATUS = { paid: 'Đã thanh toán', pending: 'Đang chờ', failed: 'Thất bại', expired: 'Hết hạn' };

// Premium status, the packages on sale (paid through VNPay) and the member's payment history.
export function MembershipSheet({ visible, onClose, onChanged }) {
  const { api } = useAuth();
  const [simulationOrder, setSimulationOrder] = useState(null);
  const [notice, setNotice] = useState('');
  const checkoutIds = useRef(new Map());
  const checkoutLock = useRef(false);
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const [p, o] = await Promise.all([api.payments.plans(), api.payments.orders()]);
      setData(p); setOrders(o.orders ?? []);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (visible) { setError(''); load(); } }, [visible]);
  const buy = async (product) => {
    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setBusy(product); setError('');
    try {
      const back = Linking.createURL('payment');
      if (!checkoutIds.current.has(product)) checkoutIds.current.set(product, newId());
      const checkout = await api.payments.create(product, back, checkoutIds.current.get(product));
      if (checkout.simulated) { setSimulationOrder(checkout.order); setNotice(''); }
      else await WebBrowser.openAuthSessionAsync(checkout.payment_url, back);
      await load();
      onChanged?.();
    } catch (e) { if (e.status === 409) checkoutIds.current.delete(product); setError(e.message); } finally { checkoutLock.current = false; setBusy(''); }
  };
  const simulate = async outcome => {
    if (checkoutLock.current || !simulationOrder) return;
    checkoutLock.current = true; setBusy(simulationOrder.product); setError('');
    try { const result = await api.payments.simulate(simulationOrder.order_id, outcome); setNotice(result.message || 'Giao dịch giả lập đã được xử lý.'); checkoutIds.current.delete(simulationOrder.product); setSimulationOrder(null); await load(); onChanged?.(); }
    catch(e) { setError(e.message); } finally { checkoutLock.current = false; setBusy(''); }
  };
  const m = data?.membership;
  return (
    <Sheet visible={visible} title="Gói thành viên" subtitle={data?.simulated ? 'Thanh toán giả lập · Không thu tiền thật' : data?.environment === 'sandbox' ? 'VNPay Sandbox · Thanh toán thử nghiệm' : 'Thanh toán an toàn qua VNPay'} onClose={onClose}>
      <Surface radius={radius.lg} style={[styles.card, m?.premium && styles.premium]}>
        <Ionicons name={m?.premium ? 'diamond' : 'person-circle'} size={28} color={m?.premium ? colors.ink : colors.textDim} />
        <View style={styles.flex}>
          <Text variant="heading" color={m?.premium ? colors.ink : undefined}>{m?.premium ? 'FitLife Premium' : 'Gói miễn phí'}</Text>
          <Text variant="caption" color={m?.premium ? colors.ink : colors.textDim}>
            {m?.premium ? `Hiệu lực đến ${dmy(m.premium_until)}` : 'Tạo lịch tập có trong gói miễn phí. Premium có thêm lượt AI và gợi ý bữa ăn.'}
          </Text>
        </View>
      </Surface>
      {simulationOrder ? <Surface style={{padding:18,gap:12}}><Text variant="heading">Xác nhận thanh toán giả lập</Text><Text>{data?.plans?.find(p=>p.product===simulationOrder.product)?.title} · {vnd(simulationOrder.amount_vnd)}</Text><Text>Thành công sẽ cộng quyền lợi vào tài khoản để thử nghiệm. Không thu tiền thật.</Text><Button title="Giả lập thành công" loading={!!busy} onPress={()=>simulate('success')}/><Button title="Giả lập thất bại" disabled={!!busy} variant="glass" onPress={()=>simulate('failed')}/><Button title="Đóng" disabled={!!busy} variant="ghost" onPress={()=>setSimulationOrder(null)}/></Surface> : null}
      {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
      {data && !data.configured ? <Text variant="caption" tone="faint">Máy chủ chưa bật thanh toán VNPay nên chưa mua được lúc này.</Text> : null}
      {(data?.plans ?? []).map(p => (
        <Surface key={p.product} radius={radius.md} style={styles.plan}>
          <View style={styles.flex}>
            <Text variant="label">{p.title}</Text>
            <Text variant="caption" tone="dim">{p.premium_days ? `${p.premium_days} ngày Premium · ` : ''}tặng {p.coins} xu</Text>
          </View>
          <Button title={vnd(p.amount_vnd)} onPress={() => buy(p.product)} loading={busy === p.product}
            disabled={!!busy || !data.configured} variant={p.premium_days ? 'primary' : 'glass'} style={styles.buy} />
        </Surface>
      ))}
      {error ? <Text tone="danger">{error}</Text> : null}
      <Text variant="label" style={styles.section}>Lịch sử thanh toán</Text>
      <Button title="Làm mới giao dịch" variant="glass" disabled={!!busy} onPress={load} />
      {!orders.length ? <Text variant="caption" tone="faint">Chưa có giao dịch nào.</Text> : orders.map(o => (
        <View key={o.order_id} style={styles.order}>
          <View style={styles.flex}>
            <Text variant="label">{data?.plans?.find(p => p.product === o.product)?.title ?? o.product}</Text>
            <Text variant="caption" tone="faint">{dmy(o.created_at)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="label">{vnd(o.amount_vnd)}</Text>
            <Text variant="caption" tone={o.status === 'paid' ? 'accent' : o.status === 'failed' ? 'danger' : 'faint'}>{o.simulated ? 'Giả lập · ' : ''}{STATUS[o.status] ?? o.status}</Text>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const styles = themed(() => StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  premium: { backgroundColor: colors.accent },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  buy: { minWidth: 120 },
  section: { marginTop: 8 },
  order: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.strokeSoft },
}));
