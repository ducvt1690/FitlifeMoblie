import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IoArrowBack, IoLockClosedOutline } from 'react-icons/io5';
import { useAuth } from '../../lib/auth.jsx';
import { useLoad, useNotice } from '../../lib/useLoad.js';
import { ACTIVITY, ASSIGNMENT_STATUS, GENDERS, GOALS, fmtDate, labelOf } from '../../lib/options.js';
import { ConfirmButton, Empty, Loadable, Notice, PageHeader, Segmented, StatusTag } from '../../components/ui.jsx';
import { Charts } from '../Progress.jsx';
import AssignForm from './AssignForm.jsx';

const RANGES = [{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }];

export default function TrainerStudent() {
  const { userId } = useParams();
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const [days, setDays] = useState(7);
  const detail = useLoad(() => api.trainer.student(userId, days), [userId, days]);
  const templates = useLoad(() => api.trainer.templates());

  async function act(action, message) {
    const result = await run(action, message);
    if (result) await detail.reload();
    return result;
  }

  const d = detail.data;
  return (
    <div className="page">
      <Link className="back-link" to="/trainer/students"><IoArrowBack /> Danh sách học viên</Link>
      <Notice notice={notice} />
      <Loadable loading={detail.loading} error={detail.error} onRetry={detail.reload}>
        {d && (<>
          <PageHeader title={d.student.full_name}
            subtitle={`${d.student.email} · Mục tiêu: ${labelOf(GOALS, d.student.goal)} · Kết nối từ ${fmtDate(d.link.accepted_at)}`}>
            {d.health && <Segmented options={RANGES} value={days} onChange={setDays} />}
          </PageHeader>

          {d.health ? (<>
            <div className="tile-row">
              {[['Giới tính', labelOf(GENDERS, d.health.gender)], ['Tuổi', d.health.age ?? '—'],
                ['Chiều cao', `${d.health.height} cm`], ['Cân nặng', `${d.health.weight} kg`],
                ['Mức vận động', labelOf(ACTIVITY, d.health.activity_level)]].map(([label, value]) => (
                <div key={label} className="card summary"><span className="muted small">{label}</span><b>{value}</b></div>
              ))}
            </div>
            <Charts stats={d.health} long={days > 7} />
          </>) : (
            <div className="card notice-card">
              <IoLockClosedOutline />
              <p>Nhật ký sức khỏe chỉ hiển thị khi học viên đang có bài bạn giao chưa hoàn thành. Hãy giao bài bên dưới.</p>
            </div>
          )}

          <div className="split">
            <section className="card">
              <div className="card-head"><h3>Giao bài mới</h3></div>
              <Loadable loading={templates.loading} error={templates.error} onRetry={templates.reload}>
                {templates.data && <AssignForm userId={userId} templates={templates.data.templates}
                  onAssign={(body) => act(() => api.trainer.assign(body), (r) => r.message)} />}
              </Loadable>
            </section>
            <section className="card">
              <div className="card-head"><h3>Bài đã giao</h3></div>
              {d.assignments.length === 0 ? <Empty>Chưa giao bài nào cho học viên này.</Empty> : (
                <ul className="row-list">
                  {d.assignments.map((a) => (
                    <li key={a.id}>
                      <div>
                        <b>{a.template?.title ?? '—'}</b>
                        <span className="muted small">
                          Giao {fmtDate(a.assigned_at)}{a.done_at ? ` · xong ${fmtDate(a.done_at)}` : ''}{a.note ? ` · “${a.note}”` : ''}
                        </span>
                      </div>
                      <StatusTag status={a.status}>{labelOf(ASSIGNMENT_STATUS, a.status)}</StatusTag>
                      {a.status === 'assigned' && (
                        <ConfirmButton onConfirm={() => act(() => api.trainer.cancelAssignment(a.id), (r) => r.message)}>Hủy</ConfirmButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>)}
      </Loadable>
    </div>
  );
}
