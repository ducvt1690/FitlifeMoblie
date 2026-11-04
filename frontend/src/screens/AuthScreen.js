import { Alert } from '../utils/alerts';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { loginAccount, registerAccount } from '../utils/storage';
import { soundManager } from '../utils/audio';

export default function AuthScreen({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [onboarding, setOnboarding] = useState({ gender: 'male', age: '', height: '', weight: '', activity_level: 'moderate', goal: 'maintain' });
  const [feedback, setFeedback] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setFeedback('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password;

    if (!cleanEmail || !cleanPass) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Email và Mật khẩu!');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      Alert.alert('Email không hợp lệ', 'Vui lòng nhập định dạng email chính xác (VD: ban@gmail.com)!');
      return;
    }

    if (isRegister) {
      const cleanName = name.trim();
      if (!cleanName) {
        Alert.alert('Thiếu họ tên', 'Vui lòng nhập tên của bạn!');
        return;
      }
      if ([...cleanPass].length < 8) {
        Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần tối thiểu từ 8 ký tự trở lên!');
        return;
      }
      if (cleanPass !== confirmPassword) {
        Alert.alert('Mật khẩu không khớp', 'Mật khẩu xác nhận không trùng khớp!');
        return;
      }

      setIsLoading(true);
      const res = await registerAccount(cleanName, cleanEmail, cleanPass, { ...onboarding, age: Number(onboarding.age), height: Number(onboarding.height), weight: Number(onboarding.weight) });
      setIsLoading(false);

      if (res.success) {
        soundManager.playCoinSound();
        Alert.alert('🎉 Đăng ký thành công', `Chào mừng ${cleanName} gia nhập FitLife!`);
        if (onLoginSuccess) onLoginSuccess(res.user);
      } else {
        setFeedback(res.message);
      }
    } else {
      setIsLoading(true);
      const res = await loginAccount(cleanEmail, cleanPass);
      setIsLoading(false);

      if (res.success) {
        soundManager.playCoinSound();
        if (onLoginSuccess) onLoginSuccess(res.user);
      } else {
        setFeedback(res.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Logo & App Branding */}
        <View style={styles.brandHeader}>
          <View style={styles.logoWrap}>
            <Ionicons name="flash" size={32} color={COLORS.black} />
          </View>
          <Text style={styles.brandTitle}>FitLife</Text>
          <Text style={styles.brandTagline}>Sức khỏe đỉnh cao • Thể hình tương lai</Text>
        </View>

        {/* Auth Mode Tabs (Login / Register) */}
        <View style={styles.card}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, !isRegister && styles.tabBtnActive]}
              onPress={() => setIsRegister(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, !isRegister && styles.tabBtnTextActive]}>
                Đăng Nhập
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, isRegister && styles.tabBtnActive]}
              onPress={() => setIsRegister(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, isRegister && styles.tabBtnTextActive]}>
                Tạo Tài Khoản
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>HỌ VÀ TÊN</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Họ và tên" accessibilityLabel="Họ và tên"
                    placeholderTextColor={COLORS.textMuted}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ĐĂNG NHẬP</Text>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  placeholder="ban@email.com" accessibilityLabel="Email"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>MẬT KHẨU</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  accessibilityLabel="Mật khẩu" secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>XÁC NHẬN MẬT KHẨU</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={!showPassword}
                    accessibilityLabel="Xác nhận mật khẩu" value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>
            )}

            {isRegister && <View style={{gap:10}}>
              {['age','height','weight'].map((key)=><View key={key}><Text style={styles.inputLabel}>{{age:'Tuổi',height:'Chiều cao (cm)',weight:'Cân nặng (kg)'}[key]}</Text><TextInput style={styles.inputBox} accessibilityLabel={{age:'Tuổi',height:'Chiều cao',weight:'Cân nặng'}[key]} keyboardType="numeric" value={onboarding[key]} onChangeText={value=>setOnboarding(p=>({...p,[key]:value}))}/></View>)}
              {[["gender",[['male','Nam'],['female','Nữ']]],["activity_level",[['sedentary','Ít vận động'],['light','Nhẹ'],['moderate','Vừa'],['active','Nhiều']]],["goal",[['lose','Giảm cân'],['maintain','Giữ cân'],['gain','Tăng cân']]]].map(([key,choices])=><View key={key} style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{choices.map(([value,label])=><TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{selected:onboarding[key]===value}} onPress={()=>setOnboarding(p=>({...p,[key]:value}))} style={[styles.tabBtn,onboarding[key]===value&&styles.tabBtnActive]}><Text>{label}</Text></TouchableOpacity>)}</View>)}
            </View>}
            {!!feedback&&<Text accessibilityRole="alert" style={{color:'#B91C1C'}}>{feedback}</Text>}
            {/* Submit Action Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              <Text style={styles.submitBtnText}>
                {isRegister ? 'Đăng Ký Tài Khoản →' : 'Đăng Nhập Ngay →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...SHADOWS.card,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8EBE5',
    ...SHADOWS.card,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: COLORS.card,
    ...SHADOWS.soft,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabBtnTextActive: {
    color: COLORS.black,
    fontWeight: '900',
  },
  formContainer: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.black,
    fontWeight: '600',
  },
  demoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF9C3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE047',
    alignSelf: 'flex-start',
  },
  demoFillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#854D0E',
  },
  submitBtn: {
    backgroundColor: COLORS.lime,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
    ...SHADOWS.soft,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.2,
  },
  guestSection: {
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  orText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.soft,
  },
  guestBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.black,
  },
  guestNote: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
});
