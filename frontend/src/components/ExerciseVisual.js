import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function ExerciseVisual({
  animationType = 'shadow_boxing',
  isPlaying = true,
  size = 'large', // 'small' | 'large'
  phase = 'work', // 'work' | 'rest'
}) {
  // Animation controllers
  const cycleAnim = useRef(new Animated.Value(0)).current;
  const punchAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const isSmall = size === 'small';
  const containerHeight = isSmall ? 100 : 210;

  useEffect(() => {
    if (!isPlaying || phase === 'rest') {
      cycleAnim.setValue(0);
      punchAnim.setValue(0);
      bounceAnim.setValue(0);
      return;
    }

    // Main smooth loop for body motion
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(cycleAnim, {
          toValue: 1,
          duration: animationType === 'mountain_climbers' ? 450 : 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cycleAnim, {
          toValue: 0,
          duration: animationType === 'mountain_climbers' ? 450 : 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // Punch & Strike quick snap loop
    const punch = Animated.loop(
      Animated.sequence([
        Animated.timing(punchAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(punchAnim, {
          toValue: 0,
          duration: 450,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // Footwork & bounce loop
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    cycle.start();
    punch.start();
    bounce.start();

    return () => {
      cycle.stop();
      punch.stop();
      bounce.stop();
    };
  }, [isPlaying, phase, animationType]);

  // Render specific animated exercise graphic
  const renderGraphic = () => {
    if (phase === 'rest') {
      return (
        <View style={styles.restCenterWrap}>
          <View style={styles.restCircle}>
            <Ionicons name="leaf-outline" size={isSmall ? 28 : 46} color={COLORS.primary} />
          </View>
          <Text style={[styles.restPrompt, isSmall && { fontSize: 11 }]}>
            Hít sâu bằng mũi, thở chậm bằng miệng
          </Text>
        </View>
      );
    }

    switch (animationType) {
      case 'shadow_boxing': {
        const jabTranslate = punchAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, isSmall ? 30 : 65],
        });
        const crossTranslate = punchAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, isSmall ? -25 : -55],
        });
        const bobTranslate = bounceAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        });

        return (
          <Animated.View
            style={[styles.boxerContainer, { transform: [{ translateY: bobTranslate }] }]}
          >
            {/* Fighter Head & Guard */}
            <View style={styles.fighterHead}>
              <View style={styles.fighterHair} />
              <View style={styles.fighterFace} />
            </View>

            {/* Torso */}
            <View style={styles.fighterTorso}>
              {/* Left Glove (Jab) */}
              <Animated.View
                style={[
                  styles.boxingGlove,
                  styles.gloveLeft,
                  { transform: [{ translateX: jabTranslate }] },
                ]}
              >
                <Text style={styles.gloveEmoji}>🥊</Text>
                <Animated.View
                  style={[
                    styles.impactFlash,
                    {
                      opacity: punchAnim.interpolate({
                        inputRange: [0.7, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ]}
                />
              </Animated.View>

              {/* Right Glove (Cross) */}
              <Animated.View
                style={[
                  styles.boxingGlove,
                  styles.gloveRight,
                  { transform: [{ translateX: crossTranslate }] },
                ]}
              >
                <Text style={styles.gloveEmoji}>🥊</Text>
              </Animated.View>
            </View>

            {/* Fighter Legs & Stance */}
            <View style={styles.fighterLegsRow}>
              <View style={[styles.fighterLeg, styles.frontLeg]} />
              <View style={[styles.fighterLeg, styles.backLeg]} />
            </View>
          </Animated.View>
        );
      }

      case 'squats': {
        const squatY = cycleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, isSmall ? 25 : 55],
        });
        const kneeScale = cycleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.7],
        });

        return (
          <View style={styles.squatStage}>
            <Animated.View
              style={[
                styles.squatBody,
                { transform: [{ translateY: squatY }, { scaleY: kneeScale }] },
              ]}
            >
              <View style={styles.squatHead} />
              <View style={styles.squatTorso}>
                <View style={styles.squatArmsOut} />
              </View>
              <View style={styles.squatLegs}>
                <View style={[styles.squatThigh, styles.thighLeft]} />
                <View style={[styles.squatThigh, styles.thighRight]} />
              </View>
            </Animated.View>
            <View style={styles.floorLine} />
          </View>
        );
      }

      case 'pushups': {
        const pushY = cycleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, isSmall ? 20 : 42],
        });

        return (
          <View style={styles.pushupStage}>
            <Animated.View
              style={[styles.pushupBody, { transform: [{ translateY: pushY }] }]}
            >
              <View style={styles.pushupHead} />
              <View style={styles.pushupSpine} />
              <View style={styles.pushupFeet} />
            </Animated.View>
            {/* Arms support from ground */}
            <View style={styles.pushupHandsRow}>
              <View style={styles.pushupHand} />
              <View style={styles.pushupHand} />
            </View>
            <View style={styles.floorLine} />
          </View>
        );
      }

      case 'jumping_jacks': {
        const jumpSpread = cycleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, isSmall ? 18 : 36],
        });
        const armRaise = cycleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, isSmall ? -28 : -55],
        });
        const bounceY = cycleAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -12, 0],
        });

        return (
          <Animated.View
            style={[styles.jackContainer, { transform: [{ translateY: bounceY }] }]}
          >
            <View style={styles.jackHead} />
            <View style={styles.jackTorso} />

            {/* Arms */}
            <Animated.View
              style={[
                styles.jackArm,
                styles.jackArmLeft,
                { transform: [{ translateY: armRaise }, { rotate: '-45deg' }] },
              ]}
            />
            <Animated.View
              style={[
                styles.jackArm,
                styles.jackArmRight,
                { transform: [{ translateY: armRaise }, { rotate: '45deg' }] },
              ]}
            />

            {/* Legs */}
            <View style={styles.jackLegsRow}>
              <Animated.View
                style={[
                  styles.jackLeg,
                  { transform: [{ translateX: Animated.multiply(jumpSpread, -1) }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.jackLeg,
                  { transform: [{ translateX: jumpSpread }] },
                ]}
              />
            </View>
          </Animated.View>
        );
      }

      case 'plank': {
        const breathPulse = cycleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1.05],
        });

        return (
          <View style={styles.plankStage}>
            <Animated.View
              style={[styles.plankBody, { transform: [{ scale: breathPulse }] }]}
            >
              <View style={styles.plankHead} />
              <View style={styles.plankCoreBar}>
                <Text style={styles.plankCoreText}>SIẾT CORE</Text>
              </View>
              <View style={styles.plankToes} />
            </Animated.View>
            <View style={styles.plankElbows}>
              <View style={styles.plankArm} />
            </View>
            <View style={styles.floorLine} />
          </View>
        );
      }

      case 'mma_sprawl': {
        const sprawlY = cycleAnim.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0, isSmall ? 35 : 70, 0],
        });
        const sprawlWidth = cycleAnim.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [60, isSmall ? 110 : 170, 60],
        });

        return (
          <View style={styles.sprawlStage}>
            <Animated.View
              style={[
                styles.sprawlBody,
                {
                  transform: [{ translateY: sprawlY }],
                  width: sprawlWidth,
                },
              ]}
            >
              <Text style={styles.sprawlText}>⚡ PHÒNG THỦ & DẰN HÔNG ⚡</Text>
            </Animated.View>
            <View style={styles.floorLine} />
          </View>
        );
      }

      case 'muay_thai_knees': {
        const kneeLift = cycleAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, isSmall ? -30 : -60, 0],
        });

        return (
          <View style={styles.kneeStage}>
            <View style={styles.kneeTorso}>
              <View style={styles.clinchHands}>
                <Text style={styles.clinchEmoji}>🤼 KHÓA GÁY</Text>
              </View>
            </View>
            <View style={styles.kneeLegsRow}>
              <View style={styles.supportLeg} />
              <Animated.View
                style={[styles.strikingKnee, { transform: [{ translateY: kneeLift }] }]}
              >
                <Text style={styles.strikeFlame}>🔥 GỐI LÊN</Text>
              </Animated.View>
            </View>
          </View>
        );
      }

      default: {
        // Fallback pulsing motion
        const pulse = cycleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1.06],
        });

        return (
          <Animated.View style={[styles.genericStage, { transform: [{ scale: pulse }] }]}>
            <View style={styles.genericCenter}>
              <Ionicons name="fitness" size={isSmall ? 32 : 54} color={COLORS.primary} />
              <Text style={styles.genericText}>VÀO NHỊP ĐỘNG TÁC</Text>
            </View>
          </Animated.View>
        );
      }
    }
  };

  return (
    <View style={[styles.cardContainer, { height: containerHeight }]}>
      {/* Background Energy Grid */}
      <View style={styles.gridBackground}>
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineHorizontal} />
      </View>

      {/* Main Graphic */}
      <View style={styles.centerGraphicArea}>{renderGraphic()}</View>

      {/* Movement State Pill */}
      {phase === 'work' && (
        <View style={styles.tempoPill}>
          <View style={styles.liveDot} />
          <Text style={styles.tempoText}>
            {animationType === 'shadow_boxing'
              ? 'Tổ hợp đòn: 1-2 Hook'
              : animationType === 'squats'
              ? 'Xuống hít - Lên thở'
              : animationType === 'pushups'
              ? 'Gồng ngực - Đẩy dứt khoát'
              : animationType === 'plank'
              ? 'Khóa thẳng - Giữ đều'
              : 'Nhịp động tác chuẩn'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    position: 'relative',
  },
  gridBackground: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-evenly',
    opacity: 0.15,
  },
  gridLineHorizontal: {
    height: 1,
    backgroundColor: COLORS.primary,
    width: '100%',
  },
  centerGraphicArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  tempoPill: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  tempoText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Rest state
  restCenterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  restCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(195, 245, 60, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  restPrompt: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },

  // Boxer styles
  boxerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fighterHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    marginBottom: 4,
  },
  fighterHair: {
    width: 24,
    height: 8,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  fighterFace: {
    width: 8,
    height: 4,
    backgroundColor: '#E2E8F0',
    marginTop: 6,
  },
  fighterTorso: {
    width: 50,
    height: 44,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  boxingGlove: {
    position: 'absolute',
    padding: 2,
    backgroundColor: '#EF4444',
    borderRadius: 12,
  },
  gloveLeft: {
    right: -24,
    top: 6,
  },
  gloveRight: {
    left: -24,
    top: 6,
  },
  gloveEmoji: {
    fontSize: 18,
  },
  impactFlash: {
    position: 'absolute',
    top: -6,
    right: -10,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FDE047',
  },
  fighterLegsRow: {
    flexDirection: 'row',
    marginTop: 4,
    width: 44,
    justifyContent: 'space-between',
  },
  fighterLeg: {
    width: 10,
    height: 32,
    backgroundColor: '#334155',
    borderRadius: 5,
  },
  frontLeg: {
    transform: [{ rotate: '12deg' }],
  },
  backLeg: {
    transform: [{ rotate: '-15deg' }],
  },

  // Squats styles
  squatStage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 140,
  },
  squatBody: {
    alignItems: 'center',
  },
  squatHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    marginBottom: 4,
  },
  squatTorso: {
    width: 42,
    height: 40,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  squatArmsOut: {
    width: 48,
    height: 8,
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },
  squatLegs: {
    flexDirection: 'row',
    width: 40,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  squatThigh: {
    width: 12,
    height: 38,
    backgroundColor: '#475569',
    borderRadius: 6,
  },
  thighLeft: {
    transform: [{ rotate: '-10deg' }],
  },
  thighRight: {
    transform: [{ rotate: '10deg' }],
  },
  floorLine: {
    width: 140,
    height: 3,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginTop: 6,
  },

  // Pushups styles
  pushupStage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 120,
  },
  pushupBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pushupHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F8FAFC',
    marginRight: 6,
  },
  pushupSpine: {
    width: 75,
    height: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 7,
  },
  pushupFeet: {
    width: 14,
    height: 12,
    backgroundColor: '#475569',
    borderRadius: 4,
    marginLeft: 4,
  },
  pushupHandsRow: {
    width: 90,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pushupHand: {
    width: 8,
    height: 14,
    backgroundColor: '#38BDF8',
    borderRadius: 3,
  },

  // Jumping Jacks styles
  jackContainer: {
    alignItems: 'center',
  },
  jackHead: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    marginBottom: 4,
  },
  jackTorso: {
    width: 38,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  jackArm: {
    position: 'absolute',
    top: 28,
    width: 8,
    height: 36,
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },
  jackArmLeft: {
    left: -12,
  },
  jackArmRight: {
    right: -12,
  },
  jackLegsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  jackLeg: {
    width: 10,
    height: 42,
    backgroundColor: '#475569',
    borderRadius: 5,
    marginHorizontal: 4,
  },

  // Plank styles
  plankStage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 110,
  },
  plankBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  plankHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginRight: 6,
  },
  plankCoreBar: {
    width: 90,
    height: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plankCoreText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0F172A',
  },
  plankToes: {
    width: 12,
    height: 10,
    backgroundColor: '#475569',
    marginLeft: 4,
    borderRadius: 3,
  },
  plankElbows: {
    width: 70,
    height: 8,
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },

  // MMA Sprawl styles
  sprawlStage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 120,
  },
  sprawlBody: {
    height: 38,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FEF08A',
  },
  sprawlText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  // Muay Thai Knee styles
  kneeStage: {
    alignItems: 'center',
  },
  kneeTorso: {
    width: 44,
    height: 42,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingTop: 4,
  },
  clinchHands: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clinchEmoji: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
  },
  kneeLegsRow: {
    flexDirection: 'row',
    width: 60,
    justifyContent: 'space-between',
    marginTop: 6,
  },
  supportLeg: {
    width: 10,
    height: 40,
    backgroundColor: '#475569',
    borderRadius: 5,
  },
  strikingKnee: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  strikeFlame: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },

  // Generic fallback
  genericStage: {
    alignItems: 'center',
  },
  genericCenter: {
    alignItems: 'center',
  },
  genericText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
});
