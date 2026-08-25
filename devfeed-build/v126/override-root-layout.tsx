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
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void queryClient.invalidateQueries(); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: 16, fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ title: '행사 상세' }} />
        <Stack.Screen name="trend/[id]" options={{ title: '트렌드 상세' }} />
        <Stack.Screen name="news/[id]" options={{ title: 'AI 뉴스' }} />
        <Stack.Screen name="ai-news/[id]" options={{ title: 'AI 뉴스' }} />
        <Stack.Screen name="calendar" options={{ title: '내 캘린더' }} />
        <Stack.Screen name="settings" options={{ title: '설정', presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  );
}
