import React from 'react';
import { Text } from 'react-native';
import { Page, Card, Action } from '../components/ServerCards';
import { useRemote } from '../components/RemoteState';
import { getChallenges, joinChallenge, checkinChallenge } from '../utils/storage';
export default function ChallengeScreen() {
  const state = useRemote(getChallenges);
  const act = c => state.run(async () => {
    await (c.joined ? checkinChallenge(c.challenge_id) : joinChallenge(c.challenge_id));
    state.setData(await getChallenges());
  });
  return <Page title="Thử thách" subtitle="Mỗi thử thách check-in tối đa một lần/ngày; đủ số ngày mới nhận thưởng." state={state}>
 {state.data?.length === 0 && <Text>Chưa có thử thách đang mở.</Text>}
 {state.data?.map(c => <Card key={c.challenge_id} title={c.title}><Text>{c.description}</Text><Text>{c.current_progress}/{c.target_days} ngày · thưởng {c.reward_coins} xu</Text><Text>Đã hoàn thành {c.completed_count} lượt</Text><Action disabled={state.busy || c.joined && c.checked_in_today} title={!c.joined ? 'Tham gia' : c.checked_in_today ? 'Đã check-in hôm nay' : 'Check-in hôm nay'} onPress={() => act(c)} /></Card>)}
 </Page>;
}
