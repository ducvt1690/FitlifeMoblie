import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import Segmented from '../../ui/Segmented';
import Sheet from '../../ui/Sheet';
import { colors, radius, themed } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { ActionForm, ErrorBox, Field, ListRow, Pager, Pill, PRODUCT_NAMES, STATUS, SectionTitle, count, dmy, dmyhm, fmt, usePaged, vnd } from './kit';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'premium', label: 'Premium' },
  { value: 'free', label: 'Free' },
  { value: 'locked', label: 'Bị khóa' },
];
const filterOf = (f) => (f === 'locked' ? { status: 'locked' } : f === 'all' ? {} : { plan: f });
const ROLES = [{ value: 'user', label: 'Người dùng' }, { value: 'trainer', label: 'Trainer' }, { value: 'admin', label: 'Admin' }];
const GENDERS = [{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }];
const ACTIVITY = [{ value: 'sedentary', label: 'Ít' }, { value: 'light', label: 'Nhẹ' }, { value: 'moderate', label: 'Vừa' }, { value: 'active', label: 'Nhiều' }];
const GOALS = [{ value: 'lose', label: 'Giảm cân' }, { value: 'maintain', label: 'Giữ cân' }, { value: 'gain', label: 'Tăng cân' }];
const labelOf = (options, value) => options.find(o => o.value === value)?.label ?? value ?? '—';

export default function UsersScreen() {
  const { api } = useAuth();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const list = usePaged(page => api.admin.accounts({ q, page, ...filterOf(filter) }), 'accounts', [api, q, filter]);

  // Search a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <Screen tabBar contentStyle={styles.page} refreshing={false} onRefresh={list.reload}>
      <Text variant="title" style={styles.title}>Người dùng</Text>
      <TextField label="Tìm theo email hoặc tên" value={text} onChangeText={setText} autoCapitalize="none" returnKeyType="search"
        onSubmitEditing={() => setQ(text.trim())} placeholder="vd: an@gmail.com" />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      <ErrorBox message={list.error} />
      <Text variant="caption" tone="dim">{count(list.total)} tài khoản</Text>

      <View style={styles.list}>
        {list.rows.map(a => (
          <ListRow key={a.user_id} icon={a.role === 'admin' ? 'shield-checkmark' : 'person-circle'} onPress={() => setOpenId(a.user_id)}
            title={a.full_name || a.email}
            subtitle={`${a.email} · ${fmt(a.fit_coins)} xu · streak ${a.streak_days ?? 0} · tạo ${dmy(a.created_at)}`}
            right={<View style={styles.tags}>
              {a.premium ? <Pill label="PREMIUM" color={colors.accentText} /> : null}
              {!a.is_active ? <Pill label="KHÓA" color={colors.danger} /> : null}
              {a.role !== 'user' ? <Pill label={a.role.toUpperCase()} color={colors.water} /> : null}
            </View>} />
        ))}
        {!list.loading && !list.rows.length && !list.error ? <Text tone="dim" align="center">Không có tài khoản nào khớp.</Text> : null}
      </View>
      <Pager shown={list.rows.length} total={list.total} loading={list.loading} onMore={list.more} />

      <AccountSheet id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />
    </Screen>
  );
}

