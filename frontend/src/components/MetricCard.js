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
          <Text style={styles.label}>{label}</Text>
        </View>

        {actionLabel && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: iconColor }]}
            onPress={onAction || onPress}
            activeOpacity={0.7}
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
    padding: 15,
    borderWidth: 1,
    borderColor: '#E8EBE5',
    justifyContent: 'space-between',
    minHeight: 110,
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
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  subtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
});
