import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { getUserProfile, saveUserProfile, getCoins, clearAuthSession } from '../utils/storage';
import { soundManager } from '../utils/audio';

const GOALS = [
  { id: 'lose', label: 'Giảm mỡ', icon: 'trending-down-outline', delta: -500 },
  { id: 'maintain', label: 'Giữ cân', icon: 'remove-outline', delta: 0 },
  { id: 'gain', label: 'Tăng cơ', icon: 'trending-up-outline', delta: 400 },
];

const ACTIVITY = [
  { id: 'sedentary', label: 'Ít', mult: 1.2 },
  { id: 'light', label: 'Nhẹ', mult: 1.375 },
  { id: 'moderate', label: 'Vừa', mult: 1.55 },
  { id: 'active', label: 'Nhiều', mult: 1.725 },
];

export default function ProfileScreen({ onSaved, onLogout }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('23');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('65');
  const [activity, setActivity] = useState('moderate');
  const [goal, setGoal] = useState('maintain');
  const [targetWater, setTargetWater] = useState('2275');
  const [targetCalories, setTargetCalories] = useState('2000');
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    (async () => {
      const p = await getUserProfile();
      if (p) {
        setName(p.name && p.name !== 'Người dùng FitLife' ? p.name : '');
        setGender(p.gender || 'male');
        setAge(String(p.age ?? 23));
        setHeight(String(p.height ?? 170));
        setWeight(String(p.weight ?? 65));
        setActivity(p.activityLevel || 'moderate');
        setGoal(p.goal || 'maintain');
        setTargetWater(String(p.targetWater ?? 2200));
        setTargetCalories(String(p.targetCalories ?? 2000));
      }
      setCoins(await getCoins());
    })();
  }, []);

  // Mifflin-St Jeor BMR -> TDEE -> adjusted by goal
  const computeCalories = (w, h, a, g, act, gl) => {
    const bmr = 10 * w + 6.25 * h - 5 * a + (g === 'male' ? 5 : -161);
    const mult = ACTIVITY.find((x) => x.id === act)?.mult || 1.55;
    const delta = GOALS.find((x) => x.id === gl)?.delta || 0;
    return Math.round(bmr * mult + delta);
  };

  const handleAutoSuggest = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    if (!w || !h || !a) {
      Alert.alert('Thiếu thông tin', 'Hãy nhập đủ cân nặng, chiều cao và tuổi để tính gợi ý.');
      return;
    }
    setTargetWater(String(Math.round(w * 35)));
    setTargetCalories(String(computeCalories(w, h, a, gender, activity, goal)));
  };

  const handleSave = async () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    const tw = parseInt(targetWater, 10);
    const tc = parseInt(targetCalories, 10);

    if (!w || w < 25 || w > 300) return Alert.alert('Lỗi', 'Cân nặng hợp lệ: 25 - 300 kg');
    if (!h || h < 80 || h > 250) return Alert.alert('Lỗi', 'Chiều cao hợp lệ: 80 - 250 cm');
    if (!a || a < 5 || a > 100) return Alert.alert('Lỗi', 'Tuổi hợp lệ: 5 - 100');
    if (!tw || tw < 500) return Alert.alert('Lỗi', 'Mục tiêu nước tối thiểu 500 ml');
    if (!tc || tc < 800) return Alert.alert('Lỗi', 'Mục tiêu calo tối thiểu 800 kcal');

    const old = await getUserProfile();
    const ok = await saveUserProfile({
      ...old,
      name: name.trim() || 'Người dùng FitLife',
      gender,
      age: a,
      height: h,
      weight: w,
      activityLevel: activity,
      goal,
      targetWater: tw,
      targetCalories: tc,
    });
    if (ok) {
      soundManager.playCoinSound();
      if (onSaved) onSaved();
      Alert.alert('✅ Đã lưu hồ sơ', 'Mục tiêu nước, calo và lời khuyên AI sẽ được cập nhật theo hồ sơ mới.');
    } else {
      Alert.alert('Lỗi', 'Không lưu được hồ sơ, vui lòng thử lại.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất tài khoản hiện tại không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await clearAuthSession();
            if (onLogout) onLogout();
          },
        },
      ]
    );
  };

  const bmi = (() => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    return w && h ? (w / (h * h)).toFixed(1) : '--';
  })();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header card */}
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={34} color={COLORS.black} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{name.trim() || 'Người dùng FitLife'}</Text>
            <Text style={styles.heroSub}>BMI {bmi}  •  🪙 {coins} coins</Text>
          </View>
        </View>

        {/* Basic info */}
        <Text style={styles.label}>Tên hiển thị</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nhập tên của bạn"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>Giới tính</Text>
        <View style={styles.row}>
          {[
            { id: 'male', label: 'Nam', icon: 'male' },
            { id: 'female', label: 'Nữ', icon: 'female' },
          ].map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[styles.chip, gender === g.id && styles.chipActive]}
              onPress={() => setGender(g.id)}
            >
              <Ionicons name={g.icon} size={16} color={COLORS.black} />
              <Text style={styles.chipText}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Tuổi</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={age} onChangeText={setAge} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Cao (cm)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={height} onChangeText={setHeight} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Nặng (kg)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={weight} onChangeText={setWeight} />
          </View>
        </View>

        <Text style={styles.label}>Mức độ vận động</Text>
        <View style={styles.row}>
          {ACTIVITY.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[styles.chip, { flex: 1, justifyContent: 'center' }, activity === a.id && styles.chipActive]}
              onPress={() => setActivity(a.id)}
            >
              <Text style={styles.chipText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Mục tiêu của bạn</Text>
        <View style={styles.row}>
          {GOALS.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={[styles.chip, { flex: 1, justifyContent: 'center' }, goal === g.id && styles.chipActive]}
              onPress={() => setGoal(g.id)}
            >
              <Ionicons name={g.icon} size={14} color={COLORS.black} />
              <Text style={styles.chipText}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Targets */}
        <View style={styles.targetHeader}>
          <Text style={styles.sectionTitle}>Mục tiêu hằng ngày</Text>
          <TouchableOpacity style={styles.suggestBtn} onPress={handleAutoSuggest} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={13} color={COLORS.black} />
            <Text style={styles.suggestText}>Tự gợi ý</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Nước (ml)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={targetWater} onChangeText={setTargetWater} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Calo (kcal)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={targetCalories} onChangeText={setTargetCalories} />
          </View>
        </View>
        <Text style={styles.hint}>
          Gợi ý: nước = cân nặng × 35 ml; calo tính theo công thức Mifflin-St Jeor, vận động và mục tiêu bạn chọn.
        </Text>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.black} />
          <Text style={styles.saveText}>Lưu hồ sơ</Text>
        </TouchableOpacity>

        {/* Logout / Switch Account Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>Đăng xuất / Đổi tài khoản</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    marginBottom: 8,
    ...SHADOWS.card,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroName: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.black },
  heroSub: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 3, fontWeight: '600' },
  label: {
    fontSize: SIZES.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: SIZES.base,
    fontWeight: '700',
    color: COLORS.black,
  },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  chipActive: { backgroundColor: COLORS.lime, borderColor: COLORS.limeDark },
  chipText: { fontSize: SIZES.sm, fontWeight: '800', color: COLORS.black },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
  },
  sectionTitle: { fontSize: SIZES.base, fontWeight: '900', color: COLORS.black },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.limeLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  suggestText: { fontSize: SIZES.xs, fontWeight: '800', color: COLORS.black },
  hint: { fontSize: 11, color: COLORS.textMuted, marginTop: 8, lineHeight: 16 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.lime,
    paddingVertical: 15,
    borderRadius: 18,
    marginTop: 24,
    ...SHADOWS.soft,
  },
  saveText: { fontSize: SIZES.base, fontWeight: '900', color: COLORS.black },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 12,
  },
  logoutText: {
    fontSize: SIZES.sm,
    fontWeight: '800',
    color: '#DC2626',
  },
});
