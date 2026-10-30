# FitLife — Công việc UI dành cho frontend

Cập nhật: **29/10/2026**. Tài liệu này giao việc hoàn thiện giao diện trong lúc backend tiếp tục viết API. Các nhận xét dựa trên mã nguồn frontend hiện tại, chưa phải kết quả kiểm tra hiển thị trên thiết bị thật.

## 1. Nên làm gì trước?

**Ưu tiên: luồng đăng ký và khai báo hồ sơ → Home → nhật ký sức khỏe → nhiệm vụ.** Frontend có thể dùng dữ liệu mẫu để hoàn thiện màn hình và thao tác ngay, sau đó nối API.

Giữ phong cách đang có: nền sáng, màu lime/pastel, thẻ bo góc và icon Ionicons. Tiếp tục hoàn thiện các màn hình sẵn có để giao diện thống nhất.

## 2. Giao diện hiện tại đã có gì?

- `App.js`: màn xác thực và bốn tab Home, Challenge, Quests, Menu. Công cụ con mở qua modal trong Menu.
- `AuthScreen`: đăng nhập, đăng ký tên/email/mật khẩu và chế độ khách. Chưa có luồng khai báo thể trạng khi đăng ký.
- `HomeScreen`: tổng quan sức khỏe, nước, bước chân, tâm trạng, nhiệm vụ và shortcut.
- `ProfileScreen`: sửa thông tin cơ thể, mục tiêu nước/calo và đăng xuất.
- `WaterTrackerScreen`: tổng nước, thêm nhanh/tùy chỉnh, lịch sử trong ngày và chỉnh mục tiêu.
- `CalorieScreen`: bốn bữa ăn, tổng calo/macro, chọn món mẫu hoặc tự nhập, xóa món.
- `WorkoutScreen`: danh sách bài tập theo nhóm và bộ đếm tập/nghỉ.
- `QuestScreen`: danh sách nhiệm vụ và modal nhập liệu cho từng loại.
- `BmiCalculatorScreen`: tính BMI/BMR/TDEE và lịch sử.
- `AnalyticsScreen`: biểu đồ nước, cân nặng, bước chân và ngủ trong bảy ngày.
- `ChallengeScreen`: danh sách, tạo thử thách và check-in bằng dữ liệu local.
- `ShopScreen`: danh mục vật phẩm, giá xu và trạng thái sở hữu local.
- `AiCoachScreen`: chat, câu hỏi nhanh và phần cấu hình AI.

Các màn hình trên chủ yếu dùng AsyncStorage và dữ liệu demo. `DashboardScreen.js` có trong thư mục nhưng không phải màn hình đang được `App.js` render.

## 3. Đợt 1 — Đăng nhập, đăng ký và khai báo hồ sơ

File chính: [AuthScreen.js](frontend/src/screens/AuthScreen.js), [ProfileScreen.js](frontend/src/screens/ProfileScreen.js), [App.js](frontend/App.js).

- [ ] Giữ form đăng nhập; thêm lỗi ngay dưới ô nhập thay vì chỉ hiện Alert.
- [ ] Nút gửi có trạng thái đang xử lý và khóa bấm lặp.
- [ ] Form đăng ký yêu cầu mật khẩu tối thiểu 8 ký tự; có hiện/ẩn mật khẩu và xác nhận mật khẩu.
- [ ] Bổ sung đăng ký nhiều bước: thông tin tài khoản → thể trạng → mục tiêu → xem lại và xác nhận.
- [ ] Thể trạng gồm giới tính, tuổi, chiều cao (cm), cân nặng (kg).
- [ ] Mục tiêu gồm mức vận động và giảm cân/giữ cân/tăng cân; nhãn dễ hiểu bằng tiếng Việt.
- [ ] Có nút Quay lại; giữ thông tin đã nhập khi chuyển bước. Không lưu mật khẩu vào dữ liệu mẫu lâu dài.
- [ ] Hiển thị đủ trạng thái: email trùng, mật khẩu sai, tài khoản khóa, mất mạng và phiên hết hạn.
- [ ] Chế độ khách được ghi rõ là trải nghiệm demo; không dùng tài khoản mẫu như tài khoản thật.

**Hoàn thành khi:** người kiểm tra đi từ đăng ký đến Home bằng mock data; thiếu trường nào được chỉ rõ tại trường đó; bàn phím không che nút xác nhận.

## 4. Đợt 2 — Home và điều hướng

File chính: [HomeScreen.js](frontend/src/screens/HomeScreen.js), [FloatingNavBar.js](frontend/src/components/FloatingNavBar.js), [MenuScreen.js](frontend/src/screens/MenuScreen.js).

