import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Text from '../../ui/Text';
import { colors, radius, themed } from '../../theme/tokens';
import { useLayout } from '../../theme/useLayout';
import { useAuth } from '../../context/AuthContext';

// Full detail for one exercise of the plan: the GIF, what it trains, how to do it and how to feel the muscle.
export default function ExerciseSheet({ exerciseId, onClose }) {
  const { api } = useAuth();
  const { insets, gutter, contentWidth } = useLayout();
  const [ex, setEx] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!exerciseId) return undefined;
    let live = true;
    setEx(null); setError('');
    api.exercises.get(exerciseId).then(r => live && setEx(r.exercise)).catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [api, exerciseId]);

  const muscles = [...(ex?.display_target_muscles ?? []), ...(ex?.display_secondary_muscles ?? [])];
  return (
    <Modal visible={!!exerciseId} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.sheet, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <Text variant="heading" numberOfLines={2} style={styles.flex}>{ex?.display_name ?? 'Bài tập'}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Đóng" style={styles.close}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: insets.bottom + 24 }}>
          <View style={{ width: '100%', maxWidth: contentWidth, alignSelf: 'center', gap: 16 }}>
            {error ? <Text tone="danger">{error}</Text> : null}
            {!ex && !error ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} /> : null}
            {ex ? (
              <>
                <View style={styles.media}>
                  {ex.gif_url ? <Image source={{ uri: ex.gif_url }} style={styles.gif} contentFit="contain" transition={200} accessibilityLabel={`Minh họa ${ex.display_name}`} />
                    : <Ionicons name="barbell" size={48} color={colors.textFaint} />}
                </View>
                <View style={styles.chips}>
                  {muscles.map((m, i) => (
                    <View key={`${m}-${i}`} style={[styles.chip, i < (ex.display_target_muscles?.length ?? 0) && styles.chipMain]}>
                      <Text variant="caption" color={i < (ex.display_target_muscles?.length ?? 0) ? colors.ink : colors.textDim}>{m}</Text>
                    </View>
                  ))}
                  {(ex.display_equipments ?? []).map(e => (
                    <View key={`eq-${e}`} style={styles.chip}><Text variant="caption" tone="dim">{e}</Text></View>
                  ))}
                </View>
                {ex.description_vi ? <Text tone="dim">{ex.description_vi}</Text> : null}
                {ex.display_instructions?.length ? (
                  <View style={styles.block}>
                    <Text variant="label" tone="accent">Cách tập</Text>
                    {ex.display_instructions.map((s, i) => (
                      <View key={i} style={styles.row}>
                        <View style={styles.num}><Text variant="caption" color={colors.ink}>{i + 1}</Text></View>
                        <Text style={styles.flex}>{s.replace(/^Step:?\s*\d+\s*/i, '')}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {ex.tips_vi?.length ? (
                  <View style={styles.block}>
                    <Text variant="label" tone="accent">Mẹo cảm nhận cơ</Text>
                    {ex.tips_vi.map((t, i) => (
                      <View key={i} style={styles.row}>
                        <Ionicons name="flash" size={16} color={colors.accent} style={{ marginTop: 3 }} />
                        <Text style={styles.flex}>{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  media: { aspectRatio: 1, maxHeight: 360, borderRadius: radius.lg, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gif: { width: '100%', height: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.surface },
  chipMain: { backgroundColor: colors.accent },
  block: { gap: 10, padding: 16, borderRadius: radius.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', gap: 10 },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
}));
