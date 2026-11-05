import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import AuthShell from './AuthShell';
import Glass from '../../ui/Glass';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import { colors, radius, themed } from '../../theme/tokens';
import { authApi } from '../../api/client';

// Two steps: ask for a 6-digit code by email, then set a new password with it.
export default function ForgotScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);

  const run = async (task) => {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const send = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Nhập đúng email bạn đã đăng ký.');
    run(async () => setSent((await authApi.forgotPassword(email.trim())).message));
  };
  const reset = () => {
    if (!/^\d{6}$/.test(code)) return setError('Mã gồm 6 chữ số trong email.');
    if (password.length < 8) return setError('Mật khẩu mới cần ít nhất 8 ký tự.');
    run(async () => setDone((await authApi.resetPassword(email.trim(), code, password)).message));
  };

  return (
    <AuthShell onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}>
      <View style={styles.hero}>
        <Text variant="title">Quên mật khẩu</Text>
        <Text tone="dim">{sent ? sent : 'Nhập email, FitLife sẽ gửi mã 6 số để bạn đặt mật khẩu mới.'}</Text>
      </View>

      <Glass blur intensity={45} radius={radius.lg} style={styles.card}>
        {done ? (
          <>
            <Text>{done}</Text>
            <Button title="Về đăng nhập" onPress={() => router.replace('/login')} />
          </>
        ) : (
          <>
            <TextField label="Email" value={email} onChangeText={setEmail} placeholder="ban@email.com" editable={!sent}
              autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
              returnKeyType={sent ? 'next' : 'send'} onSubmitEditing={sent ? undefined : send} />
            {sent ? (
              <>
                <TextField label="Mã xác nhận" value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
                  keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6}
                  returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
                <TextField ref={passwordRef} label="Mật khẩu mới" value={password} onChangeText={setPassword} placeholder="Ít nhất 8 ký tự"
                  secure autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={reset} />
              </>
            ) : null}
            {error ? (
              <View style={styles.alert} accessibilityLiveRegion="polite"><Text variant="label" tone="danger">{error}</Text></View>
            ) : null}
            <Button title={sent ? 'Đặt mật khẩu mới' : 'Gửi mã'} onPress={sent ? reset : send} loading={busy} style={styles.cta} />
            {sent ? <Button title="Gửi lại mã / đổi email" variant="ghost" onPress={() => { setSent(''); setCode(''); setError(''); }} /> : null}
          </>
        )}
      </Glass>
    </AuthShell>
  );
}

const styles = themed(() => StyleSheet.create({
  hero: { marginTop: 20, marginBottom: 22, gap: 6 },
  card: { padding: 18, gap: 14 },
  alert: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: 12 },
  cta: { marginTop: 4 },
}));
