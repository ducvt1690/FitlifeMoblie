import { Link } from 'react-router-dom';
import {
  IoWater, IoRestaurant, IoBarbell, IoMoon, IoHappy, IoCheckmarkCircle, IoChatbubbleEllipses,
  IoAdd, IoChevronForward, IoFlame, IoCalculatorOutline, IoTimerOutline, IoStatsChartOutline,
  IoGiftOutline,
} from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import { DEMO_MEALS, DEMO_QUESTS, DEMO_TODAY, DEMO_WEEK_WATER } from '../lib/mockData.js';

const QUEST_ICONS = {
  water: IoWater, barbell: IoBarbell, restaurant: IoRestaurant, moon: IoMoon,
  happy: IoHappy, checkmark: IoCheckmarkCircle, chat: IoChatbubbleEllipses,
};
const fmt = (n) => n.toLocaleString('vi-VN');

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function EmptyToday({ targetWater, targetCalories }) {
  return (
    <div className="card empty-state span-all">
      <span className="badge-icon tint-green"><IoAdd /></span>
      <h3>Hôm nay bạn chưa ghi nhận gì</h3>
      <p className="muted">
        Mục tiêu của bạn: <b>{fmt(targetWater ?? 0)} ml</b> nước và <b>{fmt(targetCalories ?? 0)} kcal</b>.
        Bắt đầu bằng một ly nước nhé!
      </p>
      <Link to="/app/logs" className="btn btn-primary">Bắt đầu ghi nhật ký</Link>
    </div>
  );
}

