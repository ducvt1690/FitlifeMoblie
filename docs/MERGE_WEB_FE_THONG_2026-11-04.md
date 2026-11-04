# Gộp web-fe vào thông — 04/11/2026

Nhánh `thông` từ `1936a98` nhận toàn bộ nhánh local `web-fe` tại `3ad90fa` bằng fast-forward, không có xung đột Git. Nguồn gồm bản `origin/web-fe` tại `c1480f9` và commit local bổ sung Postman/ERD/review. Các bản sửa sau đó nằm trên `thông`.

Thực hiện tại worktree `C:\Users\thong\.codex\worktrees\merge-web-fe-thong\FitlifeMoblie`. Thư mục gốc `C:\hoc tap\FitlifeMoblie` vẫn ở `main`; các chỉnh sửa chưa commit tại đó được giữ nguyên. Chưa push lên GitHub.

## Đã sửa

- Check-in thử thách kiểm tra tất cả lượt tham gia trong ngày, ngăn nhận thưởng lặp sau khi hoàn thành rồi tham gia lại; trạng thái `checked_in_today` nhất quán.
- Trạng thái sở hữu badge/theme đọc trên toàn bộ lịch sử của chính tài khoản, tách khỏi giới hạn 100 giao dịch hiển thị.
- Chat retry trả cùng phản hồi đã lưu; tiếp tục ghi phản hồi nếu lần trước thất bại, không thưởng nhiệm vụ lại và không tạo phản hồi trùng khi gửi đồng thời. Mã tin AI không thể bị dùng làm mã request của người dùng.
- Website giữ mã request khi gửi lại câu hỏi sau lỗi mạng và khóa chuyển cuộc trò chuyện trong khi gửi.
- Ba kiểm thử database cập nhật theo 19 collection nghiệp vụ cộng `auth_sessions`. Fixture không tạo giả consent HLV hoặc nhật ký admin; kiểm thử xác nhận các collection đó được giữ nguyên.
- `npm run web` tại root mở website Vite; `npm run web:mobile` mở Expo web; `npm run build:web` build website. README và hợp đồng API đã cập nhật.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Backend `npm run build` | 57 file JavaScript đạt kiểm tra cú pháp |
| Backend `npm test` | 91/91 đạt, không skip; gồm 4 regression mới |
| Database `npm test` | 40/40 đạt, không skip |
| Postman `npm run test:postman:review` | 121 request, 165/165 assertion đạt |
| `node backend/scripts/review-api-coverage.js` | Phủ 62/62 cặp method/path: 60 nghiệp vụ và 2 kiểm tra hệ thống |
| Root `npm run build:web` | Vite production build thành công |
| `git diff --check` | Đạt |
| Edge/Playwright, website qua Vite proxy và backend thật | Đăng nhập/đăng xuất 3 vai trò; 10 trang thành viên, 4 trang HLV, 5 trang admin; không lỗi runtime hoặc response API lỗi ngoài tình huống cố ý |
| Mất phản hồi chat sau khi server đã lưu | Gửi lại giữ cùng request, nhận cùng reply, không tin nhắn trùng |
| Dashboard tại 375, 768, 1440 px | Không tràn ngang; đã chụp ảnh, chưa có baseline để so sánh visual regression |

Postman trước khi sửa tái hiện 3 assertion lỗi; kiểm thử database trước khi sửa có 3 lỗi. Bốn regression bổ sung được chạy đỏ trước khi sửa logic rồi đạt sau sửa. Không đổi assertion Postman để chấp nhận hành vi lỗi.

Browser smoke chạy bằng Edge headless vì Chrome chưa có trên máy. Backend/database/Postman/browser đều dùng MongoDB replica set tạm; không dùng `.env`, không truy cập hoặc sửa Atlas. AI ngoài được tắt; coach theo quy tắc được kiểm tra. Log/ảnh của browser và Postman nằm trong `backend/postman/review/` được Git bỏ qua.

## Phạm vi còn lại

- Đây là gộp nhánh và sửa các lỗi đã tái hiện, chưa triển khai production hoặc nghiệm thu Atlas thật.
- App Expo trong `frontend/` vẫn là luồng local có sẵn của nhánh; việc tích hợp mobile vào backend chưa được thực hiện trong lần gộp này.
- Chat mới dùng UUID phản hồi xác định từ request mà không đổi schema. Lịch sử cũ vẫn đọc được; retry request tạo trước bản sửa có thể thêm một phản hồi vì phản hồi cũ chưa lưu liên kết request.
- Chưa có bộ lint/typecheck riêng trong package hiện tại; backend kiểm tra cú pháp, web dùng Vite build và browser smoke.
