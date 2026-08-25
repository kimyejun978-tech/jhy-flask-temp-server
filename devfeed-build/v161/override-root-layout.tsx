import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { colors } from '@/theme';
import { promptForUpdateIfAvailable } from '@/updater';
import CalendarQuickAddFab from '@/components/CalendarQuickAddFab';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnMount: 'always' } } });

export default function RootLayout() {
  useEffect(() => {
    const timer = setTimeout(() => { void promptForUpdateIfAvailable(); }, 1800);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void queryClient.invalidateQueries(); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="trend/[id]" />
            <Stack.Screen name="ai-news/[id]" />
            <Stack.Screen name="news/[id]" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="calendar-add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="calendar-edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
          <CalendarQuickAddFab />
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
