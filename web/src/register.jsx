import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { request, rootFor } from './api';
import { useAuth } from './context';
import { Button, Field } from './ui';

const STEPS = [['Tạo tài khoản', 'Chỉ mất chưa tới một phút.'], ['Về cơ thể bạn', 'Dùng để tính lượng calo và nước mỗi ngày.'], ['Mục tiêu của bạn', 'Bạn có thể đổi lại bất cứ lúc nào.']];
const GOALS = [['lose','Giảm cân','Ăn ít hơn mức tiêu hao một chút'],['maintain','Giữ dáng','Giữ cân nặng hiện tại'],['gain','Tăng cơ','Ăn dư một chút, tập kháng lực']];
const ACTIVITY = [['sedentary','Ít vận động','Ngồi nhiều, hầu như không tập'],['light','Nhẹ','1–3 buổi mỗi tuần'],['moderate','Vừa phải','3–5 buổi mỗi tuần'],['active','Năng động','6–7 buổi mỗi tuần']];
function Choices({ label, items, value, onChange }) {
  return <fieldset className="app-choices"><legend>{label}</legend>{items.map(([key,title,hint])=><label key={key} className={value===key?'selected':''}><input type="radio" name={label} value={key} checked={value===key} onChange={()=>onChange(key)} /><span><strong>{title}</strong>{hint&&<small>{hint}</small>}</span></label>)}</fieldset>;
}
export function RegisterPage() {
  const {user,ready,signIn}=useAuth();
  const [step,setStep]=useState(0), [form,setForm]=useState({full_name:'',email:'',password:'',confirm_password:'',gender:'male',age:22,height:170,weight:65,goal:'maintain',activity_level:'moderate'});
  const [sent,setSent]=useState(''),[code,setCode]=useState(''),[proof,setProof]=useState(null),[resend,setResend]=useState(0),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
  const lock=useRef(false),version=useRef(0);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const email=form.email.trim().toLowerCase(), verified=proof?.email===email&&proof.expires>Date.now(), codeSent=sent===email&&!!email;
  const countdown=Math.max(0,Math.ceil((resend-now)/1000));
  function change(key,value){if(key==='email'){version.current++;setProof(null);setSent('');setCode('');setResend(0);}setForm(f=>({...f,[key]:value}));setError('');}
  async function perform(action){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
  async function send(){if(resend>Date.now())return;const revision=version.current;const r=await request('/api/auth/register/email-code',{method:'POST',body:{email}});if(revision!==version.current)return;setProof(null);setCode('');setSent(email);setResend(Date.now()+r.resend_after*1000);}
  function submit(e){e.preventDefault();perform(async()=>{
    if(step===0){
      if(form.password!==form.confirm_password)throw new Error('Mật khẩu nhập lại chưa khớp.');
      if(verified){setStep(1);return;}
      if(!codeSent){await send();return;}
      if(!/^\d{6}$/.test(code))throw new Error('Nhập mã 6 số đã gửi đến email.');
      const revision=version.current;
      const r=await request('/api/auth/register/verify-email',{method:'POST',body:{email,code}});
      if(revision!==version.current)return;
      setProof({email,token:r.verification_token,expires:Date.now()+r.expires_in*1000});setCode('');setStep(1);
    }else if(step===1){setStep(2);}else{
      if(!verified){setProof(null);setSent('');setStep(0);throw new Error('Xác minh email đã hết hạn. Vui lòng gửi mã mới.');}
      try {const r=await request('/api/auth/register',{method:'POST',body:{...form,email,full_name:form.full_name.trim(),verification_token:proof.token}});setResult(r);}
      catch(e){if(e.status===403){setProof(null);setSent('');setStep(0);}throw e;}
    }
  });}
  if(ready&&user)return <Navigate to={rootFor(user.role)} replace/>;
  const p=result?.user.profile;
  return <main className="app-auth-shell"><div className="app-auth-column"><header className="app-auth-top">{!result&&<button className="icon-button" type="button" aria-label="Quay lại" disabled={busy} onClick={()=>step?setStep(step-1):location.assign('/login')}>‹</button>}<Link className="brand" to="/login">FitLife</Link>{!result&&<div className="app-step-bars" aria-label={`Bước ${step+1} trên 3`}>{STEPS.map((s,i)=><span key={s[0]} className={i<=step?'on':''}/>)}</div>}</header>
    <h1>{result?`Kế hoạch của ${result.user.name?.trim().split(' ').pop()||'bạn'}`:STEPS[step][0]}</h1><p className="muted">{result?'Mục tiêu mỗi ngày, tính từ thông tin bạn vừa nhập.':STEPS[step][1]}</p>
    {result?<><div className="app-plan"><div><span>Năng lượng</span><strong>{p?.target_calories?.toLocaleString('vi-VN')} kcal / ngày</strong></div><div><span>Nước</span><strong>{(p?.target_water/1000).toLocaleString('vi-VN')} lít / ngày</strong></div><div><span>Chỉ số cơ thể</span><strong>{(p?.weight/((p?.height/100)**2)).toLocaleString('vi-VN',{maximumFractionDigits:1})} BMI</strong></div></div><Button onClick={()=>signIn(result)}>Vào FitLife</Button></>:<form onSubmit={submit}>
      {step===0&&<div className="app-auth-card"><Field label="Họ và tên" value={form.full_name} onChange={e=>change('full_name',e.target.value)} autoComplete="name" placeholder="Nguyễn Văn A" maxLength={100} required disabled={busy}/><Field label="Email" type="email" value={form.email} onChange={e=>change('email',e.target.value)} autoComplete="email" placeholder="ban@email.com" maxLength={100} required disabled={busy}/><Field label="Mật khẩu" type="password" value={form.password} onChange={e=>change('password',e.target.value)} autoComplete="new-password" placeholder="Ít nhất 8 ký tự" minLength={8} required disabled={busy}/><Field label="Nhập lại mật khẩu" type="password" value={form.confirm_password} onChange={e=>change('confirm_password',e.target.value)} autoComplete="new-password" minLength={8} required disabled={busy}/>
        {verified?<p>Email đã được xác minh.</p>:codeSent?<><p className="muted">Mã xác minh đã gửi đến {email}. Mã có hiệu lực 10 phút.</p><Field label="Mã xác minh email" placeholder="Mã 6 số" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy}/><Button secondary type="button" disabled={busy||countdown>0} onClick={()=>perform(send)}>{countdown?`Gửi lại mã sau ${countdown}s`:'Gửi lại mã'}</Button></>:<p className="muted">Xác minh email trước khi tạo tài khoản. FitLife sẽ gửi mã 6 số đến hộp thư của bạn.</p>}</div>}
      {step===1&&<div className="app-auth-card"><Choices label="Giới tính" items={[[ 'male','Nam'],['female','Nữ']]} value={form.gender} onChange={v=>change('gender',v)}/>{[['age','Tuổi',5,100],['height','Chiều cao (cm)',80,250],['weight','Cân nặng (kg)',25,300]].map(([key,label,min,max])=><Field key={key} label={label} type="number" value={form[key]} min={min} max={max} step={1} required onChange={e=>change(key,Number(e.target.value))}/>)}</div>}
      {step===2&&<div className="app-auth-card"><Choices label="Mục tiêu" items={GOALS} value={form.goal} onChange={v=>change('goal',v)}/><Choices label="Mức vận động" items={ACTIVITY} value={form.activity_level} onChange={v=>change('activity_level',v)}/></div>}
      {error&&<p className="inline-error" role="alert">{error}</p>}<Button type="submit" busy={busy}>{step===0&&!verified?(codeSent?'Xác minh email':'Gửi mã xác minh'):step<2?'Tiếp tục':'Tạo kế hoạch'}</Button>{step===0&&<p className="app-auth-footer">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>}
    </form>}
  </div></main>;
}
