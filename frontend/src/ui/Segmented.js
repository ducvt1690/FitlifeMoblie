import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Surface from './Surface';
import Text from './Text';
import { PressScale } from './Button';
import { colors, radius, themed } from '../theme/tokens';

// Choice chips. options: [{ value, label, hint?, icon? }]. `stacked` lays them out as full-width rows.
export default function Segmented({ options, value, onChange, stacked = false }) {
  return (
    <View style={stacked ? styles.stack : styles.row} accessibilityRole="radiogroup">
      {options.map(o => {
        const on = o.value === value;
        return (
          <PressScale key={o.value} onPress={() => onChange(o.value)} containerStyle={stacked ? null : styles.cell}
            accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}>
            <Surface radius={radius.sm} raised={on} style={[stacked ? styles.wide : styles.chip, on && styles.on]}>
              {o.icon && <Ionicons name={o.icon} size={20} color={on ? colors.text : colors.textDim} />}
              <View style={stacked ? { flex: 1 } : null}>
                <Text variant="label" tone={on ? 'default' : 'dim'} align={stacked ? 'left' : 'center'}>{o.label}</Text>
                {o.hint && <Text variant="caption" tone="faint">{o.hint}</Text>}
              </View>
              {stacked && <View style={[styles.radio, on && styles.radioOn]} />}
            </Surface>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  stack: { gap: 10 },
  chip: { minHeight: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 10 },
  wide: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  on: { borderColor: colors.text, borderWidth: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.textFaint },
  radioOn: { borderWidth: 6, borderColor: colors.accent },
}));
