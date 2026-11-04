import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const FALLBACK_API_GIF = 'https://static.exercisedb.dev/media/0JtKWum.gif';

export default function ExerciseVisual({
  gifUrl = null,
  isPlaying = true,
  size = 'large', // 'thumb' | 'small' | 'large'
  phase = 'work', // 'work' | 'rest'
  bodyPartLabel = '',
}) {
  const [loadingGif, setLoadingGif] = useState(Boolean(gifUrl));
  const [currentUri, setCurrentUri] = useState(gifUrl || FALLBACK_API_GIF);

  useEffect(() => {
    setCurrentUri(gifUrl || FALLBACK_API_GIF);
    setLoadingGif(Boolean(gifUrl));
  }, [gifUrl]);

  if (size === 'thumb') {
    return (
      <View style={styles.thumbWrap}>
        <ExpoImage
          source={{ uri: currentUri }}
          style={styles.thumbGif}
          contentFit="contain"
          autoplay={isPlaying}
          cachePolicy="memory-disk"
          onError={() => {
            if (currentUri !== FALLBACK_API_GIF) {
              setCurrentUri(FALLBACK_API_GIF);
            }
          }}
        />
      </View>
    );
  }

  const isSmall = size === 'small';
  const boxSize = isSmall ? 145 : 205;

  return (
    <View style={[styles.cardContainer, isSmall ? styles.cardSmall : styles.cardLarge]}>
      {phase === 'rest' ? (
        <View style={styles.restWrap}>
          <View style={styles.restIconCircle}>
            <Ionicons name="leaf" size={36} color="#059669" />
          </View>
          <Text style={styles.restTitle}>ĐANG NGHỈ GIỮA HIỆP • HÍT THỞ SÂU</Text>
          <Text style={styles.restSub}>Hít sâu bằng mũi 4s • Thở ra chậm bằng miệng 4s</Text>
        </View>
      ) : (
        <View style={styles.stageCenter}>
          {loadingGif && (
            <ActivityIndicator
              size="small"
              color="#059669"
              style={styles.loaderOverlay}
            />
          )}
          <ExpoImage
            source={{ uri: currentUri }}
            style={{ width: boxSize, height: boxSize }}
            contentFit="contain"
            autoplay={isPlaying}
            cachePolicy="memory-disk"
            onLoadStart={() => setLoadingGif(true)}
            onLoad={() => setLoadingGif(false)}
            onError={() => {
              setLoadingGif(false);
              if (currentUri !== FALLBACK_API_GIF) {
                setCurrentUri(FALLBACK_API_GIF);
              }
            }}
          />
        </View>
      )}

      <View style={[styles.tempoPill, phase === 'rest' && styles.tempoPillRest]}>
        <View
          style={[
            styles.liveDot,
            { backgroundColor: phase === 'rest' ? '#059669' : '#16A34A' },
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
    borderColor: '#E2E8F0',
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  restIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  restTitle: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  restSub: {
    color: '#475569',
    fontSize: 11.5,
    marginTop: 3,
    textAlign: 'center',
  },
  tempoPill: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tempoPillRest: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  tempoText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
});
