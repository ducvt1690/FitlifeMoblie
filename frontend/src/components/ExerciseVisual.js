import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import SpriteAnimation from './SpriteAnimation';

export default function ExerciseVisual({
  gifUrl = null,
  animationType = 'squat',
  sprite = null,
  frameCount = 6,
  frameDurationMs = 200,
  isPlaying = true,
  size = 'large', // 'thumb' | 'small' | 'large'
  phase = 'work', // 'work' | 'rest'
  bodyPartLabel = '',
}) {
  const [loadingGif, setLoadingGif] = useState(true);

  if (size === 'thumb') {
    return (
      <View style={styles.thumbWrap}>
        {gifUrl ? (
          <Image
            source={{ uri: gifUrl }}
            style={styles.thumbGif}
            resizeMode="contain"
          />
        ) : (
          <SpriteAnimation
            sprite={sprite || animationType || 'squat'}
            frameCount={frameCount}
            frameDurationMs={frameDurationMs}
            size={74}
            playing={isPlaying}
          />
        )}
      </View>
    );
  }

  const isSmall = size === 'small';
  const boxSize = isSmall ? 135 : 210;

  return (
    <View style={[styles.cardContainer, isSmall ? styles.cardSmall : styles.cardLarge]}>
      {phase === 'rest' ? (
        <View style={styles.restWrap}>
          <View style={styles.restIconCircle}>
            <Ionicons name="leaf" size={38} color="#159C7A" />
          </View>
          <Text style={styles.restTitle}>ĐANG NGHỈ GIỮA HIỆP</Text>
          <Text style={styles.restSub}>Hít sâu bằng mũi 4s • Thở ra chậm bằng miệng 4s</Text>
        </View>
      ) : gifUrl ? (
        <View style={styles.stageCenter}>
          {loadingGif && (
            <ActivityIndicator
              size="small"
              color="#159C7A"
              style={styles.loaderOverlay}
            />
          )}
          <Image
            source={{ uri: gifUrl }}
            style={{ width: boxSize, height: boxSize }}
            resizeMode="contain"
            onLoadStart={() => setLoadingGif(true)}
            onLoadEnd={() => setLoadingGif(false)}
          />
        </View>
      ) : (
        <View style={styles.stageCenter}>
          <SpriteAnimation
            sprite={sprite || animationType || 'squat'}
            frameCount={frameCount}
            frameDurationMs={frameDurationMs}
            size={boxSize}
            playing={isPlaying}
          />
        </View>
      )}

      <View style={[styles.tempoPill, phase === 'rest' && styles.tempoPillRest]}>
        <View
          style={[
            styles.liveDot,
            { backgroundColor: phase === 'rest' ? '#159C7A' : '#16A34A' },
          ]}
        />
        <Text style={styles.tempoText} numberOfLines={1}>
          {phase === 'rest'
            ? 'Hồi phục nhịp tim • Thả lỏng cơ bắp'
            : bodyPartLabel
            ? `Động tác mẫu GIF • Nhóm cơ: ${bodyPartLabel}`
            : 'Làm theo động tác mẫu & giữ nhịp thở đều'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8EEE8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbGif: {
    width: 76,
    height: 76,
  },
  cardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D8EEE8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  cardSmall: {
    height: 165,
    paddingBottom: 24,
  },
  cardLarge: {
    height: 245,
    paddingBottom: 28,
  },
  stageCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderOverlay: {
    position: 'absolute',
    zIndex: 2,
  },
  restWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  restIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E5F4EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  restTitle: {
    color: '#116B58',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  restSub: {
    color: '#53746E',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  tempoPill: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3FBF9',
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
