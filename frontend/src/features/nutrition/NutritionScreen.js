import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Screen from '../../ui/Screen';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import TextField from '../../ui/TextField';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';
import { colors, fonts, radius } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import AskCoach from '../coach/AskCoach';

const COACH_STARTERS = ['Gợi ý bữa tiếp theo cho mình', 'Trưa nay mình ăn 1 tô phở bò', 'Còn thiếu bao nhiêu đạm?', 'Mình dị ứng tôm'];

const fmt = (n) => Math.round(n ?? 0).toLocaleString('vi-VN');
const r1 = (n) => Math.round(n * 10) / 10;
const MEAL_TYPES = [
  { value: 'breakfast', label: 'Sáng' }, { value: 'lunch', label: 'Trưa' },
  { value: 'dinner', label: 'Tối' }, { value: 'snack', label: 'Phụ' },
];
const TYPE_LABEL = Object.fromEntries(MEAL_TYPES.map(t => [t.value, t.label]));
const MACROS = [
  { key: 'protein', label: 'Đạm', color: colors.move },
  { key: 'carbs', label: 'Tinh bột', color: colors.calories },
  { key: 'fat', label: 'Chất béo', color: colors.water },
];
const typeByHour = () => {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 17 ? 'snack' : h < 21 ? 'dinner' : 'snack';
};
const scaled = (item, grams) => item.per100
  ? { ...item, grams, calories: Math.round(item.per100.kcal * grams / 100), protein: r1(item.per100.protein * grams / 100),
    carbs: r1(item.per100.carbs * grams / 100), fat: r1(item.per100.fat * grams / 100) }
  : { ...item, grams };

function Bar({ value, target, color }) {
  const pct = target ? Math.min(value / target, 1) : 0;
  return <View style={styles.track}><View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} /></View>;
}

