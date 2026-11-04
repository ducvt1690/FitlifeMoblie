import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import { colors, fonts, radius } from '../theme/tokens';

// Labelled input. `secure` adds a show/hide toggle; `error` shows a message under the field.
const TextField = forwardRef(function TextField({ label, error, secure, suffix, style, onFocus, onBlur, ...input }, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={style}>
      {label && <Text variant="caption" tone="dim" style={styles.label}>{label}</Text>}
      <View style={[styles.box, focused && styles.focused, error && styles.errored]}>
        <TextInput ref={ref} placeholderTextColor={colors.textFaint} selectionColor={colors.accent}
          secureTextEntry={secure && hidden} style={styles.input}
          {...input}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }} />
        {suffix && <Text variant="label" tone="faint" style={styles.suffix}>{suffix}</Text>}
        {secure && (
          <Pressable onPress={() => setHidden(h => !h)} hitSlop={12} accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textDim} />
          </Pressable>
        )}
      </View>
      {error ? <Text variant="caption" tone="danger" style={styles.error}>{error}</Text> : null}
    </View>
  );
});
export default TextField;

const styles = StyleSheet.create({
  label: { marginBottom: 6, marginLeft: 4 },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 16, gap: 10, borderRadius: radius.sm,
    backgroundColor: colors.field, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.stroke },
  focused: { borderColor: colors.textDim },
  errored: { borderColor: colors.danger },
  input: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 17, paddingVertical: 14, outlineStyle: 'none' },
  suffix: { marginLeft: 4 },
  error: { marginTop: 6, marginLeft: 4 },
});
