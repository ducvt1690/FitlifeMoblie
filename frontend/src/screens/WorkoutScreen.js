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
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOW } from '../constants/theme';
import { EXERCISES, WORKOUT_CATEGORIES } from '../constants/data';
import { addWorkoutLog, completeQuest } from '../utils/storage';
import { soundManager } from '../utils/audio';
import ExerciseVisual from '../components/ExerciseVisual';

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

  // Audio mute state
  const [isMuted, setIsMuted] = useState(soundManager.isMuted);

  // Modal tab: 'guide' | 'mistakes' | 'muscles'
  const [activeGuideTab, setActiveGuideTab] = useState('guide');

  const filteredExercises =
    selectedCategory === 'all'
      ? EXERCISES
      : EXERCISES.filter((ex) => ex.category === selectedCategory);

  // Timer countdown loop
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
    if (timerPhase === 'work') {
      soundManager.playBoxingBell();
      if (currentSet < totalSets) {
        setTimerPhase('rest');
        setTimeLeft(15); // 15 seconds rest
        soundManager.speakVoice(`Hết giờ hiệp ${currentSet}. Nghỉ ngơi 15 giây, hít thở sâu!`);
      } else {
        // Finished all sets!
        setIsTimerRunning(false);
        finishWorkout();
      }
    } else {
      // Rest finished, start next work set
      soundManager.playBoxingBell();
      const nextSet = currentSet + 1;
      setTimerPhase('work');
      setCurrentSet(nextSet);
      setTimeLeft(initialTime);
      soundManager.speakVoice(`Bắt đầu hiệp ${nextSet}, sẵn sàng!`);
    }
  };

  const startExercise = (exercise) => {
    setActiveExercise(exercise);
    const duration = exercise.durationSec || 45;
    setInitialTime(duration);
    setTimeLeft(duration);
    setTimerPhase('work');
    setCurrentSet(1);
    setIsTimerRunning(true);
    setTimerModalVisible(true);
    setActiveGuideTab('guide');

    // Trigger ring bell and voice coach
    soundManager.playBoxingBell();
    soundManager.speakVoice(`Bắt đầu hiệp một: ${exercise.title}!`);
  };

  const toggleSound = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
    Vibration.vibrate(40);
  };

  const finishWorkout = async () => {
    if (!activeExercise) return;
    const burned = activeExercise.calories * (currentSet || 1);
    const totalDuration = initialTime * (currentSet || 1);

    await addWorkoutLog({
      title: activeExercise.title,
      durationSec: totalDuration,
      calories: burned,
    });

    // Complete Daily Quest for workout
    await completeQuest('q_workout', `${activeExercise.title} (${burned} kcal)`);

    soundManager.playVictorySound();
    soundManager.speakVoice(`Xuất sắc! Bạn đã hoàn thành bài tập ${activeExercise.title}!`);

    Alert.alert(
      '🏆 Chiến Thắng Hiệp Đấu!',
      `Bạn đã xuất sắc hoàn thành ${currentSet} hiệp bài tập ${activeExercise.title} và đốt cháy khoảng ${burned} kcal! (+10 Coins)`,
      [{ text: 'Nhận Thưởng', onPress: () => closeTimer() }]
    );
  };

  const toggleTimer = () => {
    const nextState = !isTimerRunning;
    setIsTimerRunning(nextState);
    Vibration.vibrate(50);
    if (nextState) {
      soundManager.speakVoice(timerPhase === 'work' ? 'Tiếp tục vào hiệp!' : 'Tiếp tục nghỉ ngơi');
    }
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(initialTime);
    setTimerPhase('work');
    setCurrentSet(1);
    Vibration.vibrate(60);
  };

  const closeTimer = () => {
    setIsTimerRunning(false);
    soundManager.stopSpeaking();
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
                isSelected && {
                  backgroundColor: COLORS.black,
                  borderColor: COLORS.primary,
                },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cat.icon}
                size={16}
                color={isSelected ? COLORS.primary : COLORS.textMuted}
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
            {/* Header info */}
            <View style={styles.cardHeader}>
              <View style={styles.exerciseTitleWrap}>
                <View style={styles.titleRow}>
                  <Text style={styles.exerciseTitle}>{ex.title}</Text>
                  {ex.category === 'cardio' && (
                    <View style={styles.mmaTag}>
                      <Text style={styles.mmaTagText}>🥊 MMA</Text>
                    </View>
                  )}
                </View>

                {/* Badges */}
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                    <Ionicons name="flame" size={13} color="#EF4444" />
                    <Text style={[styles.badgeText, { color: '#EF4444' }]}>
                      {ex.calories} kcal
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
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

            {/* Visual Movement Demonstration Preview */}
            <View style={styles.demoPreviewWrap}>
              <ExerciseVisual
                animationType={ex.animationType}
                isPlaying={true}
                size="small"
                phase="work"
              />
            </View>

            {/* Target Muscles */}
            {ex.muscles && (
              <View style={styles.muscleRow}>
                <Text style={styles.muscleLabel}>🎯 Cơ tác động:</Text>
                {ex.muscles.map((m, idx) => (
                  <View key={idx} style={styles.musclePill}>
                    <Text style={styles.muscleText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.exerciseDesc}>{ex.description}</Text>

            {/* Card Footer */}
            <View style={styles.cardFooter}>
              <Text style={styles.repsText}>🎯 Lộ trình: {ex.reps}</Text>
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => startExercise(ex)}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={16} color={COLORS.black} />
                <Text style={styles.startBtnText}>Vào Tập Ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* FULLSCREEN EXERCISE & TIMER MODAL */}
      <Modal visible={timerModalVisible} animationType="slide">
        <SafeAreaView style={styles.timerScreen}>
          {/* Top Bar: Close + Title + Mute Audio Toggle */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={closeTimer}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>

            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalExerciseTitle} numberOfLines={1}>
                {activeExercise?.title}
              </Text>
              <Text style={styles.modalExerciseSub}>
                Hiệp đấu {currentSet} / {totalSets}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.iconCircleBtn,
                !isMuted && { backgroundColor: 'rgba(195, 245, 60, 0.2)', borderColor: COLORS.primary },
              ]}
              onPress={toggleSound}
            >
              <Ionicons
                name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                size={22}
                color={isMuted ? '#94A3B8' : COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Visual Movement Dynamic Demo Stage */}
            <View style={styles.stageWrap}>
              <ExerciseVisual
                animationType={activeExercise?.animationType}
                isPlaying={isTimerRunning}
                size="large"
                phase={timerPhase}
              />
            </View>

            {/* Phase Badge & Circular Timer */}
            <View style={styles.timerDisplayCard}>
              <View
                style={[
                  styles.phaseTag,
                  {
                    backgroundColor:
                      timerPhase === 'work' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    borderColor: timerPhase === 'work' ? '#EF4444' : '#22C55E',
                  },
                ]}
              >
                <View
                  style={[
                    styles.phasePulseDot,
                    { backgroundColor: timerPhase === 'work' ? '#EF4444' : '#22C55E' },
                  ]}
                />
                <Text
                  style={[
                    styles.phaseTagText,
                    { color: timerPhase === 'work' ? '#EF4444' : '#22C55E' },
                  ]}
                >
                  {timerPhase === 'work' ? '💥 ĐANG VÀO HIỆP' : '🍃 NGHỈ NGƠI HỒI SỨC'}
                </Text>
              </View>

              <Text style={styles.countdownBigText}>{formatTime(timeLeft)}</Text>
              <Text style={styles.countdownSub}>
                {isTimerRunning
                  ? timerPhase === 'work'
                    ? 'Duy trì nhịp động tác & thở đều!'
                    : 'Hít sâu hồi sức chuẩn bị hiệp sau'
                  : 'Đang tạm dừng — Bấm nút để tiếp tục'}
              </Text>
            </View>

            {/* Timer Controls Row */}
            <View style={styles.timerControlsRow}>
              <TouchableOpacity style={styles.timerSubBtn} onPress={resetTimer}>
                <Ionicons name="refresh" size={24} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timerMainPlayBtn,
                  {
                    backgroundColor: timerPhase === 'work' ? COLORS.primary : '#22C55E',
                  },
                ]}
                onPress={toggleTimer}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isTimerRunning ? 'pause' : 'play'}
                  size={36}
                  color={COLORS.black}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.timerSubBtn} onPress={finishWorkout}>
                <Ionicons name="checkmark-done" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* Technical Form Guide & Coaching Tabs */}
            <View style={styles.coachingBox}>
              <View style={styles.guideTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.guideTabBtn,
                    activeGuideTab === 'guide' && styles.guideTabActive,
                  ]}
                  onPress={() => setActiveGuideTab('guide')}
                >
                  <Text
                    style={[
                      styles.guideTabText,
                      activeGuideTab === 'guide' && styles.guideTabTextActive,
                    ]}
                  >
                    📋 Kỹ Thuật Chuẩn
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.guideTabBtn,
                    activeGuideTab === 'mistakes' && styles.guideTabActive,
                  ]}
                  onPress={() => setActiveGuideTab('mistakes')}
                >
                  <Text
                    style={[
                      styles.guideTabText,
                      activeGuideTab === 'mistakes' && styles.guideTabTextActive,
                    ]}
                  >
                    ⚠️ Lỗi Cần Tránh
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.guideTabBtn,
                    activeGuideTab === 'muscles' && styles.guideTabActive,
                  ]}
                  onPress={() => setActiveGuideTab('muscles')}
                >
                  <Text
                    style={[
                      styles.guideTabText,
                      activeGuideTab === 'muscles' && styles.guideTabTextActive,
                    ]}
                  >
                    🌬️ Nhịp Thở & Cơ
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Contents */}
              <View style={styles.guideContentArea}>
                {activeGuideTab === 'guide' && (
                  <View style={styles.guideItem}>
                    <Text style={styles.guideLabel}>🏁 Chuẩn bị:</Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.prep || activeExercise?.description}
                    </Text>
                    <Text style={[styles.guideLabel, { marginTop: 8 }]}>⚡ Phát lực:</Text>
                    <Text style={styles.guideBody}>{activeExercise?.action}</Text>
                  </View>
                )}

                {activeGuideTab === 'mistakes' && (
                  <View style={styles.guideItem}>
                    <Text style={[styles.guideLabel, { color: '#EF4444' }]}>
                      🚫 Những lỗi sai hay gặp:
                    </Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.mistakes || 'Giữ thăng bằng và không nín thở khi vận động.'}
                    </Text>
                  </View>
                )}

                {activeGuideTab === 'muscles' && (
                  <View style={styles.guideItem}>
                    <Text style={[styles.guideLabel, { color: COLORS.primary }]}>
                      🌬️ Nhịp thở chuẩn:
                    </Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.breathing || 'Thở ra khi phát lực, hít vào khi phục hồi.'}
                    </Text>
                    <Text style={[styles.guideLabel, { marginTop: 8, color: '#38BDF8' }]}>
                      🎯 Nhóm cơ kích hoạt:
                    </Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.muscles?.join(' • ') || 'Toàn thân'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
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
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 6,
  },
  categoryChipText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
  },
  exerciseList: {
    gap: 16,
  },
  exerciseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW,
  },
  cardHeader: {
    marginBottom: 10,
  },
  exerciseTitleWrap: {
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.text,
    flex: 1,
  },
  mmaTag: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  mmaTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
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
  demoPreviewWrap: {
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  muscleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  musclePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  muscleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
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
    paddingTop: 12,
  },
  repsText: {
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  startBtnText: {
    color: COLORS.black,
    fontWeight: '800',
    fontSize: SIZES.xs,
  },

  // MODAL TIMER STYLES
  timerScreen: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  iconCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  modalExerciseTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
  },
  modalExerciseSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  stageWrap: {
    width: '100%',
    marginBottom: 16,
  },
  timerDisplayCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18,
  },
  phaseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
    gap: 6,
  },
  phasePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownBigText: {
    fontSize: 56,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 2,
  },
  countdownSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
    marginBottom: 20,
  },
  timerMainPlayBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  timerSubBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  coachingBox: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  guideTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  guideTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  guideTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    backgroundColor: '#1E293B',
  },
  guideTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  guideTabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  guideContentArea: {
    padding: 14,
  },
  guideItem: {
    gap: 4,
  },
  guideLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  guideBody: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
  },
});
