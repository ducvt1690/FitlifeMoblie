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
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import {
  loginAccount,
  registerAccount,
  resetPasswordAccount,
} from '../utils/storage';
import { soundManager } from '../utils/audio';

function getPasswordStrength(pass) {
  if (!pass) return { level: 0, label: '', color: '#E2E8F0' };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass) || /[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass) || (/[A-Z]/.test(pass) && /[0-9]/.test(pass))) score += 1;

  if (score <= 1) return { level: 1, label: 'Yếu (Cần ít nhất 6 ký tự)', color: '#EF4444' };
  if (score === 2) return { level: 2, label: 'Trung bình', color: '#F59E0B' };
  if (score === 3) return { level: 3, label: 'Mạnh', color: '#10B981' };
  return { level: 4, label: 'Rất mạnh & An toàn', color: '#059669' };
}

export default function AuthScreen({ onLoginSuccess }) {
  // 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState('login');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Inline feedback banner: { type: 'error' | 'success', text: string }
  const [feedback, setFeedback] = useState(null);

  const switchMode = (nextMode) => {
    setAuthMode(nextMode);
    setFeedback(null);
    setPassword('');
    setConfirmPassword('');
  };

  const validateEmailFormat = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleSubmit = async () => {
    setFeedback(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanEmail) {
      setFeedback({ type: 'error', text: 'Vui lòng nhập địa chỉ Email của bạn.' });
      return;
    }

    if (!validateEmailFormat(cleanEmail)) {
      setFeedback({
        type: 'error',
        text: 'Định dạng Email chưa hợp lệ (Ví dụ: tenban@gmail.com).',
      });
      return;
    }

    // 1. Luồng Khôi phục mật khẩu
    if (authMode === 'forgot') {
      if (!cleanPass || cleanPass.length < 6) {
        setFeedback({
          type: 'error',
          text: 'Mật khẩu mới phải có tối thiểu từ 6 ký tự trở lên.',
        });
        return;
      }
      if (cleanPass !== confirmPassword.trim()) {
        setFeedback({
          type: 'error',
          text: 'Mật khẩu xác nhận không trùng khớp với mật khẩu mới.',
        });
        return;
      }

      setIsLoading(true);
      const res = await resetPasswordAccount(cleanEmail, cleanPass);
      setIsLoading(false);

      if (res.success) {
        soundManager.playCoinSound();
        Vibration.vibrate(50);
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
        setFeedback({
          type: 'success',
          text: 'Đặt lại mật khẩu thành công! Hãy đăng nhập với mật khẩu mới.',
        });
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
      return;
    }

    // 2. Luồng Đăng ký tài khoản mới
    if (authMode === 'register') {
      const cleanName = name.trim();
      if (!cleanName || cleanName.length < 2) {
        setFeedback({ type: 'error', text: 'Vui lòng nhập Họ và tên đầy đủ của bạn.' });
        return;
      }
      if (!cleanPass || cleanPass.length < 6) {
        setFeedback({
          type: 'error',
          text: 'Mật khẩu bảo mật cần tối thiểu từ 6 ký tự trở lên.',
        });
        return;
      }
      if (cleanPass !== confirmPassword.trim()) {
        setFeedback({ type: 'error', text: 'Mật khẩu xác nhận không trùng khớp.' });
        return;
      }
      if (!agreeTerms) {
        setFeedback({
          type: 'error',
          text: 'Vui lòng đồng ý với Điều khoản dịch vụ & Chính sách bảo mật.',
        });
        return;
      }

      setIsLoading(true);
      const res = await registerAccount(cleanName, cleanEmail, cleanPass);
      setIsLoading(false);

      if (res.success) {
        soundManager.playCoinSound();
        Vibration.vibrate(60);
        if (onLoginSuccess) onLoginSuccess(res.user);
      } else {
        setFeedback({ type: 'error', text: res.message });
      }
      return;
    }

    // 3. Luồng Đăng nhập
    if (!cleanPass) {
      setFeedback({ type: 'error', text: 'Vui lòng nhập mật khẩu đăng nhập.' });
      return;
    }

    setIsLoading(true);
    const res = await loginAccount(cleanEmail, cleanPass);
    setIsLoading(false);

    if (res.success) {
      soundManager.playCoinSound();
      Vibration.vibrate(40);
      if (onLoginSuccess) onLoginSuccess(res.user);
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const passStrength = getPasswordStrength(password);
  const isPasswordMatch =
    confirmPassword.length > 0 && password.length > 0 && password === confirmPassword;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Hero Branding */}
        <View style={styles.brandHeader}>
          <View style={styles.logoOuterRing}>
            <View style={styles.logoWrap}>
              <Ionicons name="flash" size={28} color={COLORS.black} />
            </View>
          </View>
          <View style={styles.brandNameRow}>
            <Text style={styles.brandTitle}>FitLife</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>
          <Text style={styles.brandTagline}>
            Hệ sinh thái quản lý thể hình & dinh dưỡng thông minh
          </Text>
        </View>

        {/* Main Authentication Card */}
        <View style={styles.card}>
          {/* Mode Switcher Tabs (Login / Register) */}
          {authMode !== 'forgot' ? (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, authMode === 'login' && styles.tabBtnActive]}
                onPress={() => switchMode('login')}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="log-in-outline"
                  size={15}
                  color={authMode === 'login' ? COLORS.black : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    authMode === 'login' && styles.tabBtnTextActive,
                  ]}
                >
                  Đăng Nhập
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, authMode === 'register' && styles.tabBtnActive]}
                onPress={() => switchMode('register')}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="person-add-outline"
                  size={14}
                  color={authMode === 'register' ? COLORS.black : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.tabBtnText,
                    authMode === 'register' && styles.tabBtnTextActive,
                  ]}
                >
                  Đăng Ký Mới
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.forgotHeader}>
              <TouchableOpacity
                style={styles.backToLoginBtn}
                onPress={() => switchMode('login')}
                activeOpacity={0.75}
              >
                <Ionicons name="arrow-back" size={16} color={COLORS.black} />
                <Text style={styles.backToLoginText}>Quay lại Đăng nhập</Text>
              </TouchableOpacity>
              <Text style={styles.forgotTitle}>Khôi phục mật khẩu</Text>
              <Text style={styles.forgotSub}>
                Nhập địa chỉ email đã đăng ký tài khoản để thiết lập mật khẩu mới.
              </Text>
            </View>
          )}

          {/* Inline Error / Success Banner */}
          {feedback && (
            <View
              style={[
                styles.feedbackBanner,
                feedback.type === 'error'
                  ? styles.feedbackError
                  : styles.feedbackSuccess,
              ]}
            >
              <Ionicons
                name={
                  feedback.type === 'error'
                    ? 'alert-circle'
                    : 'checkmark-circle'
                }
                size={18}
                color={feedback.type === 'error' ? '#DC2626' : '#059669'}
              />
              <Text
                style={[
                  styles.feedbackText,
                  { color: feedback.type === 'error' ? '#991B1B' : '#065F46' },
                ]}
              >
                {feedback.text}
              </Text>
              <TouchableOpacity onPress={() => setFeedback(null)}>
                <Ionicons
                  name="close"
                  size={16}
                  color={feedback.type === 'error' ? '#991B1B' : '#065F46'}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {authMode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>HỌ VÀ TÊN HỘI VIÊN</Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedField === 'name' && styles.inputBoxFocused,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={
                      focusedField === 'name' ? '#059669' : COLORS.textSecondary
                    }
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập họ và tên của bạn"
                    placeholderTextColor={COLORS.textMuted}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                  {name.trim().length >= 2 && (
                    <Ionicons name="checkmark-circle" size={17} color="#10B981" />
                  )}
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ĐỊA CHỈ EMAIL</Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === 'email' && styles.inputBoxFocused,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={
                    focusedField === 'email' ? '#059669' : COLORS.textSecondary
                  }
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="tenban@gmail.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
                {validateEmailFormat(email.trim()) && (
                  <Ionicons name="checkmark-circle" size={17} color="#10B981" />
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {authMode === 'forgot' ? 'MẬT KHẨU MỚI' : 'MẬT KHẨU'}
              </Text>
              <View
                style={[
                  styles.inputBox,
                  focusedField === 'password' && styles.inputBoxFocused,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={
                    focusedField === 'password' ? '#059669' : COLORS.textSecondary
                  }
                />
                <TextInput
                  style={styles.textInput}
                  placeholder={
                    authMode === 'login'
                      ? 'Nhập mật khẩu của bạn'
                      : 'Tối thiểu 6 ký tự'
                  }
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Meter for Register / Forgot */}
              {authMode !== 'login' && password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4].map((step) => (
                      <View
                        key={step}
                        style={[
                          styles.strengthSegment,
                          {
                            backgroundColor:
                              step <= passStrength.level
                                ? passStrength.color
                                : '#E2E8F0',
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text
                    style={[styles.strengthLabel, { color: passStrength.color }]}
                  >
                    Độ bảo mật: {passStrength.label}
                  </Text>
                </View>
              )}
            </View>

            {(authMode === 'register' || authMode === 'forgot') && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>XÁC NHẬN MẬT KHẨU</Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedField === 'confirm' && styles.inputBoxFocused,
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={
                      focusedField === 'confirm'
                        ? '#059669'
                        : COLORS.textSecondary
                    }
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập lại mật khẩu ở trên"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                  />
                  {isPasswordMatch && (
                    <Ionicons name="checkmark-circle" size={17} color="#10B981" />
                  )}
                </View>
              </View>
            )}

            {/* Login Options: Remember Me & Forgot Password */}
            {authMode === 'login' && (
              <View style={styles.loginMetaRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && styles.checkboxChecked,
                    ]}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={12} color={COLORS.black} />
                    )}
                  </View>
                  <Text style={styles.rememberText}>Duy trì đăng nhập</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => switchMode('forgot')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.forgotLinkText}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Register Terms Checkbox */}
            {authMode === 'register' && (
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAgreeTerms(!agreeTerms)}
                activeOpacity={0.8}
              >
                <View
                  style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}
                >
                  {agreeTerms && (
                    <Ionicons name="checkmark" size={12} color={COLORS.black} />
                  )}
                </View>
                <Text style={styles.termsText}>
                  Tôi đồng ý với{' '}
                  <Text style={styles.termsHighlight}>Điều khoản sử dụng</Text> &{' '}
                  <Text style={styles.termsHighlight}>
                    Chính sách dữ liệu sức khỏe
                  </Text>
                </Text>
              </TouchableOpacity>
            )}

            {/* Primary Action Button */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.black} />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>
                    {authMode === 'login'
                      ? 'Đăng Nhập Tài Khoản'
                      : authMode === 'register'
                      ? 'Hoàn Tất Đăng Ký'
                      : 'Cập Nhật Mật Khẩu Mới'}
                  </Text>
                  <View style={styles.submitArrowCircle}>
                    <Ionicons
                      name="arrow-forward"
                      size={15}
                      color={COLORS.lime}
                    />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Bottom Prompt to switch between Login & Register */}
            <View style={styles.switchPromptRow}>
              <Text style={styles.switchPromptText}>
                {authMode === 'login'
                  ? 'Chưa có tài khoản hội viên?'
                  : 'Đã có tài khoản FitLife Pro?'}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  switchMode(authMode === 'login' ? 'register' : 'login')
                }
                activeOpacity={0.75}
              >
                <Text style={styles.switchPromptLink}>
                  {authMode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Security & Feature Trust Badges */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={14} color="#059669" />
            <Text style={styles.trustText}>Mã hóa SHA-256</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="cloud-done" size={14} color="#0284C7" />
            <Text style={styles.trustText}>Đồng bộ đa thiết bị</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed" size={14} color="#7C3AED" />
            <Text style={styles.trustText}>Riêng tư 100%</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoOuterRing: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(188, 239, 57, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.lime,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.card,
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.black,
    letterSpacing: -0.7,
  },
  proBadge: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.lime,
    letterSpacing: 0.8,
  },
  brandTagline: {
    fontSize: 12.5,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.soft,
  },
  tabBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabBtnTextActive: {
    color: COLORS.black,
    fontWeight: '800',
  },
  forgotHeader: {
    marginBottom: 16,
  },
  backToLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 12,
  },
  backToLoginText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.black,
  },
  forgotTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.black,
  },
  forgotSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  formContainer: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  inputBoxFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    padding: 0,
  },
  strengthContainer: {
    marginTop: 4,
    gap: 4,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 5,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  loginMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.lime,
    borderColor: '#84CC16',
  },
  rememberText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  forgotLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  termsHighlight: {
    fontWeight: '700',
    color: COLORS.black,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.lime,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: '#A3E635',
    ...SHADOWS.soft,
  },
  submitBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.black,
  },
  submitArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  switchPromptText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  switchPromptLink: {
    fontSize: 12.5,
    color: '#059669',
    fontWeight: '800',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  trustDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
});
