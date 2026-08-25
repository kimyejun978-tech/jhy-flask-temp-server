import { Pressable, StyleSheet, Text } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

export default function CalendarQuickAddFab() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const visible = pathname.includes('schedule') || pathname === '/calendar';
  if (!visible) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="새 일정 추가"
      onPress={() => router.push('/calendar-add?mode=natural')}
      style={({ pressed }) => [styles.fab, { bottom: Math.max(insets.bottom + 82, 94) }, pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={styles.plus}>＋</Text>
      <Text style={styles.label}>일정 추가</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    zIndex: 100,
    elevation: 12,
    minHeight: 54,
    paddingHorizontal: 17,
    borderRadius: 19,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#4E2BCC',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  plus: { color: colors.white, fontSize: 23, fontWeight: '500', marginTop: -2 },
  label: { color: colors.white, fontSize: 13, fontWeight: '900' },
});
