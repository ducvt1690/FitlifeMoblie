import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

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
  progressPercent = null,
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onPress ? 0.85 : 0.95}
      onPress={onPress || onAction}
    >
      <View style={styles.topRow}>
        <View style={styles.labelGroup}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={17} color={iconColor} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>

        {actionLabel && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: iconBg }]}
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

      <View style={styles.bottomSection}>
        {subtext ? (
          <Text style={styles.subtext} numberOfLines={1}>
            {subtext}
          </Text>
        ) : null}

        {typeof progressPercent === 'number' && (
          <View style={styles.miniTrack}>
            <View
              style={[
                styles.miniFill,
                {
                  width: `${Math.min(100, Math.max(4, progressPercent))}%`,
                  backgroundColor: iconColor,
                },
              ]}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-between',
    minHeight: 128,
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
    width: 34,
    height: 34,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    marginVertical: 3,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  bottomSection: {
    marginTop: 4,
    gap: 6,
  },
  subtext: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  miniTrack: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 3,
  },
});
