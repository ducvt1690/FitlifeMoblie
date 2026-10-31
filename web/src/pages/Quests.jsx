import { Link } from 'react-router-dom';
import { IoCheckmarkCircle, IoFlame, IoChevronForward } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { useLoad, useNotice } from '../lib/useLoad.js';
import { QUEST_META } from '../lib/quests.js';
import ProgressRing from '../components/ProgressRing.jsx';
import { Loadable, Notice, PageHeader } from '../components/ui.jsx';

export default function Quests() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.quests());

  async function checkin() {
    if (await run(() => api.checkin(), (r) => r.message)) reload();
  }

  const quests = data?.quests ?? [];
  const done = quests.filter((q) => q.is_completed).length;
  const checkedIn = quests.find((q) => q.quest_key === 'q_checkin')?.is_completed;

  return (
    <div className="page">
      <PageHeader title="Nhiệm vụ hằng ngày" subtitle="Mỗi nhiệm vụ +10 xu, làm mới lúc 0 giờ theo múi giờ của bạn.">
        <button className="btn btn-dark" onClick={checkin} disabled={!data || checkedIn}>
          <IoCheckmarkCircle /> {checkedIn ? 'Đã điểm danh' : 'Điểm danh hôm nay'}
        </button>
      </PageHeader>
      <Notice notice={notice} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="split">
            <article className="card card-dark streak-card">
              <ProgressRing value={done} max={quests.length} size={140} stroke={12} color="var(--lime)">
                <div className="center"><strong className="ring-big">{done}/{quests.length}</strong><span className="label-light">hôm nay</span></div>
              </ProgressRing>
              <div className="streak-line"><IoFlame /> Chuỗi <b>{data.streak_days}</b> ngày</div>
              <p className="label-light small">
                Hoàn thành ít nhất {data.streak_min_quests} nhiệm vụ mỗi ngày để chuỗi tăng. Bỏ lỡ một ngày, chuỗi bắt đầu lại.
              </p>
            </article>

            <article className="card">
              <ul className="quest-list big">
                {quests.map((q) => {
                  const { icon: Icon, to } = QUEST_META[q.quest_key] ?? QUEST_META.q_checkin;
                  return (
                    <li key={q.quest_key} className={q.is_completed ? 'is-done' : ''}>
                      <span className="badge-icon"><Icon /></span>
                      <div className="quest-title">
                        {q.quest_title}
                        {q.completed_at && (
                          <span className="muted small"> · lúc {new Date(q.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                      {q.is_completed
                        ? <span className="quest-reward"><IoCheckmarkCircle /></span>
                        : <Link to={to} className="btn btn-ghost btn-sm">+{q.reward_coins} xu <IoChevronForward /></Link>}
                    </li>
                  );
                })}
              </ul>
            </article>
          </div>
        )}
      </Loadable>
    </div>
  );
}
