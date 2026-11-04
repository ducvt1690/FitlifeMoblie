import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import AuthShell from './AuthShell';
import Glass from '../../ui/Glass';
import Text from '../../ui/Text';
import Button from '../../ui/Button';
import TextField from '../../ui/TextField';
import { colors, radius, themed } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Nhập email và mật khẩu.');
    setBusy(true);
    setError('');
    try {
      await login(email, password); // the root layout switches to the role's area
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <View style={styles.hero}>
        <Text variant="title">Đăng nhập</Text>
        <Text tone="dim">Dùng email bạn đã đăng ký với FitLife.</Text>
      </View>

      <Glass blur intensity={45} radius={radius.lg} style={styles.card}>
        <TextField label="Email" value={email} onChangeText={setEmail} placeholder="ban@email.com"
          autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
          returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
        <TextField ref={passwordRef} label="Mật khẩu" value={password} onChangeText={setPassword} placeholder="••••••••"
          secure autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
        {error ? (
          <View style={styles.alert} accessibilityLiveRegion="polite"><Text variant="label" tone="danger">{error}</Text></View>
        ) : null}
        <Button title="Đăng nhập" onPress={submit} loading={busy} style={styles.cta} />
      </Glass>

      <View style={styles.footer}>
        <Text tone="dim">Chưa có tài khoản?</Text>
        <Button title="Tạo tài khoản" variant="ghost" onPress={() => router.replace('/register')} />
      </View>
    </AuthShell>
  );
}

const styles = themed(() => StyleSheet.create({
  hero: { marginTop: 20, marginBottom: 22, gap: 6 },
  card: { padding: 18, gap: 14 },
  alert: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: 12 },
  cta: { marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
}));
