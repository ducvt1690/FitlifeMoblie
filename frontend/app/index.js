import { Redirect } from 'expo-router';
import { homeFor, useAuth } from '../src/context/AuthContext';
import LandingScreen from '../src/features/landing/LandingScreen';

export default function Index() {
  const { user } = useAuth();
  return user ? <Redirect href={homeFor(user.role)} /> : <LandingScreen />;
}
