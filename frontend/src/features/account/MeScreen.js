import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';
import { colors, radius } from '../../theme/tokens';
import { THEMES, themeChoice, applyTheme } from '../../theme/preference';
import { useAuth } from '../../context/AuthContext';
import { loadPhotos, pickPhoto, clearPhoto } from '../../lib/media';
import { readReminderSettings, saveReminderSettings } from '../../lib/reminders';
import { ACTIVITY, GOALS, EditProfileSheet, MembershipSheet, PasswordSheet, dmy } from './sheets';

const ROLE_LABEL = { user: 'Thành viên', admin: 'Quản trị viên' };
const fmt = (n) => Math.round(n ?? 0).toLocaleString('vi-VN');

// Earned from lifetime totals, like the award cases of the big fitness apps.
const BADGES = [
  { icon: 'flag', label: 'Buổi đầu tiên', done: l => l.workouts >= 1 },
  { icon: 'flame', label: 'Chuỗi 3 ngày', done: l => l.best_streak >= 3 },
  { icon: 'calendar', label: 'Chuỗi 7 ngày', done: l => l.best_streak >= 7 },
  { icon: 'barbell', label: '10 buổi tập', done: l => l.workouts >= 10 },
  { icon: 'time', label: '1.000 phút', done: l => l.minutes >= 1000 },
  { icon: 'trophy', label: '50 buổi tập', done: l => l.workouts >= 50 },
  { icon: 'flash', label: '10.000 kcal', done: l => l.calories_burned >= 10000 },
  { icon: 'medal', label: 'Chuỗi 30 ngày', done: l => l.best_streak >= 30 },
];

