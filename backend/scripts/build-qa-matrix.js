'use strict';

const fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '../..');
const definitions = {
  auth: ['auth', 'Tài khoản và phiên', 'users, auth_sessions, daily_quest_logs', 'Login, Register', 'AuthScreen', 'auth.test.js'],
  profile: ['profile', 'Hồ sơ và mục tiêu', 'users, bmi_history, workout_logs', 'Profile', 'ProfileScreen, BmiCalculatorScreen', 'profile.test.js'],
  water: ['water-logs', 'Nhật ký nước', 'water_logs, users, daily_quest_logs', 'Logs, Dashboard', 'HomeScreen, WaterTrackerScreen', 'member.test.js'],
  workout: ['workout-logs', 'Nhật ký tập', 'workout_logs, users, daily_quest_logs', 'Logs', 'WorkoutScreen, QuestScreen', 'workout.test.js'],
  exercise: ['exercises', 'Danh mục, tìm kiếm và chi tiết bài tập', 'exercises', 'Workouts', 'WorkoutScreen', 'Postman review'],
  meal: ['meal-logs', 'Thêm, xem, sửa và xóa bữa ăn', 'meal_logs, users, daily_quest_logs', 'Logs', 'CalorieScreen', 'meal.test.js'],
  quest: ['quests', 'Nhiệm vụ, điểm danh và streak', 'daily_quest_logs, users', 'Quests', 'QuestScreen', 'features.test.js'],
  bmi: ['bmi-records', 'BMI hiện tại và lịch sử', 'bmi_history, users', 'Progress (đọc)', 'BmiCalculatorScreen', 'features.test.js'],
  challenge: ['challenges', 'Tham gia và check-in thử thách', 'challenges, user_challenges, users', 'Challenges', 'ChallengeScreen', 'features.test.js'],
  reward: ['rewards', 'Đổi thưởng và sở hữu vật phẩm', 'reward_items, purchases, users', 'Rewards', 'ShopScreen', 'features.test.js'],
  stats: ['stats', 'Thống kê 1–31 ngày', 'water_logs, meal_logs, workout_logs, sleep_logs, mood_logs, daily_quest_logs', 'Dashboard, Progress', 'AnalyticsScreen', 'features.test.js'],
  chat: ['chat', 'AI Coach và lịch sử', 'ai_chat_sessions, ai_chat_messages, users, daily_quest_logs', 'Coach', 'AiCoachScreen', 'features.test.js'],
  coaching: ['coaching', 'Đồng ý kết nối và xử lý bài giao', 'trainer_links, trainer_assignments, workout_templates', 'Coaching', 'CoachingScreen', 'roles.test.js'],
  trainer: ['trainer', 'Mã mời, giáo án, giao bài và xem học viên', 'users, trainer_links, workout_templates, trainer_assignments; đọc nhật ký khi đủ quyền', 'trainer/*', 'Không áp dụng (mobile chỉ user)', 'roles.test.js'],
  admin: ['admin', 'Quản lý tài khoản, danh mục và audit', 'users, challenges, reward_items, purchases, admin_logs', 'admin/*', 'Không áp dụng (mobile chỉ user)', 'roles.test.js']
};
const collection = require('../api/review-api.postman_collection.json');
const normalize = p => p.replace(/\?.*/, '').replace('{{baseUrl}}', '').replace(/\{\{[^}]+\}\}|:[^/]+/g, ':id');
const rows = [];
for (const file of fs.readdirSync(path.join(root, 'backend/routes'))) {
  const group = file.split('.')[0];
  const specs = group === 'daily-log' ? [['sleep-logs', 'Giấc ngủ', 'sleep_logs, users, daily_quest_logs', 'Logs', 'QuestScreen', 'features.test.js'], ['mood-logs', 'Tâm trạng', 'mood_logs, users, daily_quest_logs', 'Logs', 'HomeScreen, QuestScreen', 'features.test.js']] : [definitions[group]];
  for (const spec of specs) {
    if (!spec) throw new Error('Unmapped router ' + file);
    const [prefix, job, db, web, mobile, test] = spec;
    for (const [, method, suffix] of fs.readFileSync(path.join(root, 'backend/routes', file), 'utf8').matchAll(/router\.(get|post|patch|put|delete)\('([^']+)'/g)) {
      const endpoint = '/api/' + prefix + (suffix === '/' ? '' : suffix),
        verb = method.toUpperCase();
      const requests = collection.item.filter(i => i.request.method === verb && normalize(i.request.url) === normalize(endpoint)).length;
      if (!requests) throw new Error('No Postman request for ' + verb + ' ' + endpoint);
      rows.push([job, verb + ' ' + endpoint, db, web, mobile, test + '; ' + requests + ' Postman request(s)']);
    }
  }
}
const out = path.join(root, 'docs/qa');
fs.mkdirSync(out, {
  recursive: true
});
fs.writeFileSync(path.join(out, 'API_MATRIX.md'), '# Ma trận nghiệp vụ → API → database → web → mobile → test\n\n' + 'Được sinh từ route thật và collection review. Có ' + rows.length + ' cặp method/path nghiệp vụ; `GET /` và `GET /health` là hai route hệ thống bổ sung. Phủ route không thay thế kiểm thử mọi tổ hợp đầu vào. Kết quả thực thi nằm ở [báo cáo QA](ACCEPTANCE_2026-11-04.md).\n\n' + '| Nghiệp vụ | API | MongoDB | Web | Mobile | Bằng chứng kiểm thử |\n|---|---|---|---|---|---|\n' + rows.map(r => '| ' + r.join(' | ') + ' |').join('\n') + '\n\n' + 'Chi tiết request/response, validation và lỗi: [profile](../../backend/api/profile.md), [workout](../../backend/api/workouts.md), [meals](../../backend/api/meals.md), [features](../../backend/api/features.md), [Postman review](../../backend/api/review-api.postman_collection.json). Mobile adapter được kiểm tra với backend/MongoDB thật bởi `frontend/tests/server-integration.test.cjs`. Một số endpoint chi tiết được API test bao phủ dù UI dùng dữ liệu đã có từ danh sách.\n');
console.log('Generated API_MATRIX.md for ' + rows.length + ' business endpoints; all have Postman coverage.');
