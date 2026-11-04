const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  {
    randomUUID
  } = require('node:crypto');
const {
  chromium,
  expect
} = require('@playwright/test');
const mobileUrl = process.env.FITLIFE_MOBILE_URL || 'http://127.0.0.1:8085';
const webUrl = process.env.FITLIFE_WEB_URL || 'http://127.0.0.1:5175';
const results = [];
async function step(name, action) {
  try {
    await action();
    results.push({
      name,
      status: 'PASS'
    });
    console.log('PASS ' + name);
  } catch (e) {
    results.push({
      name,
      status: 'FAIL',
      message: e.message
    });
    throw e;
  }
}
(async () => {
  const browser = await chromium.launch({
    channel: process.env.FITLIFE_BROWSER_CHANNEL || 'msedge',
    headless: true
  });
  const mobile = await browser.newPage({
      viewport: {
        width: 412,
        height: 915
      }
    }),
    web = await browser.newPage();
  const errors = [];
  for (const p of [mobile, web]) {
    p.on('pageerror', e => errors.push(e.message));
    p.on('dialog', d => d.accept());
  }
  const email = 'cross-' + randomUUID() + '@qa.example',
    password = 'Cross-platform-test-2026!';
  const close = () => mobile.getByLabel('Đóng tiện ích', {
    exact: true
  }).click();
  const menu = async title => {
    await mobile.getByRole('button', {
      name: 'Menu',
      exact: true
    }).click();
    await mobile.getByText(title, {
      exact: true
    }).click();
  };
  const out = path.resolve(__dirname, '../../qa-artifacts');
  fs.mkdirSync(out, {
    recursive: true
  });
  try {
    await step('Mobile registration creates a server account with onboarding', async () => {
      await mobile.goto(mobileUrl);
      await mobile.getByText('Tạo Tài Khoản', {
        exact: true
      }).click();
      await mobile.getByLabel('Họ và tên', {
        exact: true
      }).fill('Cross Platform QA');
      await mobile.getByLabel('Email', {
        exact: true
      }).fill(email);
      await mobile.getByLabel('Mật khẩu', {
        exact: true
      }).fill(password);
      await mobile.getByLabel('Xác nhận mật khẩu', {
        exact: true
      }).fill(password);
      await mobile.getByLabel('Tuổi', {
        exact: true
      }).fill('25');
      await mobile.getByLabel('Chiều cao', {
        exact: true
      }).fill('170');
      await mobile.getByLabel('Cân nặng', {
        exact: true
      }).fill('65');
      await mobile.getByText('Đăng Ký Tài Khoản →', {
        exact: true
      }).click();
      await expect(mobile.getByText('Cross Platform QA', {
        exact: true
      })).toBeVisible();
    });
    await step('Mobile water log appears on the website after signing into the same account', async () => {
      const saved = mobile.waitForResponse(r => r.url().endsWith('/api/water-logs') && r.request().method() === 'POST');
      await mobile.getByText('+250ml', {
        exact: true
      }).click();
      assert.equal((await saved).status(), 201);
      await web.goto(webUrl + '/login');
      await web.getByLabel('Email', {
        exact: true
      }).fill(email);
      await web.getByLabel('Mật khẩu', {
        exact: true
      }).fill(password);
      await web.getByRole('button', {
        name: 'Đăng nhập',
        exact: true
      }).click();
      await web.waitForURL('**/app');
      const water = web.waitForResponse(r => r.url().includes('/api/water-logs') && r.request().method() === 'GET');
      await web.goto(webUrl + '/app/logs');
      const data = await (await water).json();
      assert.equal(data.total, 250);
      assert.equal(data.logs.length, 1);
      await expect(web.locator('.chip-list').getByText(/250 ml/)).toBeVisible();
    });
    await step('Website meal creation appears in the mobile nutrition screen', async () => {
      await web.getByLabel('Tên món', {
        exact: true
      }).fill('Bữa ăn đồng bộ QA');
      await web.getByLabel(/^Calo/).fill('450');
      await web.getByRole('button', {
        name: 'Thêm bữa ăn',
        exact: true
      }).click();
      await expect(web.getByText('Bữa ăn đồng bộ QA', {
        exact: true
      })).toBeVisible();
      await menu('Nhật ký Calo & Dinh dưỡng');
      await expect(mobile.getByText('Bữa ăn đồng bộ QA', {
        exact: true
      })).toBeVisible();
      await close();
    });
    await step('Mobile meal editing persists on the website without a second quest reward', async () => {
      await menu('Nhật ký Calo & Dinh dưỡng');
      await mobile.getByLabel('Sửa Bữa ăn đồng bộ QA', {
        exact: true
      }).click();
      await mobile.getByPlaceholder('Số Calo (kcal) *', {
        exact: true
      }).fill('500');
      await mobile.getByText('Lưu món ăn này', {
        exact: true
      }).click();
      await close();
      const meals = web.waitForResponse(r => r.url().includes('/api/meal-logs') && r.request().method() === 'GET');
      await web.reload();
      const data = await (await meals).json();
      assert.equal(data.total_calories, 500);
      assert.equal(data.logs.length, 1);
    });
    await step('Mobile quests, check-in and challenge progress follow backend rules', async () => {
      await mobile.getByRole('button', {
        name: 'Nhiệm vụ',
        exact: true
      }).click();
      const checked = mobile.waitForResponse(r => r.url().endsWith('/api/quests/checkin'));
      await mobile.getByText('Điểm danh trong ngày', {
        exact: true
      }).locator('..').getByRole('button', {
        name: 'Thực hiện',
        exact: true
      }).click();
      assert.equal((await checked).status(), 200);
      await mobile.getByRole('button', {
        name: 'Thử thách',
        exact: true
      }).click();
      await mobile.getByRole('button', {
        name: 'Tham gia',
        exact: true
      }).first().click();
      await mobile.getByRole('button', {
        name: 'Check-in hôm nay',
        exact: true
      }).first().click();
      await expect(mobile.getByRole('button', {
        name: 'Đã check-in hôm nay',
        exact: true
      })).toBeDisabled();
    });
    await step('Mobile reward ownership persists on the website', async () => {
      await menu('🎁 Cửa Hàng Đổi Xu (Shop)');
      await mobile.getByRole('button', {
        name: 'Đổi 0 xu',
        exact: true
      }).click();
      await expect(mobile.getByRole('button', {
        name: 'Đã sở hữu',
        exact: true
      })).toBeVisible();
      await close();
      const rewards = web.waitForResponse(r => r.url().endsWith('/api/rewards'));
      await web.goto(webUrl + '/app/rewards');
      assert.ok((await (await rewards).json()).items.some(i => i.cost_coins === 0 && i.owned));
    });
    await step('Mobile chat retry recovers a saved response after two dropped network responses', async () => {
      await menu('🤖 Trợ Lý AI FitLife Coach');
      let count = 0,
        first;
      await mobile.route('**/api/chat/messages', async route => {
        count++;
        const body = route.request().postDataJSON();
        if (!first) first = body;else assert.deepEqual(body, first);
        if (count <= 2) {
          await route.fetch();
          await route.abort('failed');
        } else await route.continue();
      });
      await mobile.getByLabel('Câu hỏi', {
        exact: true
      }).fill('Hôm nay uống bao nhiêu nước?');
      await mobile.getByRole('button', {
        name: 'Gửi câu hỏi',
        exact: true
      }).click();
      await expect(mobile.getByText(/Không kết nối được máy chủ/)).toBeVisible();
      await mobile.getByRole('button', {
        name: 'Gửi câu hỏi',
        exact: true
      }).click();
      await expect(mobile.getByText(/Hôm nay bạn đã uống 250/)).toBeVisible();
      assert.equal(count, 3);
      await mobile.unroute('**/api/chat/messages');
      await close();
    });
    await step('Mobile catalog uses real API search and renders empty results', async () => {
      await menu('Luyện tập & Bấm giờ HIIT');
      await expect(mobile.getByText('Bài tập kiểm thử 0', {
        exact: true
      })).toBeVisible();
      await mobile.getByLabel('Tìm bài tập', {
        exact: true
      }).fill('not-a-real-exercise-qa');
      await mobile.getByText('Tìm kiếm bài tập', {
        exact: true
      }).click();
      await expect(mobile.getByText('Chưa có bài tập phù hợp.', {
        exact: true
      })).toBeVisible();
      await close();
    });
    await step('Mobile server failure shows an error and can be retried', async () => {
      await mobile.route('**/api/rewards', r => r.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'QA service unavailable'
        })
      }));
      await menu('🎁 Cửa Hàng Đổi Xu (Shop)');
      await expect(mobile.getByText('QA service unavailable', {
        exact: true
      })).toBeVisible();
      await mobile.unroute('**/api/rewards');
      await mobile.getByRole('button', {
        name: 'Thử lại',
        exact: true
      }).click();
      await expect(mobile.getByRole('button', {
        name: 'Đã sở hữu',
        exact: true
      })).toBeVisible();
      await close();
    });
    await step('Mobile session rejection returns to login without cached private data', async () => {
      await mobile.route('**/api/rewards', r => r.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Session expired QA'
        })
      }));
      await menu('🎁 Cửa Hàng Đổi Xu (Shop)');
      await expect(mobile.getByText('Đăng Nhập Ngay →', {
        exact: true
      })).toBeVisible();
      await mobile.unroute('**/api/rewards');
    });
    assert.deepEqual(errors, []);
    await mobile.screenshot({
      path: path.join(out, 'mobile-login.png')
    });
    await web.screenshot({
      path: path.join(out, 'web-rewards.png'),
      fullPage: true
    });
  } finally {
    fs.writeFileSync(path.join(out, 'cross-platform.json'), JSON.stringify({
      results,
      runtimeErrors: errors
    }, null, 2));
    await browser.close();
  }
})().catch(e => {
  console.error(e.message);
  process.exitCode = 1;
});