- [ ] Việt hóa tên tab, tiêu đề và các nhãn còn tiếng Anh.
- [ ] Thống nhất thứ tự thông tin: lời chào → tiến độ hôm nay → nước/calo → nhiệm vụ → công cụ.
- [ ] Chạm thẻ nước/calo/tập luyện mở đúng chức năng; đóng modal quay lại nơi hợp lý.
- [ ] Home có trạng thái người mới chưa ghi dữ liệu, kèm nút bắt đầu ghi nhật ký.
- [ ] Thêm giao diện đang tải, tải lỗi + Thử lại và kéo xuống làm mới.
- [ ] Bỏ số mẫu gây hiểu nhầm: streak `5d`, bước chân 7.420 và nhịp tim giả; nếu giữ để demo phải ghi nhãn dữ liệu mẫu.
- [ ] Xu/streak trên mock Home, Quests và Profile dùng cùng một bộ dữ liệu.
- [ ] Thanh điều hướng không che nội dung cuối màn hình; xử lý safe area và nút Back trên Android.

**Hoàn thành khi:** đi qua bốn tab và các shortcut không bị mắc modal; có thể xem Home ở trạng thái có dữ liệu và chưa có dữ liệu.

## 5. Đợt 3 — Hoàn thiện UI nhật ký sức khỏe

### Nước uống

File: [WaterTrackerScreen.js](frontend/src/screens/WaterTrackerScreen.js).

- [ ] Hiển thị tổng đã uống/mục tiêu, tiến độ và lịch sử từng lần uống có giờ + ml.
- [ ] Form thêm nước có lựa chọn nhanh và nhập số; báo lỗi số không hợp lệ.
- [ ] Có trạng thái đang lưu, lưu thành công và chưa lưu được + Thử lại.
- [ ] Thông báo nhận thưởng khác với thông báo lưu nước: không hiện nhận 10 xu ở mọi lần thêm.
- [ ] Chuẩn bị chọn ngày để xem lịch sử và trạng thái ngày chưa có bản ghi.
- [ ] Với luồng nối API hiện có, mục tiêu là số backend tính; ẩn nút tự sửa mục tiêu và xóa hết nước cho đến khi có hợp đồng API tương ứng.

### Bữa ăn và calo

File: [CalorieScreen.js](frontend/src/screens/CalorieScreen.js).

- [ ] Hoàn thiện luồng chọn bữa → tìm món/chọn món → xem khẩu phần và dinh dưỡng → xác nhận thêm.
- [ ] Món mẫu cần có bước xem lại trước khi lưu, tránh chạm nhầm là lưu ngay.
- [ ] Form tự nhập có tên món, calo, protein, carbs, fat và đơn vị rõ ràng.
- [ ] Hiển thị bốn bữa, tổng calo/macro và danh sách món của từng bữa.
- [ ] Chuẩn bị UI xem chi tiết, chỉnh sửa và xác nhận xóa món bằng mock data.
- [ ] Có trạng thái tìm không thấy món, bữa trống và lưu lỗi.

### Tập luyện

File: [WorkoutScreen.js](frontend/src/screens/WorkoutScreen.js).

- [ ] Hoàn thiện thẻ bài tập, lọc nhóm, trang/modal chi tiết hướng dẫn và mức độ.
- [ ] Bộ đếm hiển thị rõ hiệp hiện tại, thời gian tập/nghỉ, bắt đầu/tạm dừng/đặt lại.
- [ ] Hỏi xác nhận khi thoát buổi đang tập.
- [ ] Có màn tổng kết buổi tập: tên bài, thời lượng, calo ước tính và nút Lưu buổi tập.
- [ ] Chuẩn bị form ghi buổi tập thủ công và danh sách lịch sử bằng mock data.

### Ngủ, tâm trạng và BMI

File: [QuestScreen.js](frontend/src/screens/QuestScreen.js), [BmiCalculatorScreen.js](frontend/src/screens/BmiCalculatorScreen.js).

- [ ] Giấc ngủ: form số giờ/chất lượng, xem lại và sửa bản ghi của ngày.
- [ ] Tâm trạng: chọn cảm xúc, ghi chú tùy chọn, xem lại/sửa.
- [ ] Hai form trên có thể mở từ Home/Menu, không chỉ từ Quests.
- [ ] BMI: form có đơn vị, kết quả dễ đọc và lịch sử cân nặng theo ngày.
- [ ] Tách thao tác xem kết quả BMI khỏi lưu hồ sơ; không để bấm tính tự thay mục tiêu calo mà người dùng không biết.

**Hoàn thành khi:** mọi loại nhật ký có luồng nhập → xem lại → lưu → xem danh sách, đủ trạng thái rỗng/đang tải/lỗi. Các tính năng chưa có API được demo bằng mock.

