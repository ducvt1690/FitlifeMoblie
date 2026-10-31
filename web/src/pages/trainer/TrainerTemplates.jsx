import { useState } from 'react';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad, useNotice } from '../../lib/useLoad.js';
import { LEVELS, WORKOUT_CATEGORIES, labelOf } from '../../lib/options.js';
import { Empty, Loadable, Notice, PageHeader } from '../../components/ui.jsx';
import Field from '../../components/Field.jsx';

const EMPTY = { title: '', category: WORKOUT_CATEGORIES[0], minutes: '30', calories_est: '200', level: 'beginner', description: '' };
const toForm = (t) => ({ title: t.title, category: t.category, minutes: String(Math.round(t.duration_seconds / 60)),
  calories_est: String(t.calories_est), level: t.level, description: t.description });

export default function TrainerTemplates() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.trainer.templates());
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const minutes = Number(form.minutes);
  const calories = Number(form.calories_est);
  const valid = form.title.trim() && form.description.trim() && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440
    && Number.isInteger(calories) && calories >= 0 && calories <= 10000;

  function reset() { setEditing(null); setForm(EMPTY); }

  async function save(e) {
    e.preventDefault();
    const body = { title: form.title.trim(), category: form.category, duration_seconds: minutes * 60,
      calories_est: calories, level: form.level, description: form.description.trim() };
    setBusy(true);
    const result = await run(() => (editing ? api.trainer.updateTemplate(editing, body) : api.trainer.createTemplate(body)),
      editing ? 'Đã cập nhật giáo án.' : 'Đã tạo giáo án.');
    setBusy(false);
    if (result) { reset(); await reload(); }
  }

  async function toggle(t) {
    if (await run(() => api.trainer.updateTemplate(t.template_id, { is_active: !t.is_active }),
      t.is_active ? 'Đã ngừng dùng giáo án.' : 'Đã bật lại giáo án.')) await reload();
  }

  return (
    <div className="page">
      <PageHeader title="Giáo án" subtitle="Bài tập mẫu để giao cho học viên. Giáo án ngừng dùng vẫn giữ trong lịch sử bài giao." />
      <Notice notice={notice} />
      <div className="split">
        <section className="card">
          <div className="card-head"><h3>{editing ? 'Sửa giáo án' : 'Giáo án mới'}</h3></div>
          <form className="form" onSubmit={save}>
            <Field label="Tên giáo án" value={form.title} onChange={set('title')} maxLength={150} placeholder="Cardio đốt mỡ 30 phút" />
            <div className="row-2">
              <label className="field">
                <span className="field-label">Loại</span>
                <select className="select" value={form.category} onChange={set('category')}>
                  {[...new Set([...WORKOUT_CATEGORIES, form.category])].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Mức độ</span>
                <select className="select" value={form.level} onChange={set('level')}>
                  {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </label>
            </div>
            <div className="row-2">
              <Field label="Thời lượng" type="number" min="1" max="1440" suffix="phút" value={form.minutes} onChange={set('minutes')} />
              <Field label="Calo ước tính" type="number" min="0" suffix="kcal" value={form.calories_est} onChange={set('calories_est')} />
            </div>
            <label className="field">
              <span className="field-label">Hướng dẫn</span>
              <textarea className="textarea" rows="5" maxLength={5000} value={form.description} onChange={set('description')}
                placeholder="Khởi động 5 phút, chạy 20 phút, giãn cơ 5 phút…" />
            </label>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={!valid || busy}>{editing ? 'Lưu thay đổi' : 'Tạo giáo án'}</button>
              {editing && <button type="button" className="btn btn-ghost" onClick={reset}>Hủy sửa</button>}
            </div>
          </form>
        </section>
        <section className="card">
          <Loadable loading={loading} error={error} onRetry={reload}>
            {data && (data.templates.length === 0 ? <Empty>Bạn chưa có giáo án nào.</Empty> : (
              <ul className="row-list">
                {data.templates.map((t) => (
                  <li key={t.template_id} className={t.is_active ? '' : 'is-off'}>
                    <div>
                      <b>{t.title}</b>
                      <span className="muted small">
                        {t.category} · {labelOf(LEVELS, t.level)} · {Math.round(t.duration_seconds / 60)} phút · ~{t.calories_est} kcal
                      </span>
                    </div>
                    {!t.is_active && <span className="tag muted-tag">Ngừng dùng</span>}
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(t.template_id); setForm(toForm(t)); }}>Sửa</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggle(t)}>{t.is_active ? 'Ngừng dùng' : 'Bật lại'}</button>
                  </li>
                ))}
              </ul>
            ))}
          </Loadable>
        </section>
      </div>
    </div>
  );
}
