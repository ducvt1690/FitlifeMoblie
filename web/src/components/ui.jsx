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