// The member's personal hub: photos, lifetime progress, membership, body profile and app settings.
export default function MeScreen({ tabBar = true }) {
  const { user, api, logout, refreshUser } = useAuth();
  const member = user?.role === 'user';
  const [profile, setProfile] = useState(null);
  const [life, setLife] = useState(null);
  const [bmi, setBmi] = useState(null);
  const [membership, setMembership] = useState(null);
  const [photos, setPhotos] = useState({});
  const [notify, setNotify] = useState({ after_workout: true, water: false });
  const [sheet, setSheet] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, l, b, m] = await Promise.all([api.profile(), member ? api.lifetime() : null, member ? api.bmi() : null,
        member ? api.payments.plans().catch(() => null) : null]);
      setProfile(p.profile); setLife(l); setBmi(b); setMembership(m?.membership ?? null); setError('');
    } catch (e) { setError(e.message); }
  }, [api, member]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { loadPhotos(user?.user_id).then(setPhotos).catch(() => {}); readReminderSettings().then(setNotify); }, [user?.user_id]);

  const changePhoto = async (kind) => {
    try {
      const uri = await pickPhoto(user.user_id, kind);
      if (uri) setPhotos(p => ({ ...p, [kind]: uri }));
    } catch (e) { setError(e.message); }
  };
  const removePhoto = async (kind) => { await clearPhoto(user.user_id, kind); setPhotos(p => ({ ...p, [kind]: null })); };
  const toggle = (k) => async (v) => {
    const next = { ...notify, [k]: v };
    setNotify(next);
    try { await saveReminderSettings(next); } catch (e) { setNotify(notify); setError(e.message); }
  };
  const [themeNote, setThemeNote] = useState('');
  const pickTheme = (v) => { if (v !== themeChoice && !applyTheme(v)) setThemeNote('Đã lưu. Mở lại ứng dụng để đổi giao diện.'); };

  const name = profile?.full_name ?? user?.name;
  const initial = (name?.trim().split(' ').pop()?.[0] ?? 'F').toUpperCase();
  const days = profile?.member_since ? Math.max(1, Math.ceil((Date.now() - new Date(profile.member_since)) / 86400000)) : null;
  const tiles = life ? [
    { label: 'Buổi tập', value: fmt(life.workouts), icon: 'barbell' },
    { label: 'Phút tập', value: fmt(life.minutes), icon: 'time' },
    { label: 'kcal đã đốt', value: fmt(life.calories_burned), icon: 'flame' },
    { label: 'Ngày hoạt động', value: fmt(life.active_days), icon: 'calendar' },
    { label: 'Chuỗi hiện tại', value: `${fmt(life.streak_days)} ngày`, icon: 'trending-up' },
    { label: 'Chuỗi dài nhất', value: `${fmt(life.best_streak)} ngày`, icon: 'trophy' },
  ] : [];
  const weights = [...(bmi?.records ?? [])].reverse().slice(-14);
  const wMin = Math.min(...weights.map(w => w.weight));
  const wMax = Math.max(...weights.map(w => w.weight));
  const body = profile ? [
    { label: 'Ngày sinh', value: profile.date_of_birth ? dmy(profile.date_of_birth) : '—' },
    { label: 'Tuổi', value: profile.age ?? '—' },
    { label: 'Chiều cao', value: `${profile.height} cm` },
    { label: 'Cân nặng', value: `${profile.weight} kg` },
    { label: 'Mục tiêu', value: GOALS.find(g => g.value === profile.goal)?.label ?? '—' },
    { label: 'Mức vận động', value: ACTIVITY.find(a => a.value === profile.activity_level)?.label ?? '—' },
    { label: 'Năng lượng mỗi ngày', value: `${fmt(profile.target_calories)} kcal` },
    { label: 'Nước mỗi ngày', value: `${fmt(profile.target_water)} ml` },
  ] : [];

  return (
    <Screen tabBar={tabBar} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <View style={styles.cover}>
        {photos.cover ? <Image source={{ uri: photos.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          : <LinearGradient colors={[colors.accentSoft, colors.surfaceHigh]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        <Pressable onPress={() => changePhoto('cover')} onLongPress={() => photos.cover && removePhoto('cover')} style={styles.coverBtn}
          accessibilityRole="button" accessibilityLabel="Đổi ảnh bìa" accessibilityHint="Nhấn giữ để gỡ ảnh">
          <Ionicons name="image" size={16} color={colors.text} />
          <Text variant="caption">Ảnh bìa</Text>
        </Pressable>
      </View>
      <View style={styles.idRow}>
        <Pressable onPress={() => changePhoto('avatar')} onLongPress={() => photos.avatar && removePhoto('avatar')}
          accessibilityRole="button" accessibilityLabel="Đổi ảnh đại diện" accessibilityHint="Nhấn giữ để gỡ ảnh" style={styles.avatar}>
          {photos.avatar ? <Image source={{ uri: photos.avatar }} style={styles.avatarImg} contentFit="cover" />
            : <Text variant="title">{initial}</Text>}
          <View style={styles.camera}><Ionicons name="camera" size={14} color={colors.ink} /></View>
        </Pressable>
        {membership?.premium ? (
          <View style={styles.pro}><Ionicons name="diamond" size={12} color={colors.ink} /><Text variant="caption" color={colors.ink}>PREMIUM</Text></View>
        ) : null}
      </View>
      <Text variant="title" numberOfLines={1}>{name}</Text>
      <Text variant="label" tone="dim" numberOfLines={1}>{user?.email}</Text>
      <Text variant="caption" tone="faint" style={styles.since}>
        {ROLE_LABEL[user?.role] ?? user?.role}{profile?.member_since ? ` · Tham gia ${dmy(profile.member_since)} · ${fmt(days)} ngày cùng FitLife` : ''}
      </Text>
      {error ? <Surface radius={radius.sm} style={styles.alert}><Text variant="label" tone="danger">{error}</Text></Surface> : null}

      {member && life ? (
        <>
          <View style={styles.grid}>
            {tiles.map(t => (
              <Surface key={t.label} radius={radius.md} style={styles.tile}>
                <Ionicons name={t.icon} size={16} color={colors.accentText} />
                <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>{t.value}</Text>
                <Text variant="caption" tone="faint" numberOfLines={1}>{t.label}</Text>
              </Surface>
            ))}
          </View>

          <Text variant="heading" style={styles.h}>Thành tích</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badges}>
            {BADGES.map(b => {
              const done = b.done(life);
              return (
                <View key={b.label} style={[styles.badge, !done && styles.locked]} accessibilityLabel={`${b.label}${done ? ', đã đạt' : ', chưa đạt'}`}>
                  <View style={[styles.badgeIcon, done && styles.badgeOn]}>
                    <Ionicons name={done ? b.icon : 'lock-closed'} size={22} color={done ? colors.ink : colors.textFaint} />
                  </View>
                  <Text variant="caption" tone={done ? 'default' : 'faint'} numberOfLines={2} style={styles.center}>{b.label}</Text>
                </View>
              );
            })}
          </ScrollView>

          {life.records.longest ? (
            <Surface radius={radius.lg} style={styles.card}>
              <Text variant="caption" tone="accent">Kỷ lục cá nhân</Text>
              <View style={styles.row}>
                <Text variant="label" tone="dim" style={styles.flex}>Buổi dài nhất</Text>
                <Text variant="label">{Math.round(life.records.longest.duration_seconds / 60)} phút</Text>
              </View>
              <View style={styles.row}>
                <Text variant="label" tone="dim" style={styles.flex}>Đốt nhiều nhất</Text>
                <Text variant="label">{fmt(life.records.hottest?.calories_burned)} kcal</Text>
              </View>
            </Surface>
          ) : null}

          {weights.length ? (
            <Surface radius={radius.lg} style={styles.card}>
              <View style={styles.row}>
                <Text variant="caption" tone="accent" style={styles.flex}>Cân nặng</Text>
                <Text variant="caption" tone="dim">BMI {bmi.current?.bmi_value ?? '—'}{bmi.current?.bmi_status ? ` · ${bmi.current.bmi_status}` : ''}</Text>
              </View>
              <View style={styles.chart}>
                {weights.map(w => (
                  <View key={w.record_date} style={styles.barCol}>
                    <View style={[styles.bar, { height: `${wMax > wMin ? 25 + ((w.weight - wMin) / (wMax - wMin)) * 75 : 60}%` }]} />
                  </View>
                ))}
              </View>
              <View style={styles.row}>
                <Text variant="caption" tone="faint" style={styles.flex}>{dmy(weights[0].record_date)}</Text>
                <Text variant="label">{weights.at(-1).weight} kg</Text>
              </View>
              <Text variant="caption" tone="faint">Cập nhật cân nặng ở "Chỉnh sửa hồ sơ" để xem xu hướng.</Text>
            </Surface>
          ) : null}

          {life.recent.length ? (
            <Surface radius={radius.lg} style={styles.card}>
              <Text variant="caption" tone="accent">Lịch sử tập gần đây</Text>
              {life.recent.map(w => (
                <View key={w.workout_id} style={styles.row}>
                  <View style={styles.flex}>
                    <Text variant="label" numberOfLines={1}>{w.title}</Text>
                    <Text variant="caption" tone="faint">{dmy(w.workout_date)}</Text>
                  </View>
                  <Text variant="caption" tone="dim">{Math.round(w.duration_seconds / 60)} phút · {fmt(w.calories_burned)} kcal</Text>
                </View>
              ))}
            </Surface>
          ) : null}

          <Pressable onPress={() => setSheet('membership')} accessibilityRole="button">
            <Surface radius={radius.lg} style={[styles.card, styles.rowCard]}>
              <Ionicons name="diamond" size={22} color={colors.accentText} />
              <View style={styles.flex}>
                <Text variant="label">{membership?.premium ? 'FitLife Premium' : 'Nâng cấp Premium'}</Text>
                <Text variant="caption" tone="dim">{membership?.premium ? `Hiệu lực đến ${dmy(membership.premium_until)}` : 'Quản lý gói, gia hạn và lịch sử thanh toán'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Surface>
          </Pressable>

          <Surface radius={radius.lg} style={styles.card}>
            <View style={styles.row}>
              <Text variant="caption" tone="accent" style={styles.flex}>Hồ sơ cơ thể</Text>
              <Pressable onPress={() => setSheet('edit')} hitSlop={10} accessibilityRole="button"><Text variant="label" tone="accent">Chỉnh sửa</Text></Pressable>
            </View>
            {body.map(r => (
              <View key={r.label} style={styles.row}>
                <Text variant="label" tone="dim" style={styles.flex}>{r.label}</Text>
                <Text variant="label">{r.value}</Text>
              </View>
            ))}
          </Surface>
        </>
      ) : null}

      <Text variant="heading" style={styles.h}>Cài đặt</Text>
      <Surface radius={radius.lg} style={styles.card}>
        <Text variant="caption" tone="dim">Giao diện</Text>
        <Segmented value={themeChoice} onChange={pickTheme} options={THEMES} />
        {themeNote ? <Text variant="caption" tone="faint">{themeNote}</Text> : null}
      </Surface>
      {member ? (
        <Surface radius={radius.lg} style={styles.card}>
          <Text variant="caption" tone="dim">Thông báo</Text>
          <View style={styles.row}>
            <View style={styles.flex}><Text variant="label">Nhắc sau buổi tập</Text><Text variant="caption" tone="faint">Tắm, ăn uống theo giờ bạn tập xong</Text></View>
            <Switch value={notify.after_workout} onValueChange={toggle('after_workout')} trackColor={{ true: colors.accent }} />
          </View>
          <View style={styles.row}>
            <View style={styles.flex}><Text variant="label">Nhắc uống nước</Text><Text variant="caption" tone="faint">2 giờ một lần, từ 9:00 đến 19:00</Text></View>
            <Switch value={notify.water} onValueChange={toggle('water')} trackColor={{ true: colors.accent }} />
          </View>
        </Surface>
      ) : null}
      <Surface radius={radius.lg} style={styles.card}>
        <Pressable onPress={() => setSheet('password')} style={styles.row} accessibilityRole="button">
          <Ionicons name="key" size={18} color={colors.textDim} />
          <Text variant="label" style={styles.flex}>Đổi mật khẩu</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      </Surface>
      <Button title="Đăng xuất" variant="glass" loading={busy} onPress={async () => { setBusy(true); await logout(); }} />
      <Text variant="caption" tone="faint" style={[styles.center, styles.version]}>FitLife {Constants.expoConfig?.version ?? ''}</Text>

      <EditProfileSheet visible={sheet === 'edit'} profile={profile} onClose={() => setSheet('')} onSaved={() => { load(); refreshUser?.(); }} />
      <PasswordSheet visible={sheet === 'password'} onClose={() => setSheet('')} />
      <MembershipSheet visible={sheet === 'membership'} onClose={() => setSheet('')} onChanged={load} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  cover: { height: 150, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  coverBtn: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 999, backgroundColor: colors.glassStrong },
  idRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -44, marginBottom: 10, paddingHorizontal: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: colors.bg },
  avatarImg: { width: '100%', height: '100%', borderRadius: 44 },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg },
  pro: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.accent, marginBottom: 6 },
  since: { marginTop: 4, marginBottom: 16 },
  alert: { padding: 12, marginBottom: 12, backgroundColor: colors.dangerSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  tile: { flexBasis: '30%', flexGrow: 1, padding: 12, gap: 4 },
  h: { marginTop: 14, marginBottom: 10 },
  badges: { gap: 10, paddingBottom: 4 },
  badge: { width: 82, alignItems: 'center', gap: 6 },
  locked: { opacity: 0.6 },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  badgeOn: { backgroundColor: colors.accent },
  card: { padding: 16, gap: 12, marginTop: 12 },
  rowCard: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 70 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 4, backgroundColor: colors.accent },
  version: { marginTop: 14 },
});
