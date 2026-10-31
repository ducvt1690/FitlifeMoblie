import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useLoad } from '../lib/useLoad.js';
import { fmt } from '../lib/options.js';
import { BarChart, dayLabel, Empty, Loadable, PageHeader, Segmented } from '../components/ui.jsx';

const RANGES = [{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }];
const average = (values) => {
  const known = values.filter((v) => v != null && v > 0);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
};

export default function Progress() {
  const { api } = useAuth();
  const [days, setDays] = useState(7);
  const stats = useLoad(() => api.stats(days), [days]);
  const bmi = useLoad(() => api.bmi());

  return (
    <div className="page">
      <PageHeader title="Thống kê" subtitle="Tổng hợp từ nhật ký của bạn.">
        <Segmented options={RANGES} value={days} onChange={setDays} />
      </PageHeader>

      <Loadable loading={stats.loading} error={stats.error} onRetry={stats.reload}>
        {stats.data && <Charts stats={stats.data} long={days > 7} />}
      </Loadable>

      <Loadable loading={bmi.loading} error={bmi.error} onRetry={bmi.reload}>
        {bmi.data && <BmiCard current={bmi.data.current} records={bmi.data.records} />}
      </Loadable>
    </div>
  );
}

function Charts({ stats, long }) {
  const series = (pick) => stats.days.map((d) => ({ key: d.date, label: dayLabel(d.date, long), value: pick(d) }));
  const charts = [
    { title: 'Nước uống', unit: 'ml', target: stats.target_water, pick: (d) => d.water_ml },
    { title: 'Calo nạp vào', unit: 'kcal', target: stats.target_calories, pick: (d) => d.calories },
    { title: 'Thời gian tập', unit: 'phút', pick: (d) => Math.round(d.workout_seconds / 60) },
    { title: 'Giấc ngủ', unit: 'giờ', target: 7, pick: (d) => d.sleep_hours },
  ];

  return (<>
    <div className="summary-row">
      <div className="card summary"><span className="muted small">Chuỗi hiện tại</span><b>{stats.streak_days} ngày</b></div>
      <div className="card summary"><span className="muted small">Nước TB/ngày</span><b>{fmt(average(stats.days.map((d) => d.water_ml)))} ml</b></div>
      <div className="card summary"><span className="muted small">Ngủ TB</span><b>{average(stats.days.map((d) => d.sleep_hours)).toFixed(1)} giờ</b></div>
      <div className="card summary"><span className="muted small">Buổi tập</span><b>{stats.days.reduce((s, d) => s + d.workout_count, 0)}</b></div>
    </div>
    <div className="chart-grid">
      {charts.map((c) => (
        <article key={c.title} className="card">
          <div className="card-head">
            <h3>{c.title}</h3>
            {c.target && <span className="muted small">Mục tiêu {fmt(c.target)} {c.unit}</span>}
          </div>
          <BarChart data={series(c.pick)} target={c.target} format={(v) => `${fmt(v)} ${c.unit}`} />
        </article>
      ))}
    </div>
  </>);
}

const BMI_SCALE = [
  { upTo: 18.5, label: 'Thiếu cân' }, { upTo: 23, label: 'Cân đối' }, { upTo: 25, label: 'Thừa cân nhẹ' },
  { upTo: 40, label: 'Tiền béo phì / Béo phì' },
];

function BmiCard({ current, records }) {
  // Vị trí kim trên thang 15–40.
  const pos = Math.min(Math.max((current.bmi_value - 15) / 25, 0), 1) * 100;
  return (
    <article className="card">
      <div className="card-head">
        <h3>Chỉ số BMI</h3>
        <span className="muted small">Chuẩn châu Á · cập nhật khi bạn sửa cân nặng/chiều cao</span>
      </div>
      <div className="bmi-now">
        <strong>{current.bmi_value}</strong>
        <span className="tag">{current.bmi_status}</span>
      </div>
      <div className="bmi-scale">
        {BMI_SCALE.map((s, i) => <span key={s.label} style={{ flex: s.upTo - (BMI_SCALE[i - 1]?.upTo ?? 15) }}>{s.label}</span>)}
        <i style={{ left: `${pos}%` }} />
      </div>
      <h3 className="sub-title">Lịch sử</h3>
      {records.length ? (
        <table className="table">
          <thead><tr><th>Ngày</th><th>Cân nặng</th><th>BMI</th><th>Phân loại</th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.record_id}><td>{r.record_date}</td><td>{r.weight} kg</td><td>{r.bmi_value}</td><td>{r.bmi_status}</td></tr>
            ))}
          </tbody>
        </table>
      ) : <Empty>Chưa có lịch sử. Mỗi lần bạn cập nhật cân nặng ở trang Hồ sơ sẽ lưu một bản ghi.</Empty>}
    </article>
  );
}
