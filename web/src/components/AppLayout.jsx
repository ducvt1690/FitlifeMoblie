import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  IoGridOutline, IoJournalOutline, IoTrophyOutline, IoFlagOutline, IoGiftOutline,
  IoBarbellOutline, IoStatsChartOutline, IoChatbubbleEllipsesOutline, IoPersonOutline,
  IoLogOutOutline, IoMenuOutline, IoCloseOutline, IoSparkles, IoPeopleOutline, IoDocumentTextOutline,
  IoClipboardOutline, IoShieldCheckmarkOutline, IoReceiptOutline, IoFitnessOutline,
} from 'react-icons/io5';
import { useAuth } from '../lib/auth.jsx';
import Logo from './Logo.jsx';

const MEMBER_NAV = [
  { to: '/app', label: 'Tổng quan', icon: IoGridOutline, end: true },
  { to: '/app/logs', label: 'Nhật ký', icon: IoJournalOutline },
  { to: '/app/quests', label: 'Nhiệm vụ', icon: IoFlagOutline },
  { to: '/app/challenges', label: 'Thử thách', icon: IoTrophyOutline },
  { to: '/app/rewards', label: 'Đổi thưởng', icon: IoGiftOutline },
  { to: '/app/workouts', label: 'Bài tập', icon: IoBarbellOutline },
  { to: '/app/progress', label: 'Thống kê', icon: IoStatsChartOutline },
  { to: '/app/coach', label: 'AI Coach', icon: IoChatbubbleEllipsesOutline },
  { to: '/app/coaching', label: 'Huấn luyện viên', icon: IoFitnessOutline },
  { to: '/app/profile', label: 'Hồ sơ', icon: IoPersonOutline },
];

const TRAINER_NAV = [
  { to: '/trainer', label: 'Tổng quan', icon: IoGridOutline, end: true },
  { to: '/trainer/students', label: 'Học viên', icon: IoPeopleOutline },
  { to: '/trainer/templates', label: 'Giáo án', icon: IoDocumentTextOutline },
  { to: '/trainer/assignments', label: 'Bài đã giao', icon: IoClipboardOutline },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Tổng quan', icon: IoGridOutline, end: true },
  { to: '/admin/accounts', label: 'Tài khoản', icon: IoPeopleOutline },
  { to: '/admin/challenges', label: 'Thử thách', icon: IoTrophyOutline },
  { to: '/admin/rewards', label: 'Vật phẩm', icon: IoGiftOutline },
  { to: '/admin/transactions', label: 'Giao dịch xu', icon: IoReceiptOutline },
];

const AREAS = {
  user: { nav: MEMBER_NAV },
  trainer: { nav: TRAINER_NAV, label: 'Huấn luyện viên' },
  admin: { nav: ADMIN_NAV, label: 'Quản trị' },
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const area = AREAS[user.role] ?? AREAS.user;

  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Link dạng /app/logs#meal: đợi trang tải xong rồi cuộn tới đúng mục.
  useEffect(() => {
    if (!location.hash) { window.scrollTo(0, 0); return; }
    const id = location.hash.slice(1);
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 20) clearInterval(timer);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearInterval(timer);
  }, [location.pathname, location.hash]);

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
          {area.label && <span className="area-label"><IoShieldCheckmarkOutline /> {area.label}</span>}
          {area.nav.map(({ to, label, icon: Icon, end }) => (
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
              <span>{user.email}</span>
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
          {user.role === 'user' && (
            <NavLink to="/app/rewards" className="coin-pill" title="Xu FitLife — bấm để đổi thưởng">
              <IoSparkles /> {user.profile?.coins ?? 0} xu
            </NavLink>
          )}
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