export default function NutritionScreen() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [manual, setManual] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [mealType, setMealType] = useState(typeByHour);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [info, setInfo] = useState('');
  const [allergy, setAllergy] = useState('');

  const load = useCallback(async () => {
    try { setData(await api.nutrition.today()); setError(''); } catch (e) { setError(e.message); }
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (key, fn) => {
    setBusy(key); setNotice(''); setInfo('');
    try { await fn(); } catch (e) { setNotice(e.message); } finally { setBusy(''); }
  };

  const parse = () => run('parse', async () => {
    const res = await api.nutrition.parse(text.trim());
    setParsed(res);
    setManual({ calories: '', protein: '', carbs: '', fat: '' });
    if (res.message) setInfo(res.message);
  });

  const items = parsed?.items ?? [];
  const extra = Object.fromEntries(Object.entries(manual).map(([k, v]) => [k, Number(String(v).replace(',', '.')) || 0]));
  const total = (k) => r1(items.reduce((s, i) => s + i[k], 0) + extra[k]);
  const canSave = items.length > 0 || extra.calories > 0;

  const save = () => run('save', async () => {
    const names = [...items.map(i => `${i.grams}g ${i.name}`), ...(parsed?.unknown ?? [])].join(', ') || text.trim();
    await api.nutrition.addMeal({ meal_name: [...names].slice(0, 150).join(''), meal_type: mealType,
      calories: Math.max(Math.round(total('calories')), 1), protein: total('protein'), carbs: total('carbs'), fat: total('fat') });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setParsed(null); setText('');
    await load();
  });

  const allergies = data?.allergies ?? [];
  const saveAllergies = (list) => run('allergy', async () => {
    const res = await api.nutrition.setAllergies(list);
    setData(d => ({ ...d, allergies: res.allergies })); setAllergy('');
  });

  const suggestion = data?.suggestion;
  const c = data?.consumed ?? {};
  const t = data?.targets ?? {};

  return (
    <>
    <Screen tabBar refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <Text variant="title" style={styles.title}>Ăn uống</Text>
      {error ? <Text tone="danger" style={styles.gap}>{error}</Text> : null}

      <Surface radius={radius.lg} style={styles.macroBox}>
        <View style={styles.rowBetween}>
          <Text variant="label" tone="dim">Năng lượng hôm nay</Text>
          {data?.completed ? <Text variant="caption" tone="accent">Đã hoàn thành</Text> : null}
        </View>
        <Text variant="metric">{fmt(c.calories)}<Text variant="label" tone="faint"> / {fmt(t.calories)} kcal</Text></Text>
        <Bar value={c.calories ?? 0} target={t.calories} color={colors.accent} />
        <View style={styles.macroRow}>
          {MACROS.map(m => (
            <View key={m.key} style={styles.macro}>
              <Text variant="caption" tone="dim">{m.label}</Text>
              <Text variant="label">{fmt(c[m.key])}<Text variant="caption" tone="faint"> / {fmt(t[m.key])} g</Text></Text>
              <Bar value={c[m.key] ?? 0} target={t[m.key]} color={m.color} />
            </View>
          ))}
        </View>
      </Surface>

      <Surface radius={radius.md} style={styles.card}>
        <Text variant="label">Dị ứng thực phẩm</Text>
        {allergies.length ? (
          <View style={styles.chips}>
            {allergies.map(a => (
              <Pressable key={a} style={styles.chip} disabled={!!busy} accessibilityLabel={`Bỏ dị ứng ${a}`}
                onPress={() => saveAllergies(allergies.filter(x => x !== a))}>
                <Text variant="caption">{a}</Text>
                <Ionicons name="close" size={14} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        ) : <Text variant="caption" tone="faint">Chưa có. Gợi ý bữa ăn sẽ tránh các món bạn thêm ở đây.</Text>}
        <View style={styles.addRow}>
          <TextField value={allergy} onChangeText={setAllergy} placeholder="VD: hải sản, sữa, đậu phộng" style={styles.flex}
            returnKeyType="done" onSubmitEditing={() => allergy.trim() && saveAllergies([...allergies, allergy.trim()])} />
          <Button title="Thêm" variant="glass" loading={busy === 'allergy'} disabled={!allergy.trim() || !!busy}
            onPress={() => saveAllergies([...allergies, allergy.trim()])} />
        </View>
      </Surface>

      <Text variant="heading" style={styles.section}>Bạn vừa ăn gì?</Text>
      <TextField value={text} onChangeText={setText} placeholder="VD: 300g ức gà, 1 bát cơm, 2 quả trứng" multiline
        returnKeyType="done" onSubmitEditing={() => text.trim() && parse()} />
      <Button title="Tính macro" onPress={parse} loading={busy === 'parse'} disabled={!text.trim() || !!busy} style={styles.gapTop} />
      {data?.ai ? (
        <Text variant="caption" tone="faint" style={styles.hint}>
          {data.ai.enabled ? `AI đã dùng ${data.ai.used}/${data.ai.limit} lượt hôm nay${data.ai.premium ? ' · Premium' : ''}` : 'Đang dùng bảng món ăn có sẵn'}
        </Text>
      ) : null}
      {notice ? <Text variant="label" tone="danger" style={styles.gap}>{notice}</Text> : null}
      {info ? <Text variant="label" tone="dim" style={styles.gap}>{info}</Text> : null}

      {parsed ? (
        <Surface radius={radius.md} style={styles.card}>
          {parsed.warnings?.map(w => <Text key={w} variant="label" tone="danger">{w}</Text>)}
          {items.map((it, idx) => (
            <View key={`${it.name}-${idx}`} style={styles.itemRow}>
              <View style={styles.flex}>
                <Text variant="label" tone={it.allergen ? 'danger' : undefined}>{it.name}{it.allergen ? ` · dị ứng ${it.allergen}` : ''}</Text>
                <Text variant="caption" tone="dim">{fmt(it.calories)} kcal · Đ {it.protein} · TB {it.carbs} · B {it.fat}</Text>
              </View>
              <TextInput value={String(it.grams)} keyboardType="numeric" style={styles.grams} selectionColor={colors.accent}
                accessibilityLabel={`Số gram ${it.name}`}
                onChangeText={(v) => setParsed(p => ({ ...p, items: p.items.map((x, j) => (j === idx ? scaled(x, Number(v.replace(/\D/g, '')) || 0) : x)) }))} />
              <Text variant="caption" tone="faint">g</Text>
              <Pressable hitSlop={10} accessibilityLabel={`Bỏ ${it.name}`}
                onPress={() => setParsed(p => ({ ...p, items: p.items.filter((_, j) => j !== idx) }))}>
                <Ionicons name="close" size={18} color={colors.textFaint} />
              </Pressable>
            </View>
          ))}
          {parsed.unknown?.length ? (
            <View style={styles.manual}>
              <Text variant="caption" tone="dim">Nhập tay cho: {parsed.unknown.join(', ')}</Text>
              <View style={styles.manualRow}>
                {[['calories', 'kcal'], ['protein', 'Đạm'], ['carbs', 'TB'], ['fat', 'Béo']].map(([k, label]) => (
                  <TextField key={k} label={label} value={manual[k]} keyboardType="numeric" style={styles.flex}
                    onChangeText={(v) => setManual(m => ({ ...m, [k]: v }))} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.rowBetween}>
            <Text variant="label" tone="dim">Tổng</Text>
            <Text variant="label">{fmt(total('calories'))} kcal · Đ {total('protein')} · TB {total('carbs')} · B {total('fat')}</Text>
          </View>
          <Segmented options={MEAL_TYPES} value={mealType} onChange={setMealType} />
          <Button title="Lưu bữa ăn" onPress={save} loading={busy === 'save'} disabled={!canSave || !!busy} />
        </Surface>
      ) : null}

      {!data?.completed ? (
        <>
          <Text variant="heading" style={styles.section}>Gợi ý bữa tiếp theo</Text>
          {suggestion ? (
            <Surface radius={radius.md} style={styles.card}>
              <Text variant="caption" tone="accent">{TYPE_LABEL[suggestion.meal_type]} · {fmt(suggestion.calories)} kcal</Text>
              <Text variant="heading">{suggestion.meal_name.charAt(0).toUpperCase() + suggestion.meal_name.slice(1)}</Text>
              {suggestion.note ? <Text tone="dim">{suggestion.note}</Text> : null}
              {suggestion.items.map((it, i) => (
                <Text key={i} variant="label" tone="dim">• {it.grams}g {it.name} — {fmt(it.calories)} kcal</Text>
              ))}
              <Text variant="caption" tone="faint">Đạm {suggestion.protein} g · Tinh bột {suggestion.carbs} g · Béo {suggestion.fat} g</Text>
              <View style={styles.buttons}>
                <Button title="Đã ăn" loading={busy === 'eat'} disabled={!!busy}
                  onPress={() => run('eat', async () => { await api.nutrition.eat(suggestion.suggestion_id); await load(); })} />
                <Button title="Gợi ý khác" variant="ghost" loading={busy === 'suggest'} disabled={!!busy}
                  onPress={() => run('suggest', async () => { await api.nutrition.suggest(); await load(); })} />
              </View>
            </Surface>
          ) : (
            <Surface radius={radius.md} style={styles.card}>
              <Text tone="dim">
                {(data?.remaining?.calories ?? 0) < 100 ? 'Bạn đã ăn gần đủ mục tiêu hôm nay.'
                  : `Còn ${fmt(data?.remaining?.calories)} kcal và ${fmt(data?.remaining?.protein)} g đạm. Gợi ý sẽ là bữa nhẹ nếu đã muộn, bữa chính nếu còn sớm.`}
              </Text>
              {(data?.remaining?.calories ?? 0) >= 100 ? (
                <Button title="Gợi ý cho tôi" variant="glass" loading={busy === 'suggest'} disabled={!!busy}
                  onPress={() => run('suggest', async () => {
                    const res = await api.nutrition.suggest();
                    if (res.message) setInfo(res.message);
                    await load();
                  })} />
              ) : null}
            </Surface>
          )}
        </>
      ) : null}

      <Text variant="heading" style={styles.section}>Đã ăn hôm nay</Text>
      {data?.meals?.length ? data.meals.map(m => (
        <Surface key={m.meal_id} radius={radius.sm} style={styles.mealRow}>
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={2}>{m.meal_name}</Text>
            <Text variant="caption" tone="dim">{TYPE_LABEL[m.meal_type]} · Đ {r1(m.protein)} · TB {r1(m.carbs)} · B {r1(m.fat)}</Text>
          </View>
          <Text variant="label">{fmt(m.calories)} kcal</Text>
          <Pressable hitSlop={10} accessibilityLabel={`Xóa ${m.meal_name}`}
            onPress={() => run('del', async () => { await api.nutrition.removeMeal(m.meal_id); await load(); })}>
            <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
          </Pressable>
        </Surface>
      )) : <Text tone="faint">Chưa có bữa nào.</Text>}

      <Button title={data?.completed ? 'Mở lại ngày hôm nay' : 'Hoàn thành ngày hôm nay'} variant={data?.completed ? 'glass' : 'primary'}
        style={styles.section} loading={busy === 'day'} disabled={!data || !!busy}
        onPress={() => run('day', async () => {
          await api.nutrition.setDay(!data.completed);
          if (!data.completed) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          await load();
        })} />
    </Screen>
    <AskCoach context="nutrition" title="Bữa ăn, macro, dị ứng" starters={COACH_STARTERS} onDone={load} />
    </>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 16 },
  gap: { marginTop: 8 },
  gapTop: { marginTop: 10 },
  hint: { marginTop: 8, marginLeft: 4 },
  section: { marginTop: 26, marginBottom: 10 },
  macroBox: { padding: 18, gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  macroRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  macro: { flex: 1, gap: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  card: { padding: 16, gap: 12, marginTop: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  grams: { width: 64, minHeight: 40, textAlign: 'right', color: colors.text, fontFamily: fonts.semibold, fontSize: 16,
    paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.field, outlineStyle: 'none' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.track },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manual: { gap: 8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  buttons: { gap: 4 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8 },
});
