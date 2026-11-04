import GlassTabs from '../../src/ui/GlassTabs';

export default function TrainerLayout() {
  return (
    <GlassTabs tabs={[
      { name: 'index', title: 'Học viên', icon: 'people' },
      { name: 'me', title: 'Tài khoản', icon: 'person' },
    ]} />
  );
}
