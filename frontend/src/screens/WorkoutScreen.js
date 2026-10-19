import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOW } from '../constants/theme';
import { EXERCISES, WORKOUT_CATEGORIES } from '../constants/data';
import { addWorkoutLog } from '../utils/storage';
import { soundManager } from '../utils/audio';

export default function WorkoutScreen() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeExercise, setActiveExercise] = useState(null);

  // Timer states
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [initialTime, setInitialTime] = useState(45);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerPhase, setTimerPhase] = useState('work'); // 'work' | 'rest'
  const [currentSet, setCurrentSet] = useState(1);
  const totalSets = 3;
  const intervalRef = useRef(null);

  const filteredExercises =
    selectedCategory === 'all'
      ? EXERCISES
      : EXERCISES.filter((ex) => ex.category === selectedCategory);

  // Timer management
  useEffect(() => {
    if (isTimerRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 4 && prev > 1) {
            soundManager.playCountdownBeep();
          }
          if (prev <= 1) {
            handlePhaseComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning, timerPhase, currentSet]);

  const handlePhaseComplete = () => {
    soundManager.playWhistleSound();
    if (timerPhase === 'work') {
      if (currentSet < totalSets) {
        setTimerPhase('rest');
        setTimeLeft(15); // 15 seconds rest
      } else {
        // Finished all sets!
        setIsTimerRunning(false);
        finishWorkout();
      }
    } else {
      // Rest finished, start next work set
      setTimerPhase('work');
      setCurrentSet((s) => s + 1);
      setTimeLeft(initialTime);
    }
  };

  const startExercise = (exercise) => {
    setActiveExercise(exercise);
    setInitialTime(exercise.durationSec || 45);
    setTimeLeft(exercise.durationSec || 45);
    setTimerPhase('work');
    setCurrentSet(1);
    setIsTimerRunning(false);
    setTimerModalVisible(true);
  };

  const finishWorkout = async () => {
    if (!activeExercise) return;
    const burned = activeExercise.calories * (currentSet || 1);
    await addWorkoutLog({
      title: activeExercise.title,
      durationSec: (initialTime * currentSet),
      calories: burned,
    });
    Alert.alert(
      '🎉 Chúc mừng!',
      `Bạn đã hoàn thành bài tập ${activeExercise.title} và đốt cháy khoảng ${burned} kcal!`,
      [{ text: 'Tuyệt vời', onPress: () => setTimerModalVisible(false) }]
    );
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(initialTime);
    setTimerPhase('work');
    setCurrentSet(1);
  };

  const closeTimer = () => {
    setIsTimerRunning(false);
    setTimerModalVisible(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Category Horizontal Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
      >
        {WORKOUT_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                isSelected && { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={16}
                color={isSelected ? COLORS.white : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  isSelected && { color: COLORS.white, fontWeight: '700' },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Exercises List */}
      <View style={styles.exerciseList}>
        {filteredExercises.map((ex) => (
          <View key={ex.id} style={styles.exerciseCard}>
            <View style={styles.cardHeader}>
              <View style={styles.exerciseTitleWrap}>
                <Text style={styles.exerciseTitle}>{ex.title}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: COLORS.purpleLight }]}>
                    <Ionicons name="flame" size={12} color={COLORS.purple} />
                    <Text style={[styles.badgeText, { color: COLORS.purple }]}>
                      {ex.calories} kcal
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
                    <Text style={[styles.badgeText, { color: COLORS.textMuted }]}>
                      {ex.durationSec}s / hiệp
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor:
                          ex.level === 'Dễ'
                            ? COLORS.primaryLight
                            : ex.level === 'Trung bình'
                            ? COLORS.accentLight
                            : COLORS.dangerLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color:
                            ex.level === 'Dễ'
                              ? COLORS.primaryDark
                              : ex.level === 'Trung bình'
                              ? '#B45309'
                              : COLORS.danger,
                        },
                      ]}
                    >
                      {ex.level}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.exerciseDesc}>{ex.description}</Text>

            <View style={styles.cardFooter}>
              <Text style={styles.repsText}>🎯 Lộ trình: {ex.reps}</Text>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => startExercise(ex)}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={16} color={COLORS.white} />
                <Text style={styles.startBtnText}>Bắt đầu</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Fullscreen Timer Modal */}
      <Modal visible={timerModalVisible} animationType="slide">
        <View style={styles.timerScreen}>
          <TouchableOpacity style={styles.closeTimerBtn} onPress={closeTimer}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.timerHeader}>
            <Text style={styles.timerTitle}>{activeExercise?.title}</Text>
            <View
              style={[
                styles.phaseTag,
                {
                  backgroundColor:
                    timerPhase === 'work' ? COLORS.dangerLight : COLORS.primaryLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.phaseTagText,
                  {
                    color: timerPhase === 'work' ? COLORS.danger : COLORS.primaryDark,
                  },
                ]}
              >
                {timerPhase === 'work' ? '🔥 ĐANG TẬP' : '🍃 NGHỈ NGƠI'}
              </Text>
            </View>
            <Text style={styles.setCounter}>Hiệp {currentSet} / {totalSets}</Text>
          </View>

          {/* Big Circular Timer Display */}
          <View
            style={[
              styles.bigTimerRing,
              {
                borderColor: timerPhase === 'work' ? COLORS.purple : COLORS.primary,
              },
            ]}
          >
            <Text style={styles.bigTimerText}>{formatTime(timeLeft)}</Text>
            <Text style={styles.bigTimerSub}>
              {isTimerRunning ? 'Tiếp tục duy trì!' : 'Bấm để bắt đầu'}
            </Text>
          </View>

          {/* Timer Controls */}
          <View style={styles.timerControlsRow}>
            <TouchableOpacity style={styles.timerSubBtn} onPress={resetTimer}>
              <Ionicons name="refresh" size={26} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.timerMainPlayBtn,
                {
                  backgroundColor: timerPhase === 'work' ? COLORS.purple : COLORS.primary,
                },
              ]}
              onPress={toggleTimer}
            >
              <Ionicons
                name={isTimerRunning ? 'pause' : 'play'}
                size={36}
                color={COLORS.white}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.timerSubBtn} onPress={finishWorkout}>
              <Ionicons name="checkmark-done" size={26} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.timerGuideText}>
            {activeExercise?.description}
          </Text>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  categoryChipText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  exerciseList: {
    gap: 14,
  },
  exerciseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    ...SHADOW,
  },
  cardHeader: {
    marginBottom: 8,
  },
  exerciseTitleWrap: {
    gap: 6,
  },
  exerciseTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.text,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  exerciseDesc: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  repsText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.purple,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  startBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: SIZES.xs,
  },
  // Modal Timer styles
  timerScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    padding: 24,
    justifyContent: 'space-between',
  },
  closeTimerBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  timerHeader: {
    alignItems: 'center',
  },
  timerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  phaseTag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  phaseTagText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  setCounter: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  bigTimerRing: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 8,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW,
  },
  bigTimerText: {
    fontSize: 54,
    fontWeight: '900',
    color: COLORS.text,
  },
  bigTimerSub: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
  },
  timerMainPlayBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW,
  },
  timerSubBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW,
  },
  timerGuideText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
    marginBottom: 20,
  },
});
