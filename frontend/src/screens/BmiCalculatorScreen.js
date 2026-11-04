import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOW } from '../constants/theme';
import {
  getUserProfile,
  saveUserProfile,
  getBmiHistory,
  addBmiRecord,
} from '../utils/storage';

export default function BmiCalculatorScreen() {
  const [height, setHeight] = useState('170'); // cm
  const [weight, setWeight] = useState('65');  // kg
  const [age, setAge] = useState('24');
  const [gender, setGender] = useState('male'); // 'male' | 'female'
  const [activity, setActivity] = useState('moderate'); // sedentary, light, moderate, active

  const [bmiResult, setBmiResult] = useState(null);
  const [history, setHistory] = useState([]);

  const loadData = async () => {
    const prof = await getUserProfile();
    if (prof) {
      if (prof.height) setHeight(prof.height.toString());
      if (prof.weight) setWeight(prof.weight.toString());
      if (prof.age) setAge(prof.age.toString());
      if (prof.gender) setGender(prof.gender);
      if (prof.activityLevel) setActivity(prof.activityLevel);
    }
    const hist = await getBmiHistory();
    setHistory(hist);
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateBMI = async () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age, 10) || 25;

    if (!h || h < 80 || h > 250) {
      Alert.alert('Lỗi', 'Vui lòng nhập chiều cao hợp lệ (80 - 250 cm)!');
      return;
    }
    if (!w || w < 25 || w > 300) {
      Alert.alert('Lỗi', 'Vui lòng nhập cân nặng hợp lệ (25 - 300 kg)!');
      return;
    }

    const hInMeter = h / 100;
    const bmiVal = parseFloat((w / (hInMeter * hInMeter)).toFixed(1));

    // Category (Tiêu chuẩn Châu Á WHO/IDI & WPRO)
    let category = 'Bình thường';
    let color = COLORS.primary;
    let advice = 'Thể trạng của bạn đang ở mức rất tốt! Hãy tiếp tục duy trì chế độ ăn và tập luyện hiện tại.';

    if (bmiVal < 18.5) {
      category = 'Thiếu cân';
      color = COLORS.secondary;
      advice = 'Bạn đang hơi gầy. Nên bổ sung thêm các bữa ăn phụ giàu dinh dưỡng, uống sữa và tập kháng lực để tăng cơ bắp.';
    } else if (bmiVal < 23) {
      category = 'Bình thường (Lý tưởng)';
      color = COLORS.primary;
      advice = 'Chúc mừng! Bạn có chỉ số cơ thể đạt chuẩn cân đối. Hãy duy trì thói quen sống lành mạnh này.';
    } else if (bmiVal < 25) {
      category = 'Thừa cân nhẹ';
      color = COLORS.accent;
      advice = 'Bạn đang hơi thừa cân một chút. Hãy tăng cường vận động hàng ngày và giảm bớt đồ ngọt, chiên xào.';
    } else {
      category = 'Béo phì';
      color = COLORS.danger;
      advice = 'Chỉ số BMI cảnh báo nguy cơ cho tim mạch và khớp. Nên điều chỉnh chế độ ăn giảm thâm hụt calo và tập thể dục đều đặn.';
    }

    // BMR (Mifflin-St Jeor formula)
    let bmrVal = 10 * w + 6.25 * h - 5 * a;
    if (gender === 'male') {
      bmrVal += 5;
    } else {
      bmrVal -= 161;
    }
    bmrVal = Math.round(bmrVal);

    // TDEE multipliers
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
    };
    const tdeeVal = Math.round(bmrVal * (multipliers[activity] || 1.375));

    // Ideal weight range for height (Asian standard BMI 18.5 - 23)
    const minIdealWeight = (18.5 * hInMeter * hInMeter).toFixed(1);
    const maxIdealWeight = (23 * hInMeter * hInMeter).toFixed(1);

    const result = {
      bmi: bmiVal,
      category,
      color,
      advice,
      bmr: bmrVal,
      tdee: tdeeVal,
      idealWeight: `${minIdealWeight} - ${maxIdealWeight} kg`,
      targetDeficit: tdeeVal - 500, // giảm cân
      targetSurplus: tdeeVal + 400, // tăng cân
    };

    setBmiResult(result);

    // Save to profile & history
    const prof = await getUserProfile();
    await saveUserProfile({
      ...prof,
      height: h,
      weight: w,
      age: a,
      gender,
      activityLevel: activity,
      targetCalories: tdeeVal,
    });

    const newRecord = await addBmiRecord({
      weight: w,
      height: h,
      bmi: bmiVal,
      category,
      color,
    });
    if (newRecord) {
      setHistory((prev) => [newRecord, ...prev.slice(0, 20)]);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Input Form */}
      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>Thông tin thể trạng</Text>

        {/* Gender selector */}
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[
              styles.genderBtn,
              gender === 'male' && { backgroundColor: COLORS.secondaryLight, borderColor: COLORS.secondary },
            ]}
            onPress={() => setGender('male')}
          >
            <Ionicons
              name="male"
              size={20}
              color={gender === 'male' ? COLORS.secondary : COLORS.textMuted}
            />
            <Text
              style={[
                styles.genderText,
                gender === 'male' && { color: COLORS.secondary, fontWeight: '700' },
              ]}
            >
              Nam
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.genderBtn,
              gender === 'female' && { backgroundColor: '#FCE7F3', borderColor: '#EC4899' },
            ]}
            onPress={() => setGender('female')}
          >
            <Ionicons
              name="female"
              size={20}
              color={gender === 'female' ? '#EC4899' : COLORS.textMuted}
            />
            <Text
              style={[
                styles.genderText,
                gender === 'female' && { color: '#EC4899', fontWeight: '700' },
              ]}
            >
              Nữ
            </Text>
          </TouchableOpacity>
        </View>

        {/* Height and Weight inputs */}
        <View style={styles.inputRow}>
          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Chiều cao (cm)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
                placeholder="170"
              />
              <Text style={styles.inputUnit}>cm</Text>
            </View>
          </View>

          <View style={styles.inputCol}>
            <Text style={styles.inputLabel}>Cân nặng (kg)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                placeholder="65"
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>
          </View>
        </View>

        {/* Age and Activity */}
        <View style={styles.inputRow}>
          <View style={[styles.inputCol, { flex: 0.8 }]}>
            <Text style={styles.inputLabel}>Tuổi</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
                placeholder="24"
              />
              <Text style={styles.inputUnit}>tuổi</Text>
            </View>
          </View>

          <View style={[styles.inputCol, { flex: 1.2 }]}>
            <Text style={styles.inputLabel}>Mức độ vận động</Text>
            <View style={styles.activityBtnRow}>
              {[
                { id: 'sedentary', label: 'Ít' },
                { id: 'light', label: 'Nhẹ' },
                { id: 'moderate', label: 'Vừa' },
                { id: 'active', label: 'Nhiều' },
              ].map((act) => (
                <TouchableOpacity
                  key={act.id}
                  style={[
                    styles.miniActBtn,
                    activity === act.id && { backgroundColor: COLORS.primary },
                  ]}
                  onPress={() => setActivity(act.id)}
                >
                  <Text
                    style={[
                      styles.miniActText,
                      activity === act.id && { color: COLORS.white, fontWeight: '700' },
                    ]}
                  >
                    {act.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Calculate button */}
        <TouchableOpacity style={styles.calcBtn} onPress={calculateBMI}>
          <Ionicons name="calculator" size={20} color={COLORS.white} />
          <Text style={styles.calcBtnText}>Tính toán chỉ số thể trạng</Text>
        </TouchableOpacity>
      </View>

      {/* Result Display Card */}
      {bmiResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Kết quả phân tích</Text>
            <View style={[styles.categoryBadge, { backgroundColor: `${bmiResult.color}20` }]}>
              <Text style={[styles.categoryBadgeText, { color: bmiResult.color }]}>
                {bmiResult.category}
              </Text>
            </View>
          </View>

          <View style={styles.bmiDisplayCenter}>
            <Text style={[styles.bigBmiNumber, { color: bmiResult.color }]}>
              {bmiResult.bmi}
            </Text>
            <Text style={styles.bmiLabel}>Chỉ số BMI</Text>
          </View>

          {/* Advice */}
          <View style={styles.adviceBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.primaryDark} />
            <Text style={styles.adviceText}>{bmiResult.advice}</Text>
          </View>

          {/* Energy metrics: BMR, TDEE, Ideal Weight */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricItemTitle}>Cân nặng chuẩn</Text>
              <Text style={styles.metricItemVal}>{bmiResult.idealWeight}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricItemTitle}>Năng lượng nền (BMR)</Text>
              <Text style={styles.metricItemVal}>{bmiResult.bmr} kcal</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricItemTitle}>Tiêu hao ngày (TDEE)</Text>
              <Text style={[styles.metricItemVal, { color: COLORS.primaryDark }]}>
                {bmiResult.tdee} kcal
              </Text>
            </View>
          </View>

          {/* Calories Target Recommendation */}
          <View style={styles.targetCaloriesBox}>
            <Text style={styles.targetCalTitle}>🎯 Gợi ý calo theo mục tiêu của bạn:</Text>
            <Text style={styles.targetCalRow}>
              • <Text style={{ fontWeight: '700' }}>Giảm cân an toàn:</Text> ăn ~{bmiResult.targetDeficit} kcal/ngày
            </Text>
            <Text style={styles.targetCalRow}>
              • <Text style={{ fontWeight: '700' }}>Giữ cân hiện tại:</Text> ăn ~{bmiResult.tdee} kcal/ngày
            </Text>
            <Text style={styles.targetCalRow}>
              • <Text style={{ fontWeight: '700' }}>Tăng cơ / Tăng cân:</Text> ăn ~{bmiResult.targetSurplus} kcal/ngày
            </Text>
          </View>
        </View>
      )}

      {/* History */}
      <Text style={styles.sectionTitle}>Lịch sử đo gần đây</Text>
      {history.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={32} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Chưa có lịch sử đo nào. Hãy tính thử ngay!</Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {history.map((rec) => (
            <View key={rec.id} style={styles.historyItem}>
              <View>
                <Text style={styles.historyWeight}>
                  {rec.weight} kg • {rec.height} cm
                </Text>
                <Text style={styles.historyDate}>{rec.date} {rec.time}</Text>
              </View>
              <View style={[styles.historyBadge, { backgroundColor: `${rec.color || COLORS.primary}20` }]}>
                <Text style={[styles.historyBmi, { color: rec.color || COLORS.primary }]}>
                  BMI {rec.bmi} ({rec.category})
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

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
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    marginBottom: 20,
    ...SHADOW,
  },
  cardTitle: {
    fontSize: SIZES.lg,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    gap: 8,
  },
  genderText: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  inputUnit: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  activityBtnRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniActBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  miniActText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  calcBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    ...SHADOW,
  },
  calcBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: SIZES.base,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    ...SHADOW,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: SIZES.xs,
    fontWeight: '800',
  },
  bmiDisplayCenter: {
    alignItems: 'center',
    marginVertical: 14,
  },
  bigBmiNumber: {
    fontSize: 52,
    fontWeight: '900',
  },
  bmiLabel: {
    fontSize: SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  adviceBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  adviceText: {
    flex: 1,
    fontSize: SIZES.xs,
    color: '#065F46',
    lineHeight: 18,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginBottom: 14,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricItemTitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 4,
    textAlign: 'center',
  },
  metricItemVal: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: COLORS.text,
  },
  targetCaloriesBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  targetCalTitle: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  targetCalRow: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  historyList: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    ...SHADOW,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyWeight: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  historyDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  historyBmi: {
    fontSize: SIZES.xs,
    fontWeight: '700',
  },
});