function AccountSheet({ id, onClose, onChanged }) {
  const { api, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try { setData(await api.admin.account(id)); setError(''); } catch (e) { setError(e.message); }
  }, [api, id]);
  // Keep the last account on screen while the sheet slides closed.
  useEffect(() => { if (!id) return; setData(null); setError(''); setAction(null); setNotice(''); load(); }, [id, load]);

  const a = data?.account;
  const m = data?.membership;
  const p = data?.profile;
  const act = data?.activity_30d;
  const ai = data?.ai;
  const self = a?.user_id === user?.user_id;

  const ACTIONS = a ? [
    { key: 'edit', icon: 'create', title: 'Sửa thông tin', form: true, run: body => api.admin.updateAccount(id, body) },
    !self && (a.is_active
      ? { key: 'lock', icon: 'lock-closed', title: 'Khóa tài khoản', danger: true, detail: 'Người dùng bị đăng xuất khỏi mọi máy và không đăng nhập lại được.',
          run: ({ note }) => api.admin.updateAccount(id, { is_active: false, note }) }
      : { key: 'unlock', icon: 'lock-open', title: 'Mở khóa tài khoản', run: ({ note }) => api.admin.updateAccount(id, { is_active: true, note }) }),
    !self && { key: 'role', icon: 'shield-checkmark', title: 'Đổi quyền', danger: true,
      detail: 'Admin vào được toàn bộ trang quản trị; trainer vào khu huấn luyện viên. Người này sẽ bị đăng xuất để nhận quyền mới.',
      choice: { label: `Quyền hiện tại: ${labelOf(ROLES, a.role)}`, options: ROLES, initial: a.role, hint: 'Chọn một quyền khác quyền hiện tại.' },
      run: ({ choice, note }) => api.admin.updateAccount(id, { role: choice, note }) },
    { key: 'password', icon: 'key', title: 'Đặt lại mật khẩu', danger: true,
      detail: 'Đặt mật khẩu mới rồi gửi riêng cho người dùng. Mọi thiết bị đang đăng nhập sẽ bị đăng xuất.',
      text: { label: 'Mật khẩu mới', secure: true, placeholder: 'Tối thiểu 8 ký tự', hint: 'Mật khẩu cần tối thiểu 8 ký tự.', valid: t => [...t].length >= 8 && !!t.trim() },
      run: ({ text, note }) => api.admin.updateAccount(id, { password: text, note }) },
    !self && { key: 'premium', icon: 'diamond', title: 'Cấp Premium', detail: m?.premium ? `Cộng thêm vào hạn hiện tại (${dmy(m.premium_until)}).` : 'Tính từ hôm nay.',
      amount: { label: 'Số ngày', initial: '30', placeholder: '30', hint: 'Số ngày từ 1 đến 3650.', valid: n => n >= 1 && n <= 3650 },
      run: ({ amount, note }) => api.admin.grantPremium(id, amount, note) },
    !self && m?.premium && { key: 'revoke', icon: 'remove-circle', title: 'Thu hồi Premium', danger: true, detail: 'Hạn Premium kết thúc ngay bây giờ.',
      run: ({ note }) => api.admin.revokePremium(id, note) },
    !self && { key: 'coins', icon: 'cash', title: 'Cộng / trừ xu', detail: `Số dư hiện tại ${fmt(data.wallet.fit_coins)} xu. Nhập số âm để trừ; số dư không xuống dưới 0.`,
      amount: { label: 'Số xu (+/-)', placeholder: '100 hoặc -50', hint: 'Nhập số nguyên khác 0.', valid: n => n !== 0 },
      run: ({ amount, note }) => api.admin.coins(id, amount, note) },
    !self && { key: 'logout', icon: 'log-out', title: 'Đăng xuất mọi thiết bị', detail: `Đang có ${data.sessions.active} phiên đăng nhập.`,
      run: ({ note }) => api.admin.logoutAll(id, note) },
    !self && { key: 'chat', icon: 'trash', title: 'Xóa dữ liệu AI', danger: true, detail: 'Xóa lịch sử chat và trí nhớ AI của người này. Không hoàn tác được.',
      run: ({ note }) => api.admin.clearChat(id, note) },
    !self && { key: 'delete', icon: 'trash-bin', title: 'Xóa tài khoản', danger: true, confirm: a.email, closes: true,
      detail: 'Xóa vĩnh viễn tài khoản cùng mọi dữ liệu: nhật ký, đơn thanh toán, ví xu, chat AI. Không hoàn tác được.',
      run: ({ note }) => api.admin.deleteAccount(id, note) },
  ].filter(Boolean) : [];

  const submit = async (values) => {
    const res = await action.run(values);
    if (action.closes) { onChanged(); onClose(); return; }
    setNotice(res?.message || `Đã thực hiện: ${action.title}.`);
    setAction(null);
    await load();
    onChanged();
  };

  return (
    <Sheet visible={!!id} title={a ? (a.full_name || a.email) : 'Tài khoản'} subtitle={a?.email} onClose={onClose}>
      <ErrorBox message={error} />
      {!data && !error ? <ActivityIndicator color={colors.text} style={styles.spinner} /> : null}
      {data ? (
        <>
          <View style={styles.tags}>
            <Pill label={m.premium ? 'PREMIUM' : 'FREE'} color={m.premium ? colors.accentText : colors.textDim} />
            <Pill label={a.is_active ? 'Đang hoạt động' : 'Đã khóa'} color={a.is_active ? colors.textDim : colors.danger} />
            <Pill label={a.role.toUpperCase()} color={a.role === 'admin' ? colors.water : colors.textDim} />
          </View>
          {notice ? <Surface radius={radius.sm} style={styles.notice}><Text variant="label" color={colors.accentText}>{notice}</Text></Surface> : null}

          <SectionTitle>Thao tác</SectionTitle>
          {self ? <Text variant="caption" tone="dim">Đây là tài khoản của bạn: chỉ sửa thông tin và mật khẩu; khóa, đổi quyền, Premium, xu hay xóa phải nhờ admin khác.</Text> : null}
          {action?.form ? (
            <EditForm account={a} profile={p} onCancel={() => setAction(null)}
              onSubmit={submit} />
          ) : action ? (
            <ActionForm key={action.key} action={action} onCancel={() => setAction(null)} onSubmit={submit} />
          ) : (
            <View style={styles.actions}>
              {ACTIONS.map(x => (
                <Button key={x.key} title={x.title} icon={x.icon} variant="glass" onPress={() => { setNotice(''); setAction(x); }}
                  style={styles.action} />
              ))}
            </View>
          )}

          <SectionTitle>Gói thành viên</SectionTitle>
          <Surface radius={radius.md} style={styles.card}>
            <Field label="Gói" value={m.premium ? 'Premium' : 'Free'} />
            <Field label="Hạn Premium" value={m.premium_until ? dmy(m.premium_until) : '—'} />
            {m.orders.length ? m.orders.slice(0, 6).map(o => (
              <Field key={o.order_id} label={`${PRODUCT_NAMES[o.product] ?? o.product} · ${dmy(o.created_at)}`}
                value={`${vnd(o.amount_vnd)} · ${STATUS[o.status]?.label ?? o.status}`} color={STATUS[o.status]?.color()} />
            )) : <Text variant="caption" tone="faint">Chưa có đơn thanh toán.</Text>}
          </Surface>

          <SectionTitle>Hoạt động 30 ngày</SectionTitle>
          <Surface radius={radius.md} style={styles.card}>
            <Field label="Buổi tập" value={`${fmt(act.workouts)} buổi · ${fmt(act.workout_minutes)} phút`} />
            <Field label="Bữa ăn đã log" value={fmt(act.meals)} />
            <Field label="Nước" value={`${fmt(act.water_ml)} ml`} />
            <Field label="Bước chân" value={fmt(act.steps)} />
            <Field label="Nhiệm vụ hoàn thành" value={fmt(act.quests_completed)} />
            <Field label="Thử thách đang chạy" value={act.challenges.length ? act.challenges.map(c => `${c.title} (${c.current_progress}/${c.target_days})`).join(', ') : '—'} />
            <Field label="Huy hiệu" value={act.badges.length ? act.badges.map(b => b.title).join(', ') : '—'} />
            {act.records ? <Field label="Kỷ lục" value={`streak dài nhất ${act.records.best_streak} · ${fmt(act.records.total_workouts)} buổi`} /> : null}
          </Surface>

          <SectionTitle>AI</SectionTitle>
          <Surface radius={radius.md} style={styles.card}>
            <Field label="Chat (24 giờ)" value={`${ai.chat.used_24h}/${ai.chat.limit} · còn ${ai.chat.remaining}`} />
            <Field label="Gợi ý bữa ăn (hôm nay)" value={`${ai.meal_ai.used_today}/${ai.meal_ai.limit}`} />
            <Field label="Tạo lịch tập (hôm nay)" value={`${ai.workout_plan.used_today}/${ai.workout_plan.limit}`} />
            <Field label="Câu hỏi AI 30 ngày" value={fmt(act.ai_questions)} />
          </Surface>

          <SectionTitle>Hồ sơ</SectionTitle>
          <Surface radius={radius.md} style={styles.card}>
            <Field label="Giới tính · tuổi" value={`${labelOf(GENDERS, p.gender)} · ${p.age ?? '—'}`} />
            <Field label="Chiều cao · cân nặng" value={`${p.height ?? '—'} cm · ${p.weight ?? '—'} kg`} />
            <Field label="BMI" value={p.bmi_value ? `${p.bmi_value} (${p.bmi_status})` : '—'} />
            <Field label="Mục tiêu · vận động" value={`${labelOf(GOALS, p.goal)} · vận động ${labelOf(ACTIVITY, p.activity_level).toLowerCase()}`} />
            <Field label="Kcal · nước mục tiêu" value={`${fmt(p.target_calories)} kcal · ${fmt(p.target_water)} ml`} />
            <Field label="Dị ứng" value={p.allergies?.length ? p.allergies.join(', ') : '—'} />
          </Surface>

          <SectionTitle>Ví xu</SectionTitle>
          <Surface radius={radius.md} style={styles.card}>
            <Field label="Số dư" value={`${fmt(data.wallet.fit_coins)} xu`} />
            {data.wallet.transactions.slice(0, 10).map(t => (
              <Field key={t.tx_id} label={`${dmyhm(t.created_at)} · ${t.source}`} value={`${t.amount > 0 ? '+' : ''}${fmt(t.amount)}`}
                color={t.amount < 0 ? colors.danger : colors.accentText} />
            ))}
          </Surface>

          <SectionTitle>Tài khoản</SectionTitle>
          <Surface radius={radius.md} style={styles.card}>
            <Field label="Ngày tạo" value={dmy(a.created_at)} />
            <Field label="Múi giờ" value={a.timezone} />
            <Field label="Streak" value={`${a.streak_days ?? 0} ngày`} />
            <Field label="Phiên đang mở" value={fmt(data.sessions.active)} />
            <Field label="Đăng nhập gần nhất" value={dmyhm(data.sessions.last_login_at)} />
          </Surface>
        </>
      ) : null}
    </Sheet>
  );
}

