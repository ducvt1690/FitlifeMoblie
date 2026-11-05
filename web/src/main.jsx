import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { FiActivity, FiBarChart2, FiUsers, FiGrid, FiList, FiLink, FiAward, FiCreditCard, FiFileText, FiUser, FiLogOut, FiTrendingUp, FiClipboard, FiHeart, FiMenu } from 'react-icons/fi';
import { Providers, useAuth } from './context';
import { ROLES, rootFor } from './api';
import { AuthPage } from './auth';
import { TemplatesPage, StudentsPage, AssignmentsPage, InvitesPage, ProgressPage, TrainerDashboard } from './trainer';
import { AdminDashboard, AccountsPage, CatalogPage, LedgerPage, RevenuePage } from './admin';
import { MemberDashboard, MemberAssignments, MemberChallenges, MemberWorkouts, MemberProgress, PremiumPage, ProfilePage } from './member';
import { NutritionPage, CoachPage, WellbeingPage } from './wellbeing';
import { BmiPage, ExerciseLibrary, WorkoutPlanPage } from './training';
import './styles.css';
const navs = {
  trainer: [['', 'Tổng quan', FiGrid], ['students', 'Học viên', FiUsers], ['templates', 'Mẫu bài tập', FiClipboard], ['assignments', 'Bài đã giao', FiList], ['invites', 'Mã kết nối', FiLink], ['progress', 'Tiến độ & phản hồi', FiTrendingUp]],
  admin: [['', 'Tổng quan', FiGrid], ['accounts', 'Tài khoản', FiUsers], ['challenges', 'Thử thách', FiAward], ['payments', 'Thanh toán', FiCreditCard], ['logs', 'Nhật ký quản trị', FiFileText], ['revenue', 'Doanh thu', FiBarChart2]],
  user: [['', 'Hôm nay', FiGrid], ['assignments', 'Bài được giao', FiClipboard], ['workouts', 'Nhật ký tập luyện', FiActivity], ['plans', 'Lịch tập hôm nay', FiList], ['exercises', 'Thư viện bài tập', FiClipboard], ['bmi', 'Chỉ số cơ thể', FiHeart], ['progress', 'Tiến độ', FiTrendingUp], ['wellbeing', 'Sức khỏe mỗi ngày', FiHeart], ['nutrition', 'Dinh dưỡng', FiClipboard], ['coach', 'AI Coach', FiActivity], ['challenges', 'Thử thách', FiAward], ['premium', 'Premium & Coin', FiCreditCard]],
};
function Protected({ role }) {
  const { user, ready } = useAuth(); const location = useLocation();
  if (!ready) return <div className="boot" role="status">Đang khôi phục phiên đăng nhập…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={rootFor(user.role)} replace />;
  return <Shell />;
}
function Shell() {
  const { user, logout } = useAuth(); const [open, setOpen] = React.useState(false);
  const [compact, setCompact] = React.useState(() => matchMedia('(max-width: 800px)').matches);
  React.useEffect(() => {
    const query = matchMedia('(max-width: 800px)');
    const update = () => { setCompact(query.matches); if (!query.matches) setOpen(false); };
    query.addEventListener('change', update);
    const close = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => { query.removeEventListener('change', update); window.removeEventListener('keydown', close); };
  }, []);
  const base = rootFor(user.role);
  return <div className="app-shell"><a className="skip-link" href="#main">Đến nội dung</a><aside id="main-sidebar" inert={compact && !open} className={`sidebar ${open ? 'open' : ''}`}><button className="icon-button menu-toggle sidebar-close" aria-label="Đóng điều hướng" onClick={() => setOpen(false)}>×</button><NavLink className="brand" to={base}><FiActivity />FitLife<span>{ROLES[user.role]}</span></NavLink><nav aria-label="Điều hướng chính">{navs[user.role].map(([path, label, Icon]) => <NavLink end={!path} to={`${base}${path ? `/${path}` : ''}`} key={label} onClick={() => setOpen(false)}><Icon aria-hidden="true" />{label}</NavLink>)}</nav><div className="sidebar-bottom"><NavLink to={`${base}/profile`} onClick={() => setOpen(false)}><FiUser />Hồ sơ & cài đặt</NavLink><button onClick={logout}><FiLogOut />Đăng xuất</button><p>Cùng bạn bền bỉ mỗi ngày.</p></div></aside>{compact && open && <button className="nav-backdrop" aria-label="Đóng bảng điều hướng" tabIndex={-1} onClick={() => setOpen(false)} />}<div className="workspace"><header className="topbar"><button className="icon-button menu-toggle" aria-label="Mở điều hướng" aria-controls="main-sidebar" aria-expanded={open} onClick={() => setOpen(!open)}><FiMenu /></button><span><FiHeart aria-hidden="true" /> Không ngừng tiến bộ</span><NavLink to={`${base}/profile`} className="avatar-link"><span className="avatar">{user.full_name?.slice(0, 1)}</span><span>{user.full_name}<small>{ROLES[user.role]}</small></span></NavLink></header><main id="main" className="main-content"><Outlet /></main><footer className="app-footer">FitLife<span>Tập trung vào những gì bạn có thể cải thiện hôm nay.</span></footer></div></div>;
}
function Home() { const { user, ready } = useAuth(); return ready ? <Navigate to={user ? rootFor(user.role) : '/login'} replace /> : <div className="boot">Đang tải…</div>; }
function App() { return <Routes><Route path="/" element={<Home />} /><Route path="/login" element={<AuthPage />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/forgot" element={<AuthPage mode="forgot" />} />
  <Route path="/trainer" element={<Protected role="trainer" />}><Route index element={<TrainerDashboard />} /><Route path="templates" element={<TemplatesPage />} /><Route path="students" element={<StudentsPage />} /><Route path="assignments" element={<AssignmentsPage />} /><Route path="invites" element={<InvitesPage />} /><Route path="progress" element={<ProgressPage />} /><Route path="profile" element={<ProfilePage />} /></Route>
  <Route path="/admin" element={<Protected role="admin" />}><Route index element={<AdminDashboard />} /><Route path="accounts" element={<AccountsPage />} /><Route path="challenges" element={<CatalogPage kind="challenges" />} /><Route path="payments" element={<LedgerPage kind="payments" />} /><Route path="logs" element={<LedgerPage kind="logs" />} /><Route path="revenue" element={<RevenuePage />} /><Route path="profile" element={<ProfilePage />} /></Route>
  <Route path="/member" element={<Protected role="user" />}><Route index element={<MemberDashboard />} /><Route path="assignments" element={<MemberAssignments />} /><Route path="workouts" element={<MemberWorkouts />} /><Route path="plans" element={<WorkoutPlanPage />} /><Route path="exercises" element={<ExerciseLibrary />} /><Route path="bmi" element={<BmiPage />} /><Route path="progress" element={<MemberProgress />} /><Route path="wellbeing" element={<WellbeingPage />} /><Route path="nutrition" element={<NutritionPage />} /><Route path="coach" element={<CoachPage />} /><Route path="challenges" element={<MemberChallenges />} /><Route path="premium" element={<PremiumPage />} /><Route path="profile" element={<ProfilePage />} /></Route><Route path="/app/premium" element={<Navigate to="/member/premium" replace />} /><Route path="*" element={<Home />} />
</Routes>; }
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><Providers><App /></Providers></BrowserRouter></React.StrictMode>);
