import GlassTabs from '../../src/ui/GlassTabs';

export default function HomeLayout() {
  return (
    <GlassTabs tabs={[
      { name: 'index', title: 'Hôm nay', icon: 'today' },
      { name: 'nutrition', title: 'Ăn uống', icon: 'restaurant' },
      { name: 'workout', title: 'Tập luyện', icon: 'barbell' },
      { name: 'coach', title: 'AI Coach', icon: 'chatbubble-ellipses' },
      { name: 'me', title: 'Hồ sơ', icon: 'person' },
    ]} />
  );
}
