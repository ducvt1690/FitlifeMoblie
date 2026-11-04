import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
export function useRemote(loader, auto = true) {
  const latest = useRef(loader);
  latest.current = loader;
  const [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const alive = useRef(true),
    running = useRef(false);
  const sequence = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback(async action => {
    if (running.current) return;
    running.current = true;
    if (alive.current) {
      setBusy(true);
      setError('');
    }
    sequence.current++;
    try {
      return await action();
    } catch (e) {
      if (alive.current) setError(e.message);
      return null;
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }, []);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    if (alive.current) {
      setBusy(true);
      setError('');
    }
    try {
      const value = await latest.current();
      if (alive.current && sequence.current === current) setData(value);
      return value;
    } catch (e) {
      if (alive.current && sequence.current === current) setError(e.message);
      return null;
    } finally {
      if (alive.current && sequence.current === current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (auto) reload();
  }, [reload, auto]);
  return {
    data,
    busy,
    error,
    run,
    reload,
    setData
  };
}
export function useFeedback() {
  const state = useRemote(() => Promise.resolve(null), false);
  return {
    ...state,
    wrap: action => (...args) => state.run(() => action(...args))
  };
}
export function RemoteState({
  busy,
  error,
  onRetry
}) {
  return <View accessibilityLiveRegion="polite">
    {busy && <ActivityIndicator color={COLORS.primary} accessibilityLabel="Đang tải" />}
    {!!error && <View style={s.error}><Text accessibilityRole="alert">{error}</Text>{onRetry && <TouchableOpacity onPress={onRetry} accessibilityRole="button"><Text style={s.retry}>Thử lại</Text></TouchableOpacity>}</View>}
  </View>;
}
const s = StyleSheet.create({
  error: {
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 12,
    margin: 10
  },
  retry: {
    fontWeight: '700',
    paddingTop: 8,
    color: '#991B1B'
  }
});
