// Nhãn cho admin_logs.action (services/admin.service.js, scripts/set-role.js).
const ACTIONS = {
  lock_account: 'Khóa tài khoản',
  unlock_account: 'Mở khóa tài khoản',
  set_role_user: 'Chuyển về thành viên',
  set_role_trainer: 'Cấp quyền huấn luyện viên',
  set_role_admin: 'Cấp quyền quản trị (script)',
  create_challenge: 'Tạo thử thách',
  update_challenge: 'Sửa thử thách',
  create_reward_item: 'Tạo vật phẩm',
  update_reward_item: 'Sửa vật phẩm',
};
export const actionLabel = (action) => ACTIONS[action] ?? action;
