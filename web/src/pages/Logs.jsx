import { useState } from 'react';
import { IoWater, IoRestaurant, IoBarbell, IoMoon, IoHappy, IoTrashOutline } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { useLoad, useNotice } from '../lib/useLoad.js';
import { fmt, labelOf, MEAL_TYPES, MOODS, SLEEP_QUALITIES, WORKOUT_CATEGORIES } from '../lib/options.js';
import Field from '../components/Field.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import { Empty, Loadable, Notice, PageHeader, Segmented } from '../components/ui.jsx';

const num = (v) => (v === '' ? NaN : Number(v));

export default function Logs() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(async () => {
    const [water, meals, workouts, sleep, mood] = await Promise.all([
      api.water(), api.meals(), api.workouts(), api.sleep(), api.mood(),
    ]);
    return { water, meals, workouts, sleep: sleep.log, mood: mood.log };
  });

  // Ghi xong thì tải lại để tổng và danh sách luôn khớp backend.
  const save = async (action, message) => {
    const result = await run(action, message);
    if (result) reload();
    return result;
  };

  return (
    <div className="page">
      <PageHeader title="Nhật ký sức khỏe" subtitle="Mỗi mục ghi lần đầu trong ngày được +10 xu." />
      <Notice notice={notice} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="log-grid">
            <WaterCard water={data.water} onAdd={(ml) => save(() => api.addWater(ml), `Đã ghi ${ml} ml nước.`)} />
            <SleepCard log={data.sleep} onSave={(log) => save(() => api.saveSleep(log), 'Đã lưu giấc ngủ.')} />
            <MoodCard log={data.mood} onSave={(log) => save(() => api.saveMood(log), 'Đã lưu tâm trạng.')} />
            <MealCard meals={data.meals}
              onAdd={(meal) => save(() => api.addMeal(meal), `Đã thêm ${meal.meal_name}.`)}
              onDelete={(id) => save(() => api.deleteMeal(id), 'Đã xóa bữa ăn.')} />
            <WorkoutCard workouts={data.workouts}
              onAdd={(w) => save(() => api.addWorkout(w), `Đã ghi buổi tập ${w.title}.`)} />
          </div>
        )}
      </Loadable>
    </div>
  );
}

function CardHead({ id, icon: Icon, tint, title, children }) {
  return (
    <div className="card-head" id={id}>
      <h3 className="with-icon"><span className={`badge-icon sm ${tint}`}><Icon /></span>{title}</h3>
      {children}
    </div>
  );
}

function WaterCard({ water, onAdd }) {
  const [custom, setCustom] = useState('');
  const amount = num(custom);
  return (
    <article className="card">
      <CardHead id="water" icon={IoWater} tint="tint-blue" title="Nước uống">
        <span className="muted small">{fmt(water.total)} / {fmt(water.target)} ml</span>
      </CardHead>
      <div className="water-row">
        <ProgressRing value={water.total} max={water.target} size={96} stroke={10} color="var(--secondary)">
          <b>{Math.round((water.total / water.target) * 100)}%</b>
        </ProgressRing>
        <div className="quick-add">
          {[150, 250, 500].map((ml) => (
            <button key={ml} className="btn btn-ghost" onClick={() => onAdd(ml)}>+{ml} ml</button>
          ))}
        </div>
      </div>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); onAdd(amount).then((ok) => ok && setCustom('')); }}>
        <Field label="Lượng khác" type="number" min="1" max="5000" suffix="ml" value={custom}
          onChange={(e) => setCustom(e.target.value)} placeholder="300" />
        <button className="btn btn-primary" disabled={!(amount >= 1 && amount <= 5000)}>Ghi</button>
      </form>
      {water.logs.length > 0 && (
        <ul className="chip-list">
          {water.logs.map((l) => <li key={l.log_id}>{l.log_time} · {l.amount} ml</li>)}
        </ul>
      )}
    </article>
  );
}

function SleepCard({ log, onSave }) {
  const [hours, setHours] = useState(log?.hours ?? 7.5);
  const [quality, setQuality] = useState(log?.quality ?? SLEEP_QUALITIES[1]);
  return (
    <article className="card">
      <CardHead id="sleep" icon={IoMoon} tint="tint-purple" title="Giấc ngủ đêm qua">
        {log && <span className="muted small">Đã ghi {log.hours} giờ</span>}
      </CardHead>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave({ hours: Number(hours), quality }); }}>
        <label className="range-field">
          <span className="field-label">Số giờ ngủ: <b>{hours} giờ</b></span>
          <input type="range" min="0" max="14" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <Segmented options={SLEEP_QUALITIES} value={quality} onChange={setQuality} />
        <button className="btn btn-primary">{log ? 'Cập nhật' : 'Lưu giấc ngủ'}</button>
      </form>
    </article>
  );
}

