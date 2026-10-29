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
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOW } from '../constants/theme';
import { EXERCISES, WORKOUT_CATEGORIES } from '../constants/data';
import {
  fetchExercisesFromApi,
  fetchExerciseDetailById,
} from '../utils/exerciseApi';
import {
  addWorkoutLog,
  completeQuest,
  addCoins,
} from '../utils/storage';
import { soundManager } from '../utils/audio';
import ExerciseVisual from '../components/ExerciseVisual';

function formatDurationLabel(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m} phút ${s} giây` : `${m} phút`;
  }
  return `${seconds} giây`;
}

export default function WorkoutScreen() {
  const [exercisesList, setExercisesList] = useState(EXERCISES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState(EXERCISES[0]);
  const [completedIds, setCompletedIds] = useState([]);

  // API pagination & search states
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState('0JtKWum');
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalApiCount, setTotalApiCount] = useState(1500);

  // Inline quick timer
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

  // Initial fetch from https://oss.exercisedb.dev/api/v1/exercises
  useEffect(() => {
    loadInitialFromApi();
  }, []);

  const loadInitialFromApi = async () => {
    setIsLoadingApi(true);
    const res = await fetchExercisesFromApi({ limit: 25 });
    if (res.exercises && res.exercises.length > 0) {
      setExercisesList(res.exercises);
      setSelectedExercise(res.exercises[0]);
      setNextCursor(res.meta?.nextCursor || null);
      setHasNextPage(Boolean(res.meta?.hasNextPage));
      if (res.meta?.total) setTotalApiCount(res.meta.total);
    }
    setIsLoadingApi(false);
  };

  const handleSearchSubmit = async () => {
    const q = searchQuery.trim();
    if (!q) {
      loadInitialFromApi();
      return;
    }
    setIsLoadingApi(true);
    const res = await fetchExercisesFromApi({ search: q });
    if (res.exercises && res.exercises.length > 0) {
      setExercisesList(res.exercises);
      handleSelectExercise(res.exercises[0]);
      setHasNextPage(false);
    } else {
      Alert.alert(
        'Không tìm thấy',
        `Không tìm thấy bài tập nào khớp với "${q}". Vui lòng thử từ khóa tiếng Anh (vd: squat, push-up, dumbbell, chest, abs).`
      );
    }
    setIsLoadingApi(false);
  };

  const handleLoadMoreApi = async () => {
    if (!hasNextPage || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const res = await fetchExercisesFromApi({ cursor: nextCursor, limit: 25 });
    if (res.success && res.exercises.length > 0) {
      setExercisesList((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const newItems = res.exercises.filter((item) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      setNextCursor(res.meta?.nextCursor || null);
      setHasNextPage(Boolean(res.meta?.hasNextPage));
    }
    setIsLoadingMore(false);
  };

  const filteredExercises =
    selectedCategory === 'all'
      ? exercisesList
      : exercisesList.filter((ex) => ex.category === selectedCategory);

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

  const handleSelectExercise = async (ex) => {
    setSelectedExercise(ex);
    Vibration.vibrate(30);
    // If search endpoint returned abbreviated item without instructions, fetch full details
    if (!ex.instructions || ex.instructions.length === 0) {
      const full = await fetchExerciseDetailById(ex.id);
      if (full) {
        setSelectedExercise(full);
        setExercisesList((prev) =>
          prev.map((item) => (item.id === full.id ? full : item))
        );
      }
    }
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
    const burned = ex.calories || 30;

    await addWorkoutLog({
      title: ex.title,
      durationSec: ex.durationSec || 45,
      calories: burned,
    });
    await completeQuest('q_workout', `${ex.title} (+${exp} EXP)`);
    await addCoins(exp);

    soundManager.playVictorySound();
    soundManager.speakVoice(`Hoàn thành ${ex.title}! Cộng ${exp} xu thưởng!`);

    Alert.alert(
      '🎉 Hoàn thành bài tập!',
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

  const startExercise = async (exercise) => {
    let targetEx = exercise;
    if (!exercise.instructions || exercise.instructions.length === 0) {
      const full = await fetchExerciseDetailById(exercise.id);
      if (full) targetEx = full;
    }

    setSelectedExercise(targetEx);
    setQuickRunning(false);
    setActiveExercise(targetEx);
    const duration = targetEx.durationSec || 45;
    setInitialTime(duration);
    setTimeLeft(duration);
    setTimerPhase('work');
    setCurrentSet(1);
    setIsTimerRunning(true);
    setTimerModalVisible(true);
    setActiveGuideTab('guide');

    soundManager.playBoxingBell();
    soundManager.speakVoice(`Bắt đầu hiệp một: ${targetEx.title}!`);
  };

  const toggleSound = () => {
    const nextMuted = soundManager.toggleMute();
    setIsMuted(nextMuted);
    Vibration.vibrate(40);
  };

  const finishWorkout = async () => {
    if (!activeExercise) return;
    const burned = (activeExercise.calories || 30) * (currentSet || 1);
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
      {/* SEARCH BAR FOR EXERCISEDB API (1,500 EXERCISES) */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search-outline" size={18} color="#6B817D" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm trong 1,500 bài tập (vd: squat, push-up, burpee, curl...)"
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              loadInitialFromApi();
            }}
          >
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit}>
          <Text style={styles.searchBtnText}>Tìm</Text>
        </TouchableOpacity>
      </View>

      {/* SELECTED EXERCISE HERO CARD WITH ANIMATED GIF FROM EXERCISEDB */}
      {selectedExercise && (
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.eyebrowRow}>
                <Text style={styles.heroEyebrow}>ĐỘNG TÁC MẪU EXERCISEDB API</Text>
                <View style={styles.idPill}>
                  <Text style={styles.idPillText}>#{selectedExercise.id}</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>{selectedExercise.title}</Text>
              <Text style={styles.heroMeta}>
                {selectedExercise.bodyPartLabel} • {selectedExercise.equipment} • +
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

          {/* Animated GIF + 2D Sprite Display */}
          <View style={styles.heroAnimationBox}>
            <ExerciseVisual
              gifUrl={selectedExercise.gifUrl}
              sprite={selectedExercise.sprite}
              frameDurationMs={selectedExercise.frameDurationMs || 165}
              bodyPartLabel={selectedExercise.bodyPartLabel}
              isPlaying={true}
              size="small"
              phase="work"
            />
          </View>

          {/* Target & Secondary Muscles */}
          {selectedExercise.muscles && selectedExercise.muscles.length > 0 && (
            <View style={styles.muscleRow}>
              <Text style={styles.muscleLabel}>🎯 Cơ tác động:</Text>
              {selectedExercise.muscles.map((m, i) => (
                <View key={i} style={styles.musclePill}>
                  <Text style={styles.muscleText}>{m}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Step-by-step instructions */}
          {selectedExercise.instructions && selectedExercise.instructions.length > 0 && (
            <View style={styles.instructionList}>
              {selectedExercise.instructions.slice(0, 4).map((step, idx) => (
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
              ? '✓ Đã hoàn thành hôm nay — Đã cộng EXP & Coins vào hồ sơ!'
              : 'Quan sát kỹ động tác GIF mẫu và giữ nhịp thở đều khi tập.'}
          </Text>
        </View>
      )}

      {/* Category Filter */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>
          Kho bài tập API ({filteredExercises.length} / {totalApiCount})
        </Text>
        {isLoadingApi && <ActivityIndicator size="small" color="#159C7A" />}
      </View>

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

      {/* Exercises List with GIF Thumbnails */}
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
              {/* Animated GIF / 2D Sprite Thumbnail */}
              <ExerciseVisual
                gifUrl={ex.gifUrl}
                sprite={ex.sprite}
                frameDurationMs={ex.frameDurationMs || 175}
                isPlaying={true}
                size="thumb"
              />

              <View style={styles.exerciseInfoCol}>
                <View style={styles.rowTitleWrap}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {ex.title}
                  </Text>
                  {isDone && <Text style={styles.doneCheck}>✓</Text>}
                </View>

                <Text style={styles.rowMeta}>
                  {ex.bodyPartLabel} • {ex.calories} kcal • +{ex.expReward || 15} EXP
                </Text>

                <Text style={styles.rowInstruction} numberOfLines={2}>
                  {ex.instructions?.[0] || `Thiết bị: ${ex.equipment} • Nhóm cơ: ${ex.muscles?.join(', ')}`}
                </Text>

                <View style={styles.rowActionBar}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>{ex.equipment}</Text>
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

      {/* Load More Pagination Button (`nextCursor` from API) */}
      {hasNextPage && selectedCategory === 'all' && (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={handleLoadMoreApi}
          disabled={isLoadingMore}
          activeOpacity={0.8}
        >
          {isLoadingMore ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.loadMoreBtnText}>
                Tải thêm bài tập từ API (Còn {totalApiCount - exercisesList.length}+ bài)
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

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
                Hiệp đấu {currentSet} / {totalSets} • {activeExercise?.bodyPartLabel}
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
            {/* Large Animated GIF + 2D Stage */}
            <View style={styles.stageWrap}>
              <ExerciseVisual
                gifUrl={activeExercise?.gifUrl}
                sprite={activeExercise?.sprite}
                frameDurationMs={activeExercise?.frameDurationMs || 160}
                bodyPartLabel={activeExercise?.bodyPartLabel}
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
                    ? 'Thực hiện theo động tác mẫu GIF & giữ nhịp thở!'
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
                    📋 Các Bước Tập (API)
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
                    ⚠️ Lưu Ý Kỹ Thuật
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
                    🎯 Cơ & Thiết Bị
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.guideContentArea}>
                {activeGuideTab === 'guide' && (
                  <View style={styles.guideItem}>
                    {(activeExercise?.instructions || []).map((step, i) => (
                      <Text key={i} style={styles.guideBody}>
                        • {step}
                      </Text>
                    ))}
                  </View>
                )}

                {activeGuideTab === 'mistakes' && (
                  <View style={styles.guideItem}>
                    <Text style={[styles.guideLabel, { color: '#EF4444' }]}>
                      🚫 Kiểm soát tư thế:
                    </Text>
                    <Text style={styles.guideBody}>{activeExercise?.mistakes}</Text>
                    <Text style={[styles.guideLabel, { color: COLORS.primary, marginTop: 8 }]}>
                      🌬️ Nhịp thở:
                    </Text>
                    <Text style={styles.guideBody}>{activeExercise?.breathing}</Text>
                  </View>
                )}

                {activeGuideTab === 'muscles' && (
                  <View style={styles.guideItem}>
                    <Text style={[styles.guideLabel, { color: '#38BDF8' }]}>
                      🎯 Nhóm cơ đích & phụ:
                    </Text>
                    <Text style={styles.guideBody}>
                      {activeExercise?.muscles?.join(' • ') || 'Toàn thân'}
                    </Text>
                    <Text style={[styles.guideLabel, { marginTop: 8, color: COLORS.primary }]}>
                      🏋️ Thiết bị sử dụng:
                    </Text>
                    <Text style={styles.guideBody}>{activeExercise?.equipment}</Text>
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
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#D8EEE8',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#173B36',
    paddingVertical: 4,
  },
  searchBtn: {
    backgroundColor: '#159C7A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
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
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroEyebrow: {
    color: '#198A73',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  idPill: {
    backgroundColor: '#E5F4EF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  idPillText: {
    color: '#116B58',
    fontSize: 10,
    fontWeight: '800',
  },
  heroTitle: {
    fontSize: 19,
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
    marginVertical: 10,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  muscleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#173B36',
  },
  musclePill: {
    backgroundColor: '#E5F4EF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  muscleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#116B58',
  },
  instructionList: {
    backgroundColor: '#F8FCFB',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 4,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    color: '#173B36',
    fontSize: 17,
    fontWeight: '900',
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
    width: 82,
    height: 82,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8EEE8',
  },
  thumbGif: {
    width: 78,
    height: 78,
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
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#116B58',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 14,
    gap: 8,
  },
  loadMoreBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
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
    gap: 6,
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
