import { Link } from 'react-router-dom';
import {
  IoWater, IoRestaurant, IoBarbell, IoMoon, IoHappy, IoAdd, IoChevronForward, IoFlame, IoCheckmarkCircle,
} from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { useLoad, useNotice } from '../lib/useLoad.js';
import { QUEST_META } from '../lib/quests.js';
import { fmt, labelOf, MEAL_TYPES } from '../lib/options.js';
import ProgressRing from '../components/ProgressRing.jsx';
import { BarChart, dayLabel, Empty, Loadable, Notice } from '../components/ui.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function Dashboard() {
  const { user, api } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(async () => {
    const [stats, quests, meals] = await Promise.all([api.stats(7), api.quests(), api.meals()]);
    return { stats, quests, meals };
  });

  async function addWater() {
    if (await run(() => api.addWater(250), 'Đã ghi 250 ml nước.')) reload();
  }

  return (
    <div className="page">
      <section className="greet">
        <div>
          <p className="muted">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="page-title">{greeting()}, {user.name?.split(' ').slice(-1)[0]}</h1>
        </div>
        <Link to="/app/logs" className="btn btn-dark"><IoAdd /> Ghi nhật ký</Link>
      </section>
      <Notice notice={notice} />

      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && <Overview {...data} onAddWater={addWater} />}
      </Loadable>
    </div>
  );
}

function Overview({ stats, quests, meals, onAddWater }) {
  const today = stats.days.at(-1);
  const done = quests.quests.filter((q) => q.is_completed).length;
  const { target_water: targetWater, target_calories: targetCalories } = stats;

  return (
    <div className="dash-grid">
      <article className="card card-dark progress-card">
        <div>
          <span className="label-light">Nhiệm vụ hôm nay</span>
          <strong className="big">{done}/{quests.quests.length}</strong>
          <p className="label-light">
            Chuỗi <b>{stats.streak_days}</b> ngày · cần {quests.streak_min_quests} nhiệm vụ/ngày để giữ chuỗi
          </p>
        </div>
        <ProgressRing value={done} max={quests.quests.length} size={110} stroke={10} color="var(--lime)">
          <IoFlame className="ring-icon" />
        </ProgressRing>
      </article>

      <article className="card metric">
        <div className="metric-head"><span className="badge-icon tint-blue"><IoWater /></span>Nước uống</div>
        <div className="metric-body">
          <ProgressRing value={today.water_ml} max={targetWater} size={88} stroke={9} color="var(--secondary)">
            <b>{Math.round((today.water_ml / targetWater) * 100)}%</b>
          </ProgressRing>
          <div>
            <strong className="metric-value">{fmt(today.water_ml)}</strong>
            <span className="muted"> / {fmt(targetWater)} ml</span>
            <p className="muted small">Còn {fmt(Math.max(targetWater - today.water_ml, 0))} ml</p>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onAddWater}><IoAdd /> Uống 1 ly 250 ml</button>
      </article>

      <Link to="/app/logs#meal" className="card metric">
        <div className="metric-head"><span className="badge-icon tint-orange"><IoRestaurant /></span>Calo nạp vào<IoChevronForward className="chev" /></div>
        <div className="metric-body">
          <ProgressRing value={today.calories} max={targetCalories} size={88} stroke={9} color="var(--accent)">
            <b>{Math.round((today.calories / targetCalories) * 100)}%</b>
          </ProgressRing>
          <div>
            <strong className="metric-value">{fmt(today.calories)}</strong>
            <span className="muted"> / {fmt(targetCalories)} kcal</span>
            <div className="macros">
              <span>Đạm <b>{fmt(today.protein)}g</b></span>
              <span>Tinh bột <b>{fmt(today.carbs)}g</b></span>
              <span>Béo <b>{fmt(today.fat)}g</b></span>
            </div>
          </div>
        </div>
      </Link>

      <article className="card">
        <div className="card-head">
          <h3>Nhiệm vụ</h3>
          <Link to="/app/quests" className="link">Xem tất cả</Link>
        </div>
        <ul className="quest-list">
          {quests.quests.map((q) => {
            const { icon: Icon, to } = QUEST_META[q.quest_key] ?? QUEST_META.q_checkin;
            return (
              <li key={q.quest_key} className={q.is_completed ? 'is-done' : ''}>
                <span className="badge-icon sm"><Icon /></span>
                <Link to={to} className="quest-title">{q.quest_title}</Link>
                <span className="quest-reward">{q.is_completed ? <IoCheckmarkCircle /> : `+${q.reward_coins} xu`}</span>
              </li>
            );
          })}
        </ul>
      </article>

      <article className="card">
        <div className="card-head">
          <h3>Nước uống 7 ngày</h3>
          <Link to="/app/progress" className="link">Thống kê</Link>
        </div>
        <BarChart target={targetWater} format={(v) => `${fmt(v)} ml`}
          data={stats.days.map((d) => ({ key: d.date, label: dayLabel(d.date), value: d.water_ml }))} />
        <p className="muted small">Vạch ngang là mục tiêu, cột xanh đậm là ngày đạt.</p>
      </article>

      <article className="card">
        <div className="card-head">
          <h3>Hôm nay</h3>
          <Link to="/app/logs" className="link">Ghi thêm</Link>
        </div>
        <ul className="stat-list">
          <li><IoBarbell /> Tập luyện <b>{Math.round(today.workout_seconds / 60)} phút · {fmt(today.calories_burned)} kcal</b></li>
          <li><IoMoon /> Giấc ngủ <b>{today.sleep_hours == null ? 'chưa ghi' : `${today.sleep_hours} giờ · ${today.sleep_quality}`}</b></li>
          <li><IoHappy /> Tâm trạng <b>{today.mood_label ?? 'chưa ghi'}</b></li>
        </ul>
        <h3 className="sub-title">Bữa ăn</h3>
        {meals.logs.length ? (
          <ul className="meal-list">
            {meals.logs.slice(0, 4).map((m) => (
              <li key={m.meal_id}>
                <div><strong>{m.meal_name}</strong><span className="muted small">{labelOf(MEAL_TYPES, m.meal_type)}</span></div>
                <span className="kcal">{fmt(m.calories)} kcal</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Chưa ghi bữa nào hôm nay.</Empty>}
      </article>
    </div>
  );
}
