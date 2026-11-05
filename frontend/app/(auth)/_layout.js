import { Fragment } from 'react';
import { Stack } from 'expo-router';
import { colors, useScheme } from '../../src/theme/tokens';

export default function AuthLayout() {
  const scheme = useScheme();
  return <Stack screenLayout={({ children }) => <Fragment key={scheme}>{children}</Fragment>}
    screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />;
}
