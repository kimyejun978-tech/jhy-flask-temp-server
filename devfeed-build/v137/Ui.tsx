import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

export function Page({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.72 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const buttonStyle = variant === 'primary' ? styles.primaryButton : variant === 'secondary' ? styles.secondaryButton : variant === 'danger' ? styles.dangerButton : styles.ghostButton;
  const textStyle = variant === 'primary' ? styles.primaryButtonText : variant === 'danger' ? styles.dangerButtonText : styles.secondaryButtonText;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, buttonStyle, (pressed || disabled) && { opacity: 0.58 }]}>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'purple' | 'green' | 'red' | 'orange' | 'blue' }) {
  const bg = tone === 'purple' ? colors.accentSoft : tone === 'green' ? colors.greenSoft : tone === 'red' ? colors.redSoft : tone === 'orange' ? '#FFF0E8' : tone === 'blue' ? colors.blueSoft : colors.cardAlt;
  const fg = tone === 'purple' ? colors.accentDark : tone === 'green' ? colors.green : tone === 'red' ? colors.red : tone === 'orange' ? '#B45C2C' : tone === 'blue' ? colors.blue : '#666672';
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: fg }]}>{children}</Text></View>;
}

export function Header({ title, eyebrow, subtitle, right }: { title: string; eyebrow?: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Divider() { return <View style={styles.divider} />; }
export function Loading() { return <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.muted}>불러오는 중…</Text></View>; }
export function ErrorBox({ message }: { message: string }) { return <View style={styles.errorBox}><Text style={styles.errorTitle}>불러오지 못했어요</Text><Text style={styles.errorText}>{message}</Text></View>; }

export const ui: Record<string, StyleProp<TextStyle | ViewStyle>> = {
  h1: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1.1 },
  h2: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: '900', letterSpacing: -0.45 },
  h3: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 23, fontWeight: '500' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 118, gap: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  button: { minHeight: 50, borderRadius: 15, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: colors.accent },
  secondaryButton: { backgroundColor: colors.accentSoft },
  ghostButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  dangerButton: { backgroundColor: colors.redSoft },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  secondaryButtonText: { color: colors.accentDark, fontSize: 14, fontWeight: '900' },
  dangerButtonText: { color: colors.red, fontSize: 14, fontWeight: '900' },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 5 },
  pageTitle: { color: colors.text, fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -1.1 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: '500', marginTop: 6, maxWidth: 320 },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900', letterSpacing: -0.35 },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  divider: { height: 1, backgroundColor: colors.line },
  loading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 9 },
  muted: { color: colors.muted, fontSize: 13 },
  errorBox: { backgroundColor: colors.redSoft, borderRadius: radius.md, padding: 15, gap: 4 },
  errorTitle: { color: colors.red, fontSize: 14, fontWeight: '900' },
  errorText: { color: '#8D4A55', fontSize: 13, lineHeight: 19 },
});
