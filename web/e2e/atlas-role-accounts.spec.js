import { test, expect } from '@playwright/test';
import fs from 'node:fs';
// These checks target operator-provisioned Atlas accounts, not the disposable default test DB.
for (const role of ['admin', 'trainer']) test(`Atlas ${role} account logs in with correct navigation`, async({page})=>{
  test.skip(process.env.FITLIFE_TEST_ATLAS !== '1', 'Set FITLIFE_TEST_ATLAS=1 to opt into Atlas account checks.');
  const credentials = JSON.parse(fs.readFileSync(new URL('../../output/atlas-test-accounts.local.json',import.meta.url),'utf8'));
  const account = credentials.accounts.find(account => account.role === role);
  expect(account, `Missing local credentials for ${role}`).toBeTruthy();
  await page.goto('/login');
  await page.getByLabel('Email',{exact:true}).fill(account.email);
  await page.getByLabel('Mật khẩu',{exact:true}).fill(account.password);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/'+account.role+'$'));
  const nav=page.getByRole('navigation',{name:'Điều hướng chính'});
  await expect(nav).not.toContainText('Đổi quà');await expect(nav).not.toContainText('Phần thưởng');
  await expect(nav).toContainText(account.role==='admin'?'Tài khoản':'Học viên');
  await page.screenshot({path:'../output/playwright/atlas-'+account.role+'.png',fullPage:true});
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
});
