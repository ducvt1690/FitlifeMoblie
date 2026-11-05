import GlassTabs from '../../src/ui/GlassTabs';
export default function TrainerLayout() {
  return (
    <GlassTabs
      tabs={[
        { name: 'index', title: 'Huấn luyện', icon: 'barbell' },
        { name: 'me', title: 'Hồ sơ', icon: 'person' },
      ]}
    />
  );
}
