import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { IoArrowBack, IoCheckmark } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import Field from '../components/Field.jsx';
import { ACTIVITY, GENDERS, GOALS } from '../lib/options.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEPS = ['Tài khoản', 'Thể trạng', 'Mục tiêu', 'Xác nhận'];


function ageOf(dateStr) {
  if (!dateStr) return null;
  const b = new Date(dateStr + 'T00:00:00');
  const t = new Date();
  return t.getFullYear() - b.getFullYear() - (t < new Date(t.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}

function validate(step, f) {
  const e = {};
  if (step === 0) {
    if (!f.full_name.trim()) e.full_name = 'Vui lòng nhập họ tên.';
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Email không hợp lệ.';
    if ([...f.password].length < 8) e.password = 'Mật khẩu tối thiểu 8 ký tự.';
    if (f.confirm !== f.password) e.confirm = 'Mật khẩu xác nhận không khớp.';
  }
  if (step === 1) {
    if (!f.gender) e.gender = 'Chọn giới tính.';
    const age = ageOf(f.date_of_birth);
    if (age === null || age < 5 || age > 100) e.date_of_birth = 'Ngày sinh không hợp lệ (5–100 tuổi).';
    const h = Number(f.height);
    if (!f.height || h < 80 || h > 250) e.height = 'Chiều cao từ 80 đến 250 cm.';
    const w = Number(f.weight);
    if (!f.weight || w < 25 || w > 300) e.weight = 'Cân nặng từ 25 đến 300 kg.';
  }
  if (step === 2) {
    if (!f.activity_level) e.activity_level = 'Chọn mức vận động.';
    if (!f.goal) e.goal = 'Chọn mục tiêu.';
  }
  return e;
}

function Choice({ options, value, onChange, columns = 2 }) {
  return (
    <div className="choice-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((o) => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)}
          className={`choice ${value === o.value ? 'is-active' : ''}`}>
          <strong>{o.label}</strong>
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm: '',
    gender: '', date_of_birth: '', height: '', weight: '',
    activity_level: '', goal: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const setValue = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const bind = (key) => ({ value: form[key], onChange: (e) => setValue(key, e.target.value), error: errors[key] });

  function next(e) {
    e.preventDefault();
    const found = validate(step, form);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((s) => s + 1);
  }

  async function submit() {
    setSubmitting(true);
    setFormError('');
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        gender: form.gender,
        date_of_birth: form.date_of_birth,
        height: Number(form.height),
        weight: Number(form.weight),
        activity_level: form.activity_level,
        goal: form.goal,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
      });
      navigate('/app', { replace: true });
    } catch (err) {
      setFormError(err.status === 409 ? 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.' : err.message);
      if (err.status === 409) setStep(0);
    } finally {
      setSubmitting(false);
    }
  }

  const labelOf = (list, v) => list.find((o) => o.value === v)?.label ?? '—';

  return (
    <AuthLayout title="Tạo tài khoản FitLife" subtitle="Vài bước để FitLife tính mục tiêu nước và calo cho bạn.">
      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
            <span>{i < step ? <IoCheckmark /> : i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {formError && <div className="alert alert-error" role="alert">{formError}</div>}

      {step < 3 ? (
        <form className="form" onSubmit={next} noValidate>
          {step === 0 && (<>
            <Field label="Họ và tên" autoComplete="name" placeholder="Nguyễn Văn A" {...bind('full_name')} />
            <Field label="Email" type="email" autoComplete="email" placeholder="ban@email.com" {...bind('email')} />
            <Field label="Mật khẩu" type="password" autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" {...bind('password')} />
            <Field label="Xác nhận mật khẩu" type="password" autoComplete="new-password" {...bind('confirm')} />
          </>)}

          {step === 1 && (<>
            <div className="field">
              <span className="field-label">Giới tính</span>
              <Choice options={GENDERS} value={form.gender} onChange={(v) => setValue('gender', v)} />
              {errors.gender && <span className="field-error">{errors.gender}</span>}
            </div>
            <Field label="Ngày sinh" type="date" {...bind('date_of_birth')} />
            <div className="row-2">
              <Field label="Chiều cao" type="number" inputMode="decimal" suffix="cm" placeholder="170" {...bind('height')} />
              <Field label="Cân nặng" type="number" inputMode="decimal" suffix="kg" placeholder="65" {...bind('weight')} />
            </div>
          </>)}

          {step === 2 && (<>
            <div className="field">
              <span className="field-label">Mức vận động</span>
              <Choice options={ACTIVITY} value={form.activity_level} onChange={(v) => setValue('activity_level', v)} />
              {errors.activity_level && <span className="field-error">{errors.activity_level}</span>}
            </div>
            <div className="field">
              <span className="field-label">Mục tiêu</span>
              <Choice options={GOALS} value={form.goal} onChange={(v) => setValue('goal', v)} columns={3} />
              {errors.goal && <span className="field-error">{errors.goal}</span>}
            </div>
          </>)}

          <div className="form-actions">
            {step > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => { setErrors({}); setStep((s) => s - 1); }}>
                <IoArrowBack /> Quay lại
              </button>
            )}
            <button className="btn btn-dark btn-grow">Tiếp tục</button>
          </div>
        </form>
      ) : (
        <div className="form">
          <dl className="review">
            <dt>Họ tên</dt><dd>{form.full_name}</dd>
            <dt>Email</dt><dd>{form.email}</dd>
            <dt>Giới tính</dt><dd>{labelOf(GENDERS, form.gender)}</dd>
            <dt>Tuổi</dt><dd>{ageOf(form.date_of_birth)}</dd>
            <dt>Chiều cao / cân nặng</dt><dd>{form.height} cm · {form.weight} kg</dd>
            <dt>Mức vận động</dt><dd>{labelOf(ACTIVITY, form.activity_level)}</dd>
            <dt>Mục tiêu</dt><dd>{labelOf(GOALS, form.goal)}</dd>
          </dl>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)} disabled={submitting}>
              <IoArrowBack /> Sửa lại
            </button>
            <button className="btn btn-primary btn-grow" onClick={submit} disabled={submitting}>
              {submitting ? 'Đang tạo tài khoản…' : 'Xác nhận và tạo tài khoản'}
            </button>
          </div>
        </div>
      )}

      <p className="muted center">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
    </AuthLayout>
  );
}
