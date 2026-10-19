import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';

export default function WaveformCard({ progress = 70, message = "You're doing well" }) {
  // Waveform bars pattern matching the image
  const barHeights = [
    12, 18, 8, 22, 14, 28, 16, 24, 10, 32, 20, 14, 26, 18, 30, 12, 22, 16, 28, 14, 20, 10, 18, 12
  ];

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.userSection}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person" size={16} color={COLORS.black} />
          </View>
          <Text style={styles.userMessage}>{message}</Text>
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
                opacity: idx < (barHeights.length * progress) / 100 ? 0.85 : 0.35,
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
    marginVertical: 14,
    ...SHADOWS.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  userMessage: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.black,
  },
  percentBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
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
    height: 38,
    marginVertical: 6,
    paddingHorizontal: 4,
  },
  waveBar: {
    width: 3.5,
    backgroundColor: '#1C3304',
    borderRadius: 2,
  },
  track: {
    height: 10,
    backgroundColor: '#9ED62F',
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.black,
    borderRadius: 5,
  },
});
