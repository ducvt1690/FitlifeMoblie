import Logo from './Logo.jsx';

export default function AuthLayout({ title, subtitle, children, aside }) {
  return (
    <div className="auth-page">
      <section className="auth-panel">
        <Logo />
        <div className="auth-box">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
      </section>
      <aside className="auth-aside" aria-hidden="true">
        {aside ?? (
          <div>
            <h2>Một tài khoản,<br />cả app lẫn web.</h2>
            <p>Dữ liệu ghi trên điện thoại sẽ hiện ở đây và ngược lại.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
