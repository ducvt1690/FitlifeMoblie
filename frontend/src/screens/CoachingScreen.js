import React, { useState } from 'react';
import { Text } from 'react-native';
import { Page, Card, Action, Input } from '../components/ServerCards';
import { useRemote } from '../components/RemoteState';
import { getCoaching, acceptTrainer, leaveTrainer, finishAssignment } from '../utils/storage';
export default function CoachingScreen() {
  const state = useRemote(getCoaching),
    [code, setCode] = useState('');
  const act = action => state.run(async () => {
    await action();
    state.setData(await getCoaching());
  });
  return <Page title="Huấn luyện viên" subtitle="Nhập mã mời để đồng ý kết nối. HLV chỉ xem nhật ký khi có kết nối và bài đang giao." state={state}>
 <Card title="Kết nối"><Input label="Mã mời 8 ký tự" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={8} /><Action title="Chấp nhận mã mời" disabled={state.busy || code.trim().length !== 8} onPress={() => act(() => acceptTrainer(code))} /></Card>
 {state.data?.links.map(l => <Card key={l.link_id} title={l.trainer?.full_name || 'Huấn luyện viên'}><Action title="Ngắt kết nối" disabled={state.busy} onPress={() => act(() => leaveTrainer(l.link_id))} /></Card>)}
 {state.data?.assignments.length === 0 && <Text>Chưa có bài tập được giao.</Text>}
 {state.data?.assignments.map(a => <Card key={a.id} title={a.template?.title || 'Bài tập được giao'}><Text>{a.note} · {a.status}</Text>{a.status === 'assigned' && <><Action title="Hoàn thành bài giao" disabled={state.busy} onPress={() => act(() => finishAssignment(a.id, 'complete'))} /><Action title="Từ chối bài giao" disabled={state.busy} onPress={() => act(() => finishAssignment(a.id, 'decline'))} /></>}</Card>)}
 </Page>;
}
