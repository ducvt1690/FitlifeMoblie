import { Vibration, Platform } from 'react-native';

let ExpoAudio = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  // gracefully fallback if expo-audio native module is not ready
}

class SoundManager {
  constructor() {
    this.isMuted = false;
  }

  // Synthesize pleasant tones on Web, and use ExpoAudio/Vibration on mobile
  async playCoinSound() {
    try {
      Vibration.vibrate(80);
    } catch (e) {}

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
          osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

          osc.start();
          osc.stop(ctx.currentTime + 0.35);
          return;
        }
      }

      if (ExpoAudio && ExpoAudio.createAudioPlayer) {
        const player = ExpoAudio.createAudioPlayer('https://cdn.freesound.org/previews/341/341695_5858296-lq.mp3');
        if (player && typeof player.play === 'function') {
          player.play();
        }
      }
    } catch (e) {
      // Graceful fallback to vibration
    }
  }

  async playCountdownBeep() {
    try {
      Vibration.vibrate(50);
    } catch (e) {}

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'square';
          osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

          osc.start();
          osc.stop(ctx.currentTime + 0.12);
          return;
        }
      }

      if (ExpoAudio && ExpoAudio.createAudioPlayer) {
        const player = ExpoAudio.createAudioPlayer('https://cdn.freesound.org/previews/254/254316_4062622-lq.mp3');
        if (player && typeof player.play === 'function') {
          player.play();
        }
      }
    } catch (e) {}
  }

  async playWhistleSound() {
    try {
      Vibration.vibrate([0, 100, 50, 150]);
    } catch (e) {}

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.15); // A6
          gain.gain.setValueAtTime(0.35, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

          osc.start();
          osc.stop(ctx.currentTime + 0.4);
          return;
        }
      }

      if (ExpoAudio && ExpoAudio.createAudioPlayer) {
        const player = ExpoAudio.createAudioPlayer('https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3');
        if (player && typeof player.play === 'function') {
          player.play();
        }
      }
    } catch (e) {}
  }
}

export const soundManager = new SoundManager();
