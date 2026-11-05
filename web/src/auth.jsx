import { RegisterPage } from './register';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { FiActivity, FiArrowUpRight } from 'react-icons/fi';
import { request, rootFor } from './api';
import { useAuth, useNotify } from './context';
import { Button, Field, Select } from './ui';
export const profileFields = [
  { key: 'full_name', label: 'Họ và tên', maxLength: 100 },
  { key: 'date_of_birth', label: 'Ngày sinh', type: 'date' },
  { key: 'height', label: 'Chiều cao (cm)', type: 'number', min: 80, max: 250, step: '0.1' },
  { key: 'weight', label: 'Cân nặng (kg)', type: 'number', min: 25, max: 300, step: '0.1' },
];
export function ProfileFields({ initial = {}, register }) {
  return <div className="form-grid">{profileFields.map(f => <Field key={f.key} {...f} label={f.label} name={f.key} defaultValue={initial[f.key]} required={register || f.key !== 'date_of_birth'} />)}
    <Select label="Giới tính" name="gender" options={{ male: 'Nam', female: 'Nữ' }} defaultValue={initial.gender || 'male'} />
    <Select label="Mức vận động" name="activity_level" options={{ sedentary: 'Ít vận động', light: 'Nhẹ', moderate: 'Vừa phải', active: 'Năng động' }} defaultValue={initial.activity_level || 'moderate'} />
    <Select label="Mục tiêu" name="goal" options={{ lose: 'Giảm cân', maintain: 'Giữ cân', gain: 'Tăng cân' }} defaultValue={initial.goal || 'maintain'} />
  </div>;
}
export function readProfile(form) {
  const d = Object.fromEntries(new FormData(form));
  for (const key of ['height', 'weight']) if (d[key] !== undefined) d[key] = Number(d[key]);
  if (!d.date_of_birth) delete d.date_of_birth;
  return d;
}
export function AuthPage({ mode = 'login' }) { return mode === 'register' ? <RegisterPage /> : <AuthForm mode={mode} />; }
function AuthForm({ mode }) {
  const { user, ready, signIn } = useAuth(); const notify = useNotify();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [email, setEmail] = useState(''), [verification, setVerification] = useState(''), [sent, setSent] = useState(false);
  if (ready && user) return <Navigate to={rootFor(user.role)} replace />;
  const perform = async fn => { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const submit = e => {
    e.preventDefault(); const form = e.currentTarget;
    perform(async () => {
      const body = mode === 'register' ? { ...readProfile(form), email, verification_token: verification, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : Object.fromEntries(new FormData(form));
      if (mode === 'register' && body.password !== body.confirm_password) throw new Error('Mật khẩu xác nhận chưa khớp.');
      if (mode === 'forgot') {
        await request('/api/auth/reset-password', { method: 'POST', body }); notify('Đã đặt lại mật khẩu. Bạn có thể đăng nhập.');
      } else signIn(await request(`/api/auth/${mode}`, { method: 'POST', body }));
    });
  };
  return <main className="auth-layout"><section className="auth-story"><Link className="brand" to="/login"><FiActivity aria-hidden="true" />FitLife<span>Fitness platform</span></Link><div><h1>Không ngừng<br />tiến bộ.</h1><p>Từng bài tập, từng mục tiêu.<br />Cùng huấn luyện viên của bạn.</p></div><p className="auth-foot">Một tài khoản. Đồng hành trên Web và Mobile.</p></section><section className="auth-content"><div className="auth-form"><h2>{mode === 'login' ? 'Chào mừng trở lại' : mode === 'register' ? 'Bắt đầu hành trình' : 'Lấy lại mật khẩu'}</h2><p>{mode === 'login' ? 'Đăng nhập để tiếp tục hành trình của bạn.' : mode === 'register' ? 'Xác minh email, sau đó hoàn thiện hồ sơ.' : 'Yêu cầu mã gửi đến email rồi đặt mật khẩu mới.'}</p>
    {error && <div className="inline-error" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <Field label="Email" name="email" type="email" autoComplete="email" required maxLength={100} value={email} onChange={e => { setEmail(e.target.value); setVerification(''); setSent(false); }} />
      {mode !== 'login' && <div className="verification"><Button secondary type="button" busy={busy} disabled={!email} onClick={() => perform(async () => { const r = await request(mode === 'register' ? '/api/auth/register/email-code' : '/api/auth/forgot-password', { method: 'POST', body: { email } }); setSent(true); notify(r.message || 'Đã gửi mã qua email.'); })}>Gửi mã xác minh</Button><Field label="Mã 6 chữ số" name={mode === 'forgot' ? 'code' : undefined} pattern="[0-9]{6}" maxLength={6} inputMode="numeric" required={mode === 'forgot'} />{mode === 'register' && <Button secondary type="button" busy={busy} disabled={!sent || !!verification} onClick={e => { const code = e.currentTarget.closest('form').querySelector('[inputmode="numeric"]').value; perform(async () => { const r = await request('/api/auth/register/verify-email', { method: 'POST', body: { email, code } }); setVerification(r.verification_token); notify('Email đã được xác minh.'); }); }}>{verification ? 'Đã xác minh' : 'Xác minh email'}</Button>}</div>}
      {mode === 'register' && <ProfileFields register />}
      <Field label={mode === 'forgot' ? 'Mật khẩu mới' : 'Mật khẩu'} type="password" name={mode === 'forgot' ? 'new_password' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={1024} required />
      {mode === 'register' && <Field label="Xác nhận mật khẩu" type="password" name="confirm_password" autoComplete="new-password" minLength={8} required />}
      <Button type="submit" busy={busy} disabled={mode === 'register' && !verification} icon={FiArrowUpRight}>{mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Đặt lại mật khẩu'}</Button>
    </form><div className="auth-links"><Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Quay lại đăng nhập'}</Link>{mode === 'login' && <Link to="/forgot">Quên mật khẩu?</Link>}</div>
  </div></section></main>;
}
