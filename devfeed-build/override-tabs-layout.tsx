import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

const I=({e}:{e:string})=><Text style={{fontSize:19}}>{e}</Text>;

export default function TabsLayout(){
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);

  return <Tabs screenOptions={{
    headerShown:false,
    tabBarActiveTintColor:colors.text,
    tabBarInactiveTintColor:colors.muted,
    tabBarHideOnKeyboard:true,
    tabBarStyle:{
      backgroundColor:colors.card,
      borderTopColor:colors.line,
      height:56 + bottom,
      paddingTop:6,
      paddingBottom:bottom,
    },
    tabBarLabelStyle:{fontSize:12,fontWeight:'700'},
  }}>
    <Tabs.Screen name="index" options={{title:'행사',tabBarIcon:()=> <I e="🗓"/>}} />
    <Tabs.Screen name="trends" options={{title:'트렌드',tabBarIcon:()=> <I e="📝"/>}} />
    <Tabs.Screen name="ai-news" options={{title:'AI 뉴스',tabBarIcon:()=> <I e="▶️"/>}} />
  </Tabs>;
}
