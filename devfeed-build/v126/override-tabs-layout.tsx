import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

function TabIcon({ label, color, focused }: { label: string; color: string; focused: boolean }) {
  return (
    <View
      style={{
        minWidth: 30,
        height: 24,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.accentSoft : 'transparent',
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? '#30477F' : 'transparent',
      }}
    >
      <Text style={{ color, fontSize: label.length > 1 ? 10 : 15, fontWeight: '900' }}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: '#687284',
        tabBarStyle: {
          backgroundColor: '#0E131A',
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: 62 + bottom,
          paddingTop: 7,
          paddingBottom: bottom,
        },
        tabBarItemStyle: {
          paddingVertical: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '800',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '행사', tabBarIcon: ({ color, focused }) => <TabIcon label="◆" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="trends"
        options={{ title: '트렌드', tabBarIcon: ({ color, focused }) => <TabIcon label="↗" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="ai-news"
        options={{ title: 'AI 뉴스', tabBarIcon: ({ color, focused }) => <TabIcon label="AI" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: '일정', tabBarIcon: ({ color, focused }) => <TabIcon label="▦" color={color} focused={focused} /> }}
      />
    </Tabs>
  );
}
