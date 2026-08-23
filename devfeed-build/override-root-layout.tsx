import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnMount: 'always',
      refetchOnReconnect: true,
    },
  },
});

export default function RootLayout() {
  return <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle:{backgroundColor:colors.bg}, headerTintColor:colors.text, contentStyle:{backgroundColor:colors.bg}, headerShadowVisible:false }}>
        <Stack.Screen name="(tabs)" options={{headerShown:false}} />
        <Stack.Screen name="event/[id]" options={{title:'행사 상세'}} />
        <Stack.Screen name="trend/[id]" options={{title:'트렌드 상세'}} />
        <Stack.Screen name="news/[id]" options={{title:'AI 뉴스'}} />
        <Stack.Screen name="settings" options={{title:'설정', presentation:'modal'}} />
      </Stack>
    </QueryClientProvider>
  </SafeAreaProvider>;
}
