# API thông tin cá nhân

API hồ sơ cho phép người dùng xem và cập nhật thông tin của chính mình, gồm email và ngày sinh. Base URL mặc định là `http://localhost:5000`; chạy BE từ thư mục `backend` bằng `npm run dev`.

## Xác thực

Hai endpoint yêu cầu tài khoản đang hoạt động có role `user` và header:

```http
Authorization: Bearer <token>
```

Token nhận từ đăng ký hoặc đăng nhập là token phiên dạng chuỗi ngẫu nhiên, không phải JWT. Backend xác định tài khoản qua token; FE không gửi `user_id` để chọn người cần sửa.

## Xem hồ sơ — `GET /api/profile`

HTTP `200` trả `{ "success": true, "profile": ... }`. Hồ sơ gồm `user_id`, `email`, `role`, `full_name`, `gender`, `date_of_birth`, `age`, `height`, `weight`, `activity_level`, `goal`, `timezone`, `target_water`, `target_calories`, `fit_coins` và `streak_days`.

- `date_of_birth` là ngày dạng `YYYY-MM-DD`, ví dụ `2003-05-15`.
- Tài khoản cũ chưa khai báo ngày sinh nhận `date_of_birth: null`. Backend giữ tuổi đã khai báo, không tự suy đoán ngày sinh từ tuổi.
- Khi có ngày sinh, tuổi được tính theo ngày hiện tại trong timezone của tài khoản. Mục tiêu calo dùng tuổi này, kể cả khi đã qua sinh nhật từ lần cập nhật hồ sơ trước.
- Mục tiêu nước phản ánh ngày hiện tại: cộng thêm `350` ml nếu hôm nay có nhật ký tập luyện, tối đa `4350` ml.
- Response không chứa password hash hoặc `_id` của MongoDB.

## Cập nhật hồ sơ — `PATCH /api/profile`

Body JSON phải là object có ít nhất một trường trong danh sách sau:

- `email`
- `date_of_birth`
- `full_name`
- `gender`
- `age`
- `height`
- `weight`
- `activity_level`
- `goal`

Chỉ gửi trường cần thay đổi. Không gửi `role`, `user_id`, `is_active`, `timezone`, xu, streak, password hash, mục tiêu nước/calo hoặc trường khác; backend trả `400` cho trường ngoài hợp đồng.

Ví dụ thay email và bổ sung ngày sinh:

```http
PATCH /api/profile
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "email": "an.nguyen@example.com",
  "date_of_birth": "2003-05-15"
}
```

Thành công trả HTTP `200` với cùng cấu trúc `{ "success": true, "profile": ... }` như GET và thông tin sau cập nhật.

### Email

- Phải là chuỗi email hợp lệ; backend bỏ khoảng trắng đầu/cuối và chuyển chữ thường trước khi kiểm tra/lưu.
- Email sau chuẩn hóa tối đa `100` ký tự và phải duy nhất trong collection `users`.
- Gửi lại email hiện tại của chính tài khoản, kể cả khác chữ hoa/thường, vẫn được chấp nhận.
- Email đã thuộc tài khoản khác trả `409`, kể cả hai yêu cầu đồng thời cùng chọn một email mới.
- Khi đổi email thành công, dùng email mới cho lần đăng nhập tiếp theo; email cũ không còn đăng nhập vào tài khoản đó. Password, `user_id` và các phiên đăng nhập hiện có được giữ nguyên. `/api/auth/me` phản ánh email mới.
- Thao tác này cập nhật email trực tiếp; chưa có luồng gửi mã hoặc liên kết xác minh email.

### Ngày sinh và tuổi

