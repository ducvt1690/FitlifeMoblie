import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

export default function MetricCard({
  icon,
  iconColor = COLORS.danger,
  iconBg = '#FEE2E2',
  label,
  value,
  unit,
  subtext,
  actionLabel,
  onAction,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.labelGroup}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={16} color={iconColor} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>

        {actionLabel && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: iconColor, backgroundColor: iconBg }]}
            onPress={onAction || onPress}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionBtnText, { color: iconColor }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
    minHeight: 116,
    ...SHADOWS.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
    flexShrink: 1,
  },
  actionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 2,
  },
  value: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.4,
  },
  unit: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  subtext: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
});
