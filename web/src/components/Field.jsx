import { useState } from 'react';
import { IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5';

export default function Field({ label, error, type = 'text', suffix, ...props }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      <span className="field-control">
        <input type={isPassword && show ? 'text' : type} aria-invalid={Boolean(error)} {...props} />
        {suffix && <span className="field-suffix">{suffix}</span>}
        {isPassword && (
          <button type="button" className="field-eye" onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
            {show ? <IoEyeOffOutline /> : <IoEyeOutline />}
          </button>
        )}
      </span>
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
