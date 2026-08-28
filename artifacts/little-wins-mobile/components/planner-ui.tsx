import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Task } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

export function Screen({
  children,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.screen,
        { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 105 },
      ]}
      scrollEnabled
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? undefined : undefined}
    >
      {refreshing ? <ActivityIndicator color={colors.primary} style={styles.refreshing} /> : null}
      {children}
    </ScrollView>
  );
}

export function Header({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const colors = useColors();
  const width = `${Math.max(0, Math.min(100, value))}%` as `${number}%`;
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
      <View style={[styles.progressFill, { width, backgroundColor: colors.primary }]} />
    </View>
  );
}

export function TaskCard({
  task,
  onToggle,
  onFocus,
}: {
  task: Task;
  onToggle: () => void;
  onFocus?: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={`task-${task.id}`}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.taskCard,
        {
          backgroundColor: task.completed ? colors.secondary : colors.card,
          borderColor: task.completed ? colors.primary : colors.border,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.check,
          {
            borderColor: task.completed ? colors.primary : colors.mutedForeground,
            backgroundColor: task.completed ? colors.primary : 'transparent',
          },
        ]}
      >
        {task.completed ? <Feather name="check" size={15} color={colors.primaryForeground} /> : null}
      </View>
      <View style={styles.taskCopy}>
        <Text
          numberOfLines={2}
          style={[
            styles.taskTitle,
            { color: task.completed ? colors.mutedForeground : colors.foreground },
            task.completed && styles.completedTask,
          ]}
        >
          {task.title}
        </Text>
        {task.notes ? <Text numberOfLines={1} style={[styles.taskNotes, { color: colors.mutedForeground }]}>{task.notes}</Text> : null}
      </View>
      <View style={[styles.xpPill, { backgroundColor: colors.accent }]}>
        <Feather name="zap" size={12} color={colors.accentForeground} />
        <Text style={[styles.xpText, { color: colors.accentForeground }]}>{task.xp}</Text>
      </View>
      {onFocus && !task.completed ? (
        <Pressable
          testID={`task-focus-${task.id}`}
          onPress={onFocus}
          hitSlop={8}
          style={[styles.focusPill, { borderColor: colors.border }]}
        >
          <Feather name="play" size={11} color={colors.primary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function EmptyState({ title, body, icon = 'sun' }: { title: string; body: string; icon?: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { paddingHorizontal: 18 },
  refreshing: { marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 7 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '700', letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 7 },
  progressTrack: { height: 8, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 8 },
  taskCard: { minHeight: 74, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  taskCopy: { flex: 1, paddingRight: 8 },
  taskTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  completedTask: { textDecorationLine: 'line-through' },
  taskNotes: { fontSize: 12, marginTop: 3 },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  xpText: { fontSize: 11, fontWeight: '700' },
  focusPill: { width: 27, height: 27, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
  empty: { alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 32 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
});