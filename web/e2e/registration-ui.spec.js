import { test, expect } from '@playwright/test';
test('App-style Web registration progresses through OTP, body and goal', async ({page})=>{
  // UI contract only: delivery is isolated to avoid sending email during a layout test.
  await page.route('**/api/auth/register/email-code',r=>r.fulfill({json:{resend_after:60,expires_in:600}}));
  await page.route('**/api/auth/register/verify-email',r=>r.fulfill({json:{verification_token:'test-proof',expires_in:600}}));
  let submitted;
  await page.route('**/api/auth/register',async r=>{submitted=r.request().postDataJSON();await r.fulfill({json:{token:'test-token',user:{name:'Test Member',role:'user',profile:{height:170,weight:65,target_calories:2200,target_water:2500}}}});});
  await page.goto('/register');
  await expect(page.getByLabel('Mã xác minh email')).toHaveCount(0);
  for(const [label,value] of [['Họ và tên','Test Member'],['Email','ui@fitlife.example'],['Mật khẩu','Testing123!'],['Nhập lại mật khẩu','Testing123!']]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole('button',{name:'Gửi mã xác minh',exact:true}).click();
  await expect(page.getByRole('button',{name:/Gửi lại mã sau/})).toBeDisabled();
  await page.getByLabel('Mã xác minh email').fill('123456');
  await page.getByRole('button',{name:'Xác minh email',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Về cơ thể bạn'})).toBeVisible();
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Mục tiêu của bạn'})).toBeVisible();
  await page.getByRole('button',{name:'Tạo kế hoạch'}).click();
  await expect(page.getByRole('button',{name:'Vào FitLife'})).toBeVisible();
  expect(submitted.verification_token).toBe('test-proof');expect(submitted.age).toBe(22);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'../output/playwright/app-style-register.png',fullPage:true});
});
