import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { useEffect } from 'react';
import { colors } from '@/theme';
import { promptForUpdateIfAvailable } from '@/updater';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnMount: 'always' } } });

export default function RootLayout() {
  useEffect(() => {
    const timer = setTimeout(() => { void promptForUpdateIfAvailable(); }, 1800);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void queryClient.invalidateQueries(); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="trend/[id]" />
        <Stack.Screen name="ai-news/[id]" />
        <Stack.Screen name="news/[id]" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="settings" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </QueryClientProvider>
  );
}
