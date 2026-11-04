import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { colors, radius } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import AskCoach from '../coach/AskCoach';
import SwipeToDone from '../../ui/SwipeToDone';
import { scheduleReminders } from '../../lib/reminders';

const COACH_STARTERS = ['Lên lịch tập ngực 45 phút', 'Hôm nay nên tập nhóm cơ nào?', 'Lên lịch tập ở nhà không có tạ 30 phút', 'Tập xong nên ăn gì?'];

const SPLITS = [
  { value: 'ppl', label: 'Push · Pull · Legs', days: [['push', 'Push'], ['pull', 'Pull'], ['legs', 'Legs']] },
  { value: 'upper_lower', label: 'Upper · Lower', days: [['upper', 'Upper'], ['lower', 'Lower']] },
  { value: 'full_body', label: 'Full body', days: [['full', 'Toàn thân']] },
];

export default function WorkoutScreen() {
  const { api } = useAuth();
  const [plan, setPlan] = useState(null);
  const [split, setSplit] = useState('ppl');
  const [focus, setFocus] = useState('push');
  const [minutes, setMinutes] = useState(45);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [broken, setBroken] = useState({});
  const [scheduled, setScheduled] = useState(0);

  const load = useCallback(async () => {
    try { setPlan((await api.plans.today()).plan); } catch (e) { setError({ message: e.message }); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = SPLITS.find(s => s.value === split).days;
  const create = async () => {
    setBusy('create'); setError(null);
    try {
      const res = await api.plans.create({ split, focus, minutes, ...(note.trim() ? { note: note.trim() } : {}) });
      setPlan(res.plan); setShowForm(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) { setError({ message: e.message, premium: e.status === 402 }); } finally { setBusy(''); }
  };
  const finish = async () => {
    setBusy('done'); setError(null);
    try {
      const res = await api.plans.complete(plan.plan_id);
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setScheduled(await scheduleReminders(res.after?.reminders));
    } catch (e) { setError({ message: e.message }); } finally { setBusy(''); }
  };
  const doneIds = plan?.done_items ?? [];
  const toggle = async (id) => {
    const before = doneIds;
    const next = before.includes(id) ? before.filter(d => d !== id) : [...before, id];
    setPlan(p => ({ ...p, done_items: next }));
    try { await api.plans.setDone(plan.plan_id, next); } catch (e) { setPlan(p => ({ ...p, done_items: before })); setError({ message: e.message }); }
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
          <Text variant="label" tone={error.premium ? 'accent' : 'danger'}>{error.premium ? 'Tính năng Premium' : 'Có lỗi'}</Text>
          <Text tone="dim">{error.message}</Text>
          {error.premium ? <Text variant="caption" tone="faint">Premium mở lịch tập AI và 50 lượt AI mỗi ngày.</Text> : null}
        </Surface>
      ) : null}

      {plan && !showForm ? (
        <>
          <Surface radius={radius.lg} style={styles.card}>
            <Text variant="caption" tone="accent">{plan.status === 'done' ? 'Đã tập xong' : `Khoảng ${plan.estimated_minutes} phút · khởi động ${plan.warmup_minutes} phút`}</Text>
            <Text variant="heading">{plan.title}</Text>
            {plan.tip ? <Text tone="dim">{plan.tip}</Text> : null}
            {plan.notice ? <Text variant="caption" tone="faint">{plan.notice}</Text> : null}
            {plan.status !== 'done' ? <Text variant="caption" tone="dim">{doneIds.length}/{plan.items.length} bài xong · vuốt bài sang trái để đánh dấu</Text> : null}
          </Surface>
          {plan.status === 'done' && plan.after ? (
            <Surface radius={radius.lg} style={styles.card}>
              <Text variant="caption" tone="accent">Coach gợi ý sau buổi tập</Text>
              {plan.after.tips.map(t => (
                <View key={t.title} style={styles.tip}>
                  <View style={styles.tipIcon}><Ionicons name={t.icon} size={18} color={colors.accent} /></View>
                  <View style={styles.flex}><Text variant="label">{t.title}</Text><Text tone="dim">{t.text}</Text></View>
                </View>
              ))}
              {scheduled ? <Text variant="caption" tone="faint">Đã hẹn {scheduled} lời nhắc: tắm sau {plan.after.reminders[0].in_minutes} phút, ăn sau {plan.after.reminders[1].in_minutes} phút.</Text> : null}
            </Surface>
          ) : null}
          {plan.items.map((it, i) => (
            <SwipeToDone key={it.exercise_id} done={doneIds.includes(it.exercise_id)} disabled={plan.status === 'done'} onToggle={() => toggle(it.exercise_id)}>
            <Surface radius={radius.md} style={[styles.exercise, doneIds.includes(it.exercise_id) && styles.doneRow]}>
              {it.gif_url && !broken[it.exercise_id] ? (
                <Image source={{ uri: it.gif_url }} style={styles.gif} contentFit="cover" transition={200}
                  onError={() => setBroken(b => ({ ...b, [it.exercise_id]: true }))} accessibilityLabel={`Minh họa ${it.name}`} />
              ) : <View style={[styles.gif, styles.noGif]}><Ionicons name="barbell" size={30} color={colors.textFaint} /></View>}
              <View style={styles.flex}>
                <Text variant="label" numberOfLines={2}>{i + 1}. {it.name}</Text>
                {it.target ? <Text variant="caption" tone="faint">{it.target}</Text> : null}
                <Text variant="label" tone="dim">{it.sets} hiệp × {it.reps} · nghỉ {it.rest_seconds}s</Text>
              </View>
              {doneIds.includes(it.exercise_id) ? <Ionicons name="checkmark-circle" size={26} color={colors.accent} /> : null}
            </Surface>
            </SwipeToDone>
          ))}
          {plan.status !== 'done' ? <Button title={allDone ? 'Hoàn thành buổi tập' : 'Đã tập xong'} onPress={finish} loading={busy === 'done'} disabled={!!busy} style={styles.gap} /> : null}
          <Button title="Tạo lịch khác" variant="glass" onPress={() => setShowForm(true)} style={styles.gap} />
        </>
      ) : form}
    </Screen>
    <AskCoach context="workout" title="Lịch tập, kỹ thuật, phục hồi" starters={COACH_STARTERS} onDone={load} />
    </>
  );
}

const styles = StyleSheet.create({
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
  gap: { marginTop: 10 },
});
