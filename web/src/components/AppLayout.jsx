import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  IoGridOutline, IoJournalOutline, IoTrophyOutline, IoFlagOutline, IoGiftOutline,
  IoBarbellOutline, IoStatsChartOutline, IoChatbubbleEllipsesOutline, IoPersonOutline,
  IoLogOutOutline, IoMenuOutline, IoCloseOutline, IoSparkles,
} from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import Logo from './Logo.jsx';

const NAV = [
  { to: '/app', label: 'Tổng quan', icon: IoGridOutline, end: true },
  { to: '/app/logs', label: 'Nhật ký', icon: IoJournalOutline },
  { to: '/app/quests', label: 'Nhiệm vụ', icon: IoFlagOutline },
  { to: '/app/challenges', label: 'Thử thách', icon: IoTrophyOutline },
  { to: '/app/rewards', label: 'Đổi thưởng', icon: IoGiftOutline },
  { to: '/app/workouts', label: 'Bài tập', icon: IoBarbellOutline },
  { to: '/app/progress', label: 'Thống kê', icon: IoStatsChartOutline },
  { to: '/app/coach', label: 'AI Coach', icon: IoChatbubbleEllipsesOutline },
  { to: '/app/profile', label: 'Hồ sơ', icon: IoPersonOutline },
];

export default function AppLayout() {
  const { user, isDemo, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-btn only-mobile" onClick={() => setOpen(false)} aria-label="Đóng menu">
            <IoCloseOutline />
          </button>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{user.name?.[0]?.toUpperCase() ?? 'F'}</div>
            <div className="user-chip-text">
              <strong>{user.name}</strong>
              <span>{isDemo ? 'Chế độ demo' : user.email}</span>
            </div>
          </div>
          <button className="nav-item logout" onClick={handleLogout}>
            <IoLogOutOutline /> <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setOpen(true)} aria-label="Mở menu">
            <IoMenuOutline />
          </button>
          <div className="topbar-spacer" />
          <div className="coin-pill" title="Xu FitLife">
            <IoSparkles /> {user.profile?.coins ?? 0} xu
          </div>
        </header>
        <main className="content">
          {isDemo && (
            <div className="demo-banner">
              Bạn đang xem <strong>chế độ demo</strong>: số liệu là dữ liệu mẫu, không được lưu.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
