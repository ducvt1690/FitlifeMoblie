import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
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
  getStreak,
} from '../utils/storage';
import { soundManager } from '../utils/audio';

function getVietnameseGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng năng lượng ☀️';
  if (hour < 18) return 'Chào buổi chiều bền bỉ 🌤️';
  return 'Chào buổi tối thư giãn 🌙';
}

function getVietnameseDateString() {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const now = new Date();
  const dayName = days[now.getDay()];
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dayName}, ${dd}/${mm}`;
}

export default function HomeScreen({ onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [coins, setCoins] = useState(0);
  const [waterTotal, setWaterTotal] = useState(0);
  const [waterLogs, setWaterLogs] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [walkSteps, setWalkSteps] = useState(0);
  const [heartRate, setHeartRate] = useState(76);
  const [overallProgress, setOverallProgress] = useState(0);
  const [completedQuestCount, setCompletedQuestCount] = useState(0);
  const [totalQuestCount, setTotalQuestCount] = useState(6);
  const [streakDays, setStreakDays] = useState(0);

  // Inline Toast Notification
  const [toastMsg, setToastMsg] = useState(null);

  // Quick water modal
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [inputWater, setInputWater] = useState('250');

  // Breakdown modal
  const [breakdownVisible, setBreakdownVisible] = useState(false);

  const showToast = (text) => {
    setToastMsg(text);
    setTimeout(() => {
      setToastMsg((prev) => (prev === text ? null : prev));
    }, 2800);
  };

  const loadData = async () => {
    const [prof, userCoins, wLogs, wkLogs, steps, quests, currentStreak] =
      await Promise.all([
        getUserProfile(),
        getCoins(),
        getWaterLogsToday(),
        getWorkoutLogsToday(),
        getStepsToday(),
        getDailyQuests(),
        getStreak(),
      ]);

    setProfile(prof);
    setCoins(userCoins);
    setStreakDays(currentStreak);
    setWaterLogs(wLogs || []);
    setWorkoutLogs(wkLogs || []);

    // Water
    const currentWater = (wLogs || []).reduce((acc, curr) => acc + curr.amount, 0);
    setWaterTotal(currentWater);

    // Workouts
    const burned = (wkLogs || []).reduce((acc, curr) => acc + (curr.calories || 0), 0);
    setCaloriesBurned(burned);

    // Steps
    setWalkSteps(steps);

    // Quests calculation
    const completedQuests = (quests || []).filter((q) => q.completed).length;
    const totalQuests = (quests || []).length || 6;
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

  const handleQuickAddWater250 = async () => {
    soundManager.playCoinSound();
    await addWaterLog(250);
    await completeQuest('q_water_1', '+250 ml');
    Vibration.vibrate(50);
    await loadData();
    showToast('💧 Đã ghi nhận +250ml nước uống!');
  };

  const handleAddWaterModal = async () => {
    const amt = parseInt(inputWater, 10);
    if (!amt || amt <= 0) return;
    soundManager.playCoinSound();
    await addWaterLog(amt);
    await completeQuest('q_water_1', `+${amt} ml`);
    setWaterModalVisible(false);
    Vibration.vibrate(80);
    await loadData();
    showToast(`💧 Đã lưu +${amt}ml nước uống hôm nay!`);
  };

  const handleAddSteps = async () => {
    soundManager.playCoinSound();
    Vibration.vibrate(50);
    const next = await addStepsToday(500);
    await loadData();
    showToast(`👟 +500 bước chân! Tổng hôm nay: ${next.toLocaleString()} bước`);
  };

  const handleToggleHeartRate = () => {
    Vibration.vibrate(80);
    const simulatedRates = [74, 78, 82, 86, 76];
    const nextRate =
      simulatedRates[(simulatedRates.indexOf(heartRate) + 1) % simulatedRates.length];
    setHeartRate(nextRate);
    showToast(`❤️ Nhịp tim đo được: ${nextRate} BPM (Trạng thái bình thường)`);
  };

  const waterTarget = profile?.targetWater || 2200;
  const waterPercent = Math.min(100, Math.round((waterTotal / waterTarget) * 100));
  const stepPercent = Math.min(100, Math.round((walkSteps / 10000) * 100));
  const caloriePercent = Math.min(100, Math.round((caloriesBurned / 500) * 100));

  const heightM = (profile?.height || 170) / 100;
  const bmiValue = ((profile?.weight || 65) / (heightM * heightM)).toFixed(1);

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
                <Text style={styles.streakText}>🔥 {streakDays} ngày</Text>
              </View>
            </View>
            <Text style={styles.greeting}>
              {getVietnameseDateString()} • {getVietnameseGreeting()}
            </Text>
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

      {/* Inline Toast Feedback */}
      {toastMsg && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.lime} />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      {/* Neon Lime Waveform Activity Card with Live Progress */}
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => setBreakdownVisible(true)}
      >
        <WaveformCard
          progress={overallProgress}
          message={
            overallProgress >= 80
              ? 'Phong độ hôm nay cực kỳ xuất sắc! 🔥'
              : overallProgress >= 40
              ? 'Đang đi đúng lộ trình mục tiêu ngày!'
              : 'Khởi động ngày mới cùng các chỉ số bên dưới!'
          }
          questStat={`${completedQuestCount}/${totalQuestCount}`}
          waterStat={`${waterTotal}/${waterTarget}ml`}
          stepStat={`${walkSteps.toLocaleString()} bước`}
        />
      </TouchableOpacity>

      {/* Section Title: Biometrics & Daily Trackers */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>CHỈ SỐ HOẠT ĐỘNG HÔM NAY</Text>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('analytics')}
          activeOpacity={0.75}
        >
          <Text style={styles.sectionLink}>Thống kê 7 ngày →</Text>
        </TouchableOpacity>
      </View>

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
            subtext="Nhịp nghỉ ổn định"
            actionLabel="Đo lại"
            onAction={handleToggleHeartRate}
            progressPercent={68}
          />
          <MetricCard
            icon="flame"
            iconColor="#EA580C"
            iconBg="#FFEDD5"
            label="Tiêu hao"
            value={caloriesBurned.toFixed(0)}
            unit="Kcal"
            subtext="Mục tiêu đốt: 500 Kcal"
            actionLabel="+ Ghi"
            onAction={() => onNavigate && onNavigate('calorie')}
            progressPercent={caloriePercent}
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
            subtext={`Đạt ${stepPercent}% / 10,000 bước`}
            actionLabel="+500"
            onAction={handleAddSteps}
            progressPercent={stepPercent}
          />
          <MetricCard
            icon="water"
            iconColor="#0284C7"
            iconBg="#E0F2FE"
            label="Nước uống"
            value={waterTotal.toLocaleString()}
            unit="ml"
            subtext={`Đạt ${waterPercent}% / ${waterTarget} ml`}
            actionLabel="+250ml"
            onAction={handleQuickAddWater250}
            onPress={() => setWaterModalVisible(true)}
            progressPercent={waterPercent}
          />
        </View>
      </View>

      {/* Body Index Snapshot Strip */}
      <View style={styles.bodySnapshotCard}>
        <View style={styles.snapshotHeader}>
          <View style={styles.snapshotTitleGroup}>
            <View style={styles.snapshotIconBox}>
              <Ionicons name="body-outline" size={16} color="#059669" />
            </View>
            <Text style={styles.snapshotTitle}>Hồ Sơ Thể Trạng Cơ Thể</Text>
          </View>
          <TouchableOpacity
            style={styles.snapshotEditBtn}
            onPress={() => onNavigate && onNavigate('bmi')}
            activeOpacity={0.75}
          >
            <Text style={styles.snapshotEditText}>Đo BMI & TDEE</Text>
            <Ionicons name="chevron-forward" size={13} color="#059669" />
          </TouchableOpacity>
        </View>

        <View style={styles.snapshotPillars}>
          <View style={styles.snapshotCol}>
            <Text style={styles.snapshotLabel}>CHIỀU CAO</Text>
            <Text style={styles.snapshotValue}>
              {profile?.height || 170}{' '}
              <Text style={styles.snapshotUnit}>cm</Text>
            </Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotCol}>
            <Text style={styles.snapshotLabel}>CÂN NẶNG</Text>
            <Text style={styles.snapshotValue}>
              {profile?.weight || 65}{' '}
              <Text style={styles.snapshotUnit}>kg</Text>
            </Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotCol}>
            <Text style={styles.snapshotLabel}>CHỈ SỐ BMI</Text>
            <Text style={[styles.snapshotValue, { color: '#059669' }]}>
              {bmiValue}
            </Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotCol}>
            <Text style={styles.snapshotLabel}>MỤC TIÊU CALO</Text>
            <Text style={styles.snapshotValue}>
              {profile?.targetCalories || 2000}{' '}
              <Text style={styles.snapshotUnit}>kcal</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Modal Quick Add Water */}
      <Modal visible={waterModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ghi Nhận Nước Uống 💧</Text>
            <Text style={styles.modalSub}>
              Chọn nhanh dung tích cốc hoặc nhập số ml vừa uống:
            </Text>
            <View style={styles.waterQuickRow}>
              {['150', '250', '350', '500'].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.waterQuickChip,
                    inputWater === val && styles.waterQuickChipActive,
                  ]}
                  onPress={() => setInputWater(val)}
                >
                  <Text
                    style={[
                      styles.waterQuickText,
                      inputWater === val && styles.waterQuickTextActive,
                    ]}
                  >
                    +{val}ml
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
                style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]}
                onPress={() => setWaterModalVisible(false)}
              >
                <Text style={styles.modalBtnCancel}>Đóng</Text>
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
            <Text style={styles.modalTitle}>
              🎯 Điểm Năng Lượng Ngày: {overallProgress}%
            </Text>
            <Text style={styles.modalSub}>
              Tổng hợp theo thời gian thực từ 3 trụ cột rèn luyện:
            </Text>
            <View style={{ gap: 10, marginVertical: 14 }}>
              <View style={styles.breakdownRow}>
                <Ionicons name="trophy-outline" size={18} color="#D97706" />
                <Text style={styles.breakdownLabel}>
                  Nhiệm vụ ngày ({completedQuestCount}/{totalQuestCount})
                </Text>
                <Text style={styles.breakdownVal}>Trọng số 50%</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Ionicons name="water-outline" size={18} color="#0284C7" />
                <Text style={styles.breakdownLabel}>
                  Nước uống ({waterTotal}/{waterTarget} ml)
                </Text>
                <Text style={styles.breakdownVal}>Trọng số 25%</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Ionicons name="walk-outline" size={18} color="#16A34A" />
                <Text style={styles.breakdownLabel}>
                  Bước chân ({walkSteps.toLocaleString()}/10,000)
                </Text>
                <Text style={styles.breakdownVal}>Trọng số 25%</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                {
                  backgroundColor: COLORS.lime,
                  alignSelf: 'stretch',
                  alignItems: 'center',
                },
              ]}
              onPress={() => setBreakdownVisible(false)}
            >
              <Text style={styles.modalBtnOk}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Adequate bottom padding for floating capsule dock */}
      <View style={{ height: 105 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userProfileGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.soft,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.black,
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
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
    fontSize: 15.5,
    color: COLORS.black,
    fontWeight: '800',
    maxWidth: 140,
  },
  streakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  streakText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#B45309',
  },
  greeting: {
    fontSize: 11.5,
    fontWeight: '600',
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
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  coinIcon: {
    fontSize: 13,
  },
  coinAmount: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#854D0E',
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 8,
    ...SHADOWS.soft,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.7,
  },
  sectionLink: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
  metricGrid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bodySnapshotCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  snapshotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  snapshotTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  snapshotIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.black,
  },
  snapshotEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  snapshotEditText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  snapshotPillars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  snapshotCol: {
    flex: 1,
    alignItems: 'center',
  },
  snapshotLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
  },
  snapshotValue: {
    fontSize: 14.5,
    fontWeight: '900',
    color: COLORS.black,
  },
  snapshotUnit: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  snapshotDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#E2E8F0',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 370,
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 22,
    ...SHADOWS.card,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.black,
  },
  modalSub: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  waterQuickRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  waterQuickChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  waterQuickChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  waterQuickText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  waterQuickTextActive: {
    color: '#0284C7',
    fontWeight: '800',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.black,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalBtnOk: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.black,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.black,
  },
  breakdownVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
});
