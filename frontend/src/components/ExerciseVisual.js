import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import SpriteAnimation from './SpriteAnimation';

const SPRITE_CONFIG = {
  walk: { sprite: 'walk', frameDurationMs: 140, label: 'Bước đều • Đánh tay tự nhiên' },
  drink: { sprite: 'drink', frameDurationMs: 220, label: 'Uống từng ngụm • 250ml nước' },
  eyes: { sprite: 'eyes', frameDurationMs: 220, label: 'Nhìn xa 6m • Chớp mắt thư giãn' },
  breathe: { sprite: 'breathe', frameDurationMs: 350, label: 'Hít sâu 4s • Thở chậm 4s' },
  squat: { sprite: 'squat', frameDurationMs: 240, label: 'Xuống hít sâu • Đứng lên thở ra' },
  squats: { sprite: 'squat', frameDurationMs: 240, label: 'Xuống hít sâu • Đứng lên thở ra' },
  stretch: { sprite: 'stretch', frameDurationMs: 280, label: 'Thả lỏng vai • Kéo giãn nhẹ nhàng' },
  plank: { sprite: 'plank', frameDurationMs: 280, label: 'Siết chặt cơ bụng • Lưng thẳng hàng' },
  run: { sprite: 'run', frameDurationMs: 120, label: 'Chạy tại chỗ • Tiếp đất êm bằng mũi chân' },
  shadow_boxing: { sprite: 'boxing', frameDurationMs: 150, label: 'Tổ hợp đòn: Jab - Cross - Hook' },
  boxing: { sprite: 'boxing', frameDurationMs: 150, label: 'Tổ hợp đòn: Jab - Cross - Hook' },
  mma_sprawl: { sprite: 'sprawl', frameDurationMs: 200, label: 'Phòng thủ • Dằn hông xuống sàn' },
  sprawl: { sprite: 'sprawl', frameDurationMs: 200, label: 'Phòng thủ • Dằn hông xuống sàn' },
  muay_thai_knees: { sprite: 'knee', frameDurationMs: 170, label: 'Khóa gáy • Phóng gối uy lực' },
  knee: { sprite: 'knee', frameDurationMs: 170, label: 'Khóa gáy • Phóng gối uy lực' },
  pushups: { sprite: 'pushup', frameDurationMs: 220, label: 'Gồng ngực • Hạ sâu đẩy dứt khoát' },
  pushup: { sprite: 'pushup', frameDurationMs: 220, label: 'Gồng ngực • Hạ sâu đẩy dứt khoát' },
  jumping_jacks: { sprite: 'jumping_jacks', frameDurationMs: 160, label: 'Bật nhảy mở tay chân nhịp 1-2' },
  crunches: { sprite: 'crunch', frameDurationMs: 220, label: 'Cuộn cơ bụng • Không kéo gập cổ' },
  crunch: { sprite: 'crunch', frameDurationMs: 220, label: 'Cuộn cơ bụng • Không kéo gập cổ' },
  mountain_climbers: { sprite: 'climber', frameDurationMs: 130, label: 'Co gối luân phiên tốc độ cao' },
  climber: { sprite: 'climber', frameDurationMs: 130, label: 'Co gối luân phiên tốc độ cao' },
  burpees: { sprite: 'burpee', frameDurationMs: 220, label: 'Ngồi xổm • Chống đẩy • Bật nhảy cao' },
  burpee: { sprite: 'burpee', frameDurationMs: 220, label: 'Ngồi xổm • Chống đẩy • Bật nhảy cao' },
  cobra_stretch: { sprite: 'cobra', frameDurationMs: 280, label: 'Mở ngực • Kéo giãn cơ bụng & lưng' },
  cobra: { sprite: 'cobra', frameDurationMs: 280, label: 'Mở ngực • Kéo giãn cơ bụng & lưng' },
};

export default function ExerciseVisual({
  animationType = 'squat',
  sprite: spriteProp,
  frameCount = 6,
  frameDurationMs: durationProp,
  isPlaying = true,
  size = 'large', // 'thumb' | 'small' | 'large'
  phase = 'work', // 'work' | 'rest'
}) {
  const key = spriteProp || animationType || 'squat';
  const cfg = SPRITE_CONFIG[key] || SPRITE_CONFIG.squat;

  const activeSprite = phase === 'rest' ? 'breathe' : cfg.sprite;
  const activeDuration =
    phase === 'rest' ? 320 : durationProp || cfg.frameDurationMs || 200;

  if (size === 'thumb') {
    return (
      <View style={styles.thumbWrap}>
        <SpriteAnimation
          sprite={activeSprite}
          frameCount={frameCount}
          frameDurationMs={activeDuration}
          size={76}
          playing={isPlaying}
        />
      </View>
    );
  }

  const isSmall = size === 'small';
  const spriteSize = isSmall ? 120 : 190;

  return (
    <View style={[styles.cardContainer, isSmall ? styles.cardSmall : styles.cardLarge]}>
      <View style={styles.stageCenter}>
        <SpriteAnimation
          sprite={activeSprite}
          frameCount={frameCount}
          frameDurationMs={activeDuration}
          size={spriteSize}
          playing={isPlaying}
        />
      </View>

      <View style={[styles.tempoPill, phase === 'rest' && styles.tempoPillRest]}>
        <View
          style={[
            styles.liveDot,
            { backgroundColor: phase === 'rest' ? '#159C7A' : '#16A34A' },
          ]}
        />
        <Text style={styles.tempoText} numberOfLines={1}>
          {phase === 'rest'
            ? 'Nghỉ ngơi: Hít vào 4 giây • Thở ra chậm 4 giây'
            : cfg.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: {
    width: 78,
    height: 78,
    borderRadius: 14,
    backgroundColor: '#F3FBF9',
    borderWidth: 1,
    borderColor: '#D8EEE8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#F3FBF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8EEE8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  cardSmall: {
    height: 150,
    paddingBottom: 24,
  },
  cardLarge: {
    height: 230,
    paddingBottom: 28,
  },
  stageCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempoPill: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBE7E0',
  },
  tempoPillRest: {
    backgroundColor: '#E5F4EF',
    borderColor: '#159C7A',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  tempoText: {
    color: '#173B36',
    fontSize: 11,
    fontWeight: '700',
  },
});
