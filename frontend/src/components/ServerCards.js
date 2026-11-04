import React from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';
import { RemoteState } from './RemoteState';
export function Page({
  title,
  subtitle,
  state,
  children
}) {
  return <ScrollView style={s.page} contentContainerStyle={s.content}><Text accessibilityRole="header" style={s.title}>{title}</Text>{!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}<RemoteState {...state} onRetry={state?.reload} />{children}</ScrollView>;
}
export function Card({
  title,
  children
}) {
  return <View style={s.card}>{!!title && <Text style={s.heading}>{title}</Text>}{children}</View>;
}
export function Action({
  title,
  onPress,
  disabled = false
}) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{
    disabled
  }} disabled={disabled} onPress={onPress} style={[s.button, disabled && {
    opacity: 0.45
  }]}><Text style={s.label}>{title}</Text></TouchableOpacity>;
}
export function Input({
  label,
  ...props
}) {
  return <View style={{
    gap: 5
  }}><Text>{label}</Text><TextInput accessibilityLabel={label} style={s.input} {...props} /></View>;
}
const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 115
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.black
  },
  subtitle: {
    color: COLORS.textSecondary
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    gap: 10,
    ...SHADOWS.card
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black
  },
  button: {
    backgroundColor: COLORS.lime,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center'
  },
  label: {
    color: COLORS.black,
    fontWeight: '700'
  },
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    color: COLORS.black
  }
});
