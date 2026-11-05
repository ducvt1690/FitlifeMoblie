'use strict';

// Match the whole message: greeting prefixes must not swallow an actual request.
function isGreeting(text) {
  if (typeof text !== 'string') return false;
  const q = text.normalize('NFKC').toLowerCase().trim()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').replace(/\s+/g, ' ');
  return /^(hi|hello|hey|alo|a lô|hé lô|chào|xin chào|chao|xin chao)(?: (?:coach|fitlife|bạn|ban|bạn ơi|mọi người|anh|chị|em))?(?: (?:ơi|ạ|nhé|nha))?$/.test(q);
}

function greetingReply() {
  return 'Chào bạn! Mình là FitLife Coach. Hôm nay bạn muốn hỏi về tập luyện, ăn uống hay theo dõi sức khỏe?';
}

// Only a current-turn request may create/change a plan. History may supply missing
// parameters for an explicit follow-up; the screen context alone never authorizes it.
function planRequest(text, previous) {
  const q = text.toLowerCase();
  if (/(?:đừng|chớ|không(?: cần| muốn)?|chưa(?: cần| muốn)?)\s+(?:(?:tạo|lên|lập|đổi|chỉnh|xếp|giúp)\s+){0,3}(?:lịch|giáo án|kế hoạch|chương trình|buổi)\s*tập/.test(q)) return null;
  if (/(?:lịch|giáo án|kế hoạch|chương trình|buổi)\s*tập\s+(?:là gì|có nghĩa|khác gì)/.test(q)) return null;
  if (!/(lịch|giáo án|kế hoạch|chương trình|plan|buổi)\s*(tập|workout|gym)|lên lịch|xếp lịch|sắp lịch|đổi lịch|chỉnh (lại )?lịch|chỉnh lại.*tập|đổi bài/.test(q)) return null;
  const hours = q.match(/(\d+(?:[.,]\d+)?)\s*(tiếng|giờ|h\b)/);
  const mins = q.match(/(\d{1,3})\s*(phút|p\b|min)/);
  const minutes = Math.min(Math.max(Math.round(hours ? Number(hours[1].replace(',', '.')) * 60 : mins ? Number(mins[1]) : previous?.minutes ?? 45), 15), 120);
  const [split, focus] = /thân trên|upper/.test(q) ? ['upper_lower', 'upper'] : /thân dưới|lower/.test(q) ? ['upper_lower', 'lower']
    : /push|ngực|vai|tay sau/.test(q) ? ['ppl', 'push'] : /pull|lưng|xô|tay trước|bắp tay/.test(q) ? ['ppl', 'pull']
      : /\blegs?\b|chân|mông|đùi/.test(q) ? ['ppl', 'legs']
        : previous ? [previous.split, previous.focus] : ['full_body', 'full'];
  return { split, focus, minutes, note: [...text.trim()].slice(0, 300).join('') };
}

// The model proposes app writes, but the current member message authorizes them.
function allowsCoachAction(type, text) {
  if (type === 'plan') return !!planRequest(text);
  const q = String(text || '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();
  if (type === 'meal') {
    if (/\b(?:dung|khong|chua)\s+(?:ghi|luu|them|log)\b/.test(q)) return false;
    const explicitLog = /\b(?:ghi|luu|them|nhap|log)\b.*\b(?:bua|mon|thuc an|an uong)\b/.test(q);
    const question = /[?？]|\b(?:co beo|bao nhieu|nen an|an gi|duoc khong|co tot|co hai|tot khong|tai sao|vi sao)\b/.test(q);
    return explicitLog || (!question && /\b(?:toi|minh|em)\s+(?:(?:da|vua|moi)\s+)?(?:an|uong)\s+(?!gi\b|bao nhieu\b)/.test(q));
  }
  if (type === 'suggest_meal') return /\b(?:goi y|de xuat|nen an|an gi|mon gi|bua tiep theo)\b/.test(q);
  if (type === 'allergy') return /\b(?:toi|minh|em)\b.*\b(?:di ung|khong dung nap)\b|\b(?:luu|ghi|them)\b.*\bdi ung\b/.test(q);
  if (type === 'remember') return !/\b(?:dung|khong)\s+(?:ghi )?nho\b/.test(q) && /\b(?:nho giup|nho la|nho rang|ghi nho|luu y)\b/.test(q);
  if (type === 'forget') return /\b(?:quen|xoa bo nho|bo ghi nho|dung nho)\b/.test(q);
  return false;
}

module.exports = { isGreeting, greetingReply, planRequest, allowsCoachAction };