// Edit the account's name, email and body profile. Only changed fields are sent; targets are recomputed by the server.
function EditForm({ account, profile, onCancel, onSubmit }) {
  const start = {
    full_name: account.full_name ?? '', email: account.email ?? '', gender: profile.gender ?? 'male',
    date_of_birth: profile.date_of_birth ?? '', age: profile.age == null ? '' : String(profile.age),
    height: profile.height == null ? '' : String(profile.height), weight: profile.weight == null ? '' : String(profile.weight),
    activity_level: profile.activity_level ?? 'moderate', goal: profile.goal ?? 'maintain',
  };
  const [v, setV] = useState(start);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setV(prev => ({ ...prev, [key]: value }));
  const hasBirthday = !!profile.date_of_birth;

  const submit = async () => {
    const body = {};
    for (const key of ['full_name', 'email', 'gender', 'activity_level', 'goal']) {
      const value = v[key].trim();
      if (value && value !== start[key]) body[key] = value;
    }
    const numbers = hasBirthday ? ['height', 'weight'] : ['age', 'height', 'weight'];
    for (const key of numbers) {
      if (v[key].trim() === start[key]) continue;
      const n = Number(v[key].replace(',', '.'));
      if (!v[key].trim() || !Number.isFinite(n)) return setError('Tuổi, chiều cao, cân nặng phải là số.');
      body[key] = key === 'age' ? Math.round(n) : n;
    }
    if (hasBirthday && v.date_of_birth.trim() !== start.date_of_birth) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date_of_birth.trim())) return setError('Ngày sinh theo dạng YYYY-MM-DD.');
      body.date_of_birth = v.date_of_birth.trim();
    }
    if (!Object.keys(body).length) return setError('Chưa thay đổi gì.');
    if (!note.trim()) return setError('Nhập lý do (bắt buộc, được ghi vào nhật ký quản trị).');
    setBusy(true); setError('');
    try { await onSubmit({ ...body, note: note.trim() }); } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Surface radius={radius.lg} style={styles.form}>
      <Text variant="heading">Sửa thông tin</Text>
      <Text variant="caption" tone="dim">Đổi email sẽ đăng xuất người này khỏi mọi thiết bị. Mục tiêu kcal và nước được tính lại.</Text>
      <TextField label="Họ tên" value={v.full_name} onChangeText={set('full_name')} maxLength={100} />
      <TextField label="Email" value={v.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <Text variant="caption" tone="dim">Giới tính</Text>
      <Segmented options={GENDERS} value={v.gender} onChange={set('gender')} />
      <View style={styles.formRow}>
        {hasBirthday
          ? <TextField label="Ngày sinh" value={v.date_of_birth} onChangeText={set('date_of_birth')} placeholder="2000-01-31" style={styles.flex} />
          : <TextField label="Tuổi" value={v.age} onChangeText={set('age')} keyboardType="number-pad" style={styles.flex} />}
        <TextField label="Cao (cm)" value={v.height} onChangeText={set('height')} keyboardType="decimal-pad" style={styles.flex} />
        <TextField label="Nặng (kg)" value={v.weight} onChangeText={set('weight')} keyboardType="decimal-pad" style={styles.flex} />
      </View>
      <Text variant="caption" tone="dim">Mức vận động</Text>
      <Segmented options={ACTIVITY} value={v.activity_level} onChange={set('activity_level')} />
      <Text variant="caption" tone="dim">Mục tiêu</Text>
      <Segmented options={GOALS} value={v.goal} onChange={set('goal')} />
      <TextField label="Lý do" value={note} onChangeText={setNote} placeholder="VD: người dùng nhờ sửa, nhập sai khi đăng ký…" maxLength={500} multiline />
      <ErrorBox message={error} />
      <View style={styles.formRow}>
        <Button title="Hủy" variant="glass" onPress={onCancel} style={styles.flex} />
        <Button title="Lưu" onPress={submit} loading={busy} style={styles.flex} />
      </View>
    </Surface>
  );
}


const styles = themed(() => StyleSheet.create({
  page: { gap: 12 },
  title: { marginBottom: 6 },
  list: { gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  spinner: { marginTop: 40 },
  notice: { padding: 12, backgroundColor: colors.accentSoft },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexBasis: '45%', flexGrow: 1 },
  card: { padding: 14, gap: 2 },
  flex: { flex: 1 },
  form: { padding: 16, gap: 12, borderWidth: 1, borderColor: colors.stroke },
  formRow: { flexDirection: 'row', gap: 10 },
}));
