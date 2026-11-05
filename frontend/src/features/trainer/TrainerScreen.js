import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { newId } from '../../api/client';
import Screen from '../../ui/Screen';
import Text from '../../ui/Text';
import TextField from '../../ui/TextField';
import Button from '../../ui/Button';
import Surface from '../../ui/Surface';
import Sheet from '../../ui/Sheet';
import Segmented from '../../ui/Segmented';
import { ASSIGNMENT_LABELS, INVITE_LABELS, LEVELS, dateTime, managementStyles as styles, usePagedResource, SearchControls, ResourceState, Pager } from '../../ui/Management';

const SECTIONS = [{ value: 'templates', label: 'Bài mẫu' }, { value: 'students', label: 'Học viên' }, { value: 'assignments', label: 'Bài đã giao' }, { value: 'invites', label: 'Mã mời' }];
const EMPTY_TEMPLATE = { title: '', description: '', category: '', duration_seconds: '', calories_est: '', level: 'beginner' };

export default function TrainerScreen() {
  const { call } = useAuth();
  const [section, setSection] = useState('templates');
  const resource = usePagedResource(`/api/trainer/${section}`);
  const rows = resource.data?.[section] ?? [];
  const [sheet, setSheet] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [progress, setProgress] = useState(null);
  const [progressPage, setProgressPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newInvite, setNewInvite] = useState(null);
  const actionLock = useRef(false);
  const pendingAssignments = useRef(new Map());
  const open = value => { setError(''); setReason(''); setFeedback(''); setProgress(null); setSheet(value); };
  const run = async (fn, message, close = true) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(''); setSuccess('');
    try { await fn(); setSuccess(message); if (close) setSheet(null); await resource.load(); }
    catch (e) { setError(e.message); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const editTemplate = t => { setForm(t ? { ...t, duration_seconds: String(t.duration_seconds), calories_est: String(t.calories_est) } : EMPTY_TEMPLATE); open({ type: 'template', item: t }); };
  const saveTemplate = () => {
    const duration = Number(form.duration_seconds), calories = Number(form.calories_est);
    if (!form.title.trim() || !form.description.trim() || !form.category.trim() || !Number.isInteger(duration) || duration < 1 || duration > 21600 || !form.calories_est.trim() || !Number.isInteger(calories) || calories < 0 || calories > 10000) return setError('Điền đủ thông tin; thời lượng 1–21.600 giây, calo 0–10.000.');
    const body = { title: form.title.trim(), description: form.description.trim(), category: form.category.trim(), duration_seconds: duration, calories_est: calories, level: form.level };
    run(() => call('/api/trainer/templates' + (sheet.item ? `/${sheet.item.template_id}` : ''), { method: sheet.item ? 'PATCH' : 'POST', body }), 'Đã lưu bài tập mẫu.');
  };
  const assign = () => {
    const payload = { user_id: sheet.item.user_id, template_id: selectedTemplate.template_id, note: note.trim() };
    const signature = JSON.stringify(payload);
    if (!pendingAssignments.current.has(signature)) pendingAssignments.current.set(signature, newId());
    run(async () => {
      await call('/api/trainer/assignments', { method: 'POST', body: { id: pendingAssignments.current.get(signature), ...payload } });
      pendingAssignments.current.delete(signature); setNote('');
    }, 'Đã giao bài cho học viên.');
  };
  const showProgress = async (student, page = 1) => {
    if (page === 1) open({ type: 'progress', item: student });
    setProgressPage(page); setBusy(true);
    try { setProgress(await call(`/api/trainer/students/${student.user_id}/progress?page=${page}&page_size=20`)); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const statuses = section === 'assignments' ? Object.entries(ASSIGNMENT_LABELS).map(([value, label]) => ({ value, label })) : section === 'templates' ? [{ value: 'active', label: 'Đang dùng' }, { value: 'archived', label: 'Ngừng dùng' }] : section === 'invites' ? [{ value: 'pending', label: 'Chờ' }, { value: 'expired', label: 'Hết hạn' }, { value: 'revoked', label: 'Thu hồi' }] : null;
  return <Screen tabBar refreshing={resource.loading} onRefresh={resource.load}>
    <Text variant="title">Huấn luyện viên</Text>
    <Text tone="dim">Quản lý bài tập và học viên đã đồng ý kết nối.</Text>
    <View style={styles.stack}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{SECTIONS.map(s => <Button key={s.value} title={s.label} variant={section === s.value ? 'primary' : 'glass'} onPress={() => { resource.setPage(1); resource.setQuery(''); resource.setStatus(''); resource.setSort(''); setSection(s.value); }} />)}</ScrollView>
      {success ? <Text tone="accent" accessibilityLiveRegion="polite">{success}</Text> : null}
      {error && !sheet ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      {section === 'templates' ? <Button title="Tạo bài tập mẫu" onPress={() => editTemplate(null)} /> : null}
      {section === 'invites' ? <><Button title="Tạo mã mời" loading={busy} onPress={() => run(async () => setNewInvite(await call('/api/trainer/invites', { method: 'POST' })), 'Đã tạo mã mời.', false)} />{newInvite ? <Text selectable>Mã mới: {newInvite.invite_code}{newInvite.expires_at ? ` · Hết hạn ${dateTime(newInvite.expires_at)}` : ''}</Text> : null}</> : null}
      {selectedTemplate ? <Text tone="accent">Mẫu đang chọn: {selectedTemplate.title}</Text> : section === 'students' ? <Text tone="dim">Chọn một bài ở mục Bài mẫu trước khi giao bài.</Text> : null}
      <SearchControls key={section} resource={resource} statuses={statuses} sorts={section === 'templates' || section === 'students' ? [{ value: '', label: 'Mới nhất' }, { value: section === 'students' ? 'full_name' : 'title', label: 'Tên A–Z' }] : null} />
      <ResourceState resource={resource} count={rows.length} />
      {!resource.loading ? rows.map(item => <Surface key={section === 'templates' ? item.template_id : section === 'students' ? item.user_id : section === 'assignments' ? item.id : item.link_id} style={styles.card}>
        {section === 'templates' ? <>
          <Text variant="heading">{item.title}</Text><Text>{item.description}</Text>
          <Text tone="dim">{item.category} · {item.duration_seconds} giây · {item.calories_est} kcal · {LEVELS.find(l => l.value === item.level)?.label} · {item.is_active ? 'Đang dùng' : 'Ngừng dùng'}</Text>
          <Button title="Chỉnh sửa mẫu" variant="glass" onPress={() => editTemplate(item)} />
          <Button title="Chọn mẫu để giao" disabled={!item.is_active || busy} onPress={() => { setSelectedTemplate(item); setSuccess('Đã chọn mẫu. Chuyển sang Học viên để giao bài.'); }} />
          <Button title={item.is_active ? 'Ngừng sử dụng / xóa mẫu' : 'Mở lại mẫu'} variant="glass" disabled={busy} onPress={() => item.is_active ? open({ type: 'archive', item }) : run(() => call(`/api/trainer/templates/${item.template_id}`, { method: 'PATCH', body: { is_active: true } }), 'Đã mở lại mẫu.', false)} />
        </> : null}
        {section === 'students' ? <>
          <Text variant="heading">{item.full_name}</Text>
          <Button title="Giao bài" disabled={!selectedTemplate || busy} onPress={() => open({ type: 'assign', item })} />
          <Button title="Tiến độ và phản hồi" variant="glass" onPress={() => showProgress(item)} />
          <Button title="Ngắt kết nối học viên" variant="glass" disabled={busy || !item.link_id} onPress={() => open({ type: 'disconnect', item })} />
        </> : null}
        {section === 'assignments' ? <Assignment item={item} onCancel={() => open({ type: 'cancel', item })} onFeedback={() => open({ type: 'feedback', item })} busy={busy} /> : null}
        {section === 'invites' ? <>
          <Text variant="heading" selectable>{item.invite_code}</Text><Text>{INVITE_LABELS[item.display_status ?? item.status] ?? item.status}</Text>
          <Text tone="dim">Hết hạn: {dateTime(item.expires_at)}</Text>
          {(item.display_status ?? item.status) === 'pending' ? <Button title="Thu hồi mã" variant="glass" onPress={() => open({ type: 'revoke', item })} disabled={busy} /> : null}
        </> : null}
      </Surface>) : null}
      <Pager resource={resource} />
    </View>
    <Sheet visible={!!sheet} title={sheet?.type === 'template' ? sheet.item ? 'Chỉnh sửa bài mẫu' : 'Tạo bài mẫu' : sheet?.type === 'progress' ? 'Tiến độ học viên' : 'Xác nhận thao tác'} onClose={() => { if (!busy) setSheet(null); }}>
      {sheet?.type === 'template' ? <>
        {[['title', 'Tên bài', 150], ['description', 'Hướng dẫn', 5000], ['category', 'Nhóm bài tập', 50], ['duration_seconds', 'Thời lượng (giây)', 5], ['calories_est', 'Calo ước tính', 5]].map(([field, label, limit]) => <TextField key={field} label={label} value={form[field]} onChangeText={value => setForm(f => ({ ...f, [field]: value }))} maxLength={limit} multiline={field === 'description'} keyboardType={['duration_seconds', 'calories_est'].includes(field) ? 'number-pad' : 'default'} />)}
        <Segmented value={form.level} onChange={level => setForm(f => ({ ...f, level }))} options={LEVELS} />
        <Text tone="dim">Bài đã giao giữ nội dung tại thời điểm giao, không đổi theo mẫu mới.</Text>
        <Button title="Lưu bài mẫu" loading={busy} onPress={saveTemplate} />
      </> : null}
      {sheet?.type === 'assign' ? <><Text>Giao {selectedTemplate?.title} cho {sheet.item.full_name}?</Text><TextField label="Ghi chú cho học viên" value={note} onChangeText={setNote} maxLength={2000} multiline /><Text tone="dim">Ghi chú được chia sẻ với đúng học viên nhận bài.</Text><Button title="Xác nhận giao bài" loading={busy} onPress={assign} /></> : null}
      {sheet?.type === 'cancel' ? <><Text>Hủy riêng bài này. Kết nối và các bài khác vẫn được giữ.</Text><TextField label="Lý do hủy" value={reason} onChangeText={setReason} maxLength={500} multiline /><Button title="Xác nhận hủy bài" loading={busy} disabled={!reason.trim()} onPress={() => run(() => call(`/api/trainer/assignments/${sheet.item.id}/cancel`, { method: 'POST', body: { reason: reason.trim() } }), 'Đã hủy bài tập.')} /></> : null}
      {sheet?.type === 'feedback' ? <><TextField label="Phản hồi cho học viên" value={feedback} onChangeText={setFeedback} maxLength={2000} multiline /><Button title="Gửi phản hồi" loading={busy} disabled={!feedback.trim()} onPress={() => run(() => call(`/api/trainer/assignments/${sheet.item.id}/feedback`, { method: 'POST', body: { feedback: feedback.trim() } }), 'Đã gửi phản hồi.')} /></> : null}
      {sheet?.type === 'disconnect' ? <><Text>Ngắt kết nối {sheet.item.full_name}, hủy các bài đang chờ và thu hồi quyền huấn luyện trên kết nối này. Kết nối lại cần đồng ý mới.</Text><Button title="Xác nhận ngắt kết nối" loading={busy} onPress={() => run(() => call(`/api/trainer/links/${sheet.item.link_id}/end`, { method: 'POST' }), 'Đã ngắt kết nối học viên.')} /></> : null}
      {sheet?.type === 'archive' ? <><Text>Mẫu chưa được giao có thể bị xóa; mẫu đã có lịch sử sẽ được ngừng sử dụng. Lịch sử giao bài được giữ lại.</Text><Button title="Xác nhận ngừng sử dụng" loading={busy} onPress={() => run(async () => { await call(`/api/trainer/templates/${sheet.item.template_id}`, { method: 'DELETE' }); if (selectedTemplate?.template_id === sheet.item.template_id) setSelectedTemplate(null); }, 'Đã ngừng sử dụng mẫu.')} /></> : null}
      {sheet?.type === 'revoke' ? <><Text>Thu hồi mã {sheet.item.invite_code}? Mã này sẽ không thể được dùng để kết nối.</Text><Button title="Xác nhận thu hồi mã" loading={busy} onPress={() => run(() => call(`/api/trainer/invites/${sheet.item.link_id}/revoke`, { method: 'POST' }), 'Đã thu hồi mã mời.')} /></> : null}
      {sheet?.type === 'progress' ? <><Text variant="heading">{sheet.item.full_name}</Text>{busy ? <Text>Đang tải tiến độ…</Text> : null}{progress ? <><Text>Tổng: {progress.summary.total} · Chờ: {progress.summary.assigned} · Hoàn thành: {progress.summary.done} · Hủy: {progress.summary.cancelled}</Text>{progress.assignments?.length ? progress.assignments.map(a => <Surface key={a.id} style={styles.card}><Assignment item={a} onFeedback={() => open({ type: 'feedback', item: a })} busy={busy} /></Surface>) : <Text>Chưa có bài tập được giao.</Text>}</> : null}</> : null}
      {sheet?.type === 'progress' && progress ? <View style={styles.row}><Button title="Bài trước" variant="glass" disabled={busy || progressPage <= 1} onPress={() => showProgress(sheet.item, progressPage - 1)} /><Text>Trang {progressPage}/{Math.max(1, Math.ceil((progress.total ?? progress.summary.total) / (progress.page_size ?? 20)))}</Text><Button title="Bài tiếp" variant="glass" disabled={busy || progressPage * (progress.page_size ?? 20) >= (progress.total ?? progress.summary.total)} onPress={() => showProgress(sheet.item, progressPage + 1)} /></View> : null}
      {error ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button title="Đóng" variant="glass" disabled={busy} onPress={() => setSheet(null)} />
    </Sheet>
  </Screen>;
}

function Assignment({ item, onCancel, onFeedback, busy }) {
  return <><Text variant="heading">{item.template?.title ?? item.template_snapshot?.title ?? 'Bài tập'}</Text><Text>{item.student_name ?? item.user_id}</Text><Text tone="dim">{ASSIGNMENT_LABELS[item.status] ?? item.status} · Giao {dateTime(item.assigned_at)}</Text>{item.note ? <Text>Ghi chú: {item.note}</Text> : null}{item.feedback ? <Text>Phản hồi: {typeof item.feedback === 'string' ? item.feedback : item.feedback.text}</Text> : null}{item.cancel_reason ? <Text>Lý do hủy: {item.cancel_reason}</Text> : null}{item.status === 'assigned' && onCancel ? <Button title="Hủy riêng bài này" variant="glass" disabled={busy} onPress={onCancel} /> : null}{onFeedback ? <Button title="Gửi phản hồi" variant="glass" disabled={busy} onPress={onFeedback} /> : null}</>;
}
