import { test, expect } from '@playwright/test';
// UI boundary checks. Gateway delivery/settlement are not claimed by these fixtures.
async function setup(page,{orderStatus='pending',failFirst=false}={}) {
  const requests=[];
  await page.addInitScript(()=>sessionStorage.setItem('fitlife.web.session','ui-test-session'));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    let body={};
    if(url.pathname==='/api/auth/me')body={user:{role:'user',name:'Payment UI Tester',user_id:'00000000-0000-4000-8000-000000000001'}};
    else if(url.pathname==='/api/payments/plans')body={configured:true,environment:'sandbox',membership:{premium:false},plans:[{product:'premium_month',title:'Premium 1 tháng',amount_vnd:49000,premium_days:30,coins:100}]};
    else if(url.pathname==='/api/payments/orders'&&route.request().method()==='POST'){
      requests.push(route.request().postDataJSON());
      if(failFirst&&requests.length===1){await route.fulfill({status:503,json:{message:'Retry fixture'}});return;}
      body={payment_url:'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?fixture=1'};
    } else if(url.pathname.startsWith('/api/payments/orders/'))body={order:{order_id:'00000000-0000-4000-8000-000000000002',status:orderStatus,amount_vnd:49000},membership:{premium:orderStatus==='paid'}};
    else if(url.pathname==='/api/payments/orders')body={orders:[],total:0,page:1,page_size:20};
    await route.fulfill({json:body});
  });
  await page.route('https://sandbox.vnpayment.vn/**',r=>r.fulfill({contentType:'text/html',body:'<h1>Sandbox navigation fixture</h1>'}));
  return requests;
}
test('checkout retry preserves the order id and opens VNPay sandbox',async({page})=>{
  const requests=await setup(page,{failFirst:true});await page.goto('/member/premium');
  await expect(page.getByText('Thanh toán thử nghiệm qua VNPay Sandbox.')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Điều hướng chính'})).not.toContainText('Đổi quà');
  await page.getByRole('button',{name:'Mua gói'}).click();
  const pay=page.getByRole('dialog').getByRole('button',{name:'Tiếp tục thanh toán'});
  await pay.click();await expect(page.getByRole('alert')).toContainText('Retry fixture');
  await pay.click();await expect(page).toHaveURL(/sandbox.vnpayment.vn/);
  expect(requests).toHaveLength(2);expect(requests[0].order_id).toBe(requests[1].order_id);
  expect(requests[0].return_url).toBe('http://localhost:5173/member/premium');
});
test('callback query cannot display paid when the Backend reports pending',async({page})=>{
  await setup(page,{orderStatus:'pending'});await page.goto('/member/premium?order=00000000-0000-4000-8000-000000000002&status=paid');
  await expect(page.getByRole('heading',{name:'Kết quả thanh toán'})).toBeVisible();
  const result = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Kết quả thanh toán', exact: true }) });
  await expect(result.locator('p[role="status"]')).toContainText('Chờ thanh toán');
});
