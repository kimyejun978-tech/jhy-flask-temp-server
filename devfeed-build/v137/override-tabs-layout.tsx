import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return (
    <View style={{ width: 30, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.accentSoft : 'transparent' }}>
      <Text style={{ color: focused ? colors.accent : colors.muted2, fontSize: 17, fontWeight: '900' }}>{symbol}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted2,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: '#FFFFFFF2',
        borderTopWidth: 1,
        borderTopColor: colors.line,
        height: 60 + bottom,
        paddingTop: 6,
        paddingBottom: bottom,
        elevation: 0,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '800', marginTop: 1 },
    }}>
      <Tabs.Screen name="index" options={{ title: '행사', tabBarIcon: ({ focused }) => <TabIcon symbol="◇" focused={focused} /> }} />
      <Tabs.Screen name="trends" options={{ title: '트렌드', tabBarIcon: ({ focused }) => <TabIcon symbol="↗" focused={focused} /> }} />
      <Tabs.Screen name="ai-news" options={{ title: 'AI 뉴스', tabBarIcon: ({ focused }) => <TabIcon symbol="AI" focused={focused} /> }} />
      <Tabs.Screen name="schedule" options={{ title: '일정', tabBarIcon: ({ focused }) => <TabIcon symbol="▦" focused={focused} /> }} />
    </Tabs>
  );
}
