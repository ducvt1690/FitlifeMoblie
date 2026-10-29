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
import {
  addWorkoutLog,
  addWaterLog,
  completeQuest,
  addCoins,
} from '../utils/storage';
import { soundManager } from '../utils/audio';
import ExerciseVisual from '../components/ExerciseVisual';
import SpriteAnimation from '../components/SpriteAnimation';

function formatDurationLabel(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m} phút ${s} giây` : `${m} phút`;
  }
  return `${seconds} giây`;
}

export default function WorkoutScreen() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState(EXERCISES[0]);
  const [completedIds, setCompletedIds] = useState([]);

  // Inline quick timer (Daily Hero 2D style)
  const [quickSecondsLeft, setQuickSecondsLeft] = useState(EXERCISES[0].durationSec);
  const [quickRunning, setQuickRunning] = useState(false);

  // Fullscreen HIIT 3-set Timer modal states
  const [activeExercise, setActiveExercise] = useState(null);
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
  const [activeGuideTab, setActiveGuideTab] = useState('guide');

  const filteredExercises =
    selectedCategory === 'all'
      ? EXERCISES
      : selectedCategory === 'daily_hero'
      ? EXERCISES.filter((ex) => ex.isDailyHero)
      : EXERCISES.filter((ex) => ex.category === selectedCategory);

  // Reset inline quick timer when switching selected exercise
  useEffect(() => {
    if (selectedExercise) {
      setQuickSecondsLeft(selectedExercise.durationSec || 45);
      setQuickRunning(false);
    }
  }, [selectedExercise?.id]);

  // Inline quick timer countdown
  useEffect(() => {
    if (!quickRunning || quickSecondsLeft <= 0) return;
    const timer = setTimeout(() => {
      setQuickSecondsLeft((s) => {
        if (s <= 4 && s > 1) {
          soundManager.playCountdownBeep();
        }
        if (s <= 1) {
          setQuickRunning(false);
          handleCompleteQuickExercise(selectedExercise);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [quickRunning, quickSecondsLeft, selectedExercise]);

  // Fullscreen HIIT timer countdown loop
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

  const handleSelectExercise = (ex) => {
    setSelectedExercise(ex);
    Vibration.vibrate(30);
  };

  const handleToggleQuickTimer = () => {
    const next = !quickRunning;
    if (next && quickSecondsLeft === 0) {
      setQuickSecondsLeft(selectedExercise.durationSec || 45);
    }
    setQuickRunning(next);
    Vibration.vibrate(40);
    if (next) {
      soundManager.playBoxingBell();
      soundManager.speakVoice(`Bắt đầu ${selectedExercise.title}!`);
    } else {
      soundManager.stopSpeaking();
    }
  };

  const handleCompleteQuickExercise = async (ex = selectedExercise) => {
    if (!ex) return;
    setQuickRunning(false);
    setCompletedIds((old) => (old.includes(ex.id) ? old : [...old, ex.id]));

    const exp = ex.expReward || 15;
    const burned = ex.calories || 20;

    if (ex.id === 'drink') {
      await addWaterLog(250);
      await completeQuest('q_water', '+250 ml (Daily Hero 2D)');
    } else {
      await addWorkoutLog({
        title: ex.title,
        durationSec: ex.durationSec || 45,
        calories: burned,
      });
      await completeQuest('q_workout', `${ex.title} (+${exp} EXP)`);
    }

    await addCoins(exp);
    soundManager.playVictorySound();
    soundManager.speakVoice(`Hoàn thành ${ex.title}! Cộng ${exp} xu thưởng!`);

    Alert.alert(
      '🎉 Hoàn thành bài tập 2D!',
      `Bạn đã hoàn thành "${ex.title}"!\n• Đốt cháy: ~${burned} kcal\n• Phần thưởng: +${exp} EXP & Coins 🪙`,
      [{ text: 'Tuyệt vời' }]
    );
  };

  const handlePhaseComplete = () => {
    if (timerPhase === 'work') {
      soundManager.playBoxingBell();
      if (currentSet < totalSets) {
        setTimerPhase('rest');
        setTimeLeft(15);
        soundManager.speakVoice(`Hết giờ hiệp ${currentSet}. Nghỉ ngơi 15 giây, hít thở sâu!`);
      } else {
        setIsTimerRunning(false);
        finishWorkout();
      }
    } else {
      soundManager.playBoxingBell();
      const nextSet = currentSet + 1;
      setTimerPhase('work');
      setCurrentSet(nextSet);
      setTimeLeft(initialTime);
      soundManager.speakVoice(`Bắt đầu hiệp ${nextSet}, sẵn sàng!`);
    }
  };

  const startExercise = (exercise) => {
    setSelectedExercise(exercise);
    setQuickRunning(false);
    setActiveExercise(exercise);
    const duration = exercise.durationSec || 45;
    setInitialTime(duration);
    setTimeLeft(duration);
    setTimerPhase('work');
    setCurrentSet(1);
    setIsTimerRunning(true);
    setTimerModalVisible(true);
    setActiveGuideTab('guide');

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
    const burned = (activeExercise.calories || 25) * (currentSet || 1);
    const totalDuration = initialTime * (currentSet || 1);
    const exp = (activeExercise.expReward || 15) * (currentSet || 1);

    setCompletedIds((old) =>
      old.includes(activeExercise.id) ? old : [...old, activeExercise.id]
    );

    await addWorkoutLog({
      title: activeExercise.title,
      durationSec: totalDuration,
      calories: burned,
    });

    await completeQuest('q_workout', `${activeExercise.title} (${burned} kcal)`);
    await addCoins(exp);

    soundManager.playVictorySound();
    soundManager.speakVoice(`Xuất sắc! Bạn đã hoàn thành bài tập ${activeExercise.title}!`);

    Alert.alert(
      '🏆 Chiến Thắng Hiệp Đấu!',
      `Bạn đã hoàn thành ${currentSet} hiệp "${activeExercise.title}"!\n• Tiêu hao: ~${burned} kcal\n• Nhận thưởng: +${exp} EXP & Coins 🪙`,
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
      {/* DAILY HERO 2D STAGE (Tham khảo & tích hợp từ DailyHero2D_ExpoStarter) */}
      {selectedExercise && (
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>BÀI TẬP 2D ĐANG CHỌN</Text>
              <Text style={styles.heroTitle}>{selectedExercise.title}</Text>
              <Text style={styles.heroMeta}>
                {selectedExercise.level} • {selectedExercise.calories} kcal • +
                {selectedExercise.expReward || 15} EXP
              </Text>
            </View>
            <TouchableOpacity
              style={styles.soundToggleSmall}
              onPress={toggleSound}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                size={20}
                color={isMuted ? '#6B817D' : '#116B58'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.heroAnimationBox}>
            <SpriteAnimation
              sprite={selectedExercise.sprite || 'squat'}
              frameCount={selectedExercise.frameCount || 6}
              frameDurationMs={selectedExercise.frameDurationMs || 200}
              size={185}
              playing={true}
            />
          </View>

          {/* Step-by-step instructions from DailyHero2D */}
          {selectedExercise.instructions && (
            <View style={styles.instructionList}>
              {selectedExercise.instructions.map((step, idx) => (
                <Text key={idx} style={styles.instructionStep}>
                  • {step}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.heroTimerText}>{formatDurationLabel(quickSecondsLeft)}</Text>

          <View style={styles.heroButtonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleToggleQuickTimer}
              activeOpacity={0.8}
            >
              <Ionicons
                name={quickRunning ? 'pause' : 'play'}
                size={16}
                color="#116B58"
              />
              <Text style={styles.secondaryButtonText}>
                {quickRunning ? 'Tạm dừng' : 'Bắt đầu'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hiitButton}
              onPress={() => startExercise(selectedExercise)}
              activeOpacity={0.8}
            >
              <Ionicons name="timer-outline" size={16} color="#FFFFFF" />
              <Text style={styles.hiitButtonText}>HIIT 3 Hiệp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleCompleteQuickExercise(selectedExercise)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Hoàn thành</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroNote}>
            {completedIds.includes(selectedExercise.id)
              ? '✓ Đã hoàn thành hôm nay — Cộng EXP & Coins vào hồ sơ!'
              : 'Làm theo hoạt ảnh 2D minh họa kết hợp âm thanh hướng dẫn.'}
          </Text>
        </View>
      )}

      {/* Category Horizontal Filter */}
      <Text style={styles.sectionHeaderTitle}>Bộ bài luyện tập 2D ({filteredExercises.length})</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
      >
        {WORKOUT_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                isSelected && {
                  backgroundColor: '#116B58',
                  borderColor: '#116B58',
                },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={cat.icon}
                size={15}
                color={isSelected ? '#FFFFFF' : COLORS.textMuted}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  isSelected && { color: '#FFFFFF', fontWeight: '800' },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 2D Exercises List */}
      <View style={styles.exerciseList}>
        {filteredExercises.map((ex) => {
          const isSelected = selectedExercise?.id === ex.id;
          const isDone = completedIds.includes(ex.id);
          return (
            <TouchableOpacity
              key={ex.id}
              style={[styles.exerciseRowCard, isSelected && styles.selectedRowCard]}
              onPress={() => handleSelectExercise(ex)}
              activeOpacity={0.85}
            >
              {/* 2D Sprite Thumbnail */}
              <View style={styles.thumbBox}>
                <SpriteAnimation
                  sprite={ex.sprite || 'squat'}
                  frameCount={ex.frameCount || 6}
                  frameDurationMs={ex.frameDurationMs || 200}
                  size={74}
                  playing={true}
                />
              </View>

              <View style={styles.exerciseInfoCol}>
                <View style={styles.rowTitleWrap}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {ex.title}
                  </Text>
                  {isDone && <Text style={styles.doneCheck}>✓</Text>}
                </View>

                <Text style={styles.rowMeta}>
                  {ex.targetReps
                    ? `${ex.targetReps} lần`
                    : formatDurationLabel(ex.durationSec)}{' '}
                  • {ex.calories} kcal • +{ex.expReward || 15} EXP
                </Text>

                <Text style={styles.rowInstruction} numberOfLines={2}>
                  {ex.instructions?.[0] || ex.description}
                </Text>

                <View style={styles.rowActionBar}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{ex.level}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.rowStartBtn}
                    onPress={() => startExercise(ex)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play" size={12} color="#FFFFFF" />
                    <Text style={styles.rowStartBtnText}>Tập 3 Hiệp</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FULLSCREEN EXERCISE & TIMER MODAL */}
      <Modal visible={timerModalVisible} animationType="slide">
        <SafeAreaView style={styles.timerScreen}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={closeTimer}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>

            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalExerciseTitle} numberOfLines={1}>
                {activeExercise?.title}
              </Text>
              <Text style={styles.modalExerciseSub}>
                Hiệp đấu {currentSet} / {totalSets} • +{activeExercise?.expReward || 15} EXP/hiệp
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.iconCircleBtn,
                !isMuted && {
                  backgroundColor: 'rgba(195, 245, 60, 0.2)',
                  borderColor: COLORS.primary,
                },
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
            {/* 2D Sprite Visual Stage */}
            <View style={styles.stageWrap}>
              <ExerciseVisual
                animationType={activeExercise?.animationType}
                sprite={activeExercise?.sprite}
                frameCount={activeExercise?.frameCount || 6}
                frameDurationMs={activeExercise?.frameDurationMs}
                isPlaying={isTimerRunning}
                size="large"
                phase={timerPhase}
              />
            </View>

            {/* Phase Badge & Countdown */}
            <View style={styles.timerDisplayCard}>
              <View
                style={[
                  styles.phaseTag,
                  {
                    backgroundColor:
                      timerPhase === 'work'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(34, 197, 94, 0.15)',
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
                    ? 'Làm theo hoạt ảnh 2D & giữ nhịp thở đều!'
                    : 'Hít sâu hồi sức chuẩn bị hiệp tiếp theo'
                  : 'Đang tạm dừng — Bấm nút Play để tiếp tục'}
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

              <View style={styles.guideContentArea}>
                {activeGuideTab === 'guide' && (
                  <View style={styles.guideItem}>
                    <Text style={styles.guideLabel}>🏁 Chuẩn bị:</Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.prep || activeExercise?.description}
                    </Text>
                    <Text style={[styles.guideLabel, { marginTop: 8 }]}>⚡ Động tác:</Text>
                    <Text style={styles.guideBody}>{activeExercise?.action}</Text>
                  </View>
                )}

                {activeGuideTab === 'mistakes' && (
                  <View style={styles.guideItem}>
                    <Text style={[styles.guideLabel, { color: '#EF4444' }]}>
                      🚫 Những lỗi sai hay gặp:
                    </Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.mistakes ||
                        'Giữ thăng bằng và không nín thở khi vận động.'}
                    </Text>
                  </View>
                )}

                {activeGuideTab === 'muscles' && (
                  <View style={styles.guideItem}>
                    <Text style={[styles.guideLabel, { color: COLORS.primary }]}>
                      🌬️ Nhịp thở chuẩn:
                    </Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.breathing ||
                        'Thở ra khi phát lực, hít vào khi phục hồi.'}
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
  // Hero 2D card (DailyHero2D style)
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#D8EEE8',
    ...SHADOW,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    color: '#198A73',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#173B36',
    marginTop: 4,
  },
  heroMeta: {
    color: '#6B817D',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  soundToggleSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5F4EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAnimationBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    backgroundColor: '#F3FBF9',
    borderRadius: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E1EFEB',
  },
  instructionList: {
    backgroundColor: '#F8FCFB',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 3,
  },
  instructionStep: {
    color: '#335C55',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  heroTimerText: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#173B36',
    marginVertical: 6,
  },
  heroButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E5F4EF',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  secondaryButtonText: {
    color: '#116B58',
    fontWeight: '800',
    fontSize: 12,
  },
  hiitButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  hiitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#159C7A',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  heroNote: {
    color: '#6B817D',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },

  sectionHeaderTitle: {
    color: '#173B36',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 4,
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
    borderWidth: 1.5,
    borderColor: '#D8EEE8',
    gap: 6,
  },
  categoryChipText: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  exerciseList: {
    gap: 10,
  },
  exerciseRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E1EFEB',
    ...SHADOW,
  },
  selectedRowCard: {
    borderColor: '#159C7A',
    backgroundColor: '#F5FCFA',
  },
  thumbBox: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: '#F3FBF9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8EEE8',
  },
  exerciseInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    color: '#173B36',
    fontWeight: '800',
    fontSize: 14,
    flex: 1,
  },
  doneCheck: {
    color: '#159C7A',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 6,
  },
  rowMeta: {
    color: '#198A73',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  rowInstruction: {
    color: '#6B817D',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  rowActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  levelBadge: {
    backgroundColor: '#E5F4EF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelBadgeText: {
    color: '#116B58',
    fontSize: 10,
    fontWeight: '700',
  },
  rowStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#159C7A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  rowStartBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
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
