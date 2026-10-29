import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import SpriteAnimation from './SpriteAnimation';

export default function ExerciseVisual({
  gifUrl = null,
  animationType = 'squat',
  sprite = null,
  frameCount = 6,
  frameDurationMs = 170,
  isPlaying = true,
  size = 'large', // 'thumb' | 'small' | 'large'
  phase = 'work', // 'work' | 'rest'
  bodyPartLabel = '',
}) {
  const [loadingGif, setLoadingGif] = useState(Boolean(gifUrl));
  const [gifError, setGifError] = useState(false);

  const resolvedSprite = sprite || animationType || 'squat';

  useEffect(() => {
    setGifError(false);
    setLoadingGif(Boolean(gifUrl));
  }, [gifUrl]);

  if (size === 'thumb') {
    return (
      <View style={styles.thumbWrap}>
        {gifUrl && !gifError ? (
          <ExpoImage
            source={{ uri: gifUrl }}
            style={styles.thumbGif}
            contentFit="contain"
            autoplay={isPlaying}
            cachePolicy="memory-disk"
            onError={() => setGifError(true)}
          />
        ) : (
          <SpriteAnimation
            sprite={resolvedSprite}
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
  const boxSize = isSmall ? 145 : 205;

  return (
    <View style={[styles.cardContainer, isSmall ? styles.cardSmall : styles.cardLarge]}>
      {phase === 'rest' ? (
        <View style={styles.restWrap}>
          <SpriteAnimation
            sprite="breathe"
            frameCount={6}
            frameDurationMs={280}
            size={isSmall ? 110 : 140}
            playing={true}
          />
          <Text style={styles.restTitle}>ĐANG NGHỈ GIỮA HIỆP • HÍT THỞ SÂU</Text>
          <Text style={styles.restSub}>Hít sâu bằng mũi 4s • Thở ra chậm bằng miệng 4s</Text>
        </View>
      ) : gifUrl && !gifError ? (
        <View style={styles.stageCenter}>
          {loadingGif && (
            <ActivityIndicator
              size="small"
              color="#159C7A"
              style={styles.loaderOverlay}
            />
          )}
          <ExpoImage
            source={{ uri: gifUrl }}
            style={{ width: boxSize, height: boxSize }}
            contentFit="contain"
            autoplay={isPlaying}
            cachePolicy="memory-disk"
            onLoadStart={() => setLoadingGif(true)}
            onLoad={() => setLoadingGif(false)}
            onError={() => {
              setLoadingGif(false);
              setGifError(true);
            }}
          />
        </View>
      ) : (
        <View style={styles.stageCenter}>
          <SpriteAnimation
            sprite={resolvedSprite}
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
            ? `Nhóm cơ tác động: ${bodyPartLabel}`
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
    height: 175,
    paddingBottom: 24,
  },
  cardLarge: {
    height: 240,
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
  restTitle: {
    color: '#116B58',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  restSub: {
    color: '#53746E',
    fontSize: 11,
    marginTop: 2,
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