## 6. Đợt 4 — UI nhiệm vụ và thống kê

File: [QuestScreen.js](frontend/src/screens/QuestScreen.js), [AnalyticsScreen.js](frontend/src/screens/AnalyticsScreen.js).

- [ ] Đổi danh sách nhiệm vụ sang bộ chung: nước, tập luyện, bữa ăn, ngủ, tâm trạng, điểm danh và chat AI.
- [ ] Bỏ cân nặng/tiêu hóa khỏi bộ bảy nhiệm vụ; BMI vẫn là chức năng riêng.
- [ ] Mỗi nhiệm vụ có trạng thái chưa xong/đang xử lý/đã hoàn thành, phần thưởng và nút mở đúng form.
- [ ] Thống nhất nhãn: tối đa 70 xu từ bảy nhiệm vụ, không mô tả có thêm thưởng 70 xu riêng.
- [ ] Có UI điểm danh và lịch sử ngày; phần xử lý dùng mock trong lúc chờ backend.
- [ ] Thống kê có trạng thái không có dữ liệu, không gọi số thiếu là số đo bằng 0.
- [ ] Nếu thêm nút 7 ngày/30 ngày thì dữ liệu mẫu phải thực sự đổi theo khoảng chọn.

**Hoàn thành khi:** chọn nhiệm vụ mở đúng màn hình; dữ liệu mock đủ để xem tiến độ 0/7, 5/7 và 7/7; biểu đồ và ngày đang chọn khớp nhau.

## 7. Đợt sau — Shop, Challenge và AI

Chỉ ưu tiên sau các màn hình sức khỏe ở trên.

- [ ] Shop: xem chi tiết → xác nhận đổi → thành công/thiếu xu/đã sở hữu; danh sách vật phẩm đã nhận.
- [ ] Phân biệt đã mua với đã trang bị/đã sử dụng; không báo đã áp dụng khi chỉ lưu ID vật phẩm.
- [ ] Challenge: danh sách → chi tiết → tham gia → tiến độ ngày → check-in → kết quả.
- [ ] Mock check-in theo số ngày, có trạng thái đã check-in hôm nay; không tăng 10% vô hạn mỗi lần bấm.
- [ ] Các người tham gia mẫu phải có nhãn demo, không trình bày như có kết nối bạn bè thật.
- [ ] AI: danh sách cuộc trò chuyện, tin đang gửi, gửi thất bại/thử lại, chờ phản hồi và xóa hội thoại có xác nhận.
- [ ] Phản hồi mẫu/local phải nhận biết được; không cần frontend tự điền API key để nghiệm thu UI.

Website trainer/admin chưa có trong frontend hiện tại. Nếu nhóm đưa website ba vai trò vào phạm vi, cần giao một đợt riêng sau khi chốt với backend; không coi `npm run web` là đã có khu trainer/admin.

## 8. Cách làm UI trong lúc chờ API

- Tạo một bộ dữ liệu mẫu dùng chung cho từng chức năng; tránh mỗi màn hình tự gán số khác nhau.
- Tách phần lấy/lưu dữ liệu khỏi JSX để sau này thay mock bằng API mà không phải viết lại giao diện.
- Chuẩn bị các trạng thái có thể bật thử: đang tải, rỗng, có dữ liệu, dữ liệu sai, lưu lỗi và thành công.
- Dữ liệu demo giữ riêng với tài khoản thật; không tự nhập dữ liệu local cũ vào MongoDB khi nối API.
- Danh sách dài phải cuộn được; form hiển thị tốt khi bật bàn phím và khi tên/nội dung dài.
- Kiểm tra màn điện thoại nhỏ và Expo Web; nút đóng, quay lại, xác nhận đều thao tác được.

Backend đã có mã nguồn API auth, profile, nước và đọc quest; API các nghiệp vụ còn lại đang được hoàn thiện. Frontend có thể bàn giao UI bằng mock trước, rồi tích hợp lần lượt khi nhận hợp đồng API. Chi tiết kết nối để sau ở [hướng dẫn BE cho FE](backend/README.FE.md).

## 9. Giao việc ngay cho frontend

**Đợt đầu nên nhận ba việc:**

1. Hoàn thiện đăng ký nhiều bước và form thể trạng/mục tiêu.
2. Chuẩn hóa Home, điều hướng và UI hồ sơ/nước với trạng thái rỗng/loading/lỗi.
3. Hoàn thiện luồng bữa ăn và tập luyện bằng mock data để backend có thể nối ngay ở đợt kế tiếp.

**Bàn giao cần có:** code UI, cách mở các màn hình/trạng thái mock, ảnh chụp màn hình và danh sách chức năng còn chờ backend. Không cần chờ toàn bộ API xong mới làm các việc này.
