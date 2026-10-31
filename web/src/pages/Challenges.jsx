import { IoTrophy, IoCheckmarkCircle } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { useLoad, useNotice } from '../lib/useLoad.js';
import { Loadable, Notice, PageHeader } from '../components/ui.jsx';

export default function Challenges() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.challenges());

  const act = async (action, message) => { if (await run(action, message)) reload(); };

  return (
    <div className="page">
      <PageHeader title="Thử thách" subtitle="Tham gia rồi check-in mỗi ngày một lần. Đủ số ngày sẽ nhận thưởng." />
      <Notice notice={notice} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        <div className="card-grid">
          {data?.challenges.map((c) => {
            const pct = Math.round((c.current_progress / c.target_days) * 100);
            return (
              <article key={c.challenge_id} className={`card challenge ${c.joined ? 'is-joined' : ''}`}>
                <div className="card-head">
                  <span className="badge-icon"><IoTrophy /></span>
                  <span className="tag">+{c.reward_coins} xu</span>
                </div>
                <h3>{c.title}</h3>
                <p className="muted small">{c.description}</p>
                {c.joined ? (
                  <>
                    <div className="progress"><i style={{ width: `${pct}%` }} /></div>
                    <p className="small"><b>{c.current_progress}</b> / {c.target_days} ngày</p>
                    <button className="btn btn-primary" disabled={c.checked_in_today}
                      onClick={() => act(() => api.checkinChallenge(c.challenge_id), (r) => r.message)}>
                      {c.checked_in_today ? <><IoCheckmarkCircle /> Đã check-in hôm nay</> : 'Check-in hôm nay'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="small muted">{c.target_days} ngày{c.completed_count ? ` · đã hoàn thành ${c.completed_count} lần` : ''}</p>
                    <button className="btn btn-dark" onClick={() => act(() => api.joinChallenge(c.challenge_id), 'Đã tham gia thử thách.')}>
                      {c.completed_count ? 'Tham gia lại' : 'Tham gia'}
                    </button>
                  </>
                )}
              </article>
            );
          })}
        </div>
      </Loadable>
    </div>
  );
}
