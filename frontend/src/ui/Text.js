import { Text as RNText } from 'react-native';
import { colors, type } from '../theme/tokens';
import { useLayout } from '../theme/useLayout';

// <Text variant="title" tone="dim">: typography scale from tokens, scaled for the screen size.
export default function Text({ variant = 'body', tone = 'default', color, align, style, ...rest }) {
  const { fs } = useLayout();
  const t = type[variant] ?? type.body;
  const toneColor = { default: colors.text, dim: colors.textDim, faint: colors.textFaint, accent: colors.accentText, danger: colors.danger }[tone];
  return (
    <RNText maxFontSizeMultiplier={1.4}
      style={[{ fontFamily: t.font, fontSize: fs(t.size), lineHeight: fs(t.line), letterSpacing: t.tracking,
        color: color ?? toneColor, textAlign: align }, style]}
      {...rest} />
  );
}
