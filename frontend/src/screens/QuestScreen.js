import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Page, Card, Action, Input } from '../components/ServerCards';
import { useRemote } from '../components/RemoteState';
import { getDailyQuests, getCoins, getStreak, checkin, addWaterLog, addMealLog, saveSleepToday, saveMoodToday, addWorkoutLog } from '../utils/storage';
const load = async () => {
  const [quests, coins, streak] = await Promise.all([getDailyQuests(), getCoins(), getStreak()]);
  return {
    quests,
    coins,
    streak
  };
};
export default function QuestScreen({
  onNavigate
}) {
  const state = useRemote(load),
    [active, setActive] = useState(null),
    [value, setValue] = useState(''),
    [name, setName] = useState('');
  const finish = () => state.run(async () => {
    if (active === 'q_water') await addWaterLog(Number(value));else if (active === 'q_meal') await addMealLog({
      name,
      calories: Number(value)
    });else if (active === 'q_sleep') await saveSleepToday(value, 'Sâu');else if (active === 'q_mood') await saveMoodToday(value, name);else if (active === 'q_workout') await addWorkoutLog({
      title: name,
      durationSec: Number(value) * 60,
      calories: 0
    });
    setActive(null);
    state.setData(await load());
  });
  const select = q => {
    if (q.completed) return;
    if (q.id === 'q_chat') {
      onNavigate?.('aicoach');
      return;
    }
    if (q.id === 'q_checkin') {
      state.run(async () => {
        await checkin();
        state.setData(await load());
      });
      return;
    }
    setActive(q.id);
    setName('');
    setValue('');
  };
  return <Page title="Nhiệm vụ hôm nay" subtitle={state.data ? state.data.coins + ' xu · Chuỗi ' + state.data.streak + ' ngày · Đủ 5/7 nhiệm vụ để giữ chuỗi' : 'Mỗi nhiệm vụ thưởng 10 xu một lần/ngày'} state={state}>
 {active && <Card title="Ghi nhận hoạt động">
 {['q_meal', 'q_workout'].includes(active) && <Input label={active === 'q_meal' ? 'Tên món' : 'Tên bài tập'} value={name} onChangeText={setName} />}
 <Input label={{
        q_water: 'Lượng nước (ml)',
        q_meal: 'Năng lượng (kcal)',
        q_sleep: 'Số giờ ngủ',
        q_mood: 'Tâm trạng',
        q_workout: 'Thời gian (phút)'
      }[active]} keyboardType={active === 'q_mood' ? 'default' : 'numeric'} value={value} onChangeText={setValue} />
 <Action title="Lưu hoạt động" disabled={state.busy || !value.trim()} onPress={finish} /><Action title="Hủy" disabled={state.busy} onPress={() => setActive(null)} /></Card>}
 {state.data?.quests.map(q => <Card key={q.id} title={q.title}><Text>{q.completed ? 'Đã hoàn thành' : 'Thưởng ' + q.reward + ' xu'}</Text><Action title={q.completed ? 'Đã ghi nhận' : q.id === 'q_chat' ? 'Mở AI Coach' : 'Thực hiện'} disabled={q.completed || state.busy} onPress={() => select(q)} /></Card>)}
 </Page>;
}
