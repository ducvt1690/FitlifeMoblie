import { useState } from 'react';

// Giao một giáo án cho học viên đã kết nối. Không truyền `students` khi đã biết học viên (trang chi tiết).
export default function AssignForm({ students, userId, templates, onAssign }) {
  const [student, setStudent] = useState(userId ?? '');
  const [template, setTemplate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const active = templates.filter((t) => t.is_active);
  const target = userId ?? student;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await onAssign({ user_id: target, template_id: template, note: note.trim() });
    setBusy(false);
    if (ok) { setTemplate(''); setNote(''); }
  }

  if (!active.length) return <p className="empty-line">Hãy tạo ít nhất một giáo án trước khi giao bài.</p>;
  return (
    <form className="form" onSubmit={submit}>
      {students && (
        <label className="field">
          <span className="field-label">Học viên</span>
          <select className="select" value={student} onChange={(e) => setStudent(e.target.value)}>
            <option value="">— Chọn học viên —</option>
            {students.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.email})</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span className="field-label">Giáo án</span>
        <select className="select" value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="">— Chọn giáo án —</option>
          {active.map((t) => <option key={t.template_id} value={t.template_id}>{t.title} · {Math.round(t.duration_seconds / 60)} phút</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Lời nhắn (không bắt buộc)</span>
        <textarea className="textarea" rows="2" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="btn btn-primary" disabled={busy || !target || !template}>Giao bài</button>
    </form>
  );
}
