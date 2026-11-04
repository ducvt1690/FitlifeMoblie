import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
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
    try { await api.plans.complete(plan.plan_id); await load(); } catch (e) { setError({ message: e.message }); } finally { setBusy(''); }
  };

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
          </Surface>
          {plan.items.map((it, i) => (
            <Surface key={it.exercise_id} radius={radius.md} style={styles.exercise}>
              <Image source={{ uri: it.gif_url }} style={styles.gif} contentFit="cover" transition={200}
                accessibilityLabel={`Minh họa ${it.name}`} />
              <View style={styles.flex}>
                <Text variant="label" numberOfLines={2}>{i + 1}. {it.name}</Text>
                {it.target ? <Text variant="caption" tone="faint">{it.target}</Text> : null}
                <Text variant="label" tone="dim">{it.sets} hiệp × {it.reps} · nghỉ {it.rest_seconds}s</Text>
              </View>
            </Surface>
          ))}
          {plan.status !== 'done' ? <Button title="Đã tập xong" onPress={finish} loading={busy === 'done'} disabled={!!busy} style={styles.gap} /> : null}
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
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, marginBottom: 8 },
  gif: { width: 76, height: 76, borderRadius: 12, backgroundColor: '#fff' },
  flex: { flex: 1, gap: 2 },
  gap: { marginTop: 10 },
});
