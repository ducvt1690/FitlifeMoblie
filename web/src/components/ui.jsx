import { useEffect, useState } from 'react';

// Khối giao diện dùng lại ở nhiều trang.

export function PageHeader({ title, subtitle, children }) {
  return (
    <section className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </section>
  );
}

// Trạng thái chung của trang: đang tải / lỗi / có dữ liệu.
export function Loadable({ loading, error, onRetry, children }) {
  if (loading) return <div className="card loading-card"><div className="spinner" /></div>;
  if (error) {
    return (
      <div className="card empty-state">
        <p className="alert alert-error">{error}</p>
        {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Thử lại</button>}
      </div>
    );
  }
  return children;
}

export function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`toast toast-${notice.type}`} role="status">{notice.text}</div>;
}

export function Empty({ children }) {
  return <p className="empty-line">{children}</p>;
}

// Biểu đồ cột đơn giản; `target` vẽ thêm vạch mục tiêu.
export function BarChart({ data, target, format = (v) => v, height = 160 }) {
  const max = Math.max(target ?? 0, ...data.map((d) => d.value ?? 0), 1);
  return (
    <div className="bars" style={{ height }}>
      {data.map((d) => (
        <div className="bar-col" key={d.key} title={`${d.label}: ${d.value == null ? 'chưa ghi' : format(d.value)}`}>
          <div className="bar-track">
            {target ? <span className="bar-target" style={{ bottom: `${(target / max) * 100}%` }} /> : null}
            {d.value
              ? <div className={`bar ${target && d.value >= target ? 'is-hit' : ''}`} style={{ height: `${(d.value / max) * 100}%` }} />
              : <span className="bar-missing">–</span>}
          </div>
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <button key={opt.value} type="button" role="tab" aria-selected={value === opt.value}
            className={value === opt.value ? 'is-active' : ''} onClick={() => onChange(opt.value)}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Nhãn ngày ngắn cho trục biểu đồ: "T2", "T3"... hoặc "12/10".
export function dayLabel(date, long) {
  const d = new Date(`${date}T00:00:00`);
  if (long) return `${d.getDate()}/${d.getMonth() + 1}`;
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
}

// Thao tác khó hoàn tác: bấm lần 1 để hỏi lại, bấm lần 2 trong 3 giây mới chạy.
export function ConfirmButton({ onConfirm, children, confirmText = 'Bấm lần nữa để xác nhận', className = 'btn btn-ghost btn-sm', disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button type="button" className={`${className} ${armed ? 'is-armed' : ''}`} disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? confirmText : children}
    </button>
  );
}

export function Pager({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button>
      <span className="muted small">Trang {page}/{pages}</span>
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau</button>
    </div>
  );
}

const STATUS_CLASS = { assigned: '', done: 'tag-done', cancelled: 'muted-tag', active: '', pending: 'tag-warn', locked: 'tag-danger' };
export function StatusTag({ status, children }) {
  return <span className={`tag ${STATUS_CLASS[status] ?? ''}`}>{children}</span>;
}
