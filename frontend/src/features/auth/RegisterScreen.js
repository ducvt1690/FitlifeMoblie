import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import AuthShell from './AuthShell';
import Glass from '../../ui/Glass';
import Surface from '../../ui/Surface';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import Segmented from '../../ui/Segmented';
import NumberStepper from '../../ui/NumberStepper';
import { colors, radius, themed } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { authApi, request } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const STEPS = [
  { title: 'Tạo tài khoản', sub: 'Chỉ mất chưa tới một phút.' },
  { title: 'Về cơ thể bạn', sub: 'Dùng để tính lượng calo và nước mỗi ngày.' },
  { title: 'Mục tiêu của bạn', sub: 'Bạn có thể đổi lại bất cứ lúc nào.' },
];
const GOALS = [
  { value: 'lose', label: 'Giảm cân', hint: 'Ăn ít hơn mức tiêu hao một chút' },
  { value: 'maintain', label: 'Giữ dáng', hint: 'Giữ cân nặng hiện tại' },
  { value: 'gain', label: 'Tăng cơ', hint: 'Ăn dư một chút, tập kháng lực' },
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
    full_name: '', email: '', password: '', confirm_password: '',
    gender: 'male', age: 22, height: 170, weight: 65,
    goal: 'maintain', activity_level: 'moderate',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [code, setCode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [proof, setProof] = useState(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);
  const emailVersion = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const email = form.email.trim().toLowerCase();
  const verified = !!proof && !!email && proof.email === email && proof.expiresAt > now;
  const codeSent = !!sentEmail && sentEmail === email;
  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const fade = useRef(new Animated.Value(1)).current;
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const set = (key) => (value) => {
    if (key === 'email' && value.trim().toLowerCase() !== email) {
      emailVersion.current += 1;
      setProof(null); setCode(''); setSentEmail(''); setResendAt(0);
    }
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
    if ([...form.password].length < 8 || !form.password.trim()) e.password = 'Mật khẩu cần ít nhất 8 ký tự.';
    if (!form.confirm_password || form.confirm_password !== form.password) e.confirm_password = 'Mật khẩu nhập lại chưa khớp.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const emailAction = async (kind) => {
    if (inFlight.current || !validateAccount()) return;
    if (kind === 'send' && resendAt > Date.now()) return;
    if (kind === 'verify' && !/^\d{6}$/.test(code)) {
      setErrors({ code: 'Nhập mã 6 số đã gửi đến email.' }); return;
    }
    const version = emailVersion.current;
    inFlight.current = true; setBusy(true);
    try {
      if (kind === 'send') {
        setProof(null); setCode('');
        const response = await request('/api/auth/register/email-code', { method: 'POST', body: { email } });
        if (version !== emailVersion.current) return;
        setSentEmail(email); setResendAt(Date.now() + (response.resend_after || 60) * 1000);
      } else {
        const response = await request('/api/auth/register/verify-email', { method: 'POST', body: { email, code } });
        if (version !== emailVersion.current) return;
        setProof({ email, token: response.verification_token, expiresAt: Date.now() + (response.expires_in || 600) * 1000 });
        setCode(''); go(1);
      }
    } catch (error) {
      if (version !== emailVersion.current) return;
      if (error.status === 429 && kind === 'send') setResendAt(Date.now() + 60000);
      setErrors({ form: error.message });
    } finally { inFlight.current = false; setBusy(false); }
  };

  // The account is created here, but signing in waits for the plan screen: signing in leaves the auth screens.
  const submit = async () => {
    if (inFlight.current) return;
    if (!proof || proof.email !== email || proof.expiresAt <= Date.now()) {
      setProof(null); setSentEmail(''); setCode('');
      setErrors({ form: 'Xác minh email đã hết hạn. Vui lòng gửi mã mới.' }); go(0); return;
    }
    inFlight.current = true;
    setBusy(true);
    setErrors({});
    try {
      const res = await authApi.register({ ...form, email, verification_token: proof.token, full_name: form.full_name.trim() });
      setResult(res);
      go(3);
    } catch (e) {
      if (e.status === 409) { setErrors({ email: e.message }); go(0); }
      else if (e.status === 403) {
        setProof(null); setSentEmail(''); setCode(''); setErrors({ form: e.message }); go(0);
      } else if (e.status === 400) { setErrors({ form: e.message }); go(0); }
      else setErrors({ form: e.message });
    } finally {
      inFlight.current = false; setBusy(false);
    }
  };

  const next = () => {
    if (inFlight.current) return;
    if (step === 0) {
      if (!validateAccount()) return;
      if (!verified) { emailAction(codeSent ? 'verify' : 'send'); return; }
    }
    if (step < 2) go(step + 1);
    else submit();
  };
  const back = () => {
    if (inFlight.current) return;
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
          <Text variant="title">{STEPS[step].title}</Text>
          <Text tone="dim">{STEPS[step].sub}</Text>
        </View>

        {step === 0 && (
          <Glass blur intensity={45} radius={radius.lg} style={styles.card}>
            <TextField label="Họ và tên" value={form.full_name} onChangeText={set('full_name')} placeholder="Nguyễn Văn A"
              editable={!busy} autoComplete="name" textContentType="name" error={errors.full_name} maxLength={100}
              returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
            <TextField ref={emailRef} label="Email" value={form.email} onChangeText={set('email')} placeholder="ban@email.com"
              editable={!busy} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
              error={errors.email} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
            <TextField ref={passwordRef} label="Mật khẩu" value={form.password} onChangeText={set('password')}
              editable={!busy} placeholder="Ít nhất 8 ký tự" secure autoComplete="new-password" textContentType="newPassword"
              error={errors.password} returnKeyType="next" onSubmitEditing={next} />
            <TextField label="Nhập lại mật khẩu" value={form.confirm_password} onChangeText={set('confirm_password')}
              editable={!busy} placeholder="Nhập lại mật khẩu" secure autoComplete="new-password" textContentType="newPassword"
              error={errors.confirm_password} returnKeyType="next" onSubmitEditing={next} />
            {verified ? <Text tone="accent">Email đã được xác minh.</Text> : codeSent ? (
              <>
                <Text variant="label" tone="dim">Mã xác minh đã gửi đến {email}. Mã có hiệu lực 10 phút.</Text>
                <TextField label="Mã xác minh email" placeholder="Mã 6 số" value={code}
                  onChangeText={value => { setCode(value.replace(/\D/g, '').slice(0, 6)); setErrors({}); }}
                  editable={!busy} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
                  maxLength={6} error={errors.code} returnKeyType="go" onSubmitEditing={next} />
                <Button title={resendSeconds ? `Gửi lại mã sau ${resendSeconds}s` : 'Gửi lại mã'} variant="ghost"
                  onPress={() => emailAction('send')} disabled={busy || resendSeconds > 0} />
              </>
            ) : <Text variant="caption" tone="dim">Xác minh email trước khi tạo tài khoản. FitLife sẽ gửi mã 6 số đến hộp thư của bạn.</Text>}
          </Glass>
        )}

        {step === 1 && (
          <View style={styles.stack}>
            <Segmented value={form.gender} onChange={set('gender')}
              options={[{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }]} />
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
        <Button title={step === 0 && !verified ? (codeSent ? 'Xác minh email' : 'Gửi mã xác minh') : step < 2 ? 'Tiếp tục' : 'Tạo kế hoạch'} onPress={next} loading={busy} disabled={busy} />
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
    { color: colors.calories, value: p.target_calories?.toLocaleString('vi-VN'), unit: 'kcal / ngày', label: 'Năng lượng' },
    { color: colors.water, value: p.target_water ? (p.target_water / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : null, unit: 'lít / ngày', label: 'Nước' },
    { color: colors.text, value: bmi?.toLocaleString('vi-VN', { maximumFractionDigits: 1 }), unit: 'BMI', label: 'Chỉ số cơ thể' },
  ];
  return (
    <AuthShell>
      <View style={styles.body}>
        <View style={[styles.head, styles.planHead]}>
          <Text variant="title">Kế hoạch của {result.user.name?.trim().split(' ').pop() || 'bạn'}</Text>
          <Text tone="dim">Mục tiêu mỗi ngày, tính từ chiều cao, cân nặng và mức vận động bạn vừa nhập.</Text>
        </View>
        <View style={styles.stack}>
          {items.map(it => (
            <Surface key={it.label} radius={radius.md} style={styles.planRow}>
              <Text variant="label" tone="dim">{it.label}</Text>
              <Text variant="metric" color={it.color}>{it.value ?? '—'}<Text variant="label" tone="faint"> {it.unit}</Text></Text>
            </Surface>
          ))}
        </View>
        <View style={styles.spacer} />
        <Button title="Vào FitLife" onPress={onDone} />
      </View>
    </AuthShell>
  );
}

const styles = themed(() => StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6 },
  dash: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.glassStrong },
  dashOn: { backgroundColor: colors.text },
  body: { flexGrow: 1, paddingTop: 12 },
  head: { gap: 6, marginBottom: 22 },
  planHead: { marginTop: 32 },
  card: { padding: 18, gap: 14 },
  stack: { gap: 12 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  subhead: { marginTop: 10 },
  alert: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: 12, marginTop: 14 },
  spacer: { flexGrow: 1, minHeight: 24 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  planRow: { padding: 16, gap: 2 },
}));
