import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { newId } from '../../api/client';
import Screen from '../../ui/Screen';
import Sheet from '../../ui/Sheet';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import TextField from '../../ui/TextField';
import DateField from '../../ui/DateField';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';
import { dateTime, money, managementStyles as styles, usePagedResource, SearchControls, ResourceState, Pager } from '../../ui/Management';

const SECTIONS = [{ value: 'challenges', label: 'Thử thách' }, { value: 'payments', label: 'Thanh toán' }, { value: 'logs', label: 'Nhật ký' }];
const ID_FIELDS = { challenges: 'challenge_id', payments: 'order_id', logs: 'log_id' };
const RESULT_KEYS = { challenges: 'challenges', payments: 'payments', logs: 'logs' };
const EMPTY_FORM = { title: '', description: '', target_days: '', reward_coins: '', badge_icon: '' };

export default function OperationsScreen() {
  const { call } = useAuth();
  const [section, setSection] = useState('challenges');
  const [filterDraft, setFilterDraft] = useState({ user_id: '', action: '', target_id: '', from: '', to: '' });
  const [filters, setFilters] = useState({});
  const resource = usePagedResource(`/api/admin/${section}`, filters);
  const rows = resource.data?.[RESULT_KEYS[section]] ?? [];
  const catalog = section === 'challenges';
  const challenge = section === 'challenges';
  const [sheet, setSheet] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const lock = useRef(false);
  const run = async (fn, message) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try { await fn(); setSuccess(message); setSheet(null); await resource.load(); }
    catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  };
  const edit = row => {
    const values = { ...EMPTY_FORM, ...row };
    for (const key of ['target_days', 'reward_coins']) values[key] = row?.[key] == null ? '' : String(row[key]);
    setForm(values); setError(''); setSheet({ type: 'edit', item: row, id: row?.[ID_FIELDS[section]] ?? newId() });
  };
  const save = () => {
    if (!form.title.trim()) return setError('Nhập tên.');
    const activeKey = 'is_active';
    const body = { title: form.title.trim(), [activeKey]: sheet.item ? sheet.item[activeKey] : true };
    if (challenge) {
      const days = Number(form.target_days), coins = Number(form.reward_coins);
      if (!form.description.trim() || !form.badge_icon.trim() || !form.target_days.trim() || !form.reward_coins.trim() || !Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(coins) || coins < 0 || coins > 100000) return setError('Nhập hướng dẫn, biểu tượng; số ngày 1–365 và thưởng xu 0–100.000.');
      Object.assign(body, { description: form.description.trim(), target_days: days, reward_coins: coins, badge_icon: form.badge_icon.trim() });
    }
    if (!sheet.item) body[ID_FIELDS[section]] = sheet.id;
    run(() => call(`/api/admin/${section}${sheet.item ? `/${sheet.id}` : ''}`, { method: sheet.item ? 'PATCH' : 'POST', body }), 'Đã lưu và ghi nhật ký quản trị.');
  };
  const detail = async row => {
    setSheet({ type: 'detail', item: row }); setDetails(null); setError(''); setBusy(true);
    try { setDetails(await call(`/api/admin/${section}/${row[ID_FIELDS[section]]}`)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const statuses = catalog ? [{ value: 'active', label: 'Đang mở' }, { value: 'inactive', label: 'Đã đóng' }] : section === 'payments' ? [{ value: 'pending', label: 'Chờ' }, { value: 'paid', label: 'Đã trả' }, { value: 'failed', label: 'Thất bại' }] : null;
  return <Screen tabBar refreshing={resource.loading} onRefresh={resource.load}>
    <Text variant="title">Quản trị nghiệp vụ</Text>
    <View style={styles.stack}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{SECTIONS.map(s => <Button key={s.value} title={s.label} variant={section === s.value ? 'primary' : 'glass'} onPress={() => { setSection(s.value); resource.setPage(1); resource.setQuery(''); resource.setStatus(''); setFilters({}); setFilterDraft({ user_id: '', action: '', target_id: '', from: '', to: '' }); setError(''); }} />)}</ScrollView>
      {success ? <Text tone="accent" accessibilityLiveRegion="polite">{success}</Text> : null}
      {error && !sheet ? <Text tone="danger">{error}</Text> : null}
      {catalog ? <Button title={'Tạo thử thách'} onPress={() => edit(null)} /> : null}
      <SearchControls key={section} resource={resource} statuses={statuses} />
      {!catalog ? <Surface style={styles.card}>
        <Text variant="heading">Bộ lọc chi tiết</Text>
        {(section === 'logs' ? [['target_id', 'UUID tài khoản / đối tượng'], ['action', 'Hành động (vd: change_account_role)']] : [['user_id', 'UUID người thực hiện']]).map(([key, label]) => <TextField key={key} label={label} value={filterDraft[key]} onChangeText={v => setFilterDraft(f => ({ ...f, [key]: v }))} autoCapitalize="none" />)}
        <DateField label="Từ ngày" value={filterDraft.from} maxDate={filterDraft.to || undefined} onChange={from => setFilterDraft(f => ({ ...f, from }))} placeholder="Từ trước đến nay" />
        <DateField label="Đến ngày" value={filterDraft.to} minDate={filterDraft.from || undefined} onChange={to => setFilterDraft(f => ({ ...f, to }))} placeholder="Đến hiện tại" />
        <Button title="Áp dụng bộ lọc" variant="glass" onPress={() => { resource.setPage(1); setFilters(filterDraft); }} />
      </Surface> : null}
      <ResourceState resource={resource} count={rows.length} />
      {!resource.loading ? rows.map(row => <Surface key={row[ID_FIELDS[section]]} style={styles.card}>
        <Record section={section} row={row} />
        <Button title="Xem chi tiết" variant="glass" onPress={() => detail(row)} />
        {catalog ? <><Button title="Chỉnh sửa" variant="glass" onPress={() => edit(row)} /><Button title={(challenge ? row.is_active : row.is_available) ? 'Ngừng hoạt động' : 'Mở lại'} variant="glass" onPress={() => { setSheet({ type: 'toggle', item: row }); setError(''); }} /></> : null}
      </Surface>) : null}
      <Pager resource={resource} />
    </View>
    <Sheet visible={!!sheet} title={sheet?.type === 'edit' ? 'Thông tin danh mục' : sheet?.type === 'detail' ? 'Chi tiết' : 'Xác nhận trạng thái'} onClose={() => { if (!busy) setSheet(null); }}>
      {sheet?.type === 'edit' ? <>
        <TextField label="Tên" value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} maxLength={challenge ? 150 : 100} />
        {challenge ? [['description', 'Hướng dẫn', 2000], ['target_days', 'Số ngày', 3], ['reward_coins', 'Thưởng xu', 6], ['badge_icon', 'Biểu tượng', 100]].map(([key, label, length]) => <TextField key={key} label={label} value={form[key]} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} maxLength={length} multiline={key === 'description'} keyboardType={key === 'target_days' || key === 'reward_coins' ? 'number-pad' : 'default'} />) : null}
        <Button title="Lưu" loading={busy} onPress={save} />
      </> : null}
      {sheet?.type === 'toggle' ? <><Text>{sheet.item.title}</Text><Text>Thay đổi trạng thái thử thách sẽ được ghi nhận trong nhật ký.</Text><Button title="Xác nhận đổi trạng thái" loading={busy} onPress={() => { const key = challenge ? 'is_active' : 'is_available'; run(() => call(`/api/admin/${section}/${sheet.item[ID_FIELDS[section]]}`, { method: 'PATCH', body: { [key]: !sheet.item[key] } }), 'Đã cập nhật trạng thái.'); }} /></> : null}
      {sheet?.type === 'detail' ? <>{busy ? <Text>Đang tải chi tiết…</Text> : null}{details ? <Record section={section} row={details.item ?? details.payment ?? details.transaction ?? details.log ?? details.challenge ?? details} detailed /> : null}</> : null}
      {error ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button title="Đóng" variant="glass" disabled={busy} onPress={() => setSheet(null)} />
    </Sheet>
  </Screen>;
}

function Record({ section, row, detailed }) {
  if (section === 'challenges') return <><Text variant="heading">{row.title}</Text><Text>{row.description}</Text><Text>{row.target_days} ngày · {row.reward_coins} xu · {row.is_active ? 'Đang mở' : 'Ngừng hoạt động'}</Text>{detailed ? <Text selectable>Mã: {row.challenge_id} · Biểu tượng: {row.badge_icon}</Text> : null}</>;
  if (section === 'payments') return <><Text variant="heading">{row.product} · {money(row.amount_vnd)}</Text><Text selectable>{row.order_id}</Text><Text>{row.full_name ?? row.user_id} · {row.email}</Text><Text>{row.simulated ? 'Giả lập · ' : ''}{row.status} · Tạo {dateTime(row.created_at)} · Thanh toán {dateTime(row.paid_at)}</Text>{detailed ? <Text>Ngân hàng: {row.bank_code ?? '—'} · Mã cổng: {row.vnp_transaction_no ?? '—'} · Kết quả: {row.response_code ?? '—'}</Text> : null}</>;
  return <><Text variant="heading">{row.action}</Text><Text>{row.admin_name ?? row.admin_id} · {dateTime(row.created_at)}</Text><Text selectable>{row.target_type} · {row.target_id}</Text><Text>Lý do: {row.note || '—'}</Text>{row.previous_role || row.new_role ? <Text>Vai trò: {row.previous_role ?? '—'} → {row.new_role ?? '—'}</Text> : null}{detailed ? <Text selectable>Mã nhật ký: {row.log_id}</Text> : null}</>;
}
