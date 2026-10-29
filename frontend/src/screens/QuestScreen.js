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
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import {
  getCoins,
  addCoins,
  getDailyQuests,
  completeQuest,
  saveUserProfile,
  getUserProfile,
  addBmiRecord,
  addWaterLog,
  addMealLog,
  saveSleepToday,
  saveMoodToday,
  addWorkoutLog,
} from '../utils/storage';
import { soundManager } from '../utils/audio';
import SpriteAnimation from '../components/SpriteAnimation';

export default function QuestScreen({ onBack, onNavigate, onQuestCompleted }) {
  const [coins, setCoins] = useState(150);
  const [activeTab, setActiveTab] = useState('Daily');
  const [quests, setQuests] = useState([]);

  // Active interactive modal
  const [activeModal, setActiveModal] = useState(null); // 'q_weight', 'q_water', 'q_meals', 'q_sleep', 'q_mood', 'q_bowel', 'q_workout'

  // Input states for modals
  const [weightInput, setWeightInput] = useState('65');
  const [waterAmount, setWaterAmount] = useState('250');
  const [mealName, setMealName] = useState('Ức gà áp chảo');
  const [mealCal, setMealCal] = useState('350');
  const [sleepHours, setSleepHours] = useState('7.5');
  const [sleepQuality, setSleepQuality] = useState('Ngủ sâu 😴');
  const [selectedMood, setSelectedMood] = useState('Vui vẻ 😊');
  const [moodNote, setMoodNote] = useState('');
  const [bowelStatus, setBowelStatus] = useState('Tốt & Khỏe mạnh 👍');
  const [workoutType, setWorkoutType] = useState('Tabata Cardio (15 phút)');

  const loadData = async () => {
    const c = await getCoins();
    setCoins(c);

    const q = await getDailyQuests();
    setQuests(q);

    const prof = await getUserProfile();
    if (prof?.weight) {
      setWeightInput(prof.weight.toString());
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const completedCount = quests.filter((q) => q.completed).length;
  const totalQuests = quests.length || 7;
  const progressPercent = Math.round((completedCount / totalQuests) * 100);

  const handleOpenQuestAction = (quest) => {
    if (quest.completed) {
      Alert.alert('Đã hoàn thành', `Nhiệm vụ "${quest.title}" đã được ghi nhận hôm nay!`);
      return;
    }
    setActiveModal(quest.id);
  };

  const handleFinishQuest = async (questId, extraValue = null) => {
    soundManager.playCoinSound();
    const { updated, rewardGiven } = await completeQuest(questId, extraValue);
    setQuests(updated);
    if (rewardGiven > 0) {
      setCoins((c) => c + rewardGiven);
    }
    setActiveModal(null);
    if (onQuestCompleted) onQuestCompleted();

    Alert.alert(
      '🎉 Xuất sắc!',
      `Bạn đã hoàn thành nhiệm vụ và nhận được +${rewardGiven} Coins thưởng!`,
      [{ text: 'Nhận xu' }]
    );
  };

  // Specific save handlers
  const handleSaveWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 30 || w > 250) {
      Alert.alert('Lỗi', 'Vui lòng nhập cân nặng hợp lệ (30 - 250 kg)');
      return;
    }
    const prof = await getUserProfile();
    await saveUserProfile({ ...prof, weight: w });
    const h = prof?.height || 170;
    const bmi = parseFloat((w / Math.pow(h / 100, 2)).toFixed(1));
    await addBmiRecord({
      weight: w,
      height: h,
      bmi,
      category: bmi < 18.5 ? 'Thiếu cân' : bmi < 23 ? 'Chuẩn' : 'Thừa cân',
      color: COLORS.primary,
    });
    await handleFinishQuest('q_weight', `${w} kg`);
  };

  const handleSaveWater = async () => {
    const amt = parseInt(waterAmount, 10);
    if (!amt || amt <= 0) return;
    await addWaterLog(amt);
    await handleFinishQuest('q_water', `+${amt} ml`);
  };

  const handleSaveMeal = async () => {
    if (!mealName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên món ăn');
      return;
    }
    const cal = parseInt(mealCal, 10) || 300;
    await addMealLog({
      name: mealName.trim(),
      calories: cal,
      mealType: 'Trưa',
    });
    await handleFinishQuest('q_meals', mealName.trim());
  };

  const handleSaveSleep = async () => {
    await saveSleepToday(sleepHours, sleepQuality);
    await handleFinishQuest('q_sleep', `${sleepHours} hrs`);
  };

  const handleSaveMood = async () => {
    await saveMoodToday(selectedMood, moodNote);
    await handleFinishQuest('q_mood', selectedMood);
  };

  const handleSaveBowel = async () => {
    await handleFinishQuest('q_bowel', bowelStatus);
  };

  const handleSaveWorkout = async () => {
    await addWorkoutLog({
      title: workoutType,
      durationSec: 15 * 60,
      calories: 120,
    });
    await handleFinishQuest('q_workout', workoutType);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={COLORS.black} />
          <Text style={styles.headerTitle}>Quest</Text>
        </TouchableOpacity>

        {/* Coin pill */}
        <View style={styles.coinPill}>
          <View style={styles.coinIconCircle}>
            <Ionicons name="sparkles" size={12} color="#D97706" />
          </View>
          <Text style={styles.coinText}>{coins}</Text>
        </View>
      </View>

      {/* Big Daily Quests Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressCardHeader}>
          <Text style={styles.progressCountText}>
            <Text style={styles.boldCount}>{completedCount}/{totalQuests}</Text> Daily Quests
          </Text>
        </View>

        {/* Custom Slider Bar with circular knob */}
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${progressPercent}%` }]} />
          <View style={[styles.sliderKnob, { left: `${Math.max(2, progressPercent - 3)}%` }]}>
            <View style={styles.knobInner} />
          </View>
        </View>

        <Text style={styles.progressSubtext}>
          Complete all your daily quests to get 70 bonus coins!
        </Text>
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsRow}>
        {['Daily', 'Exclusive', 'Streak'].map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabPill,
                isActive ? styles.tabPillActive : styles.tabPillInactive,
              ]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive ? styles.tabTextActive : styles.tabTextInactive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quests List */}
      <View style={styles.questList}>
        {quests.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.questCard}
            onPress={() => handleOpenQuestAction(item)}
            activeOpacity={0.8}
          >
            {/* Pastel circular icon */}
            <View style={[styles.questIconWrap, { backgroundColor: item.bgColor }]}>
              <Ionicons name={item.icon} size={20} color={item.iconColor} />
            </View>

            {/* Title & subtitle */}
            <View style={styles.questInfo}>
              <Text style={styles.questTitle}>{item.title}</Text>
              <Text style={styles.questSub}>
                {item.value ? `✓ Đã ghi: ${item.value}` : item.subtitle}
              </Text>
            </View>

            {/* Action button */}
            <View
              style={[
                styles.actionBtn,
                item.completed ? styles.actionBtnDone : styles.actionBtnGo,
              ]}
            >
              {item.completed ? (
                <View style={styles.doneContent}>
                  <Ionicons name="checkmark" size={14} color="#059669" />
                  <Text style={styles.doneText}>Done</Text>
                </View>
              ) : (
                <View style={styles.goContent}>
                  <Text style={styles.goText}>Go</Text>
                  <View style={styles.miniCoinDot}>
                    <Ionicons name="sparkles" size={8} color="#D97706" />
                  </View>
                  <Text style={styles.rewardText}>+{item.reward}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ================= MODALS FOR EACH QUEST ================= */}

      {/* 1. Modal Weight */}
      <Modal visible={activeModal === 'q_weight'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>⚖️ Ghi nhận Cân nặng hôm nay</Text>
            <Text style={styles.modalSubDesc}>Nhập số cân hiện tại để theo dõi tiến trình:</Text>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={styles.largeInput}
                keyboardType="numeric"
                value={weightInput}
                onChangeText={setWeightInput}
              />
              <Text style={styles.unitText}>kg</Text>
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveWeight}>
                <Text style={styles.submitBtnText}>Lưu & Nhận +10 🪙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. Modal Water */}
      <Modal visible={activeModal === 'q_water'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>💧 Nạp nước cơ thể</Text>
            <Text style={styles.modalSubDesc}>Chọn lượng nước bạn vừa uống:</Text>
            <View style={styles.presetChipRow}>
              {['150', '250', '500', '750'].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.presetChip, waterAmount === amt && styles.presetChipActive]}
                  onPress={() => setWaterAmount(amt)}
                >
                  <Text style={[styles.presetChipText, waterAmount === amt && styles.presetChipTextActive]}>
                    +{amt}ml
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveWater}>
                <Text style={styles.submitBtnText}>Xác nhận & Nhận +10 🪙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. Modal Meals */}
      <Modal visible={activeModal === 'q_meals'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>🥗 Ghi nhận Bữa ăn</Text>
            <Text style={styles.modalSubDesc}>Nhập món bạn vừa thưởng thức:</Text>
            <TextInput
              style={styles.textInputField}
              placeholder="Tên món ăn (Ví dụ: Phở bò, Salad cá ngừ...)"
              value={mealName}
              onChangeText={setMealName}
            />
            <TextInput
              style={styles.textInputField}
              placeholder="Ước tính calo (kcal)"
              keyboardType="numeric"
              value={mealCal}
              onChangeText={setMealCal}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveMeal}>
                <Text style={styles.submitBtnText}>Lưu & Nhận +10 🪙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Modal Sleep */}
      <Modal visible={activeModal === 'q_sleep'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>🌙 Giấc ngủ đêm qua</Text>
            <Text style={styles.modalSubDesc}>Bạn đã ngủ bao nhiêu tiếng?</Text>
            <View style={styles.presetChipRow}>
              {['6.0', '7.0', '7.5', '8.0', '9.0'].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.presetChip, sleepHours === h && styles.presetChipActive]}
                  onPress={() => setSleepHours(h)}
                >
                  <Text style={[styles.presetChipText, sleepHours === h && styles.presetChipTextActive]}>
                    {h}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalSubDesc, { marginTop: 12 }]}>Chất lượng giấc ngủ:</Text>
            <View style={styles.presetChipRow}>
              {['Ngủ sâu 😴', 'Bình thường 😌', 'Chập chờn 🥱'].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.presetChip, sleepQuality === q && styles.presetChipActive]}
                  onPress={() => setSleepQuality(q)}
                >
                  <Text style={[styles.presetChipText, sleepQuality === q && styles.presetChipTextActive]}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveSleep}>
                <Text style={styles.submitBtnText}>Hoàn thành & Nhận +10 🪙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. Modal Mood */}
      <Modal visible={activeModal === 'q_mood'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>😊 Cảm xúc & Tâm trạng hôm nay</Text>
            <Text style={styles.modalSubDesc}>Bạn cảm thấy thế nào?</Text>
            <View style={styles.presetChipRow}>
              {['Tuyệt vời 🤩', 'Vui vẻ 😊', 'Bình tĩnh 😌', 'Căng thẳng 😫', 'Mệt mỏi 🥱'].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.presetChip, selectedMood === m && styles.presetChipActive]}
                  onPress={() => setSelectedMood(m)}
                >
                  <Text style={[styles.presetChipText, selectedMood === m && styles.presetChipTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.textInputField, { marginTop: 14 }]}
              placeholder="Ghi chú thêm về cảm xúc của bạn (tùy chọn)..."
              value={moodNote}
              onChangeText={setMoodNote}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveMood}>
                <Text style={styles.submitBtnText}>Lưu & Nhận +10 🪙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Modal Bowel */}
      <Modal visible={activeModal === 'q_bowel'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>🩺 Sức khỏe đường ruột</Text>
            <Text style={styles.modalSubDesc}>Tình trạng tiêu hóa hôm nay:</Text>
            <View style={{ gap: 8 }}>
              {['Tốt & Khỏe mạnh 👍', 'Bình thường 👌', 'Cần uống thêm nước 💧', 'Đầy hơi khó tiêu ⚠️'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.optionRow, bowelStatus === status && styles.optionRowActive]}
                  onPress={() => setBowelStatus(status)}
                >
                  <Text style={[styles.optionText, bowelStatus === status && styles.optionTextActive]}>
                    {status}
                  </Text>
                  {bowelStatus === status && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.black} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveBowel}>
                <Text style={styles.submitBtnText}>Ghi nhận & Nhận +10 🪙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. Modal Workout */}
      <Modal visible={activeModal === 'q_workout'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeaderTitle}>🏋️ Hoàn thành buổi tập</Text>
            <Text style={styles.modalSubDesc}>Chọn hoạt động thể lực hoặc mở kho bài tập động tác mẫu:</Text>

            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3FBF9',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#D8EEE8',
                paddingVertical: 8,
                marginBottom: 10,
              }}
            >
              <SpriteAnimation
                sprite={
                  workoutType.includes('Hít đất')
                    ? 'pushup'
                    : workoutType.includes('Chạy')
                    ? 'run'
                    : workoutType.includes('boxing')
                    ? 'boxing'
                    : 'burpee'
                }
                frameCount={6}
                frameDurationMs={160}
                size={110}
                playing={true}
              />
            </View>

            <View style={{ gap: 8 }}>
              {[
                'Tabata Cardio (15 phút)',
                'Hít đất & Gập bụng (15 phút)',
                'Đi bộ nhanh / Chạy bộ (20 phút)',
                'Đấm boxing MMA (15 phút)',
              ].map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.optionRow, workoutType === w && styles.optionRowActive]}
                  onPress={() => setWorkoutType(w)}
                >
                  <Text style={[styles.optionText, workoutType === w && styles.optionTextActive]}>
                    {w}
                  </Text>
                  {workoutType === w && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.black} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {onNavigate && (
              <TouchableOpacity
                style={{
                  marginTop: 10,
                  backgroundColor: '#116B58',
                  borderRadius: 14,
                  paddingVertical: 11,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                onPress={() => {
                  setActiveModal(null);
                  onNavigate('workout');
                }}
              >
                <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                  Mở Kho 1,500 Bài Tập GIF & 2D Có Bấm Giờ
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveModal(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveWorkout}>
                <Text style={styles.submitBtnText}>Xác nhận & Nhận +10 🪙</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom padding */}
      <View style={{ height: 100 }} />
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: SIZES.lg,
    fontWeight: '800',
    color: COLORS.black,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    ...SHADOWS.soft,
  },
  coinIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
    color: COLORS.black,
  },
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    ...SHADOWS.card,
  },
  progressCardHeader: {
    marginBottom: 14,
  },
  progressCountText: {
    fontSize: SIZES.base,
    color: COLORS.black,
    fontWeight: '600',
  },
  boldCount: {
    fontSize: SIZES.xxl,
    fontWeight: '900',
    color: COLORS.black,
  },
  sliderTrack: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 7,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: '100%',
    backgroundColor: COLORS.lime,
    borderRadius: 7,
  },
  sliderKnob: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -11,
    ...SHADOWS.soft,
  },
  knobInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.lime,
  },
  progressSubtext: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabPillActive: {
    backgroundColor: COLORS.black,
  },
  tabPillInactive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
  },
  tabTextActive: {
    color: COLORS.white,
  },
  tabTextInactive: {
    color: COLORS.textMuted,
  },
  questList: {
    gap: 10,
  },
  questCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 14,
    ...SHADOWS.soft,
  },
  questIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  questInfo: {
    flex: 1,
  },
  questTitle: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 2,
  },
  questSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  actionBtnGo: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },
  actionBtnDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  goContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  goText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.black,
  },
  miniCoinDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  doneContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: '#059669',
  },

  // Modals Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 22,
    ...SHADOWS.card,
  },
  modalHeaderTitle: {
    fontSize: SIZES.base,
    fontWeight: '800',
    color: COLORS.black,
    marginBottom: 6,
  },
  modalSubDesc: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingVertical: 10,
    marginBottom: 20,
  },
  largeInput: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.black,
    textAlign: 'center',
  },
  unitText: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginLeft: 6,
  },
  presetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetChipActive: {
    backgroundColor: COLORS.lime,
    borderColor: COLORS.limeDark,
  },
  presetChipText: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  presetChipTextActive: {
    color: COLORS.black,
  },
  textInputField: {
    backgroundColor: COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: SIZES.sm,
    color: COLORS.black,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionRowActive: {
    backgroundColor: COLORS.limeLight,
    borderColor: COLORS.lime,
  },
  optionText: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  optionTextActive: {
    color: COLORS.black,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  cancelBtnText: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  submitBtn: {
    backgroundColor: COLORS.lime,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    ...SHADOWS.soft,
  },
  submitBtnText: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.black,
  },
});
