import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export const SPRITE_SHEETS = {
  // 8 original DailyHero2D sprites
  walk: require('../../assets/sprites/walk.png'),
  drink: require('../../assets/sprites/drink.png'),
  eyes: require('../../assets/sprites/eyes.png'),
  breathe: require('../../assets/sprites/breathe.png'),
  squat: require('../../assets/sprites/squat.png'),
  stretch: require('../../assets/sprites/stretch.png'),
  plank: require('../../assets/sprites/plank.png'),
  run: require('../../assets/sprites/run.png'),
  // 9 additional FitLife MMA & Fitness 2D sprites
  boxing: require('../../assets/sprites/boxing.png'),
  jumping_jacks: require('../../assets/sprites/jumping_jacks.png'),
  pushup: require('../../assets/sprites/pushup.png'),
  crunch: require('../../assets/sprites/crunch.png'),
  climber: require('../../assets/sprites/climber.png'),
  knee: require('../../assets/sprites/knee.png'),
  sprawl: require('../../assets/sprites/sprawl.png'),
  cobra: require('../../assets/sprites/cobra.png'),
  burpee: require('../../assets/sprites/burpee.png'),
};

export function SpriteAnimation({
  sprite = 'squat',
  frameCount = 6,
  frameDurationMs = 170,
  size = 180,
  playing = true,
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
  }, [sprite]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % frameCount);
    }, frameDurationMs);
    return () => clearInterval(timer);
  }, [playing, frameCount, frameDurationMs, sprite]);

  const sheet = SPRITE_SHEETS[sprite] || SPRITE_SHEETS.squat;

  return (
    <View style={[styles.viewport, { width: size, height: size }]}>
      <Image
        source={sheet}
        fadeDuration={0}
        resizeMode="stretch"
        style={{
          width: size * frameCount,
          height: size,
          transform: [{ translateX: -frame * size }],
        }}
        accessible
        accessibilityLabel={`Hoạt ảnh 2D bài tập ${sprite}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});

export default SpriteAnimation;
