import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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
  // 'both' shows both ExerciseDB GIF + 2D Sprite Coach side by side; 'gif' or '2d' focuses on one
  const [viewMode, setViewMode] = useState('both');

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
  const singleBoxSize = isSmall ? 140 : 195;
  const dualBoxSize = isSmall ? 118 : 150;

  return (
    <View style={[styles.cardContainer, isSmall ? styles.cardSmall : styles.cardLarge]}>
      {/* Mode Switcher Bar (top-right) */}
      {phase !== 'rest' && (
        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[styles.modePill, viewMode === 'both' && styles.modePillActive]}
            onPress={() => setViewMode('both')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modePillText, viewMode === 'both' && styles.modePillTextActive]}>
              ⚡ GIF + 2D
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modePill, viewMode === 'gif' && styles.modePillActive]}
            onPress={() => setViewMode('gif')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modePillText, viewMode === 'gif' && styles.modePillTextActive]}>
              🎬 GIF Mẫu
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modePill, viewMode === '2d' && styles.modePillActive]}
            onPress={() => setViewMode('2d')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modePillText, viewMode === '2d' && styles.modePillTextActive]}>
              🏃 HLV 2D
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
      ) : viewMode === 'both' && gifUrl && !gifError ? (
        <View style={styles.dualStageRow}>
          {/* Left: ExerciseDB Animated GIF */}
          <View style={styles.dualPane}>
            {loadingGif && (
              <ActivityIndicator
                size="small"
                color="#159C7A"
                style={styles.loaderOverlay}
              />
            )}
            <ExpoImage
              source={{ uri: gifUrl }}
              style={{ width: dualBoxSize, height: dualBoxSize }}
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
            <Text style={styles.paneCaption}>Giải phẫu 3D (GIF)</Text>
          </View>

          <View style={styles.dualDivider} />

          {/* Right: 2D Sprite Sheet Animation (instant 0ms offline movement) */}
          <View style={styles.dualPane}>
            <SpriteAnimation
              sprite={resolvedSprite}
              frameCount={frameCount}
              frameDurationMs={frameDurationMs}
              size={dualBoxSize}
              playing={isPlaying}
            />
            <Text style={styles.paneCaption}>Nhịp độ HLV 2D</Text>
          </View>
        </View>
      ) : viewMode === 'gif' && gifUrl && !gifError ? (
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
            style={{ width: singleBoxSize, height: singleBoxSize }}
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
            size={singleBoxSize}
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
            ? `Động tác chuyển động trực tiếp • Nhóm cơ: ${bodyPartLabel}`
            : 'Làm theo động tác chuyển động & giữ nhịp thở đều'}
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
    height: 195,
    paddingTop: 22,
    paddingBottom: 26,
  },
  cardLarge: {
    height: 245,
    paddingTop: 24,
    paddingBottom: 28,
  },
  modeSwitchRow: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    backgroundColor: '#F1F8F6',
    borderRadius: 12,
    padding: 2,
    gap: 2,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#D8EEE8',
  },
  modePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
  },
  modePillActive: {
    backgroundColor: '#116B58',
  },
  modePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#53746E',
  },
  modePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dualStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 8,
  },
  dualPane: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dualDivider: {
    width: 1,
    height: '75%',
    backgroundColor: '#E4F2EE',
  },
  paneCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: '#53746E',
    marginTop: 2,
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
    bottom: 6,
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
