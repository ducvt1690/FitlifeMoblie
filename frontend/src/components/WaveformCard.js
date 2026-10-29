import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';

export default function WaveformCard({ progress = 70, message = 'Tiến độ hôm nay rất tốt!' }) {
  const barHeights = [
    12, 18, 8, 22, 14, 28, 16, 24, 10, 32, 20, 14, 26, 18, 30, 12, 22, 16, 28, 14, 20, 10, 18, 12,
  ];

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.userSection}>
          <View style={styles.avatarWrap}>
            <Ionicons name="pulse" size={16} color={COLORS.black} />
          </View>
          <View>
            <Text style={styles.eyebrowText}>CHỈ SỐ HOẠT ĐỘNG NGÀY</Text>
            <Text style={styles.userMessage}>{message}</Text>
          </View>
        </View>

        <View style={styles.percentBadge}>
          <Text style={styles.percentText}>{progress}%</Text>
        </View>
      </View>

      {/* Waveform graphic */}
      <View style={styles.waveformContainer}>
        {barHeights.map((h, idx) => (
          <View
            key={idx}
            style={[
              styles.waveBar,
              {
                height: h,
                opacity: idx < (barHeights.length * progress) / 100 ? 0.9 : 0.28,
              },
            ]}
          />
        ))}
      </View>

      {/* Thick Progress bar */}
      <View style={styles.track}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.lime,
    borderRadius: 24,
    padding: 18,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#A3E635',
    ...SHADOWS.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  eyebrowText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#365314',
    letterSpacing: 0.6,
  },
  userMessage: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
    marginTop: 1,
  },
  percentBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  percentText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: COLORS.black,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  waveBar: {
    width: 3.5,
    backgroundColor: '#1A2E05',
    borderRadius: 2,
  },
  track: {
    height: 9,
    backgroundColor: 'rgba(26, 46, 5, 0.16)',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.black,
    borderRadius: 5,
  },
});