- `date_of_birth` phải là chuỗi ngày có thật theo định dạng `YYYY-MM-DD`; không gửi timestamp hoặc `DD/MM/YYYY`.
- Không nhận `null`, chuỗi rỗng, số, ngày không tồn tại như `2003-02-29`, hoặc ngày trong tương lai.
- Tuổi tính từ ngày sinh tại ngày hiện tại theo timezone của tài khoản phải từ `5` đến `100`, bao gồm hai mốc này.
- Backend đọc đồng hồ server mỗi yêu cầu, không dùng năm cố định hoặc thời gian client gửi lên. Đúng 00:00 tại timezone tài khoản trong ngày sinh nhật, tuổi mới được áp dụng khi gọi API tiếp theo. Ngày sinh 29/02 tăng tuổi vào 01/03 trong năm không nhuận.
- Khi gửi ngày sinh, có thể bỏ `age` để backend tự tính. Nếu cùng gửi `age`, giá trị phải đúng tuổi tính được, nếu không trả `400`.
- Khi hồ sơ đã có ngày sinh, gửi riêng `age` cũng phải khớp tuổi hiện tại từ ngày sinh. Muốn sửa tuổi do khai báo sai ngày sinh thì cập nhật `date_of_birth`.
- Hồ sơ cũ chưa có ngày sinh vẫn cập nhật được `age` như trước, dưới dạng số nguyên từ `5` đến `100`.

FE có thể hiển thị ngày sinh dưới dạng `DD/MM/YYYY`, nhưng cần đổi sang chuỗi `YYYY-MM-DD` khi gọi API. Đây là một ngày trên lịch, không phải một thời điểm UTC; tránh chuyển qua timestamp khiến lệch ngày theo múi giờ.

### Các trường còn lại

- `full_name`: chuỗi sau trim dài `1–100` ký tự.
- `gender`: `male` hoặc `female`.
- `height`: số từ `80` đến `250`, đơn vị cm.
- `weight`: số từ `25` đến `300`, đơn vị kg.
- `activity_level`: `sedentary`, `light`, `moderate` hoặc `active`.
- `goal`: `lose`, `maintain` hoặc `gain`.

Tuổi, chiều cao và cân nặng phải gửi dưới dạng JSON number, không phải chuỗi. Backend tính lại mục tiêu calo/nước sau cập nhật; phần cộng nước của ngày có tập vẫn được giữ.

## Tính toàn vẹn và lỗi

Cập nhật hồ sơ thực hiện trong transaction. Nếu email trùng hoặc dữ liệu không hợp lệ, không cập nhật dở dang tên, ngày sinh, tuổi hoặc mục tiêu sức khỏe trong cùng yêu cầu.

Lỗi có dạng:

```json
{
  "success": false,
  "message": "Thông báo lỗi"
}
```

- `400`: body rỗng/sai kiểu, trường ngoài hợp đồng, email/ngày sinh không hợp lệ hoặc tuổi không khớp.
- `401`: thiếu token, token không hợp lệ, hết hạn hoặc đã đăng xuất.
- `403`: tài khoản bị khóa hoặc role không phải `user`.
- `409`: email đã được sử dụng.
- `500`/`503`: lỗi xử lý hoặc kết nối database.

## Đăng ký có ngày sinh

`POST /api/auth/register` nhận thêm `date_of_birth` tùy chọn với cùng quy tắc ngày sinh. Khi có ngày sinh hợp lệ, có thể bỏ `age`; nếu gửi cả hai thì tuổi phải khớp. Payload đăng ký cũ chỉ có `age` vẫn được hỗ trợ.

Các trường đăng ký khác giữ nguyên: `email`, `password`, `full_name`, `gender`, `height`, `weight`, `activity_level`, `goal`; `timezone` tùy chọn. Việc không nhập ngày sinh không làm backend tự tạo một ngày sinh giả.

## Cập nhật schema MongoDB hiện có

Ngày sinh được lưu dưới dạng trường chuỗi tùy chọn `users.date_of_birth`. Email tiếp tục dùng trường và unique index hiện có. Không tạo database hoặc collection mới.

Với database đã khởi tạo, chạy tại `backend/database/mongodb`:

```powershell
npm run db:profile:plan
npm run db:profile:apply
```

Script kiểm tra schema hiện tại trước khi mở rộng validator của `users` để nhận ngày sinh. Migration giữ nguyên tài khoản, dữ liệu và index; không bổ sung ngày sinh giả cho người dùng cũ. Chạy lại khi schema đã cập nhật không thay đổi dữ liệu. Nếu phát hiện schema khác ngoài thay đổi này, script dừng để kiểm tra thay vì ghi đè validator.

Tài liệu này mô tả hợp đồng backend; màn hình frontend cần nối các trường và endpoint tương ứng.
