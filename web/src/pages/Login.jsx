import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import { homeFor } from '../lib/options.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Chỉ quay lại trang cũ nếu trang đó thuộc khu của vai trò này.
  const target = (role) => {
    const home = homeFor(role);
    const from = location.state?.from;
    return from?.startsWith(home) ? from : home;
  };

  if (user) return <Navigate to={target(user.role)} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Email không hợp lệ.';
    if (!form.password) next.password = 'Vui lòng nhập mật khẩu.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      const signedIn = await login(form.email.trim(), form.password);
      navigate(target(signedIn.role), { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <AuthLayout title="Chào mừng trở lại" subtitle="Đăng nhập để tiếp tục hành trình sức khỏe của bạn.">
      <form className="form" onSubmit={onSubmit} noValidate>
        {formError && <div className="alert alert-error" role="alert">{formError}</div>}
        <Field label="Email" type="email" autoComplete="email" value={form.email}
          onChange={set('email')} error={errors.email} placeholder="ban@email.com" />
        <Field label="Mật khẩu" type="password" autoComplete="current-password" value={form.password}
          onChange={set('password')} error={errors.password} placeholder="••••••••" />
        <button className="btn btn-dark btn-block btn-lg" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p className="muted center">Chưa có tài khoản? <Link to="/register">Đăng ký</Link></p>
    </AuthLayout>
  );
}
