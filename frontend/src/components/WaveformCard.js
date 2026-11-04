import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SIZES } from '../constants/theme';

export default function WaveformCard({
  progress = 0,
  message = 'Duy trì nhịp độ rèn luyện rất tốt!',
  questStat = null,
  waterStat = null,
  stepStat = null,
}) {
  const barHeights = [
    12, 20, 10, 24, 15, 30, 18, 26, 12, 34, 22, 16, 28, 19, 32, 14, 24, 17, 29, 15, 22, 12, 19, 14,
  ];

  const activeBarsCount = Math.max(
    1,
    Math.round((barHeights.length * Math.min(100, Math.max(0, progress))) / 100)
  );

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.userSection}>
          <View style={styles.avatarWrap}>
            <Ionicons name="pulse" size={18} color={COLORS.lime} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrowText}>ĐIỂM NĂNG LƯỢNG HÔM NAY</Text>
            <Text style={styles.userMessage} numberOfLines={1}>
              {message}
            </Text>
          </View>
        </View>

        <View style={styles.percentBadge}>
          <Text style={styles.percentText}>{progress}%</Text>
          <Ionicons name="chevron-forward" size={12} color={COLORS.lime} />
        </View>
      </View>

      {/* Waveform graphic */}
      <View style={styles.waveformContainer}>
        {barHeights.map((h, idx) => {
          const isFilled = idx < activeBarsCount && progress > 0;
          return (
            <View
              key={idx}
              style={[
                styles.waveBar,
                {
                  height: h,
                  backgroundColor: isFilled ? '#0F172A' : 'rgba(15, 23, 42, 0.2)',
                },
              ]}
            />
          );
        })}
      </View>

      {/* Thick Progress bar */}
      <View style={styles.track}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, Math.max(3, progress))}%` },
          ]}
        />
      </View>

      {/* Bottom Mini Pillar Pills */}
      {(questStat || waterStat || stepStat) && (
        <View style={styles.pillarRow}>
          {questStat ? (
            <View style={styles.pillarChip}>
              <Ionicons name="trophy" size={11} color="#365314" />
              <Text style={styles.pillarText}>Nhiệm vụ: {questStat}</Text>
            </View>
          ) : null}
          {waterStat ? (
            <View style={styles.pillarChip}>
              <Ionicons name="water" size={11} color="#365314" />
              <Text style={styles.pillarText}>{waterStat}</Text>
            </View>
          ) : null}
          {stepStat ? (
            <View style={styles.pillarChip}>
              <Ionicons name="walk" size={11} color="#365314" />
              <Text style={styles.pillarText}>{stepStat}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.lime,
    borderRadius: 26,
    padding: 18,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#A3E635',
    ...SHADOWS.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrowText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#365314',
    letterSpacing: 0.7,
  },
  userMessage: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
    marginTop: 2,
  },
  percentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.black,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.lime,
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
    width: 4,
    borderRadius: 2.5,
  },
  track: {
    height: 8,
    backgroundColor: 'rgba(26, 46, 5, 0.16)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.black,
    borderRadius: 4,
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 6,
  },
  pillarChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  pillarText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1A2E05',
  },
});
