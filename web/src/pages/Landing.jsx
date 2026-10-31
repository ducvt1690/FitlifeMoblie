import { Link } from 'react-router-dom';
import {
  IoWaterOutline, IoRestaurantOutline, IoBarbellOutline, IoFlagOutline,
  IoTrophyOutline, IoChatbubbleEllipsesOutline, IoArrowForward, IoPhonePortraitOutline,
} from 'react-icons/io5';
import Logo from '../components/Logo.jsx';

const FEATURES = [
  { icon: IoWaterOutline, tint: 'blue', title: 'Nước uống', text: 'Mục tiêu nước tính theo cơ thể bạn, ghi nhận chỉ với một chạm.' },
  { icon: IoRestaurantOutline, tint: 'orange', title: 'Dinh dưỡng', text: 'Theo dõi calo và macro cho bốn bữa trong ngày.' },
  { icon: IoBarbellOutline, tint: 'green', title: 'Tập luyện', text: 'Bài tập theo nhóm cơ, bộ đếm Tabata/HIIT và bài từ huấn luyện viên.' },
  { icon: IoFlagOutline, tint: 'yellow', title: 'Nhiệm vụ & xu', text: 'Hoàn thành nhiệm vụ hằng ngày để nhận xu và giữ chuỗi ngày.' },
  { icon: IoTrophyOutline, tint: 'pink', title: 'Thử thách', text: 'Tham gia thử thách, check-in mỗi ngày và đổi thưởng.' },
  { icon: IoChatbubbleEllipsesOutline, tint: 'purple', title: 'AI Coach', text: 'Hỏi đáp về tập luyện và dinh dưỡng dựa trên nhật ký của bạn.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#features">Tính năng</a>
          <Link to="/login" className="btn btn-ghost">Đăng nhập</Link>
          <Link to="/register" className="btn btn-primary">Bắt đầu miễn phí</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Trợ lý sức khỏe & thể lực</span>
          <h1>Sống khỏe mỗi ngày, <span className="accent">từng thói quen nhỏ</span>.</h1>
          <p>
            FitLife giúp bạn ghi nhật ký nước, bữa ăn, tập luyện và giấc ngủ, rồi biến chúng thành nhiệm vụ,
            xu thưởng và thử thách. Một tài khoản dùng chung cho app di động và website.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-dark btn-lg">Tạo tài khoản <IoArrowForward /></Link>
            <Link to="/login" className="btn btn-ghost btn-lg">Tôi đã có tài khoản</Link>
          </div>
          <p className="hero-note"><IoPhonePortraitOutline /> Đã dùng app di động? Đăng nhập bằng cùng tài khoản.</p>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-card hero-card-dark">
            <span>Hôm nay</span>
            <strong>72%</strong>
            <small>mục tiêu hoàn thành</small>
            <div className="hero-bar"><i style={{ width: '72%' }} /></div>
          </div>
          <div className="hero-card hero-card-blue"><IoWaterOutline /> <b>1.250</b> / 2.275 ml</div>
          <div className="hero-card hero-card-yellow"><IoFlagOutline /> <b>3/7</b> nhiệm vụ</div>
        </div>
      </section>

      <section id="features" className="features">
        <h2>Mọi thứ bạn cần trong một nơi</h2>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, tint, title, text }) => (
            <article key={title} className="card feature">
              <span className={`badge-icon tint-${tint}`}><Icon /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-foot">© {new Date().getFullYear()} FitLife Team</footer>
    </div>
  );
}
