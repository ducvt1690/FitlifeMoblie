import GlassTabs from '../../src/ui/GlassTabs';

export default function AdminLayout() {
  return (
    <GlassTabs tabs={[
      { name: 'index', title: 'Tổng quan', icon: 'grid' },
      { name: 'users', title: 'Người dùng', icon: 'people' },
      { name: 'operations', title: 'Nghiệp vụ', icon: 'construct' },
      { name: 'me', title: 'Tài khoản', icon: 'person' },
    ]} />
  );
}
