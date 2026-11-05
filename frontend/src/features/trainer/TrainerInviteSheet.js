import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sheet from '../../ui/Sheet';
import Text from '../../ui/Text';
import TextField from '../../ui/TextField';
import Button from '../../ui/Button';
import Surface from '../../ui/Surface';
import { ASSIGNMENT_LABELS, dateTime, managementStyles as styles, usePagedResource, ResourceState, SearchControls, Pager } from '../../ui/Management';

export default function TrainerInviteSheet({ visible, onClose }) {
  const { call } = useAuth();
  const resource = usePagedResource('/api/trainer-links', {}, visible);
  const [code, setCode] = useState('');
  const [disconnect, setDisconnect] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const lock = useRef(false);
  const run = async (fn, message) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setSuccess('');
    try { await fn(); setSuccess(message); await resource.load(); }
    catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  };
  const rows = resource.data?.assignments ?? [];
  const links = resource.data?.links ?? [];
  return <Sheet visible={visible} title="Bài tập từ huấn luyện viên" subtitle="Kết nối theo sự đồng ý của bạn" onClose={onClose}>
    <TextField label="Mã mời 8 ký tự" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={8} />
    <Button title="Đồng ý kết nối" loading={busy} disabled={!/^[A-Z0-9]{8}$/i.test(code.trim())} onPress={() => run(async () => { await call('/api/trainer-links/accept', { method: 'POST', body: { code: code.trim() } }); setCode(''); }, 'Đã kết nối huấn luyện viên.')} />
    <Text variant="heading">Kết nối hiện tại</Text>
    {!resource.loading && !links.length ? <Text tone="dim">Chưa có kết nối hoạt động.</Text> : null}
    {links.map(link => <Surface key={link.link_id} style={styles.card}><Text>{link.trainer_name}</Text><Button title="Ngắt kết nối" variant="glass" disabled={busy} onPress={() => setDisconnect(link)} />{disconnect?.link_id === link.link_id ? <><Text>Ngắt kết nối sẽ hủy những bài đang chờ. Kết nối lại cần đồng ý mới.</Text><Button title="Xác nhận ngắt kết nối" loading={busy} onPress={() => run(async () => { await call(`/api/trainer-links/${link.link_id}/end`, { method: 'POST' }); setDisconnect(null); }, 'Đã ngắt kết nối huấn luyện viên.')} /><Button title="Giữ kết nối" variant="glass" disabled={busy} onPress={() => setDisconnect(null)} /></> : null}</Surface>)}
    {success ? <Text tone="accent" accessibilityLiveRegion="polite">{success}</Text> : null}
    {error ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
    <Text variant="heading">Bài được giao</Text>
    <SearchControls resource={resource} statuses={Object.entries(ASSIGNMENT_LABELS).map(([value, label]) => ({ value, label }))} />
    <ResourceState resource={resource} count={rows.length} />
    {!resource.loading ? rows.map(a => <Surface key={a.id} style={styles.card}>
      <Text variant="heading">{a.template?.title ?? a.template_snapshot?.title ?? 'Bài tập'}</Text>
      <Text tone="dim">{a.trainer_name ?? links.find(l => l.trainer_id === a.trainer_id)?.trainer_name ?? 'Huấn luyện viên'} · {dateTime(a.assigned_at)}</Text>
      <Text>{a.template?.description ?? a.template_snapshot?.description}</Text>
      <Text>{a.template?.duration_seconds ?? a.template_snapshot?.duration_seconds ?? '—'} giây · {ASSIGNMENT_LABELS[a.status] ?? a.status}</Text>
      {a.note ? <Text>Ghi chú: {a.note}</Text> : null}
      {a.feedback ? <Text>Phản hồi: {typeof a.feedback === 'string' ? a.feedback : a.feedback.text}</Text> : null}
      {a.cancel_reason ? <Text>Lý do hủy: {a.cancel_reason}</Text> : null}
      {a.status === 'assigned' ? <Button title="Đánh dấu hoàn thành" disabled={busy} onPress={() => run(() => call(`/api/trainer-links/assignments/${a.id}/done`, { method: 'POST' }), 'Đã ghi nhận hoàn thành bài tập.')} /> : null}
    </Surface>) : null}
    <Pager resource={resource} />
  </Sheet>;
}
