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
import { ActionForm, ErrorBox, Field, ListRow, Pager, Pill, PRODUCT_NAMES, STATUS, SectionTitle, dmy, dmyhm, fmt, usePaged, vnd } from './kit';

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'premium', label: 'Premium' },
  { value: 'free', label: 'Free' },
  { value: 'locked', label: 'Bị khóa' },
];
const filterOf = (f) => (f === 'locked' ? { status: 'locked' } : f === 'all' ? {} : { plan: f });

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
      <Text variant="caption" tone="dim">{fmt(list.total)} tài khoản</Text>

      <View style={styles.list}>
        {list.rows.map(a => (
          <ListRow key={a.user_id} icon={a.role === 'admin' ? 'shield-checkmark' : 'person-circle'} onPress={() => setOpenId(a.user_id)}
            title={a.full_name || a.email}
            subtitle={`${a.email} · ${fmt(a.fit_coins)} xu · streak ${a.streak_days ?? 0} · tạo ${dmy(a.created_at)}`}
            right={<View style={styles.tags}>
              {a.premium ? <Pill label="PREMIUM" color={colors.accentText} /> : null}
              {!a.is_active ? <Pill label="KHÓA" color={colors.danger} /> : null}
              {a.role === 'admin' ? <Pill label="ADMIN" color={colors.water} /> : null}
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
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try { setData(await api.admin.account(id)); setError(''); } catch (e) { setError(e.message); }
  }, [api, id]);
  useEffect(() => { setData(null); setAction(null); setNotice(''); load(); }, [load]);

  const a = data?.account;
  const m = data?.membership;
  const p = data?.profile;
  const act = data?.activity_30d;
  const ai = data?.ai;
  const editable = a && a.role !== 'admin';

  const ACTIONS = a ? [
    a.is_active
      ? { key: 'lock', icon: 'lock-closed', title: 'Khóa tài khoản', danger: true, detail: 'Người dùng bị đăng xuất khỏi mọi máy và không đăng nhập lại được.',
          run: ({ note }) => api.admin.updateAccount(id, { is_active: false, note }) }
      : { key: 'unlock', icon: 'lock-open', title: 'Mở khóa tài khoản', run: ({ note }) => api.admin.updateAccount(id, { is_active: true, note }) },
    { key: 'premium', icon: 'diamond', title: 'Cấp Premium', detail: m?.premium ? `Cộng thêm vào hạn hiện tại (${dmy(m.premium_until)}).` : 'Tính từ hôm nay.',
      amount: { label: 'Số ngày', initial: '30', placeholder: '30', hint: 'Số ngày từ 1 đến 3650.', valid: n => n >= 1 && n <= 3650 },
      run: ({ amount, note }) => api.admin.grantPremium(id, amount, note) },
    m?.premium && { key: 'revoke', icon: 'remove-circle', title: 'Thu hồi Premium', danger: true, detail: 'Hạn Premium kết thúc ngay bây giờ.',
      run: ({ note }) => api.admin.revokePremium(id, note) },
    { key: 'coins', icon: 'cash', title: 'Cộng / trừ xu', detail: `Số dư hiện tại ${fmt(data.wallet.fit_coins)} xu. Nhập số âm để trừ; số dư không xuống dưới 0.`,
      amount: { label: 'Số xu (+/-)', placeholder: '100 hoặc -50', hint: 'Nhập số nguyên khác 0.', valid: n => n !== 0 },
      run: ({ amount, note }) => api.admin.coins(id, amount, note) },
    { key: 'logout', icon: 'log-out', title: 'Đăng xuất mọi thiết bị', detail: `Đang có ${data.sessions.active} phiên đăng nhập.`,
      run: ({ note }) => api.admin.logoutAll(id, note) },
    { key: 'chat', icon: 'trash', title: 'Xóa dữ liệu AI', danger: true, detail: 'Xóa lịch sử chat và trí nhớ AI của người này. Không hoàn tác được.',
      run: ({ note }) => api.admin.clearChat(id, note) },
    { key: 'admin', icon: 'shield-checkmark', title: 'Cấp quyền admin', danger: true, confirm: a.email,
      detail: 'Người này sẽ vào được toàn bộ trang quản trị. Sau đó không thể sửa họ từ app.',
      run: ({ note }) => api.admin.updateAccount(id, { role: 'admin', note }) },
  ].filter(Boolean) : [];

  const submit = async (values) => {
    const res = await action.run(values);
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
          {!editable ? <Text variant="caption" tone="dim">Tài khoản admin không sửa được từ app.</Text> : action ? (
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
            <Field label="Giới tính · tuổi" value={`${p.gender ?? '—'} · ${p.age ?? '—'}`} />
            <Field label="Chiều cao · cân nặng" value={`${p.height ?? '—'} cm · ${p.weight ?? '—'} kg`} />
            <Field label="BMI" value={p.bmi_value ? `${p.bmi_value} (${p.bmi_status})` : '—'} />
            <Field label="Mục tiêu · vận động" value={`${p.goal ?? '—'} · ${p.activity_level ?? '—'}`} />
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
}));
