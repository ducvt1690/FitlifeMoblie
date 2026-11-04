import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import Segmented from '../../ui/Segmented';
import { colors, radius, themed } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { ACTIONS, ErrorBox, Field, ListRow, Pager, Pill, SectionTitle, dmyhm, fmt, usePaged } from './kit';

const TABS = [
  { value: 'ai', label: 'Hạn mức AI', icon: 'sparkles' },
  { value: 'challenges', label: 'Thử thách', icon: 'trophy' },
  { value: 'rewards', label: 'Cửa hàng', icon: 'gift' },
  { value: 'exercises', label: 'Bài tập', icon: 'barbell' },
  { value: 'logs', label: 'Nhật ký', icon: 'document-text' },
];

export default function SystemScreen() {
  const [tab, setTab] = useState('ai');
  return (
    <Screen tabBar contentStyle={styles.page}>
      <Text variant="title" style={styles.title}>Hệ thống</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map(t => {
          const on = t.value === tab;
          return (
            <Pressable key={t.value} onPress={() => setTab(t.value)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Surface radius={radius.pill} raised={on} style={[styles.tab, on && styles.tabOn]}>
                <Ionicons name={t.icon} size={15} color={on ? colors.text : colors.textDim} />
                <Text variant="label" tone={on ? 'default' : 'dim'}>{t.label}</Text>
              </Surface>
            </Pressable>
          );
        })}
      </ScrollView>
      {tab === 'ai' ? <AiLimits /> : null}
      {tab === 'challenges' ? <Challenges /> : null}
      {tab === 'rewards' ? <Rewards /> : null}
      {tab === 'exercises' ? <Exercises /> : null}
      {tab === 'logs' ? <Logs /> : null}
    </Screen>
  );
}

const KIND_NAMES = { chat: 'Tin chat AI / 24 giờ', workout_plan: 'Tạo lịch tập / ngày', meal_ai: 'Gợi ý bữa ăn / ngày' };
const Notice = ({ text }) => (text ? <Surface radius={radius.sm} style={styles.notice}><Text variant="label" color={colors.accentText}>{text}</Text></Surface> : null);
const intOr = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : NaN);

