import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLoad, useNotice } from '../lib/useLoad.js';
import { ACTIVITY, fmt, GENDERS, GOALS } from '../lib/options.js';
import Field from '../components/Field.jsx';
import { Loadable, Notice, PageHeader, Segmented } from '../components/ui.jsx';

const TEXT_FIELDS = ['full_name', 'email', 'date_of_birth'];
const NUMBER_FIELDS = ['height', 'weight'];

const toForm = (p) => ({
  full_name: p.full_name, email: p.email, date_of_birth: p.date_of_birth ?? '', gender: p.gender,
  height: String(p.height), weight: String(p.weight), activity_level: p.activity_level, goal: p.goal,
});

export default function Profile() {
  const { api, refreshUser } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.profile());
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setForm(toForm(data.profile)); }, [data]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const choose = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Chỉ gửi các trường đã đổi; backend từ chối trường lạ.
  function changes() {
    const original = toForm(data.profile);
    const out = {};
    for (const key of Object.keys(form)) {
      if (form[key] === original[key]) continue;
      if (NUMBER_FIELDS.includes(key)) out[key] = Number(form[key]);
      else if (TEXT_FIELDS.includes(key)) out[key] = form[key].trim();
      else out[key] = form[key];
    }
    return out;
  }

  async function submit(e) {
    e.preventDefault();
    const body = changes();
    if (!Object.keys(body).length) return;
    setSaving(true);
    const result = await run(() => api.updateProfile(body), 'Đã lưu hồ sơ. Mục tiêu nước và calo được tính lại.');
    if (result) { await reload(); await refreshUser(); }
    setSaving(false);
  }

  const p = data?.profile;
  return (
    <div className="page narrow">
      <PageHeader title="Hồ sơ" subtitle="Cân nặng, chiều cao, mức vận động và mục tiêu quyết định lượng nước và calo mỗi ngày." />
      <Notice notice={notice} />
      <Loadable loading={loading || !form} error={error} onRetry={reload}>
        {p && form && (<>
          <div className="summary-row">
            <div className="card summary"><span className="muted small">Nước mỗi ngày</span><b>{fmt(p.target_water)} ml</b></div>
            <div className="card summary"><span className="muted small">Calo mỗi ngày</span><b>{fmt(p.target_calories)} kcal</b></div>
            <div className="card summary"><span className="muted small">Tuổi</span><b>{p.age}</b></div>
            <div className="card summary"><span className="muted small">Xu</span><b>{p.fit_coins}</b></div>
          </div>

          <form className="card form" onSubmit={submit}>
            <div className="row-2">
              <Field label="Họ tên" value={form.full_name} onChange={set('full_name')} maxLength={100} />
              <Field label="Email" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="row-3">
              <Field label="Ngày sinh" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
              <Field label="Chiều cao" type="number" suffix="cm" value={form.height} onChange={set('height')} />
              <Field label="Cân nặng" type="number" step="0.1" suffix="kg" value={form.weight} onChange={set('weight')} />
            </div>
            <div className="field">
              <span className="field-label">Giới tính</span>
              <Segmented options={GENDERS} value={form.gender} onChange={choose('gender')} />
            </div>
            <div className="field">
              <span className="field-label">Mức vận động</span>
              <Segmented options={ACTIVITY} value={form.activity_level} onChange={choose('activity_level')} />
            </div>
            <div className="field">
              <span className="field-label">Mục tiêu</span>
              <Segmented options={GOALS} value={form.goal} onChange={choose('goal')} />
            </div>
            <div className="form-actions">
              <button className="btn btn-dark" disabled={saving || !Object.keys(changes()).length}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setForm(toForm(p))}>Hoàn tác</button>
            </div>
          </form>
        </>)}
      </Loadable>
    </div>
  );
}
