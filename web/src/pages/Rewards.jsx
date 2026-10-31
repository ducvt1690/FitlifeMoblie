import { useState } from 'react';
import { IoRibbon, IoColorPalette, IoTicket, IoSparkles, IoCheckmarkCircle } from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import { useLoad, useNotice } from '../lib/useLoad.js';
import { Empty, Loadable, Notice, PageHeader } from '../components/ui.jsx';

const CATEGORY = {
  badge: { label: 'Huy hiệu', icon: IoRibbon },
  theme: { label: 'Giao diện', icon: IoColorPalette },
  voucher: { label: 'Voucher', icon: IoTicket },
};

export default function Rewards() {
  const { api } = useAuth();
  const { notice, run } = useNotice();
  const [buying, setBuying] = useState(null);
  const { data, error, loading, reload } = useLoad(() => api.rewards());

  async function buy(item) {
    setBuying(item.item_id);
    if (await run(() => api.buyReward(item.item_id), (r) => r.message)) await reload();
    setBuying(null);
  }

  const titles = new Map(data?.items.map((i) => [i.item_id, i.title]));

  return (
    <div className="page">
      <PageHeader title="Đổi thưởng" subtitle="Dùng xu kiếm từ nhiệm vụ và thử thách. Huy hiệu và giao diện chỉ mua một lần.">
        {data && <span className="coin-pill big"><IoSparkles /> {data.fit_coins} xu</span>}
      </PageHeader>
      <Notice notice={notice} />
      <Loadable loading={loading} error={error} onRetry={reload}>
        {data && (<>
          <div className="card-grid">
            {data.items.map((item) => {
              const { label, icon: Icon } = CATEGORY[item.category] ?? CATEGORY.badge;
              const short = data.fit_coins < item.cost_coins;
              return (
                <article key={item.item_id} className="card reward">
                  <span className="badge-icon lg"><Icon /></span>
                  <span className="tag muted-tag">{label}</span>
                  <h3>{item.title}</h3>
                  <p className="reward-price">{item.cost_coins ? `${item.cost_coins} xu` : 'Miễn phí'}</p>
                  {item.owned ? (
                    <button className="btn btn-ghost" disabled><IoCheckmarkCircle /> Đã sở hữu</button>
                  ) : (
                    <button className="btn btn-primary" disabled={short || buying === item.item_id} onClick={() => buy(item)}>
                      {short ? `Thiếu ${item.cost_coins - data.fit_coins} xu` : buying === item.item_id ? 'Đang đổi…' : 'Đổi ngay'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <article className="card">
            <h3 className="sub-title">Lịch sử đổi thưởng</h3>
            {data.purchases.length ? (
              <table className="table">
                <thead><tr><th>Vật phẩm</th><th>Xu</th><th>Thời gian</th></tr></thead>
                <tbody>
                  {data.purchases.map((p) => (
                    <tr key={p.purchase_id}>
                      <td>{titles.get(p.item_id) ?? 'Vật phẩm đã ngừng bán'}</td>
                      <td>{p.spent_coins}</td>
                      <td>{new Date(p.purchased_at).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty>Bạn chưa đổi vật phẩm nào.</Empty>}
          </article>
        </>)}
      </Loadable>
    </div>
  );
}
