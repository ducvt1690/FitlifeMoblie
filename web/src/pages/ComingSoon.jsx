import { Link } from 'react-router-dom';
import { IoConstructOutline } from 'react-icons/io5';

export default function ComingSoon({ title, description }) {
  return (
    <div className="page">
      <h1 className="page-title">{title}</h1>
      <div className="card empty-state">
        <span className="badge-icon tint-yellow"><IoConstructOutline /></span>
        <h3>Trang này đang được xây dựng</h3>
        <p className="muted">{description}</p>
        <Link to="/app" className="btn btn-ghost">Về trang tổng quan</Link>
      </div>
    </div>
  );
}
