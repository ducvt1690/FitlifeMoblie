import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from './Surface';
import Text from './Text';
import { PressScale } from './Button';
import { colors, fonts, radius, themed } from '../theme/tokens';

// Big number with −/+ buttons; the number itself is also typeable. Out-of-range input snaps back on blur.
export default function NumberStepper({ label, value, onChange, min, max, step = 1, unit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (n) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const n = Number(draft.replace(',', '.'));
    if (draft.trim() && Number.isFinite(n)) {
      const next = clamp(Math.round(n));
      onChange(next);
      setDraft(String(next));
    } else setDraft(String(value));
  };
  const nudge = (d) => onChange(clamp(value + d));
  return (
    <Surface radius={radius.md} style={styles.box}>
      <Text variant="label" tone="dim" style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <PressScale onPress={() => nudge(-step)} disabled={value <= min} accessibilityLabel={`Giảm ${label}`} hitSlop={6}>
          <View style={styles.btn}><Ionicons name="remove" size={20} color={colors.text} /></View>
        </PressScale>
        <View style={styles.valueWrap}>
          <TextInput value={draft} onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit}
            keyboardType="number-pad" returnKeyType="done" selectTextOnFocus maxLength={3}
            selectionColor={colors.accent} style={styles.value} accessibilityLabel={label} />
          {unit && <Text variant="caption" tone="faint">{unit}</Text>}
        </View>
        <PressScale onPress={() => nudge(step)} disabled={value >= max} accessibilityLabel={`Tăng ${label}`} hitSlop={6}>
          <View style={styles.btn}><Ionicons name="add" size={20} color={colors.text} /></View>
        </PressScale>
      </View>
    </Surface>
  );
}

const styles = themed(() => StyleSheet.create({
  box: { paddingHorizontal: 12, paddingVertical: 12 },
  label: { marginBottom: 4, marginLeft: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  valueWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  value: { color: colors.text, fontFamily: fonts.display, fontSize: 34, minWidth: 48, maxWidth: 72, textAlign: 'center', padding: 0, outlineStyle: 'none' },
}));
