import { Link } from 'react-router-dom';
import { IoFlash } from 'react-icons/io5';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo">
      <span className="logo-mark"><IoFlash /></span>
      <span>FitLife</span>
    </Link>
  );
}
