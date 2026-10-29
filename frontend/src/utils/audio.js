import { Vibration, Platform } from 'react-native';

let ExpoAudio = null;
try {
  ExpoAudio = require('expo-audio');
} catch (e) {
  // gracefully fallback if expo-audio native module is not ready
}

let Speech = null;
try {
  Speech = require('expo-speech');
} catch (e) {
  // gracefully fallback if expo-speech is not available
}

class SoundManager {
  constructor() {
    this.isMuted = false;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.isMuted) {
      this.stopSpeaking();
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  stopSpeaking() {
    try {
      if (Speech && typeof Speech.stop === 'function') {
        Speech.stop();
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
  }

  // Voice Coach Text-To-Speech (Vietnamese)
  async speakVoice(text) {
    if (this.isMuted || !text) return;

    try {
      // Mobile native via expo-speech
      if (Speech && typeof Speech.speak === 'function') {
        Speech.stop();
        Speech.speak(text, {
          language: 'vi-VN',
          pitch: 1.05,
          rate: 1.0,
        });
        return;
      }

      // Web Speech API
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      // Silent fallback
    }
  }

  // Authentic Boxing Bell sound (Boong!)
  async playBoxingBell() {
    if (this.isMuted) return;

    try {
      Vibration.vibrate([0, 120, 80, 200]);
    } catch (e) {}

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const t = ctx.currentTime;

          // Fundamental + Upper Harmonics for metallic boxing bell
          [440, 853, 1280, 2150].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = idx === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            const initialGain = 0.3 / (idx + 1);
            gain.gain.setValueAtTime(initialGain, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2 - idx * 0.15);

            osc.start(t);
            osc.stop(t + 1.2);
          });
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

  // Countdown Beep (3.. 2.. 1..)
  async playCountdownBeep() {
    if (this.isMuted) return;

    try {
      Vibration.vibrate(60);
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
          osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5 sharp beep
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);

          osc.start();
          osc.stop(ctx.currentTime + 0.14);
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

  // Referee Whistle
  async playWhistleSound() {
    if (this.isMuted) return;

    try {
      Vibration.vibrate([0, 80, 40, 160]);
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
          osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
          osc.frequency.setValueAtTime(2093.0, ctx.currentTime + 0.12); // C7
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

          osc.start();
          osc.stop(ctx.currentTime + 0.45);
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

  // Victory Fanfare Chord
  async playVictorySound() {
    if (this.isMuted) return;

    try {
      Vibration.vibrate([0, 100, 50, 100, 50, 250]);
    } catch (e) {}

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const startT = ctx.currentTime + idx * 0.12;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startT);

            gain.gain.setValueAtTime(0.25, startT);
            gain.gain.exponentialRampToValueAtTime(0.01, startT + 0.6);

            osc.start(startT);
            osc.stop(startT + 0.6);
          });
          return;
        }
      }
    } catch (e) {}
  }

  // Quick Coin Ping
  async playCoinSound() {
    if (this.isMuted) return;

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

          osc.type = 'sine';
          osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
          osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
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
    } catch (e) {}
  }
}

export const soundManager = new SoundManager();
