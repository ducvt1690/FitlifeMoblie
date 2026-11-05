import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import TextField from '../../ui/TextField';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';
import NumberStepper from '../../ui/NumberStepper';
import { colors, radius, themed } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import AskCoach from '../coach/AskCoach';
import ExerciseSheet from './ExerciseSheet';
import RestTimer from './RestTimer';
import SwipeToDone from '../../ui/SwipeToDone';
import { scheduleReminders } from '../../lib/reminders';

const COACH_STARTERS = ['Lên lịch tập ngực 45 phút', 'Hôm nay nên tập nhóm cơ nào?', 'Lên lịch tập ở nhà không có tạ 30 phút', 'Tập xong nên ăn gì?'];

const SPLITS = [
  { value: 'ppl', label: 'Push · Pull · Legs', days: [['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs']] },
  { value: 'upper_lower', label: 'Upper · Lower', days: [['upper', 'Upper'], ['lower', 'Lower']] },
  { value: 'full_body', label: 'Full body', days: [['full', 'Toàn thân']] },
];

// On web a role=button row cannot hold the rest-timer button, so the row stays a plain clickable element there.
const ROW_ROLE = Platform.OS === 'web' ? undefined : 'button';

export default function WorkoutScreen() {
  const { api } = useAuth();
  const [plan, setPlan] = useState(null);
  const [split, setSplit] = useState('ppl');
  const [focus, setFocus] = useState('push');
  const [minutes, setMinutes] = useState(45);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const toggling = useRef(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [broken, setBroken] = useState({});
  const [scheduled, setScheduled] = useState(0);
  const [nudge, setNudge] = useState('');
  const [detail, setDetail] = useState(null);
  const [rest, setRest] = useState(null);
  const startRest = (it) => setRest({ seconds: it.rest_seconds || 60, label: it.name, key: Date.now() });

  const load = useCallback(async () => {
    try { setPlan((await api.plans.today()).plan); } catch (e) { setError({ message: e.message }); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = SPLITS.find(s => s.value === split).days;
  const create = async () => {
    setBusy('create'); setError(null);
    try {
      const res = await api.plans.create({ split, focus, minutes, ...(note.trim() ? { note: note.trim() } : {}) });
      setPlan(res.plan); setShowForm(false); setRest(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) { setError({ message: e.message, quota: e.status === 402 }); } finally { setBusy(''); }
  };
  const finish = async () => {
    setBusy('done'); setError(null);
    try {
      const res = await api.plans.complete(plan.plan_id);
      await load();
      setRest(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (res.coach?.preview) setNudge(res.coach.preview);
      setScheduled(await scheduleReminders(res.after?.reminders));
    } catch (e) { setError({ message: e.message }); } finally { setBusy(''); }
  };
  const doneIds = plan?.done_items ?? [];
  const toggle = async (id) => {
    if (toggling.current || busy || plan?.status === 'done') return;
    toggling.current = true; setBusy('toggle');
    const before = doneIds;
    const next = before.includes(id) ? before.filter(d => d !== id) : [...before, id];
    setPlan(p => ({ ...p, done_items: next }));
    const item = plan.items.find(i => i.exercise_id === id);
    // Rest before the next exercise, unless this was the last one.
    if (next.length > before.length && next.length < plan.items.length && item) startRest(item);
    try { await api.plans.setDone(plan.plan_id, next); }
    catch (e) { setPlan(p => ({ ...p, done_items: before })); setError({ message: e.message }); }
    finally { toggling.current = false; setBusy(''); }
  };
  const allDone = !!plan?.items.length && plan.items.every(i => doneIds.includes(i.exercise_id));

  const form = (
    <Surface radius={radius.lg} style={styles.card}>
      <Text variant="heading">Lịch tập AI hôm nay</Text>
      <Text variant="caption" tone="dim">Chọn kiểu chia lịch, buổi hôm nay và thời gian bạn có. AI chọn bài và cắt gọn cho vừa.</Text>
      <Segmented stacked options={SPLITS.map(s => ({ value: s.value, label: s.label }))} value={split}
        onChange={(v) => { setSplit(v); setFocus(SPLITS.find(s => s.value === v).days[0][0]); }} />
      {days.length > 1 ? <Segmented options={days.map(([value, label]) => ({ value, label }))} value={focus} onChange={setFocus} /> : null}
      <NumberStepper label="Thời gian" value={minutes} onChange={setMinutes} min={15} max={120} step={5} unit="phút" />
      <TextField label="Yêu cầu thêm (không bắt buộc)" value={note} onChangeText={setNote} placeholder="VD: không có tạ đòn, đau vai trái" />
      <Button title="Tạo lịch tập" onPress={create} loading={busy === 'create'} disabled={!!busy} />
    </Surface>
  );

  return (
    <>
    <Screen tabBar>
      <Text variant="title" style={styles.title}>Tập luyện</Text>
      {error ? (
        <Surface radius={radius.md} style={[styles.card, styles.alert]}>
          <Text variant="label" tone={error.quota ? 'accent' : 'danger'}>{error.quota ? 'Hạn mức AI hôm nay' : 'Có lỗi'}</Text>
          <Text tone="dim">{error.message}</Text>
          {error.quota ? <Text variant="caption" tone="faint">Gói miễn phí có 5 lượt AI mỗi ngày; Premium có 50 lượt dùng chung cho lịch tập và dinh dưỡng.</Text> : null}
        </Surface>
      ) : null}

      {plan && !showForm ? (
        <>
          <Surface radius={radius.lg} style={styles.card}>
            <Text variant="caption" tone="accent">{plan.status === 'done' ? 'Đã tập xong' : `Khoảng ${plan.estimated_minutes} phút · khởi động ${plan.warmup_minutes} phút`}</Text>
            <Text variant="heading">{plan.title}</Text>
            {plan.tip ? <Text tone="dim">{plan.tip}</Text> : null}
            {plan.notice ? <Text variant="caption" tone="faint">{plan.notice}</Text> : null}
            {plan.status !== 'done' ? <Text variant="caption" tone="dim">{doneIds.length}/{plan.items.length} bài xong · vuốt trái để đánh dấu, chạm để xem cách tập, bấm đồng hồ để bấm giờ nghỉ</Text> : null}
          </Surface>
          {plan.status === 'done' && plan.after ? (
            <Surface radius={radius.lg} style={styles.card}>
              <View style={styles.tip}>
                <View style={styles.tipIcon}><Ionicons name="chatbubble-ellipses" size={18} color={colors.accent} /></View>
                <View style={styles.flex}>
                  <Text variant="label">Coach đã nhắn cho bạn</Text>
                  <Text tone="dim">Lưu ý phục hồi và gợi ý bữa sau tập nằm trong khung chat. Bấm "Hỏi AI" để xem.</Text>
                </View>
              </View>
              {scheduled ? <Text variant="caption" tone="faint">Đã hẹn {scheduled} lời nhắc: tắm sau {plan.after.reminders[0].in_minutes} phút, ăn sau {plan.after.reminders[1].in_minutes} phút.</Text> : null}
            </Surface>
          ) : null}
          {plan.items.map((it, i) => (
            <SwipeToDone key={it.exercise_id} label={it.name} done={doneIds.includes(it.exercise_id)} disabled={plan.status === 'done'} onToggle={() => toggle(it.exercise_id)}>
            <Pressable onPress={() => setDetail(it.exercise_id)} accessibilityRole={ROW_ROLE} accessibilityHint="Xem cách tập và mẹo">
            <Surface radius={radius.md} style={[styles.exercise, doneIds.includes(it.exercise_id) && styles.doneRow]}>
              {it.gif_url && !broken[it.exercise_id] ? (
                <Image source={{ uri: it.gif_url }} style={styles.gif} contentFit="cover" transition={200}
                  onError={() => setBroken(b => ({ ...b, [it.exercise_id]: true }))} accessibilityLabel={`Minh họa ${it.name}`} />
              ) : <View style={[styles.gif, styles.noGif]}><Ionicons name="barbell" size={30} color={colors.textFaint} /></View>}
              <View style={styles.flex}>
                <Text variant="label" numberOfLines={2}>{i + 1}. {it.name}</Text>
                {it.target ? <Text variant="caption" tone="faint">{it.target}</Text> : null}
                <View style={styles.meta}>
                  <Text variant="label" tone="dim">{it.sets} hiệp × {it.reps}</Text>
                  {plan.status !== 'done' ? (
                    <Pressable onPress={() => startRest(it)} hitSlop={8} style={styles.restChip} accessibilityRole="button" accessibilityLabel={`Bấm giờ nghỉ ${it.rest_seconds} giây`}>
                      <Ionicons name="timer-outline" size={13} color={colors.accentText} />
                      <Text variant="caption" tone="accent">{it.rest_seconds}s</Text>
                    </Pressable>
                  ) : <Text variant="label" tone="dim">· nghỉ {it.rest_seconds}s</Text>}
                </View>
              </View>
              {doneIds.includes(it.exercise_id) ? <Ionicons name="checkmark-circle" size={26} color={colors.accent} /> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Surface>
            </Pressable>
            </SwipeToDone>
          ))}
          {plan.status !== 'done' && !doneIds.length ? <Text variant="caption" tone="faint" align="center" style={styles.gap}>Đánh dấu bài đã tập để hoàn thành buổi. Chỉ bài đã tập được tính phút và kcal.</Text> : null}
          {plan.status !== 'done' ? <Button title={allDone ? 'Hoàn thành buổi tập' : 'Đã tập xong'} onPress={finish} loading={busy === 'done'} disabled={!!busy || !doneIds.length} style={styles.gap} /> : null}
          <Button title="Tạo lịch khác" variant="glass" onPress={() => setShowForm(true)} style={styles.gap} />
        </>
      ) : form}
    </Screen>
    <AskCoach context="workout" title="Lịch tập, kỹ thuật, phục hồi" starters={COACH_STARTERS} onDone={load} nudge={nudge} onSeen={() => setNudge('')} />
    <RestTimer rest={rest} onClose={() => setRest(null)} />
    <ExerciseSheet exerciseId={detail} onClose={() => setDetail(null)} />
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  title: { marginBottom: 16 },
  card: { padding: 18, gap: 12, marginBottom: 12 },
  alert: { borderColor: colors.stroke },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, paddingRight: 14 },
  doneRow: { opacity: 0.55 },
  noGif: { backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  gif: { width: 76, height: 76, borderRadius: 12, backgroundColor: '#fff' },
  flex: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.accentSoft },
  gap: { marginTop: 10 },
}));
