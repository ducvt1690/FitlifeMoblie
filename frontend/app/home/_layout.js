import GlassTabs from '../../src/ui/GlassTabs';

export default function HomeLayout() {
  return (
    <GlassTabs tabs={[
      { name: 'index', title: 'Hôm nay', icon: 'today' },
      { name: 'workout', title: 'Tập luyện', icon: 'barbell' },
      { name: 'coach', title: 'AI Coach', icon: 'sparkles' },
      { name: 'quests', title: 'Nhiệm vụ', icon: 'trophy' },
      { name: 'me', title: 'Hồ sơ', icon: 'person' },
    ]} />
  );
}
