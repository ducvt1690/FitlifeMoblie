import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { homeFor } from './lib/options.js';
import AppLayout from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Logs from './pages/Logs.jsx';
import Quests from './pages/Quests.jsx';
import Challenges from './pages/Challenges.jsx';
import Rewards from './pages/Rewards.jsx';
import Workouts from './pages/Workouts.jsx';
import Progress from './pages/Progress.jsx';
import Coach from './pages/Coach.jsx';
import Coaching from './pages/Coaching.jsx';
import Profile from './pages/Profile.jsx';
import TrainerHome from './pages/trainer/TrainerHome.jsx';
import TrainerStudents from './pages/trainer/TrainerStudents.jsx';
import TrainerStudent from './pages/trainer/TrainerStudent.jsx';
import TrainerTemplates from './pages/trainer/TrainerTemplates.jsx';
import TrainerAssignments from './pages/trainer/TrainerAssignments.jsx';
import AdminHome from './pages/admin/AdminHome.jsx';
import AdminAccounts from './pages/admin/AdminAccounts.jsx';
import AdminChallenges from './pages/admin/AdminChallenges.jsx';
import AdminRewards from './pages/admin/AdminRewards.jsx';
import AdminTransactions from './pages/admin/AdminTransactions.jsx';

// Mỗi khu chỉ mở cho đúng vai trò; vào nhầm khu thì đưa về khu của mình. Backend vẫn kiểm tra lại quyền.
function RequireRole({ role, children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={<RequireRole role="user"><AppLayout /></RequireRole>}>
        <Route index element={<Dashboard />} />
        <Route path="logs" element={<Logs />} />
        <Route path="quests" element={<Quests />} />
        <Route path="challenges" element={<Challenges />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="workouts" element={<Workouts />} />
        <Route path="progress" element={<Progress />} />
        <Route path="coach" element={<Coach />} />
        <Route path="coaching" element={<Coaching />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="/trainer" element={<RequireRole role="trainer"><AppLayout /></RequireRole>}>
        <Route index element={<TrainerHome />} />
        <Route path="students" element={<TrainerStudents />} />
        <Route path="students/:userId" element={<TrainerStudent />} />
        <Route path="templates" element={<TrainerTemplates />} />
        <Route path="assignments" element={<TrainerAssignments />} />
      </Route>
      <Route path="/admin" element={<RequireRole role="admin"><AppLayout /></RequireRole>}>
        <Route index element={<AdminHome />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="challenges" element={<AdminChallenges />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="transactions" element={<AdminTransactions />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