function MoodCard({ log, onSave }) {
  const [mood, setMood] = useState(log?.mood_label ?? '');
  const [note, setNote] = useState(log?.note ?? '');
  return (
    <article className="card">
      <CardHead id="mood" icon={IoHappy} tint="tint-yellow" title="Tâm trạng hôm nay">
        {log && <span className="muted small">Đã ghi: {log.mood_label}</span>}
      </CardHead>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave({ mood_label: mood, note }); }}>
        <div className="pill-group">
          {MOODS.map((m) => (
            <button type="button" key={m} className={`pill ${mood === m ? 'is-active' : ''}`} onClick={() => setMood(m)}>{m}</button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">Ghi chú (không bắt buộc)</span>
          <textarea className="textarea" rows="2" maxLength="2000" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={!mood}>{log ? 'Cập nhật' : 'Lưu tâm trạng'}</button>
      </form>
    </article>
  );
}

const EMPTY_MEAL = { meal_name: '', meal_type: 'lunch', calories: '', protein: '', carbs: '', fat: '' };

function MealCard({ meals, onAdd, onDelete }) {
  const [form, setForm] = useState(EMPTY_MEAL);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const valid = form.meal_name.trim() && Number.isInteger(num(form.calories)) && num(form.calories) >= 1;

  async function submit(e) {
    e.preventDefault();
    const meal = {
      meal_name: form.meal_name.trim(), meal_type: form.meal_type, calories: num(form.calories),
      protein: Number(form.protein) || 0, carbs: Number(form.carbs) || 0, fat: Number(form.fat) || 0,
    };
    if (await onAdd(meal)) setForm(EMPTY_MEAL);
  }

  return (
    <article className="card span-2">
      <CardHead id="meal" icon={IoRestaurant} tint="tint-orange" title="Bữa ăn">
        <span className="muted small">{fmt(meals.total_calories)} kcal hôm nay</span>
      </CardHead>
      <form className="form" onSubmit={submit}>
        <Segmented options={MEAL_TYPES} value={form.meal_type} onChange={(v) => setForm((f) => ({ ...f, meal_type: v }))} />
        <div className="row-2">
          <Field label="Tên món" value={form.meal_name} onChange={set('meal_name')} maxLength={150} placeholder="Phở bò" />
          <Field label="Calo" type="number" min="1" step="1" suffix="kcal" value={form.calories} onChange={set('calories')} placeholder="450" />
        </div>
        <div className="row-3">
          <Field label="Đạm" type="number" min="0" suffix="g" value={form.protein} onChange={set('protein')} />
          <Field label="Tinh bột" type="number" min="0" suffix="g" value={form.carbs} onChange={set('carbs')} />
          <Field label="Béo" type="number" min="0" suffix="g" value={form.fat} onChange={set('fat')} />
        </div>
        <button className="btn btn-primary" disabled={!valid}>Thêm bữa ăn</button>
      </form>
      {meals.logs.length ? (
        <ul className="meal-list">
          {meals.logs.map((m) => (
            <li key={m.meal_id}>
              <div>
                <strong>{m.meal_name}</strong>
                <span className="muted small">{labelOf(MEAL_TYPES, m.meal_type)} · Đ {m.protein}g · TB {m.carbs}g · B {m.fat}g</span>
              </div>
              <span className="kcal">{fmt(m.calories)} kcal</span>
              <button className="icon-btn sm" onClick={() => onDelete(m.meal_id)} aria-label={`Xóa ${m.meal_name}`}><IoTrashOutline /></button>
            </li>
          ))}
        </ul>
      ) : <Empty>Chưa ghi bữa nào hôm nay.</Empty>}
    </article>
  );
}

const EMPTY_WORKOUT = { title: '', category: WORKOUT_CATEGORIES[0], minutes: '', calories_burned: '' };

function WorkoutCard({ workouts, onAdd }) {
  const [form, setForm] = useState(EMPTY_WORKOUT);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const valid = form.title.trim() && num(form.minutes) > 0;

  async function submit(e) {
    e.preventDefault();
    const workout = {
      title: form.title.trim(), category: form.category,
      duration_seconds: Math.round(num(form.minutes) * 60), calories_burned: Math.round(Number(form.calories_burned) || 0),
    };
    if (await onAdd(workout)) setForm(EMPTY_WORKOUT);
  }

  return (
    <article className="card">
      <CardHead id="workout" icon={IoBarbell} tint="tint-green" title="Buổi tập">
        <span className="muted small">{Math.round(workouts.total_duration_seconds / 60)} phút</span>
      </CardHead>
      <form className="form" onSubmit={submit}>
        <Field label="Bài tập" value={form.title} onChange={set('title')} maxLength={150} placeholder="Chạy bộ" />
        <label className="field">
          <span className="field-label">Loại</span>
          <select className="select" value={form.category} onChange={set('category')}>
            {WORKOUT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="row-2">
          <Field label="Thời gian" type="number" min="1" suffix="phút" value={form.minutes} onChange={set('minutes')} />
          <Field label="Đốt" type="number" min="0" suffix="kcal" value={form.calories_burned} onChange={set('calories_burned')} />
        </div>
        <button className="btn btn-primary" disabled={!valid}>Ghi buổi tập</button>
      </form>
      {workouts.logs.length > 0 && (
        <ul className="chip-list">
          {workouts.logs.map((w) => (
            <li key={w.workout_id}>{w.title} · {Math.round(w.duration_seconds / 60)} phút · {w.calories_burned} kcal</li>
          ))}
        </ul>
      )}
    </article>
  );
}
