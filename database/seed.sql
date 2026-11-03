-- ====================================================================
-- FITLIFE PRO (projectMMA) - DỮ LIỆU KHỞI TẠO HỆ THỐNG (SEED DATA)
-- ====================================================================

-- 1. Khởi tạo danh mục vật phẩm cửa hàng đổi thưởng (Shop Items)
INSERT INTO reward_items (item_id, title, category, cost_coins, icon, is_available)
VALUES 
('badge_1', 'Huy hiệu Người Mới Nhập Môn', 'badge', 0, 'ribbon-outline', TRUE),
('badge_2', 'Chiến Binh Thủy Hỏa 💧', 'badge', 50, 'water-outline', TRUE),
('badge_3', 'Vua Tabata Đốt Mỡ 🔥', 'badge', 100, 'flame-outline', TRUE),
('badge_4', 'Bậc Thầy Kỷ Luật 7 Ngày ⭐', 'badge', 200, 'trophy-outline', TRUE),
('voucher_1', 'Voucher Giảm 20% Whey Protein', 'voucher', 300, 'pricetag-outline', TRUE),
('streak_freeze', 'Đóng Băng Chuỗi Streak (1 Ngày)', 'utility', 150, 'snow-outline', TRUE)
ON CONFLICT (item_id) DO NOTHING;
