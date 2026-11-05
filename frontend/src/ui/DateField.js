import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';
import { colors, radius, themed } from '../theme/tokens';

const pad = n => String(n).padStart(2, '0');
const dateKey = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const readable = value => value ? value.split('-').reverse().join('/') : '';
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Keep date-only values as strings: converting through UTC would shift the selected day.
export default function DateField({ label, value = '', onChange, placeholder = 'Chọn ngày', minDate, maxDate, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [years, setYears] = useState(false);
  const show = () => {
    const today = new Date();
    const initial = value || dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const clamped = minDate && initial < minDate ? minDate : maxDate && initial > maxDate ? maxDate : initial;
    const [year, month] = clamped.split('-').map(Number);
    setCursor({ year, month: month - 1 }); setYears(false); setOpen(true);
  };
  const move = amount => setCursor(c => { const d = new Date(c.year, c.month + amount, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  const first = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;
  const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i >= first && i < first + days ? i - first + 1 : null);
  const choose = next => { onChange(next); setOpen(false); };
  return <View>
    <Text variant="caption" tone="dim" style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Chọn ${label.toLowerCase()}`} accessibilityValue={{ text: readable(value) || placeholder }} disabled={disabled} onPress={show} style={[styles.field, disabled && { opacity: 0.5 }]}>
      <Text tone={value ? undefined : 'faint'} style={styles.flex}>{readable(value) || placeholder}</Text><Ionicons name="calendar-outline" size={21} color={colors.textDim} />
    </Pressable>
    {open && <Modal transparent visible animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}><Pressable accessibilityRole="button" accessibilityLabel="Đóng lịch" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={styles.calendar} accessibilityViewIsModal>
          <Text variant="heading">{label}</Text>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Tháng trước" onPress={() => move(-1)} style={styles.arrow}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Chọn năm" onPress={() => setYears(v => !v)} style={styles.month}><Text variant="heading">Tháng {cursor.month + 1}, {cursor.year}</Text><Ionicons name="chevron-down" size={16} color={colors.textDim} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Tháng sau" onPress={() => move(1)} style={styles.arrow}><Ionicons name="chevron-forward" size={24} color={colors.text} /></Pressable>
          </View>
          {years ? <ScrollView style={styles.yearList}><View style={styles.grid}>{Array.from({length: 121},(_,i)=>new Date().getFullYear()+10-i).map(year=><Pressable key={year} accessibilityRole="button" accessibilityLabel={`Năm ${year}`} onPress={()=>{setCursor(c=>({...c,year}));setYears(false);}} style={styles.year}><Text color={year===cursor.year?colors.accent:colors.text}>{year}</Text></Pressable>)}</View></ScrollView> : <>
            <View style={styles.grid}>{weekdays.map(day=><View key={day} style={styles.cell}><Text variant="caption" tone="dim">{day}</Text></View>)}</View>
            <View style={styles.grid}>{cells.map((day,i)=>{
              if(!day)return <View key={`empty-${i}`} style={styles.cell}/>;
              const key=dateKey(cursor.year,cursor.month,day), unavailable=!!((minDate&&key<minDate)||(maxDate&&key>maxDate));
              return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Ngày ${readable(key)}`} accessibilityState={{selected:value===key,disabled:unavailable}} disabled={unavailable} onPress={()=>choose(key)} style={[styles.cell, value===key&&styles.selected,unavailable&&{opacity:0.25}]}><Text color={value===key?colors.accentInk:colors.text}>{day}</Text></Pressable>;
            })}</View>
          </>}
          <View style={styles.actions}><Pressable accessibilityRole="button" onPress={()=>choose('')} style={styles.action}><Text tone="accent">Bỏ chọn ngày</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={styles.action}><Text>Đóng</Text></Pressable></View>
        </View>
      </View>
    </Modal>}
  </View>;
}
const styles=themed(()=>StyleSheet.create({
  flex:{flex:1},label:{marginBottom:6,marginLeft:4},field:{minHeight:54,paddingHorizontal:16,borderRadius:radius.sm,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.stroke,backgroundColor:colors.field,flexDirection:'row',alignItems:'center',gap:12},
  overlay:{flex:1,justifyContent:'center',alignItems:'center',padding:16,backgroundColor:'rgba(0,0,0,0.6)'},calendar:{width:'100%',maxWidth:380,padding:18,borderRadius:radius.lg,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.stroke},header:{flexDirection:'row',alignItems:'center',marginVertical:12},arrow:{width:44,height:44,alignItems:'center',justifyContent:'center'},month:{flex:1,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},grid:{flexDirection:'row',flexWrap:'wrap'},cell:{width:'14.285714%',minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:radius.sm},selected:{backgroundColor:colors.accent},actions:{flexDirection:'row',justifyContent:'space-between',marginTop:12},action:{minHeight:44,justifyContent:'center',paddingHorizontal:10},yearList:{maxHeight:300},year:{width:'33.333333%',minHeight:48,justifyContent:'center',alignItems:'center'},
}));
