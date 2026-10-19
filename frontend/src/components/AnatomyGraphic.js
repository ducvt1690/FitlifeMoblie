import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function AnatomyGraphic() {
  return (
    <View style={styles.container}>
      {/* Background Bio-Scanner Grid & Glow Rings */}
      <View style={styles.radarRingOuter} />
      <View style={styles.radarRingInner} />

      {/* Cyber/Athletic Silhouette */}
      <View style={styles.bodyWrap}>
        {/* Head with Neon Scan Visor */}
        <View style={styles.head}>
          <View style={styles.visorLine} />
        </View>

        {/* Neck */}
        <View style={styles.neck} />

        {/* Athletic Shoulders & Torso */}
        <View style={styles.torso}>
          {/* Deltoids & Chest */}
          <View style={styles.chestRow}>
            <View style={styles.deltoid} />
            <View style={styles.pecs}>
              <View style={styles.pec} />
              <View style={styles.pec} />
              {/* Heart rate glowing pulse node */}
              <View style={styles.heartPulseNode}>
                <View style={styles.heartPulseCore} />
              </View>
            </View>
            <View style={styles.deltoid} />
          </View>

          {/* Core / V-Taper Abs */}
          <View style={styles.absCore}>
            <View style={styles.abRow}>
              <View style={styles.abItem} />
              <View style={styles.abItem} />
            </View>
            <View style={styles.abRow}>
              <View style={styles.abItem} />
              <View style={styles.abItem} />
            </View>
            <View style={styles.abRow}>
              <View style={styles.abItemSmall} />
              <View style={styles.abItemSmall} />
            </View>
          </View>

          {/* Arms / Silhouette */}
          <View style={[styles.arm, styles.armLeft]} />
          <View style={[styles.arm, styles.armRight]} />
        </View>

        {/* Waist & Hips */}
        <View style={styles.waist} />
      </View>

      {/* Live Biometric Tag */}
      <View style={styles.bioBadge}>
        <View style={styles.pulseDot} />
        <Text style={styles.bioBadgeText}>READY • 98%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 130,
    height: 165,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarRingOuter: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: 'rgba(184, 242, 62, 0.25)',
    borderStyle: 'dashed',
  },
  radarRingInner: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(184, 242, 62, 0.08)',
  },
  bodyWrap: {
    alignItems: 'center',
    zIndex: 2,
    position: 'relative',
  },
  head: {
    width: 24,
    height: 28,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  visorLine: {
    width: 14,
    height: 2.5,
    backgroundColor: COLORS.lime,
    borderRadius: 1,
    marginTop: 2,
  },
  neck: {
    width: 10,
    height: 6,
    backgroundColor: '#334155',
    marginTop: -1,
  },
  torso: {
    alignItems: 'center',
    position: 'relative',
  },
  chestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -1,
  },
  deltoid: {
    width: 14,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#334155',
  },
  pecs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: '#475569',
    position: 'relative',
  },
  pec: {
    width: 18,
    height: 18,
    backgroundColor: '#0F172A',
    borderRadius: 6,
  },
  heartPulseNode: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartPulseCore: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },
  absCore: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2.5,
    gap: 2,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  abRow: {
    flexDirection: 'row',
    gap: 2.5,
  },
  abItem: {
    width: 14,
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 2.5,
  },
  abItemSmall: {
    width: 11,
    height: 7,
    backgroundColor: '#0F172A',
    borderRadius: 2,
  },
  arm: {
    position: 'absolute',
    top: 14,
    width: 10,
    height: 44,
    backgroundColor: '#1E293B',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#334155',
  },
  armLeft: {
    left: -8,
  },
  armRight: {
    right: -8,
  },
  waist: {
    width: 22,
    height: 8,
    backgroundColor: '#334155',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    marginTop: 1,
  },
  bioBadge: {
    position: 'absolute',
    bottom: -4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.black,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(184, 242, 62, 0.4)',
    zIndex: 5,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.lime,
  },
  bioBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: COLORS.lime,
    letterSpacing: 0.6,
  },
});
