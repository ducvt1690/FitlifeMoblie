# FitLife — kiểm toán và tích hợp (05/11/2026)

## Phạm vi và hiện trạng ban đầu

Repository hiện có Express 4, MongoDB driver, MongoDB validators/indexes, opaque bearer session lưu hash ở `auth_sessions`, React Native 0.88 + Expo 58 + Expo Router. Không tạo backend thứ hai. `web/` ban đầu chỉ có output/dependencies, không có source/package.json. Có nhiều thay đổi staged/unstaged sẵn trước tác vụ; giữ nguyên, bổ sung trực tiếp theo yêu cầu.

Backend chia routes → services → MongoDB, dùng transaction với replica set; không dùng ORM. Validator strict `additionalProperties:false`. Migration phải kiểm tra dữ liệu hiện có trước khi cập nhật validator. Auth kiểm tra session hết hạn và trạng thái account ở server; đây không phải JWT, không có refresh-token flow để tự ý thêm.

## Lỗ hổng chức năng tìm thấy

| Phần | Bằng chứng ban đầu | Tác động |
|---|---|---|
| Template | `updateTemplate` chỉ nhận `is_active` | Không sửa được nội dung; assignment tham chiếu mẫu sống nên có nguy cơ đổi lịch sử |
| Assignment | `assign` sinh UUID server mỗi lần, không có cancel riêng | Retry tạo trùng; chưa lưu lý do/hành trình trạng thái |
| Consent | Có `end` transaction; student list không có link_id | API disconnect tồn tại nhưng giao diện Trainer khó gọi đúng |
| Invitation | POST tạo mã, tuổi mã 24 giờ; chưa có GET/revoke | Không quản lý được mã |
| Trainer lists | `.limit(100)` và không trả tổng | Không có pagination/search thực tế |
| Progress/feedback | Chỉ `done` assignment | Thiếu endpoint tiến độ/phản hồi |
| Admin | CRUD catalog có sẵn; chưa đủ list/detail/filter | UI Expo mới chủ yếu accounts/overview |
| Revenue | Cần phân biệt product trong payment_orders | Không được gắn tổng tiền Coin vào doanh thu Premium |
| Web | Chưa có source riêng | Cần frontend độc lập dùng chung API |

## Kiểm soát đã có để kế thừa

Validation body theo allowlist; owner scope trong services; member/admin/trainer middleware; transaction quest/reward/payment; signed VNPay callback và chống credit lặp; session hash/TTL; CORS allowlist; request JSON limit và log lỗi không in credentials. Catalog tiền/thưởng nằm backend. Không triển khai upload/avatar storage mới trong tác vụ này; cần kiểm chứng phạm vi upload riêng nếu sản phẩm yêu cầu.

## Cách xác minh

Chạy toàn bộ `npm --prefix backend test`, database tests, Postman hiện có, test HTTP bổ sung trên MongoDB replica set dùng riêng. Web build + Playwright thực tế. Expo doctor/dependency check/bundle export. Không ghi fixture lên Atlas. API port 5000 đã có tiến trình chạy trước tác vụ; harness tích hợp dùng cổng 5500 tường minh để không ngắt dịch vụ đó. Kết quả cuối cùng và giới hạn thiết bị được ghi trong FINAL_IMPLEMENTATION_REPORT.md; không dùng trạng thái DONE cho nội dung chỉ đọc source.
