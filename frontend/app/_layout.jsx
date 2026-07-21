import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BadgeProvider } from '../context/BadgeContext';
import * as Updates from 'expo-updates';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef();
  const responseListener = useRef();

  const checkForUpdates = async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.log('Error checking for updates:', error);
    }
  };

  // Auth redirect
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    } else if (user && segments.length === 0) {
      router.replace('/');
    }
  }, [user, loading]);

  // OTA updates
  useEffect(() => {
    if (!__DEV__) {
      checkForUpdates();
    }
  }, []);

  // Notifications
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);

      if (data.screen === 'chat' && data.userId) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: data.userId },
        });
      } else if (data.screen === 'complaints') {
        router.push('/(tabs)/complaints');
      } else if (data.screen === 'food') {
        router.push('/(tabs)/food');
      } else if (data.screen === 'home') {
        router.push('/(tabs)/');
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <BadgeProvider>
          <RootLayoutNav />
        </BadgeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}