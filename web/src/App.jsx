import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import AppLayout from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ComingSoon from './pages/ComingSoon.jsx';

function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

// Các trang khu người dùng chưa làm: giữ route để sidebar đi được.
const USER_PAGES = [
  ['logs', 'Nhật ký sức khỏe', 'Ghi nước, bữa ăn, buổi tập, giấc ngủ và tâm trạng.'],
  ['quests', 'Nhiệm vụ', 'Danh sách nhiệm vụ hằng ngày và chuỗi ngày hoạt động.'],
  ['challenges', 'Thử thách', 'Tham gia thử thách và check-in mỗi ngày.'],
  ['rewards', 'Đổi thưởng', 'Dùng xu đổi vật phẩm.'],
  ['workouts', 'Bài tập', 'Bài tập theo nhóm cơ và bài từ huấn luyện viên.'],
  ['progress', 'Thống kê', 'Biểu đồ nước, cân nặng, giấc ngủ theo tuần/tháng.'],
  ['coach', 'AI Coach', 'Hỏi đáp về tập luyện và dinh dưỡng.'],
  ['profile', 'Hồ sơ', 'Thông tin cơ thể và mục tiêu.'],
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        {USER_PAGES.map(([path, title, desc]) => (
          <Route key={path} path={path} element={<ComingSoon title={title} description={desc} />} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
