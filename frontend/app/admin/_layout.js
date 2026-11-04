import GlassTabs from '../../src/ui/GlassTabs';

export default function AdminLayout() {
  return (
    <GlassTabs tabs={[
      { name: 'index', title: 'Tổng quan', icon: 'grid' },
      { name: 'users', title: 'Người dùng', icon: 'people' },
      { name: 'payments', title: 'Thanh toán', icon: 'card' },
      { name: 'system', title: 'Hệ thống', icon: 'settings' },
      { name: 'me', title: 'Tài khoản', icon: 'person' },
    ]} />
  );
}
