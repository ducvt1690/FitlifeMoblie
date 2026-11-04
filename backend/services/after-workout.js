'use strict';
// Advice for the hour after a session, picked by the member's local time of day.
// Based on common sports-nutrition and sleep guidance: 20–40 g protein within ~2 h (ISSN),
// rehydrate gradually, let heart rate settle before showering, a warm shower 1–2 h before bed helps sleep onset.

function localHour(date, timezone) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'Asia/Ho_Chi_Minh', hour: '2-digit', hourCycle: 'h23' }).format(date));
}

function partOfDay(hour) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour < 15 && hour >= 11) return 'noon';
  if (hour < 19 && hour >= 15) return 'afternoon';
  if (hour < 22 && hour >= 19) return 'evening';
  return 'late';
}

const SHOWER = {
  morning: 'Nghỉ 15–20 phút cho mồ hôi và nhịp tim dịu lại rồi tắm nước ấm vừa, không tắm nước quá lạnh ngay sau tập.',
  noon: 'Nghỉ 15–20 phút cho mồ hôi khô bớt rồi hãy tắm, tránh tắm ngay khi người còn nóng hoặc vừa ở ngoài nắng vào.',
  afternoon: 'Nghỉ 15–20 phút rồi tắm nước ấm, tránh dội nước lạnh ngay khi người còn đang nóng.',
  evening: 'Nghỉ 15–20 phút rồi tắm nước ấm (khoảng 40 °C) chừng 10 phút. Tắm ấm trước giờ ngủ 1–2 tiếng giúp dễ ngủ hơn.',
  late: 'Đã khuya: chờ 15 phút rồi tắm nhanh 5–10 phút bằng nước ấm, không tắm nước lạnh hay quá nóng, lau khô tóc trước khi ngủ.',
};
const MEAL = {
  morning: 'Ăn sáng trong khoảng 1 giờ, có tinh bột và 20–40 g đạm: bánh mì trứng, phở bò, hoặc yến mạch với sữa và chuối.',
  noon: 'Bữa trưa trong 1 giờ tới: cơm vừa đủ, thịt, cá hoặc đậu phụ (20–40 g đạm) và nhiều rau.',
  afternoon: 'Ăn nhẹ ngay (chuối, sữa, sữa chua) nếu còn lâu mới tới bữa tối; bữa tối nhớ có 20–40 g đạm.',
  evening: 'Ăn tối trong 1 giờ tới: cơm vừa phải, thịt, cá hoặc trứng và rau; hạn chế đồ chiên nhiều dầu và đồ quá cay.',
  late: 'Nếu đói, ăn nhẹ giàu đạm như sữa, sữa chua Hy Lạp hoặc 2 quả trứng luộc; tránh bữa nặng, nhiều dầu ngay trước khi ngủ.',
};
const EXTRA = {
  morning: 'Giãn cơ nhẹ 5 phút trước khi bắt đầu công việc.',
  noon: 'Nếu chiều còn làm việc, một giấc ngắn 15–20 phút giúp hồi phục tốt.',
  afternoon: 'Tránh cà phê, trà đặc, nước tăng lực sau 16 giờ để tối dễ ngủ.',
  evening: 'Giãn cơ 5 phút và giảm ánh sáng màn hình; cơ thể cần 1–2 giờ để hạ nhiệt trước khi ngủ sâu.',
  late: 'Đi ngủ sau khoảng 1 giờ, không dùng cà phê hay nước tăng lực. Lần sau thử tập sớm hơn để giấc ngủ không bị ảnh hưởng.',
};

// `eaten` and `target` are today's kcal; returns tips to show now and reminders the phone schedules (minutes from now).
function afterWorkout({ now = new Date(), timezone, eaten = 0, target = 0, minutes = 0 }) {
  const part = partOfDay(localHour(now, timezone));
  const left = Math.round(target - eaten);
  const water = minutes >= 60 ? '600–800' : '400–600';
  const calories = target > 0 ? (left > 300 ? `Hôm nay bạn còn khoảng ${left} kcal, đủ cho một bữa đầy đặn sau tập.`
    : 'Bạn đã gần đủ calo hôm nay, bữa sau tập nên nhẹ, ưu tiên đạm và rau.') : null;
  const tips = [
    { icon: 'water', title: 'Bù nước', text: `Uống ${water} ml nước trong 30 phút tới, chia thành nhiều ngụm.` },
    { icon: 'sparkles', title: 'Tắm', text: SHOWER[part] },
    { icon: 'restaurant', title: 'Ăn uống', text: [MEAL[part], calories].filter(Boolean).join(' ') },
    { icon: part === 'evening' || part === 'late' ? 'moon' : 'body', title: part === 'evening' || part === 'late' ? 'Giấc ngủ' : 'Hồi phục', text: EXTRA[part] },
  ];
  const reminders = [
    { in_minutes: 20, title: 'Đến giờ tắm rồi', body: SHOWER[part] },
    { in_minutes: part === 'late' ? 30 : 45, title: part === 'late' ? 'Ăn nhẹ trước khi ngủ?' : 'Đến giờ ăn sau tập', body: MEAL[part] },
  ];
  return { part, tips, reminders };
}

module.exports = { afterWorkout, localHour, partOfDay };
