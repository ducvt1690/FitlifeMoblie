import { useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AuthShell from './AuthShell';
import Glass from '../../ui/Glass';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import Segmented from '../../ui/Segmented';
import NumberStepper from '../../ui/NumberStepper';
import { colors, radius } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { authApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  { title: 'Tạo tài khoản', sub: 'Chỉ mất chưa tới một phút.' },
  { title: 'Về cơ thể bạn', sub: 'Dùng để tính lượng calo và nước mỗi ngày.' },
  { title: 'Mục tiêu của bạn', sub: 'Bạn có thể đổi lại bất cứ lúc nào.' },
];
const GOALS = [
  { value: 'lose', label: 'Giảm cân', hint: 'Đốt mỡ, thâm hụt calo nhẹ', icon: 'trending-down' },
  { value: 'maintain', label: 'Giữ dáng', hint: 'Duy trì cân nặng, khỏe hơn', icon: 'pulse' },
  { value: 'gain', label: 'Tăng cơ', hint: 'Tăng cân nạc, dư calo nhẹ', icon: 'barbell' },
];
const ACTIVITY = [
  { value: 'sedentary', label: 'Ít vận động', hint: 'Ngồi nhiều, hầu như không tập' },
  { value: 'light', label: 'Nhẹ', hint: '1–3 buổi mỗi tuần' },
  { value: 'moderate', label: 'Vừa phải', hint: '3–5 buổi mỗi tuần' },
  { value: 'active', label: 'Năng động', hint: '6–7 buổi mỗi tuần' },
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { width } = useLayout();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    gender: 'male', age: 22, height: 170, weight: 65,
    goal: 'maintain', activity_level: 'moderate',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fade = useRef(new Animated.Value(1)).current;
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const set = (key) => (value) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const go = (next) => {
    fade.setValue(0);
    setStep(next);
    Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const validateAccount = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Nhập tên của bạn.';
    if (!EMAIL.test(form.email.trim())) e.email = 'Email chưa đúng định dạng.';
    if ([...form.password].length < 8) e.password = 'Mật khẩu cần ít nhất 8 ký tự.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  // The account is created here, but signing in waits for the plan screen: signing in leaves the auth screens.
  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const res = await authApi.register({ ...form, email: form.email.trim().toLowerCase(), full_name: form.full_name.trim() });
      setResult(res);
      go(3);
    } catch (e) {
      if (e.status === 409) { setErrors({ email: e.message }); go(0); }
      else setErrors({ form: e.message });
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 0 && !validateAccount()) return;
    if (step < 2) go(step + 1);
    else submit();
  };
  const back = () => {
    if (step > 0) go(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (step === 3 && result) return <PlanStep result={result} onDone={() => signIn(result)} />;

  const progress = (
    <View style={styles.progress} accessibilityLabel={`Bước ${step + 1} trên 3`}>
      {STEPS.map((_, i) => <View key={i} style={[styles.dash, i <= step && styles.dashOn]} />)}
    </View>
  );

  return (
    <AuthShell onBack={back} header={progress}>
      <Animated.View style={[styles.body, { opacity: fade }]}>
        <View style={styles.head}>
          <Text variant="caption" tone="accent" style={styles.eyebrow}>BƯỚC {step + 1}/3</Text>
          <Text variant="title">{STEPS[step].title}</Text>
          <Text tone="dim">{STEPS[step].sub}</Text>
        </View>

        {step === 0 && (
          <Glass blur intensity={45} radius={radius.lg} style={styles.card}>
            <TextField label="Họ và tên" value={form.full_name} onChangeText={set('full_name')} placeholder="Nguyễn Văn A"
              autoComplete="name" textContentType="name" error={errors.full_name} maxLength={100}
              returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
            <TextField ref={emailRef} label="Email" value={form.email} onChangeText={set('email')} placeholder="ban@email.com"
              autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
              error={errors.email} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
            <TextField ref={passwordRef} label="Mật khẩu" value={form.password} onChangeText={set('password')}
              placeholder="Ít nhất 8 ký tự" secure autoComplete="new-password" textContentType="newPassword"
              error={errors.password} returnKeyType="next" onSubmitEditing={next} />
          </Glass>
        )}

        {step === 1 && (
          <View style={styles.stack}>
            <Segmented value={form.gender} onChange={set('gender')}
              options={[{ value: 'male', label: 'Nam', icon: 'male' }, { value: 'female', label: 'Nữ', icon: 'female' }]} />
            <NumberStepper label="Tuổi" value={form.age} onChange={set('age')} min={5} max={100} />
            {/* Side by side only when each stepper still has room for a 3-digit number. */}
            <View style={width >= 420 ? styles.pair : styles.stack}>
              <View style={styles.half}><NumberStepper label="Chiều cao" unit="cm" value={form.height} onChange={set('height')} min={80} max={250} /></View>
              <View style={styles.half}><NumberStepper label="Cân nặng" unit="kg" value={form.weight} onChange={set('weight')} min={25} max={300} /></View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stack}>
            <Segmented stacked value={form.goal} onChange={set('goal')} options={GOALS} />
            <Text variant="heading" style={styles.subhead}>Mức vận động</Text>
            <Segmented stacked value={form.activity_level} onChange={set('activity_level')} options={ACTIVITY} />
          </View>
        )}

        {errors.form ? <View style={styles.alert}><Text variant="label" tone="danger">{errors.form}</Text></View> : null}
        <View style={styles.spacer} />
        <Button title={step < 2 ? 'Tiếp tục' : 'Tạo kế hoạch'} icon={step < 2 ? 'arrow-forward' : 'sparkles'} onPress={next} loading={busy} />
        {step === 0 && (
          <View style={styles.footer}>
            <Text tone="dim">Đã có tài khoản?</Text>
            <Button title="Đăng nhập" variant="ghost" onPress={() => router.replace('/login')} />
          </View>
        )}
      </Animated.View>
    </AuthShell>
  );
}

// Final step: the daily targets the server computed, shown before entering the app.
function PlanStep({ result, onDone }) {
  const p = result.user.profile ?? {};
  const bmi = p.height && p.weight ? p.weight / ((p.height / 100) ** 2) : null;
  const items = [
    { icon: 'flame', color: colors.calories, value: p.target_calories?.toLocaleString('vi-VN'), unit: 'kcal / ngày', label: 'Năng lượng' },
    { icon: 'water', color: colors.water, value: p.target_water ? (p.target_water / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : null, unit: 'lít / ngày', label: 'Nước' },
    { icon: 'body', color: colors.sleep, value: bmi?.toLocaleString('vi-VN', { maximumFractionDigits: 1 }), unit: 'BMI', label: 'Chỉ số cơ thể' },
  ];
  return (
    <AuthShell>
      <View style={styles.body}>
        <View style={[styles.head, styles.planHead]}>
          <View style={styles.doneBadge}><Ionicons name="checkmark" size={30} color={colors.accentInk} /></View>
          <Text variant="caption" tone="accent" style={styles.eyebrow}>SẴN SÀNG</Text>
          <Text variant="title">Kế hoạch của {result.user.name?.trim().split(' ').pop() || 'bạn'}</Text>
          <Text tone="dim">FitLife đã tính mục tiêu mỗi ngày dựa trên cơ thể và mục tiêu của bạn.</Text>
        </View>
        <View style={styles.stack}>
          {items.map(it => (
            <Glass key={it.label} blur intensity={40} radius={radius.md} style={styles.planRow}>
              <View style={[styles.planIcon, { backgroundColor: `${it.color}26` }]}><Ionicons name={it.icon} size={22} color={it.color} /></View>
              <View style={styles.half}>
                <Text variant="label" tone="dim">{it.label}</Text>
                <Text variant="metric">{it.value ?? '—'} <Text variant="label" tone="faint">{it.unit}</Text></Text>
              </View>
            </Glass>
          ))}
        </View>
        <View style={styles.spacer} />
        <Button title="Vào FitLife" icon="arrow-forward" onPress={onDone} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  dash: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.glassStrong },
  dashOn: { backgroundColor: colors.accent },
  body: { flexGrow: 1, paddingTop: 12 },
  head: { gap: 6, marginBottom: 22 },
  planHead: { marginTop: 32 },
  eyebrow: { letterSpacing: 1.6, fontFamily: 'BeVietnamPro_700Bold' },
  card: { padding: 18, gap: 14 },
  stack: { gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  subhead: { marginTop: 10 },
  alert: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: 12, marginTop: 14 },
  spacer: { flexGrow: 1, minHeight: 24 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  doneBadge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  planIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