export default function Dashboard() {
  const { user, isDemo } = useAuth();
  const targetWater = user.profile?.target_water ?? 2000;
  const targetCalories = user.profile?.target_calories ?? 2000;
  const today = isDemo ? DEMO_TODAY : null;
  const quests = isDemo ? DEMO_QUESTS : [];
  const doneCount = quests.filter((q) => q.done).length;

  const overall = today
    ? Math.round(((Math.min(today.waterMl / targetWater, 1) + Math.min(today.calories.eaten / targetCalories, 1)
      + doneCount / quests.length) / 3) * 100)
    : 0;
  const maxWeek = Math.max(targetWater, ...DEMO_WEEK_WATER.map((d) => d.ml ?? 0));

  return (
    <div className="page">
      <section className="greet">
        <div>
          <p className="muted">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="page-title">{greeting()}, {user.name?.split(' ').slice(-1)[0]}</h1>
        </div>
        <Link to="/app/logs" className="btn btn-dark"><IoAdd /> Ghi nhật ký</Link>
      </section>

      <div className="dash-grid">
        {!today ? (
          <EmptyToday targetWater={targetWater} targetCalories={targetCalories} />
        ) : (<>
          <article className="card progress-card">
            <div>
              <span className="label-light">Tiến độ hôm nay</span>
              <strong className="big">{overall}%</strong>
              <p className="label-light">{doneCount}/{quests.length} nhiệm vụ · chuỗi {today.streakDays} ngày</p>
            </div>
            <ProgressRing value={overall} max={100} size={120} stroke={10} color="var(--lime-dark)">
              <IoFlame className="ring-icon" />
            </ProgressRing>
          </article>

          <Link to="/app/logs" className="card metric tint-card-blue">
            <div className="metric-head"><span className="badge-icon tint-blue"><IoWater /></span>Nước uống<IoChevronForward className="chev" /></div>
            <div className="metric-body">
              <ProgressRing value={today.waterMl} max={targetWater} size={96} stroke={10} color="var(--secondary)">
                <b>{Math.round((today.waterMl / targetWater) * 100)}%</b>
              </ProgressRing>
              <div>
                <strong className="metric-value">{fmt(today.waterMl)}</strong>
                <span className="muted"> / {fmt(targetWater)} ml</span>
                <p className="muted small">Còn {fmt(Math.max(targetWater - today.waterMl, 0))} ml</p>
              </div>
            </div>
          </Link>

          <Link to="/app/logs" className="card metric tint-card-orange">
            <div className="metric-head"><span className="badge-icon tint-orange"><IoRestaurant /></span>Calo<IoChevronForward className="chev" /></div>
            <div className="metric-body">
              <ProgressRing value={today.calories.eaten} max={targetCalories} size={96} stroke={10} color="var(--accent)">
                <b>{Math.round((today.calories.eaten / targetCalories) * 100)}%</b>
              </ProgressRing>
              <div>
                <strong className="metric-value">{fmt(today.calories.eaten)}</strong>
                <span className="muted"> / {fmt(targetCalories)} kcal</span>
                <div className="macros">
                  <span>P <b>{today.calories.protein}g</b></span>
                  <span>C <b>{today.calories.carbs}g</b></span>
                  <span>F <b>{today.calories.fat}g</b></span>
                </div>
              </div>
            </div>
          </Link>

          <article className="card quests">
            <div className="card-head">
              <h3>Nhiệm vụ hôm nay</h3>
              <Link to="/app/quests" className="link">Xem tất cả</Link>
            </div>
            <ul className="quest-list">
              {quests.map((q) => {
                const Icon = QUEST_ICONS[q.icon];
                return (
                  <li key={q.key} className={q.done ? 'is-done' : ''}>
                    <span className="badge-icon sm tint-green"><Icon /></span>
                    <span className="quest-title">{q.title}</span>
                    <span className="quest-reward">{q.done ? <IoCheckmarkCircle /> : `+${q.reward} xu`}</span>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="card week">
            <div className="card-head">
              <h3>Nước uống 7 ngày</h3>
              <Link to="/app/progress" className="link">Thống kê</Link>
            </div>
            <div className="bars">
              {DEMO_WEEK_WATER.map((d) => (
                <div key={d.day} className="bar-col" title={d.ml === null ? 'Chưa có dữ liệu' : `${fmt(d.ml)} ml`}>
                  <div className="bar-track">
                    {d.ml === null
                      ? <div className="bar-missing">—</div>
                      : <div className={`bar ${d.ml >= targetWater ? 'is-hit' : ''}`} style={{ height: `${(d.ml / maxWeek) * 100}%` }} />}
                    <div className="bar-target" style={{ bottom: `${(targetWater / maxWeek) * 100}%` }} />
                  </div>
                  <span>{d.day}</span>
                </div>
              ))}
            </div>
            <p className="muted small">Vạch ngang = mục tiêu · “—” = ngày chưa ghi nhận</p>
          </article>

          <article className="card meals">
            <div className="card-head">
              <h3>Bữa ăn</h3>
              <Link to="/app/logs" className="link">Thêm món</Link>
            </div>
            <ul className="meal-list">
              {DEMO_MEALS.map((m) => (
                <li key={m.meal}>
                  <div><strong>{m.meal}</strong><span className="muted small">{m.items}</span></div>
                  <span className={m.kcal ? 'kcal' : 'muted small'}>{m.kcal ? `${m.kcal} kcal` : 'Thêm'}</span>
                </li>
              ))}
            </ul>
          </article>
        </>)}

        <article className="card tools span-all">
          <h3>Công cụ</h3>
          <div className="tool-grid">
            <Link to="/app/progress" className="tool"><span className="badge-icon tint-purple"><IoCalculatorOutline /></span>BMI / TDEE</Link>
            <Link to="/app/workouts" className="tool"><span className="badge-icon tint-green"><IoTimerOutline /></span>Bấm giờ HIIT</Link>
            <Link to="/app/progress" className="tool"><span className="badge-icon tint-blue"><IoStatsChartOutline /></span>Thống kê</Link>
            <Link to="/app/rewards" className="tool"><span className="badge-icon tint-pink"><IoGiftOutline /></span>Đổi thưởng</Link>
            <Link to="/app/coach" className="tool"><span className="badge-icon tint-yellow"><IoChatbubbleEllipses /></span>AI Coach</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
