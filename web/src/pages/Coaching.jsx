import { useState } from 'react';
import { IoFitnessOutline, IoLinkOutline } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { useLoad, useNotice } from '../lib/useLoad.js';
import { ASSIGNMENT_STATUS, LEVELS, fmtDate, labelOf } from '../lib/options.js';
import { ConfirmButton, Empty, Loadable, Notice, PageHeader, StatusTag } from '../components/ui.jsx';

export default function Coaching() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const { data, error, loading, reload } = useLoad(() => api.coaching());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');

  async function act(key, action, message) {
    setBusy(key);
    const result = await run(action, message);
    if (result) await reload();
    setBusy('');
    return result;
  }

  async function connect(e) {
    e.preventDefault();
    const result = await act('connect', () => api.acceptInvite(code.trim()), (r) => r.message);
    if (result) setCode('');
  }

  // Hoàn thành bài giao rồi ghi luôn vào nhật ký tập để tính nhiệm vụ trong ngày.
  const complete = (a) => act(a.id, async () => {
    await api.completeAssignment(a.id);
    return api.addWorkout({ title: a.template.title, category: a.template.category,
      duration_seconds: a.template.duration_seconds, calories_burned: a.template.calories_est });
  }, 'Đã hoàn thành và ghi vào nhật ký tập.');

  const open = data?.assignments.filter((a) => a.status === 'assigned') ?? [];
  const history = data?.assignments.filter((a) => a.status !== 'assigned') ?? [];

  return (
    <div className="page">
      <PageHeader title="Huấn luyện viên" subtitle="Kết nối bằng mã mời từ huấn luyện viên để nhận bài tập riêng." />
      <Notice notice={notice} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="split">
            <section className="card">
              <div className="card-head"><h3><IoLinkOutline /> Kết nối</h3></div>
              <form className="inline-form" onSubmit={connect}>
                <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Mã 8 ký tự" maxLength={8} aria-label="Mã mời" />
                <button className="btn btn-dark" disabled={code.trim().length !== 8 || busy === 'connect'}>Kết nối</button>
              </form>
              <p className="muted small">
                Huấn luyện viên chỉ xem được nhật ký sức khỏe của bạn khi đang có bài tập chưa xong. Không ai xem được chat AI của bạn.
              </p>
              {data.links.length === 0 ? <Empty>Bạn chưa kết nối huấn luyện viên nào.</Empty> : (
                <ul className="row-list">
                  {data.links.map((link) => (
                    <li key={link.link_id}>
                      <div>
                        <b>{link.trainer?.full_name ?? 'Huấn luyện viên'}</b>
                        <span className="muted small">Kết nối từ {fmtDate(link.accepted_at)}</span>
                      </div>
                      <ConfirmButton disabled={busy === link.link_id}
                        onConfirm={() => act(link.link_id, () => api.leaveTrainer(link.link_id), (r) => r.message)}>
                        Ngắt kết nối
                      </ConfirmButton>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="card-head"><h3><IoFitnessOutline /> Bài tập được giao</h3><span className="muted small">{open.length} bài đang chờ</span></div>
              {open.length === 0 ? <Empty>Chưa có bài nào đang chờ bạn.</Empty> : (
                <div className="assignment-list">
                  {open.map((a) => <AssignmentCard key={a.id} a={a} busy={busy === a.id}
                    onComplete={() => complete(a)}
                    onDecline={() => act(a.id, () => api.declineAssignment(a.id), 'Đã từ chối bài tập.')} />)}
                </div>
              )}
              {history.length > 0 && (<>
                <h4 className="sub-title">Lịch sử</h4>
                <ul className="row-list">
                  {history.map((a) => (
                    <li key={a.id}>
                      <div>
                        <b>{a.template?.title ?? 'Bài tập'}</b>
                        <span className="muted small">{a.trainer?.full_name} · giao {fmtDate(a.assigned_at)}</span>
                      </div>
                      <StatusTag status={a.status}>{labelOf(ASSIGNMENT_STATUS, a.status)}</StatusTag>
                    </li>
                  ))}
                </ul>
              </>)}
            </section>
          </div>
        )}
      </Loadable>
    </div>
  );
}

function AssignmentCard({ a, busy, onComplete, onDecline }) {
  const t = a.template;
  return (
    <article className="assignment">
      <div className="assignment-head">
        <b>{t?.title ?? 'Bài tập'}</b>
        <span className="tag">{labelOf(LEVELS, t?.level)}</span>
      </div>
      <div className="tag-row">
        <span className="tag muted-tag">{t?.category}</span>
        <span className="tag muted-tag">{Math.round((t?.duration_seconds ?? 0) / 60)} phút</span>
        <span className="tag muted-tag">~{t?.calories_est} kcal</span>
      </div>
      {t?.description && <p className="pre-line">{t.description}</p>}
      {a.note && <p className="assignment-note">“{a.note}”</p>}
      <p className="muted small">{a.trainer?.full_name} · giao ngày {fmtDate(a.assigned_at)}</p>
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" disabled={busy || !t} onClick={onComplete}>Hoàn thành &amp; ghi buổi tập</button>
        <ConfirmButton disabled={busy} onConfirm={onDecline}>Từ chối</ConfirmButton>
      </div>
    </article>
  );
}
