import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
};

export function Page({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>DEVFEED</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function Card({ children, onPress, style }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: '#202734' }}
        style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const ghost = variant === 'ghost';
  const danger = variant === 'danger';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        ghost && styles.buttonGhost,
        danger && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <Text style={[styles.buttonText, ghost && styles.buttonGhostText]}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.accent} />
      <Text style={ui.muted}>불러오는 중...</Text>
    </View>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={[styles.stateBox, styles.errorBox]}>
      <Text style={styles.errorTitle}>불러오지 못했어요</Text>
      <Text style={ui.muted}>{message}</Text>
    </View>
  );
}

export const ui: Record<string, TextStyle | ViewStyle> = {
  h1: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  h2: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  body: {
    color: '#E8EBF0',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  section: {
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pageContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    gap: 12,
    marginBottom: 2,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 3,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 17,
    gap: 10,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.92,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: '#2B3442',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#C7D2E4',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
  },
  buttonGhost: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: '#313A49',
  },
  buttonDanger: {
    backgroundColor: colors.red,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#0A0D12',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  buttonGhostText: {
    color: colors.text,
  },
  stateBox: {
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
  },
  errorBox: {
    alignItems: 'flex-start',
    borderColor: '#4B2830',
    backgroundColor: '#1B1115',
  },
  errorTitle: {
    color: '#FF9BA5',
    fontSize: 15,
    fontWeight: '900',
  },
});
