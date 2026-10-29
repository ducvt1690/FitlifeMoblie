import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import WaveformCard from '../components/WaveformCard';
import MetricCard from '../components/MetricCard';
import {
  getUserProfile,
  getWaterLogsToday,
  getWorkoutLogsToday,
  getDailyQuests,
  addWaterLog,
  completeQuest,
  getStepsToday,
  addStepsToday,
  getCoins,
  getMoodToday,
  saveMoodToday,
} from '../utils/storage';
import { soundManager } from '../utils/audio';

const MOODS = [
  { id: 'ready', label: '⚡ Sẵn sàng' },
  { id: 'energetic', label: '🔥 Năng lượng' },
  { id: 'calm', label: '🧘 Thư giãn' },
  { id: 'tired', label: '😴 Hơi mệt' },
];

function getVietnameseGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng ☀️';
  if (hour < 18) return 'Chào buổi chiều 🌤️';
  return 'Chào buổi tối 🌙';
}

export default function HomeScreen({ onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [coins, setCoins] = useState(150);
  const [currentMood, setCurrentMood] = useState('⚡ Sẵn sàng');
  const [waterTotal, setWaterTotal] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [walkSteps, setWalkSteps] = useState(0);
  const [heartRate, setHeartRate] = useState(105);
  const [overallProgress, setOverallProgress] = useState(0);
  const [completedQuestCount, setCompletedQuestCount] = useState(0);
  const [totalQuestCount, setTotalQuestCount] = useState(7);

  // Quick water modal
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [inputWater, setInputWater] = useState('250');

  // Breakdown modal
  const [breakdownVisible, setBreakdownVisible] = useState(false);

  const loadData = async () => {
    const [prof, userCoins, moodData, waterLogs, workouts, steps, quests] = await Promise.all([
      getUserProfile(),
      getCoins(),
      getMoodToday(),
      getWaterLogsToday(),
      getWorkoutLogsToday(),
      getStepsToday(),
      getDailyQuests(),
    ]);

    setProfile(prof);
    setCoins(userCoins);
    if (moodData?.mood) setCurrentMood(moodData.mood);

    // Water
    const currentWater = (waterLogs || []).reduce((acc, curr) => acc + curr.amount, 0);
    setWaterTotal(currentWater);

    // Workouts
    const burned = (workouts || []).reduce((acc, curr) => acc + (curr.calories || 0), 0);
    setCaloriesBurned(burned);

    // Steps
    setWalkSteps(steps);

    // Quests calculation
    const completedQuests = (quests || []).filter((q) => q.completed).length;
    const totalQuests = (quests || []).length || 7;
    setCompletedQuestCount(completedQuests);
    setTotalQuestCount(totalQuests);

    // Overall score (0 - 100%)
    const questWeight = (completedQuests / totalQuests) * 50;
    const waterTarget = prof?.targetWater || 2200;
    const waterWeight = Math.min(25, (currentWater / waterTarget) * 25);
    const stepWeight = Math.min(25, (steps / 10000) * 25);

    setOverallProgress(Math.min(100, Math.round(questWeight + waterWeight + stepWeight)));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectMood = async (moodLabel) => {
    soundManager.playCoinSound();
    setCurrentMood(moodLabel);
    await saveMoodToday(moodLabel, 'Tâm trạng ghi nhận từ trang chủ');
    await loadData();
    Alert.alert(
      '✨ Đã lưu tâm trạng',
      `Bạn đang cảm thấy "${moodLabel}" hôm nay! Đã hoàn thành nhiệm vụ Tâm trạng (+10 Coins).`
    );
  };

  const handleQuickAddWater250 = async () => {
    soundManager.playCoinSound();
    await addWaterLog(250);
    await completeQuest('q_water', '+250 ml');
    Vibration.vibrate(50);
    await loadData();
  };

  const handleAddWaterModal = async () => {
    const amt = parseInt(inputWater, 10);
    if (!amt || amt <= 0) return;
    soundManager.playCoinSound();
    await addWaterLog(amt);
    await completeQuest('q_water', `+${amt} ml`);
    setWaterModalVisible(false);
    Vibration.vibrate(80);
    await loadData();
  };

  const handleAddSteps = async () => {
    soundManager.playCoinSound();
    Vibration.vibrate(50);
    const next = await addStepsToday(500);
    await loadData();
    Alert.alert('🏃 Vận động', `Đã ghi nhận thêm +500 bước chân! Tổng: ${next.toLocaleString()} bước.`);
  };

  const handleToggleHeartRate = () => {
    Vibration.vibrate(100);
    setHeartRate((prev) => (prev === 105 ? 112 : 105));
    Alert.alert('❤️ Nhịp tim', `Nhịp tim đo được: ${heartRate === 105 ? 112 : 105} BPM (Mức ổn định).`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.userProfileGroup}
          activeOpacity={0.8}
          onPress={() => onNavigate && onNavigate('profile')}
        >
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>
              {(profile?.name || 'F')[0].toUpperCase()}
            </Text>
            <View style={styles.avatarOnlineDot} />
          </View>
          <View>
            <View style={styles.nameStreakRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {profile?.name || 'Hội viên FitLife'}
              </Text>
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 5 ngày</Text>
              </View>
            </View>
            <Text style={styles.greeting}>{getVietnameseGreeting()}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.coinCapsule}
            activeOpacity={0.8}
            onPress={() => onNavigate && onNavigate('shop')}
          >
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.coinAmount}>{coins}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.circleBtn}
            activeOpacity={0.7}
            onPress={() => onNavigate && onNavigate('menu')}
          >
            <Ionicons name="grid-outline" size={18} color={COLORS.black} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroEyebrow}>TỔNG QUAN SỨC KHỎE</Text>
          <Text style={styles.heroTitle}>Hôm nay bạn</Text>
          <Text style={styles.heroTitleAccent}>cảm thấy thế nào?</Text>
        </View>

        <TouchableOpacity
          style={styles.questMiniCard}
          activeOpacity={0.85}
          onPress={() => onNavigate && onNavigate('quests')}
        >
          <Text style={styles.questMiniLabel}>Nhiệm vụ</Text>
          <Text style={styles.questMiniValue}>
            {completedQuestCount}/{totalQuestCount}
          </Text>
          <Text style={styles.questMiniSub}>Hoàn thành →</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Mood Quick-Chips */}
      <View style={styles.moodRow}>
        {MOODS.map((m) => {
          const isSelected = currentMood.includes(m.label.split(' ')[1] || m.label);
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.moodChip, isSelected && styles.moodChipActive]}
              onPress={() => handleSelectMood(m.label)}
              activeOpacity={0.7}
            >
              <Text style={[styles.moodText, isSelected && styles.moodTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Neon Lime Waveform Activity Card with Live Progress */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setBreakdownVisible(true)}
      >
        <WaveformCard
          progress={overallProgress}
          message={
            overallProgress >= 80
              ? 'Phong độ hôm nay cực kỳ xuất sắc! 🔥'
              : 'Duy trì nhịp độ rèn luyện rất tốt!'
          }
        />
      </TouchableOpacity>

      {/* AI Coach Quick Launcher Banner */}
      <TouchableOpacity
        style={styles.aiQuickBanner}
        activeOpacity={0.85}
        onPress={() => onNavigate && onNavigate('aicoach')}
      >
        <View style={styles.aiQuickIcon}>
          <Ionicons name="sparkles" size={18} color={COLORS.black} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.aiQuickTitle}>Trợ Lý AI FitLife Coach</Text>
            <View style={styles.aiTurboBadge}>
              <Text style={styles.aiTurboText}>AI 24/7</Text>
            </View>
          </View>
          <Text style={styles.aiQuickSub}>
            Tư vấn thực đơn, tra cứu calo món Việt & lịch tập cá nhân
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* ExerciseDB API 1500 Workouts Quick Launcher Card */}
      <TouchableOpacity
        style={styles.aiQuickBanner}
        activeOpacity={0.85}
        onPress={() => onNavigate && onNavigate('workout')}
      >
        <View style={styles.workoutPreviewBox}>
          <ExpoImage
            source={{ uri: 'https://static.exercisedb.dev/media/0JtKWum.gif' }}
            style={{ width: 46, height: 46 }}
            contentFit="contain"
            autoplay={true}
            cachePolicy="memory-disk"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.aiQuickTitle}>Kho Bài Tập Thể Lực</Text>
            <View style={[styles.aiTurboBadge, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[styles.aiTurboText, { color: '#059669' }]}>1,500 Bài</Text>
            </View>
          </View>
          <Text style={styles.aiQuickSub}>
            Hướng dẫn động tác trực quan • Giọng đọc HLV & Bấm giờ 3 hiệp
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* 2x2 Metric Grid Cards */}
      <View style={styles.metricGrid}>
        <View style={styles.gridRow}>
          <MetricCard
            icon="heart"
            iconColor="#DC2626"
            iconBg="#FEE2E2"
            label="Nhịp tim"
            value={heartRate}
            unit="BPM"
            subtext="Trạng thái ổn định"
            actionLabel="Đo"
            onAction={handleToggleHeartRate}
          />
          <MetricCard
            icon="flame"
            iconColor="#EA580C"
            iconBg="#FFEDD5"
            label="Tiêu hao"
            value={caloriesBurned.toFixed(0)}
            unit="Kcal"
            subtext="Đã đốt qua tập luyện"
            actionLabel="+ Ghi"
            onAction={() => onNavigate && onNavigate('calorie')}
          />
        </View>

        <View style={styles.gridRow}>
          <MetricCard
            icon="walk"
            iconColor="#16A34A"
            iconBg="#DCFCE7"
            label="Bước chân"
            value={walkSteps.toLocaleString()}
            unit="bước"
            subtext="Mục tiêu: 10,000"
            actionLabel="+500"
            onAction={handleAddSteps}
          />
          <MetricCard
            icon="water"
            iconColor="#0284C7"
            iconBg="#E0F2FE"
            label="Nước uống"
            value={waterTotal.toLocaleString()}
            unit="ml"
            subtext={`Mục tiêu: ${profile?.targetWater || 2200} ml`}
            actionLabel="+250ml"
            onAction={handleQuickAddWater250}
            onPress={() => setWaterModalVisible(true)}
          />
        </View>
      </View>

      {/* Modal Quick Add Water */}
      <Modal visible={waterModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ghi Nhận Nước Uống 💧</Text>
            <Text style={styles.modalSub}>Nhập hoặc chọn lượng nước vừa uống (ml):</Text>
            <View style={styles.waterQuickRow}>
              {['150', '250', '500'].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.waterQuickChip, inputWater === val && styles.waterQuickChipActive]}
                  onPress={() => setInputWater(val)}
                >
                  <Text style={[styles.waterQuickText, inputWater === val && styles.waterQuickTextActive]}>
                    +{val} ml
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={inputWater}
              onChangeText={setInputWater}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.bg }]}
                onPress={() => setWaterModalVisible(false)}
              >
                <Text style={styles.modalBtnCancel}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.lime }]}
                onPress={handleAddWaterModal}
              >
                <Text style={styles.modalBtnOk}>+ Lưu lượng nước</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Overall Progress Breakdown */}
      <Modal visible={breakdownVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎯 Điểm Tiến Độ Hôm Nay: {overallProgress}%</Text>
            <Text style={styles.modalSub}>Tổng hợp dựa trên 3 tiêu chí cốt lõi:</Text>
            <View style={{ gap: 10, marginVertical: 12 }}>
              <View style={styles.breakdownRow}>
                <Ionicons name="trophy-outline" size={18} color="#D97706" />
                <Text style={styles.breakdownLabel}>Nhiệm vụ hàng ngày ({completedQuestCount}/{totalQuestCount})</Text>
                <Text style={styles.breakdownVal}>Tỷ trọng 50%</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Ionicons name="water-outline" size={18} color="#0284C7" />
                <Text style={styles.breakdownLabel}>Lượng nước ({waterTotal} ml)</Text>
                <Text style={styles.breakdownVal}>Tỷ trọng 25%</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Ionicons name="walk-outline" size={18} color="#16A34A" />
                <Text style={styles.breakdownLabel}>Vận động ({walkSteps} bước)</Text>
                <Text style={styles.breakdownVal}>Tỷ trọng 25%</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: COLORS.lime, alignSelf: 'stretch', alignItems: 'center' }]}
              onPress={() => setBreakdownVisible(false)}
            >
              <Text style={styles.modalBtnOk}>Đã hiểu 👍</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Adequate bottom padding for floating capsule dock */}
      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  userProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.soft,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.black,
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nameStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '800',
    maxWidth: 145,
  },
  streakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B45309',
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FDE047',
    ...SHADOWS.soft,
  },
  coinIcon: {
    fontSize: 13,
  },
  coinAmount: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#854D0E',
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.soft,
  },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.black,
    lineHeight: 33,
    letterSpacing: -0.4,
  },
  heroTitleAccent: {
    fontSize: 27,
    fontWeight: '800',
    color: '#4D7C0F',
    lineHeight: 33,
    letterSpacing: -0.4,
  },
  questMiniCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  questMiniLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  questMiniValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.black,
    marginVertical: 2,
  },
  questMiniSub: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  moodChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 16,
    ...SHADOWS.soft,
  },
  moodChipActive: {
    backgroundColor: COLORS.limeLight,
    borderColor: COLORS.limeDark,
  },
  moodText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  moodTextActive: {
    color: '#365314',
    fontWeight: '800',
  },
  aiQuickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    marginBottom: 12,
    ...SHADOWS.card,
  },
  aiQuickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutPreviewBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  aiQuickTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.black,
  },
  aiTurboBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiTurboText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
  },
  aiQuickSub: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  metricGrid: {
    gap: 12,
    marginTop: 2,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 22,
    ...SHADOWS.card,
  },
  modalTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  waterQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  waterQuickChip: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waterQuickChipActive: {
    backgroundColor: COLORS.lime,
    borderColor: COLORS.limeDark,
  },
  waterQuickText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  waterQuickTextActive: {
    color: COLORS.black,
  },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  modalBtnCancel: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalBtnOk: {
    color: COLORS.black,
    fontWeight: '800',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: SIZES.xs,
    fontWeight: '600',
    color: COLORS.black,
  },
  breakdownVal: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
});
