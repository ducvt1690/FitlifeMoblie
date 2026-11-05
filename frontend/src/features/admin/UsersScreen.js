import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import TextField from '../../ui/TextField';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';
import Sheet from '../../ui/Sheet';
import { radius, themed } from '../../theme/tokens';

const roles = { user: 'Thành viên', trainer: 'Huấn luyện viên', admin: 'Quản trị viên' };
export default function UsersScreen() {
  const { call, user } = useAuth();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [nextRole, setNextRole] = useState('user');
  const [action, setAction] = useState('status');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), ...(query ? { q: query } : {}), ...(status ? { status } : {}) });
    try { const result = await call(`/api/admin/accounts?${params}`); if (id === generation.current) setData(result); }
    catch (e) { if (id === generation.current) { setError(e.message); setData(null); } }
    finally { if (id === generation.current) setLoading(false); }
  }, [call, query, status, page]);
  useFocusEffect(useCallback(() => { load(); return () => { generation.current += 1; }; }, [load]));
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setError('');
    try {
      await call(`/api/admin/accounts/${encodeURIComponent(selected.user_id)}`, { method: 'PATCH', body: { ...(action === 'role' ? { role: nextRole } : { is_active: !selected.is_active }), note: note.trim() } });
      setSuccess('Đã cập nhật tài khoản và lưu nhật ký quản trị.');
      setSelected(null); await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20)));
  return <Screen tabBar refreshing={loading} onRefresh={load}>
    <Text variant="title">Người dùng</Text>
    {success ? <Text tone="accent" accessibilityLiveRegion="polite">{success}</Text> : null}
    <View style={styles.stack}>
      <TextField label="Tìm theo tên hoặc email" placeholder="Tên hoặc email" value={q} onChangeText={setQ} maxLength={100} onSubmitEditing={() => { setPage(1); setQuery(q.trim()); }} />
      <Button title="Tìm kiếm" onPress={() => { setPage(1); setQuery(q.trim()); }} disabled={loading} />
      <Segmented value={status} onChange={v => { setPage(1); setStatus(v); }} options={[{ value: '', label: 'Tất cả' }, { value: 'active', label: 'Hoạt động' }, { value: 'locked', label: 'Bị khóa' }]} />
      {error && !selected ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      {loading ? <Text tone="dim">Đang tải…</Text> : <Text tone="dim">{data?.total ?? 0} tài khoản</Text>}
      {!loading && data?.accounts.length === 0 ? <Text>Không tìm thấy tài khoản.</Text> : null}
      {!loading && data?.accounts.map(account => <Surface key={account.user_id} radius={radius.md} style={styles.card}>
        <Text variant="heading">{account.full_name}</Text>
        <Text selectable>{account.email}</Text>
        <Text tone="dim">{roles[account.role] ?? account.role} · {account.is_active ? 'Hoạt động' : 'Bị khóa'}</Text>
        {account.user_id === user?.user_id ? <Text tone="dim">Tài khoản của bạn</Text> : account.role === 'admin' ? <Text tone="dim">Tài khoản quản trị được bảo vệ</Text> : <Button title={account.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} variant="glass" onPress={() => { setSelected(account); setAction('status'); setNote(''); setError(''); }} />}
        {account.role !== 'admin' && account.user_id !== user?.user_id ? <Button title="Đổi vai trò" variant="glass" onPress={() => { setSelected(account); setAction('role'); setNextRole(account.role); setNote(''); setError(''); }} /> : null}
      </Surface>)}
      <View style={styles.row}>
        <Button title="Trang trước" variant="glass" disabled={loading || page <= 1} onPress={() => setPage(p => p - 1)} />
        <Text>Trang {page}/{pages}</Text>
        <Button title="Trang sau" variant="glass" disabled={loading || page >= pages} onPress={() => setPage(p => p + 1)} />
      </View>
    </View>
    <Sheet visible={!!selected} title={action === 'role' ? 'Đổi vai trò tài khoản' : selected?.is_active ? 'Xác nhận khóa tài khoản' : 'Xác nhận mở khóa'} onClose={() => { if (!saving) setSelected(null); }}>
      <Text>{selected?.full_name} · {selected?.email}</Text>
      <Text tone="dim">{action === 'role' ? 'Chọn vai trò phù hợp cho tài khoản.' : selected?.is_active ? 'Khóa sẽ đăng xuất mọi phiên của tài khoản này.' : 'Tài khoản có thể đăng nhập lại sau khi mở khóa.'}</Text>
      {action === 'role' ? <><Segmented value={nextRole} onChange={setNextRole} options={[{ value: 'user', label: 'Thành viên' }, { value: 'trainer', label: 'Huấn luyện viên' }]} /><Text tone="dim">Đổi vai trò sẽ đăng xuất các phiên hiện có. Không cấp quyền quản trị tại đây.</Text></> : null}
      <TextField label="Lý do xử lý" value={note} onChangeText={setNote} maxLength={500} />
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title="Xác nhận" onPress={save} loading={saving} disabled={saving || !note.trim() || (action === 'role' && nextRole === selected?.role)} />
      <Button title="Hủy" variant="glass" disabled={saving} onPress={() => setSelected(null)} />
    </Sheet>
  </Screen>;
}
const styles = themed(() => StyleSheet.create({ stack: { gap: 14, marginTop: 16 }, card: { padding: 16, gap: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' } }));