function AiLimits() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.admin.aiLimits();
      setData(res);
      setForm(Object.fromEntries(['free', 'premium'].map(p => [p, Object.fromEntries(res.kinds.map(k => [k, String(res.limits[p][k])]))])));
      setError('');
    } catch (e) { setError(e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const body = {};
    for (const plan of ['free', 'premium']) {
      body[plan] = {};
      for (const k of data.kinds) {
        const n = intOr(form[plan][k]);
        if (!Number.isInteger(n) || n > 100000) return setError(`${KIND_NAMES[k] ?? k} (${plan}) phải là số nguyên 0–100000.`);
        body[plan][k] = n;
      }
    }
    if (!note.trim()) return setError('Nhập lý do thay đổi.');
    setBusy(true); setError(''); setNotice('');
    try {
      await api.admin.setAiLimits({ ...body, note: note.trim() });
      setNote(''); setNotice('Đã lưu hạn mức AI. Áp dụng ngay cho mọi người dùng.');
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!form) return <ErrorBox message={error} />;
  return (
    <>
      <Notice text={notice} />
      {['free', 'premium'].map(plan => (
        <Surface key={plan} radius={radius.md} style={styles.card}>
          <Text variant="heading">{plan === 'free' ? 'Free' : 'Premium'}</Text>
          {data.kinds.map(k => (
            <TextField key={k} label={`${KIND_NAMES[k] ?? k} (mặc định ${data.defaults[plan][k]})`} value={form[plan][k]} keyboardType="number-pad"
              onChangeText={v => setForm(f => ({ ...f, [plan]: { ...f[plan], [k]: v.replace(/\D/g, '') } }))} />
          ))}
        </Surface>
      ))}
      <TextField label="Lý do thay đổi" value={note} onChangeText={setNote} placeholder="VD: tăng hạn mức dịp khuyến mãi" maxLength={500} />
      <ErrorBox message={error} />
      <Button title="Lưu hạn mức" icon="save" onPress={save} loading={busy} />
    </>
  );
}

// A catalog tab (challenges or rewards): list with an on/off switch and a create form.
function Catalog({ load, toggle, flag, rowOf, createForm, empty }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(async () => {
    try { setItems(await load()); setError(''); } catch (e) { setError(e.message); }
  }, [load]);
  useEffect(() => { reload(); }, [reload]);

  const flip = async (item) => {
    setBusyId(item.id); setError(''); setNotice('');
    try { await toggle(item.id, !item[flag]); await reload(); } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };

  return (
    <>
      <Notice text={notice} />
      <ErrorBox message={error} />
      {creating ? createForm({
        onCancel: () => setCreating(false),
        onDone: async (message) => { setCreating(false); setNotice(message); await reload(); },
      }) : <Button title="Tạo mới" icon="add" variant="glass" onPress={() => { setNotice(''); setCreating(true); }} />}
      <View style={styles.list}>
        {(items ?? []).map(item => {
          const row = rowOf(item);
          return (
            <ListRow key={item.id} icon={item.icon} title={row.title} subtitle={row.subtitle}
              right={<Button title={item[flag] ? 'Tắt' : 'Bật'} variant={item[flag] ? 'ghost' : 'glass'} loading={busyId === item.id}
                onPress={() => flip(item)} style={styles.toggle} />} />
          );
        })}
        {items && !items.length ? <Text tone="dim" align="center">{empty}</Text> : null}
      </View>
    </>
  );
}

function CreateForm({ title, fields, extra, submit, onCancel, onDone }) {
  const [values, setValues] = useState(Object.fromEntries(fields.map(f => [f.key, f.initial ?? ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setValues(s => ({ ...s, [k]: v }));
  const go = async () => {
    for (const f of fields) {
      if (f.number ? !Number.isInteger(intOr(values[f.key])) : !String(values[f.key]).trim()) return setError(`Nhập ${f.label.toLowerCase()}.`);
    }
    setBusy(true); setError('');
    try {
      const body = Object.fromEntries(fields.map(f => [f.key, f.number ? intOr(values[f.key]) : values[f.key].trim()]));
      const res = await submit(body);
      onDone(res?.message || 'Đã tạo.');
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Surface radius={radius.lg} style={styles.form}>
      <Text variant="heading">{title}</Text>
      {fields.map(f => (
        <TextField key={f.key} label={f.label} value={values[f.key]} placeholder={f.placeholder} multiline={f.multiline}
          keyboardType={f.number ? 'number-pad' : 'default'} autoCapitalize={f.key.includes('icon') ? 'none' : 'sentences'}
          onChangeText={v => set(f.key, f.number ? v.replace(/\D/g, '') : v)} />
      ))}
      {extra}
      <ErrorBox message={error} />
      <View style={styles.row}>
        <Button title="Hủy" variant="glass" onPress={onCancel} style={styles.flex} />
        <Button title="Tạo" onPress={go} loading={busy} style={styles.flex} />
      </View>
    </Surface>
  );
}

function Challenges() {
  const { api } = useAuth();
  const load = useCallback(async () => (await api.admin.challenges()).challenges.map(c => ({ ...c, id: c.challenge_id, icon: c.badge_icon })), [api]);
  return (
    <Catalog load={load} flag="is_active" empty="Chưa có thử thách."
      toggle={(id, on) => api.admin.updateChallenge(id, { is_active: on })}
      rowOf={c => ({ title: c.title, subtitle: `${c.target_days} ngày · ${fmt(c.reward_coins)} xu · ${fmt(c.joined)} đang tham gia · ${fmt(c.completed)} hoàn thành${c.is_active ? '' : ' · ĐANG TẮT'}` })}
      createForm={props => (
        <CreateForm {...props} title="Thử thách mới" submit={body => api.admin.createChallenge({ ...body, is_active: true })} fields={[
          { key: 'title', label: 'Tên thử thách', placeholder: '7 ngày uống đủ nước' },
          { key: 'description', label: 'Mô tả', multiline: true, placeholder: 'Check-in mỗi ngày bạn…' },
          { key: 'target_days', label: 'Số ngày', number: true, initial: '7' },
          { key: 'reward_coins', label: 'Xu thưởng', number: true, initial: '70' },
          { key: 'badge_icon', label: 'Biểu tượng (tên Ionicons)', initial: 'trophy-outline' },
        ]} />
      )} />
  );
}

const CATEGORIES = [{ value: 'badge', label: 'Huy hiệu' }, { value: 'theme', label: 'Giao diện' }, { value: 'voucher', label: 'Voucher' }];

function RewardForm(props) {
  const { api } = useAuth();
  const [category, setCategory] = useState('badge');
  return (
    <CreateForm {...props} title="Vật phẩm mới" submit={body => api.admin.createReward({ ...body, category, is_available: true })}
      extra={<Segmented options={CATEGORIES} value={category} onChange={setCategory} />} fields={[
        { key: 'title', label: 'Tên vật phẩm', placeholder: 'Huy hiệu Chiến binh' },
        { key: 'cost_coins', label: 'Giá (xu)', number: true, initial: '100' },
        { key: 'icon', label: 'Biểu tượng (tên Ionicons)', initial: 'ribbon-outline' },
      ]} />
  );
}

function Rewards() {
  const { api } = useAuth();
  const load = useCallback(async () => (await api.admin.rewards()).items.map(r => ({ ...r, id: r.item_id })), [api]);
  return (
    <Catalog load={load} flag="is_available" empty="Chưa có vật phẩm."
      toggle={(id, on) => api.admin.updateReward(id, { is_available: on })}
      rowOf={r => ({ title: r.title, subtitle: `${CATEGORIES.find(c => c.value === r.category)?.label ?? r.category} · ${fmt(r.cost_coins)} xu · đã đổi ${fmt(r.sold)} lượt${r.is_available ? '' : ' · NGỪNG BÁN'}` })}
      createForm={props => <RewardForm {...props} />} />
  );
}

function Exercises() {
  const { api } = useAuth();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const list = usePaged(page => api.admin.exercises({ q, status, page }), 'exercises', [api, q, status]);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 400); return () => clearTimeout(t); }, [text]);

  const flip = async (x) => {
    setBusyId(x.exercise_id); setError('');
    try {
      const res = await api.admin.updateExercise(x.exercise_id, { is_active: !x.is_active });
      list.setRows(rows => rows.map(r => (r.exercise_id === x.exercise_id ? { ...r, is_active: res.exercise?.is_active ?? !x.is_active } : r)));
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };

  return (
    <>
      <TextField label="Tìm bài tập" value={text} onChangeText={setText} placeholder="squat, đẩy ngực…" returnKeyType="search" autoCapitalize="none" />
      <Segmented options={[{ value: '', label: 'Tất cả' }, { value: 'active', label: 'Đang hiện' }, { value: 'hidden', label: 'Đã ẩn' }]}
        value={status} onChange={setStatus} />
      <ErrorBox message={error || list.error} />
      <Text variant="caption" tone="dim">{fmt(list.total)} bài · bài bị ẩn không còn trong thư viện và lịch AI.</Text>
      <View style={styles.list}>
        {list.rows.map(x => (
          <ListRow key={x.exercise_id} title={x.name_vi || x.name}
            subtitle={[(x.body_parts_vi ?? x.body_parts ?? []).join(', '), (x.equipments_vi ?? x.equipments ?? []).join(', ')].filter(Boolean).join(' · ')}
            right={<View style={styles.row}>
              {!x.is_active ? <Pill label="ẨN" color={colors.danger} /> : null}
              <Button title={x.is_active ? 'Ẩn' : 'Hiện'} variant={x.is_active ? 'ghost' : 'glass'} loading={busyId === x.exercise_id}
                onPress={() => flip(x)} style={styles.toggle} />
            </View>} />
        ))}
      </View>
      <Pager shown={list.rows.length} total={list.total} loading={list.loading} onMore={list.more} />
    </>
  );
}

function Logs() {
  const { api } = useAuth();
  const list = usePaged(page => api.admin.logs({ page }), 'logs', [api]);
  return (
    <>
      <ErrorBox message={list.error} />
      <Text variant="caption" tone="dim">Nhật ký chỉ xem, không sửa hay xóa được.</Text>
      <View style={styles.list}>
        {list.rows.map(l => (
          <Surface key={l.log_id} radius={radius.md} style={styles.card}>
            <Text variant="label">{ACTIONS[l.action] ?? l.action}</Text>
            <Field label="Admin" value={l.admin_name || l.admin_email} />
            <Field label="Đối tượng" value={`${l.target_type} · ${String(l.target_id).slice(0, 8)}`} />
            {l.note ? <Text variant="caption" tone="dim">{l.note}</Text> : null}
            <Text variant="caption" tone="faint">{dmyhm(l.created_at)}</Text>
          </Surface>
        ))}
        {!list.loading && !list.rows.length && !list.error ? <Text tone="dim" align="center">Chưa có thao tác nào.</Text> : null}
      </View>
      <Pager shown={list.rows.length} total={list.total} loading={list.loading} onMore={list.more} />
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  page: { gap: 12 },
  title: { marginBottom: 6 },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9 },
  tabOn: { borderColor: colors.text, borderWidth: 1 },
  notice: { padding: 12, backgroundColor: colors.accentSoft },
  card: { padding: 14, gap: 8 },
  form: { padding: 16, gap: 12, borderWidth: 1, borderColor: colors.stroke },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  toggle: { minWidth: 64 },
}));
