'use strict';

// Scope comes from the member's current words, not from the tab or from the
// mere presence of "FitLife". Normalize accents while retaining word boundaries.
function normalize(text) {
  return typeof text === 'string' ? text.normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

const words = expression => new RegExp(`(?:^| )(?:${expression})(?= |$)`);
const outsideTopics = [
  words('lap trinh|viet (?:doan )?code|write code|python|javascript|typescript|html|css|sql|database|co so du lieu|tao website|viet ham|debug code|hack|malware'),
  words('thoi tiet|du bao mua|du bao thoi tiet|nhiet do ngoai troi|thu do|du lich|ve may bay|dat phong|khach san'),
  words('chinh tri|bau cu|tong thong|thu tuong|chien tranh|tin tuc|thoi su'),
  words('chung khoan|co phieu|bitcoin|crypto|forex|dau tu|ty gia|gia vang|vay tien|lai suat|xo so|lo de|casino'),
  words('viet tho|lam tho|viet van|bai tho|ke chuyen|truyen cuoi|giai toan|bai tap toan|van hoc|lich su viet nam|ti so bong da|ket qua bong da'),
  words('ke don|ke thuoc|uong thuoc gi|thuoc giam can|chan doan|chua benh|dieu tri|lieu thuoc|insulin'),
  words('mat khau gmail|app password|smtp|mongodb|api key|lay token|xem token|tiet lo token|tiet lo mat khau'),
];

const topics = [
  ['weight_goal', words('giam (?:can|kg|ky|ki lo|kilogram|mo)|tang (?:can|kg|ky|co)|giu (?:can|dang)|muc tieu (?:can nang|co the)|lose weight|weight loss|weight gain')],
  ['water', words('nuoc|uong nuoc|water|hydrat(?:e|ion)|ml nuoc|ly nuoc')],
  ['nutrition', words('an|an uong|bua|bua an|thuc don|dinh duong|macro|calo|calorie|calories|kcal|protein|dam|carb|carbs|chat beo|di ung|hai san|uc ga|thit ga|thit bo|ca hoi|yen mach|khoai lang|whey|food|meal|nutrition')],
  ['workout', words('tap|tap luyen|lich tap|giao an|bai tap|buoi tap|workout|gym|push|pull|legs|upper|lower|full body|nhom co|co bap|ta don|ta tay|ta nguc|co chan|plank|squat|deadlift|hiit|tabata|chay bo|di bo|khoi dong|phuc hoi')],
  ['sleep', words('ngu|giac ngu|mat ngu|sleep|met moi|met')],
  ['bmi', words('bmi|can nang|chieu cao|chi so co the')],
  ['trainer', words('huan luyen vien|trainer|hoc vien|ma moi|giao bai|bai duoc giao')],
  ['stats', words('thong ke|tom tat hom nay|tien bo|chuoi ngay|streak|fitcoin|fitcoins|nhiem vu|phan thuong|doi thuong|thu thach|tam trang|mood|buoc chan|so buoc|bao nhieu buoc|may buoc|steps')],
  ['app_help', words('dang ky|dang nhap|dang xuat|tai khoan|mat khau|otp|xac minh email|ma xac minh|ho so|premium|goi thanh vien|fitlife|ung dung nay|app nay|giao dien|anh dai dien|anh bia|thong bao')],
];
const thanks = /^(?:(?:rat )?cam on(?: (?:ban|coach|nhieu))?(?: nhe| nha| a)?|thanks|thank you|ok|okay|oke|oki|da hieu|hieu roi|vang|duoc roi)$/;
const followUp = /^(?:(?:vay|the|con) )?(?:con lai bao nhieu|con thieu bao nhieu|can them bao nhieu|bao nhieu nua|du chua|da du chua|them may ly nua)(?: (?:nhi|nhe|vay|a))?$/;
const helpQuestion = words('o dau|lam sao|lam the nao|the nao|cach|huong dan|khong biet|khong tim thay|khong thay|khong nhan duoc|khong gui duoc');

function explicitOutside(q) {
  return outsideTopics.some(pattern => pattern.test(q));
}

function helpKind(q) {
  if (/^(?:ban|coach|ai coach|fitlife coach) (?:la ai|ten (?:la )?gi|la gi)$/.test(q)) return 'overview';
  if (words('dang ky|tao tai khoan').test(q) && words('trainer|huan luyen vien|admin|quan tri vien').test(q)) return 'role';
  if (words('quen mat khau|khong nho mat khau|forgot password').test(q)) return 'forgot_password';
  if (words('doi mat khau|thay mat khau|change password').test(q)) return 'change_password';
  if (words('dang ky|tao tai khoan|xac minh email|ma otp|otp|ma xac minh|gui lai ma').test(q)) return 'signup';
  if (words('dang xuat').test(q)) return 'logout';
  if (words('dang nhap').test(q)) return 'login';
  if (words('ma moi|ket noi trainer|ket noi huan luyen vien|huan luyen vien cua toi|nhan bai tu huan luyen vien|ngat ket noi').test(q)) return 'trainer';
  if (words('phan quyen|doi vai tro|cap vai tro|role').test(q)) return 'role';
  if (/(?:doi|chinh sua|cap nhat|chuyen).*muc tieu|muc tieu.*(?:o dau|cach doi)/.test(q)) return 'goal';
  if ((words('ho so|ngay sinh|can nang|chieu cao|anh dai dien|anh bia').test(q) && helpQuestion.test(q))
    || words('sua ho so|doi ten|cap nhat ho so|doi ngay sinh').test(q)) return 'profile';
  if (words('nuoc|water').test(q) && (helpQuestion.test(q) || words('ghi|them|luu|log|record').test(q))) return 'water';
  if (words('ghi bua|luu bua|them bua|nhat ky bua|ghi mon|tinh macro').test(q)
    || (words('an uong|bua an|thuc don').test(q) && helpQuestion.test(q))) return 'meal';
  if (words('lich tap|giao an|workout').test(q) && helpQuestion.test(q)) return 'workout';
  if (words('premium|goi thanh vien').test(q)) return 'membership';
  if (words('thong ke|tien bo|lich su tap').test(q) && helpQuestion.test(q)) return 'stats';
  if (/^(?:fitlife|app nay|ung dung nay|ban) (?:lam duoc gi|co chuc nang gi|giup duoc gi)|^(?:huong dan|cach) (?:dung|su dung) (?:fitlife|app|ung dung)/.test(q)) return 'overview';
  return null;
}

const helpReplies = {
  signup: 'Chọn Tạo tài khoản, nhập họ tên, email, mật khẩu và nhập lại mật khẩu. Bấm Gửi mã xác minh, nhập mã 6 số trong email rồi bấm Xác minh email. Sau đó hoàn tất thông tin cơ thể và mục tiêu để tạo tài khoản. Nếu chưa nhận mã, kiểm tra thư rác và chờ hết thời gian đếm trước khi Gửi lại mã.',
  forgot_password: 'Ở màn hình Đăng nhập, chọn Quên mật khẩu?, nhập email đã đăng ký và bấm Gửi mã. Nhập mã 6 số nhận trong email cùng mật khẩu mới, rồi bấm Đặt mật khẩu mới. Hãy nhập mã ở màn hình đó, không gửi mật khẩu hoặc mã vào chat.',
  change_password: 'Vào Hồ sơ → Đổi mật khẩu. Nhập mật khẩu hiện tại, mật khẩu mới và nhập lại mật khẩu mới, rồi bấm Đổi mật khẩu. Mật khẩu mới cần ít nhất 8 ký tự; các phiên trên thiết bị khác sẽ được đăng xuất.',
  login: 'Chọn Đăng nhập rồi dùng email và mật khẩu đã đăng ký với FitLife. Nếu không nhớ mật khẩu, chọn Quên mật khẩu? để đặt lại qua email. Đừng gửi mật khẩu vào chat.',
  logout: 'Vào Hồ sơ và bấm Đăng xuất ở cuối màn hình để kết thúc phiên hiện tại.',
  trainer: 'Vào Hồ sơ → Huấn luyện viên của tôi, nhập mã mời 8 ký tự từ trainer và bấm Đồng ý kết nối. Bài trainer giao sẽ xuất hiện tại đó; bạn có thể Đánh dấu hoàn thành hoặc Ngắt kết nối khi không muốn nhận bài nữa.',
  role: 'Tài khoản đăng ký mới có vai trò thành viên. Quản trị viên có thể đổi thành viên ↔ huấn luyện viên tại Người dùng → Đổi vai trò. Chat không tự cấp quyền hoặc đổi vai trò tài khoản.',
  goal: 'Vào Hồ sơ → Chỉnh sửa, chọn Mục tiêu là Giảm cân, Giữ dáng hoặc Tăng cơ rồi bấm Lưu thay đổi. FitLife sẽ tính lại mục tiêu năng lượng và nước dựa trên thông tin hồ sơ; chat chưa tự đổi mục tiêu giúp bạn.',
  profile: 'Vào Hồ sơ → Chỉnh sửa để cập nhật họ tên, ngày sinh, chiều cao, cân nặng, mục tiêu và mức vận động, rồi bấm Lưu thay đổi. Bạn xem thông tin cơ thể và tiến bộ cân nặng trong Hồ sơ khi đã có dữ liệu.',
  water: 'Ở tab Hôm nay, bấm +250 ml mỗi khi bạn uống một ly nước. Tổng nước và phần còn thiếu sẽ cập nhật trên màn hình. Mình chưa ghi thêm nước chỉ từ câu hỏi này.',
  meal: 'Vào Ăn uống, nhập món và lượng ăn ở Bạn vừa ăn gì?, rồi bấm Tính macro. Kiểm tra số gram, calo và đạm/tinh bột/chất béo trước khi bấm Lưu bữa ăn. Với món được gợi ý, chỉ bấm Đã ăn sau khi bạn thực sự ăn món đó.',
  workout: 'Vào Tập luyện, chọn kiểu chia lịch, buổi và thời gian rồi bấm Tạo lịch tập. Nếu đã có lịch, chọn Tạo lịch khác để đổi. Khi tập, đánh dấu các bài đã làm và bấm Đã tập xong; tạo lịch có trong gói miễn phí.',
  membership: 'Tạo lịch tập có trong gói miễn phí. Premium có thêm lượt AI dùng cho lịch tập và dinh dưỡng. Bạn xem trạng thái gói tại Hồ sơ; các tính năng và thời hạn cụ thể hiển thị trong Gói thành viên.',
  stats: 'Tab Hôm nay tổng hợp nước, năng lượng, thời gian tập, bước chân và FitCoin. Vào Hồ sơ để xem số buổi tập, phút tập, chuỗi ngày và tiến bộ cân nặng khi đã có dữ liệu.',
  overview: 'Mình là FitLife Coach, trợ lý hỗ trợ trong ứng dụng FitLife. App có các tab Hôm nay, Ăn uống, Tập luyện, AI Coach và Hồ sơ. Bạn có thể ghi nước/bữa ăn, tạo lịch tập, theo dõi tiến bộ và quản lý hồ sơ. Bạn muốn mình hướng dẫn phần nào?',
};

function appHelpReply(text) {
  const q = normalize(text);
  if (!q || explicitOutside(q)) return null;
  const kind = helpKind(q);
  return kind ? helpReplies[kind] : null;
}

function directTopic(q) {
  if (helpKind(q)) return 'app_help';
  return topics.find(([, pattern]) => pattern.test(q))?.[0] ?? null;
}

function classifyCoachMessage(text, { previousUserText } = {}) {
  const q = normalize(text);
  if (!q) return { kind: 'clarify' };
  // Explicit unrelated subjects win even when the prompt also says FitLife or
  // contains accidental fitness words such as "bài tập lập trình".
  if (explicitOutside(q)) return { kind: 'out_of_scope' };
  if (thanks.test(q)) return { kind: 'thanks' };
  const topic = directTopic(q);
  if (topic) return { kind: 'in_scope', topic };
  if (followUp.test(q)) {
    const previous = normalize(previousUserText);
    const previousTopic = previous && !explicitOutside(previous) ? directTopic(previous) : null;
    if (previousTopic === 'water' || previousTopic === 'nutrition') return { kind: 'in_scope', topic: previousTopic };
  }
  return { kind: 'clarify' };
}

function outOfScopeReply() {
  return 'Mình chỉ hỗ trợ các nội dung trong FitLife: tập luyện, ăn uống, nước uống, giấc ngủ, chỉ số cơ thể và cách dùng app. Bạn muốn hỏi phần nào trong FitLife?';
}

module.exports = { classifyCoachMessage, appHelpReply, outOfScopeReply };
