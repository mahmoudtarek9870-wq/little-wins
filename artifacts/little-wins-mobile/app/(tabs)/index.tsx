import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import {
  getGetDashboardQueryKey,
  getGetStatsQueryKey,
  getListChallengesQueryKey,
  getListHistoryQueryKey,
  getListTasksQueryKey,
  useCompleteTask,
  useCreateTask,
  useGetDashboard,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { EmptyState, Header, ProgressBar, Screen, TaskCard } from '@/components/planner-ui';
import { reconcileNotifications } from '@/services/notifications';

export default function TodayScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const dashboard = useGetDashboard();
  const complete = useCompleteTask();
  const create = useCreateTask();
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [xpChoice, setXpChoice] = useState('10');
  const [customXp, setCustomXp] = useState('');
  const [priority, setPriority] = useState('normal');
  const [category, setCategory] = useState('Personal');
  const [duration, setDuration] = useState('30');
  const [customDuration, setCustomDuration] = useState('');
  const [isBoss, setIsBoss] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const data = dashboard.data;
  const tasks = data?.tasks ?? [];
  const completed = tasks.filter((task) => task.completed).length;
  const focusTask = tasks.find((task) => task.id === focusTaskId) ?? null;
  const nextTask = useMemo(() => {
    const priorityWeight: Record<string, number> = { critical: 4, high: 3, normal: 2, low: 1 };
    return tasks
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const priorityDelta = (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
        if (priorityDelta !== 0) return priorityDelta;
        if (b.isBoss !== a.isBoss) return b.isBoss ? 1 : -1;
        return b.xp - a.xp;
      })[0];
  }, [tasks]);
  useEffect(() => {
    if (data) void reconcileNotifications(data);
  }, [data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListChallengesQueryKey() });
  };

  const submitTask = () => {
    const cleanTitle = title.trim();
    const xp = xpChoice === 'custom' ? Number(customXp) : Number(xpChoice);
    const durationMinutes = duration === 'custom' ? Number(customDuration) : Number(duration);
    if (!cleanTitle || !Number.isFinite(xp) || xp <= 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      Alert.alert('Add a little more detail', 'Choose a positive XP reward and duration before saving.');
      return;
    }
    create.mutate(
      {
        data: {
          title: cleanTitle,
          notes: notes.trim() || null,
          xp,
          priority,
          category,
          durationMinutes,
          isBoss,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setTitle('');
          setNotes('');
          setXpChoice('10');
          setCustomXp('');
          setPriority('normal');
          setCategory('Personal');
          setDuration('30');
          setCustomDuration('');
          setIsBoss(false);
          setModalVisible(false);
        },
        onError: () => Alert.alert('Could not save task', 'Check your connection and try again.'),
      },
    );
  };

  const toggleTask = (taskId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const task = tasks.find((item) => item.id === taskId);
    complete.mutate(
      {
        taskId,
        data: {
          completed: task ? !task.completed : true,
          idempotencyKey: `${taskId}-${task?.completed ? 'reopen' : 'complete'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      },
      {
        onSuccess: (result) => {
          invalidate();
          const feedback = result.earnedXp > 0 ? `+${result.earnedXp} XP earned.` : `${Math.abs(result.earnedXp)} XP reversed.`;
          const milestones = [
            result.leveledUp ? `Level ${result.level}` : '',
            result.rankedUp ? result.rank : '',
            result.perfectDay ? 'Perfect Day' : '',
          ].filter(Boolean);
          Alert.alert(milestones.length ? milestones.join(' · ') : 'Task updated', `${feedback}${result.doubleXp ? ' Double XP was active.' : ''}`);
        },
        onError: () => Alert.alert('Could not update task', 'Your change was not saved. Try again.'),
      },
    );
  };

  useEffect(() => {
    if (!focusTask || focusSeconds <= 0) return;
    const timer = setInterval(() => setFocusSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [focusTask, focusSeconds]);

  const openFocus = (taskId: number) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setFocusTaskId(task.id);
    setFocusSeconds((task.durationMinutes ?? 30) * 60);
  };

  const closeFocus = () => {
    setFocusTaskId(null);
    setFocusSeconds(0);
  };

  const formatFocusTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <Screen>
      <Header
        eyebrow="A fresh page"
        title="Good morning, friend."
        subtitle={data?.day?.dateLabel ? `${data.day.dateLabel} · one kind step at a time` : 'One kind step at a time'}
        action={
          <View style={[styles.streakBadge, { backgroundColor: colors.secondary }]}>
            <Feather name="activity" size={15} color={colors.primary} />
            <Text style={[styles.streakValue, { color: colors.foreground }]}>{data?.streak?.current ?? 0}</Text>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>day streak</Text>
          </View>
        }
      />

      {dashboard.isLoading ? (
        <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your day...</Text>
        </View>
      ) : dashboard.isError ? (
        <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="wifi-off" size={24} color={colors.destructive} />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Your day is offline</Text>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Reconnect to refresh your Little Wins plan.</Text>
          <Pressable testID="retry-dashboard" onPress={() => dashboard.refetch()} style={[styles.retryButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Try again</Text>
          </Pressable>
        </View>
      ) : data ? (
        <>
          {data.day.doubleXp ? (
            <View style={[styles.doubleXpBanner, { backgroundColor: colors.accent }]}>
              <Feather name="zap" size={18} color={colors.accentForeground} />
              <View style={styles.doubleXpCopy}>
                <Text style={[styles.doubleXpTitle, { color: colors.accentForeground }]}>2X XP DAY</Text>
                <Text style={[styles.doubleXpBody, { color: colors.accentForeground }]}>Everything you complete today earns double XP.</Text>
              </View>
            </View>
          ) : null}
          <View style={[styles.levelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.levelTop}>
              <View>
                <Text style={[styles.cardEyebrow, { color: colors.primary }]}>Current level</Text>
                <Text style={[styles.levelTitle, { color: colors.foreground }]}>Level {data.rank.level}</Text>
              </View>
              <View style={styles.levelMeta}>
                <Text style={[styles.levelXp, { color: colors.foreground }]}>{data.rank.totalXp} XP</Text>
                <Text style={[styles.levelRank, { color: colors.primary }]}>{data.rank.name}</Text>
              </View>
            </View>
            <ProgressBar value={data.rank.xpIntoLevel} />
            <View style={styles.levelBottom}>
              <Text style={[styles.levelHint, { color: colors.mutedForeground }]}>{data.rank.xpIntoLevel} / 100 XP into this level</Text>
              <Text style={[styles.levelHint, { color: colors.mutedForeground }]}>{data.rank.xpToNextLevel} to Level {data.rank.level + 1}</Text>
            </View>
          </View>
          <View style={[styles.momentumCard, { backgroundColor: colors.primary }]}>
            <View style={styles.momentumTop}>
              <View style={styles.momentumCopy}>
                <Text style={[styles.cardEyebrow, { color: colors.primaryForeground }]}>Today's momentum</Text>
                <Text style={[styles.momentumTitle, { color: colors.primaryForeground }]}>
                  {completed === 0 ? 'Start softly.' : completed === tasks.length ? 'You showed up.' : 'Keep the thread.'}
                </Text>
              </View>
              <View style={[styles.percentCircle, { borderColor: colors.accent }]}>
                <Text style={[styles.percentText, { color: colors.primaryForeground }]}>{Math.round(data.day.progressPercent)}%</Text>
              </View>
            </View>
            <ProgressBar value={data.day.progressPercent} />
            <View style={styles.momentumMeta}>
              <Text style={[styles.metaText, { color: colors.primaryForeground }]}>{completed} of {tasks.length} complete</Text>
               <Text style={[styles.metaText, { color: colors.primaryForeground }]}>{data.rank.name} · {data.rank.xpToNextLevel} XP to go</Text>
            </View>
          </View>

          {nextTask ? (
            <View style={[styles.nextCard, { backgroundColor: colors.secondary }]}>
              <View style={styles.nextCopy}>
                <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>Your next move</Text>
                <Text style={[styles.nextTitle, { color: colors.foreground }]}>{nextTask.title}</Text>
                <Text style={[styles.nextMeta, { color: colors.mutedForeground }]}>+{nextTask.xp} XP · {nextTask.durationMinutes ?? 30} min · {nextTask.priority}</Text>
              </View>
              <Pressable testID={`focus-${nextTask.id}`} onPress={() => openFocus(nextTask.id)} style={[styles.startButton, { backgroundColor: colors.primary }]}>
                <Feather name="play" size={13} color={colors.primaryForeground} />
                <Text style={[styles.startButtonText, { color: colors.primaryForeground }]}>Start</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.sectionHeading}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>Your list</Text>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Small steps, visible.</Text>
            </View>
            <Pressable
              testID="add-task"
              onPress={() => setModalVisible(true)}
              style={({ pressed }) => [styles.addButton, { backgroundColor: colors.accent, opacity: pressed ? 0.78 : 1 }]}
            >
              <Feather name="plus" size={17} color={colors.accentForeground} />
              <Text style={[styles.addButtonText, { color: colors.accentForeground }]}>Add</Text>
            </Pressable>
          </View>
          {tasks.length ? tasks.map((task) => <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} onFocus={() => openFocus(task.id)} />) : (
            <EmptyState title="A blank canvas" body="Add one thing that would make today feel a little more like yours." icon="edit-3" />
          )}

          <View style={[styles.coachCard, { backgroundColor: colors.secondary }]}>
            <Feather name="message-circle" size={18} color={colors.primary} />
            <View style={styles.coachCopy}>
              <Text style={[styles.coachEyebrow, { color: colors.primary }]}>Coach's note</Text>
              <Text style={[styles.coachText, { color: colors.foreground }]}>{data.reminder.message}</Text>
            </View>
          </View>
        </>
      ) : null}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(20, 38, 32, 0.38)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
             <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
             <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.cardEyebrow, { color: colors.primary }]}>One small win</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add a task</Text>
              </View>
              <Pressable testID="close-task-modal" onPress={() => setModalVisible(false)} hitSlop={12}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <TextInput
              testID="task-title-input"
              autoFocus
              value={title}
              onChangeText={setTitle}
              placeholder="What would feel good to finish?"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            />
            <TextInput
              testID="task-notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="A little context (optional)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.input, styles.notesInput, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
            />
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>XP reward</Text>
            <View style={styles.chipWrap}>
              {[5, 10, 15, 20, 25, 50, 100].map((value) => (
                <Pressable key={value} onPress={() => setXpChoice(String(value))} style={[styles.chip, { backgroundColor: xpChoice === String(value) ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.chipText, { color: xpChoice === String(value) ? colors.primaryForeground : colors.foreground }]}>{value} XP</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setXpChoice('custom')} style={[styles.chip, { backgroundColor: xpChoice === 'custom' ? colors.primary : colors.secondary }]}>
                <Text style={[styles.chipText, { color: xpChoice === 'custom' ? colors.primaryForeground : colors.foreground }]}>Custom</Text>
              </Pressable>
            </View>
            {xpChoice === 'custom' ? (
              <TextInput value={customXp} onChangeText={setCustomXp} keyboardType="numeric" placeholder="Custom XP" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]} />
            ) : null}
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={styles.chipWrap}>
              {['low', 'normal', 'high', 'critical'].map((value) => (
                <Pressable key={value} onPress={() => setPriority(value)} style={[styles.chip, { backgroundColor: priority === value ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.chipText, { color: priority === value ? colors.primaryForeground : colors.foreground }]}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Category</Text>
            <View style={styles.chipWrap}>
              {['Study', 'Work', 'Health', 'Fitness', 'Personal', 'Hobby', 'Other'].map((value) => (
                <Pressable key={value} onPress={() => setCategory(value)} style={[styles.chip, { backgroundColor: category === value ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.chipText, { color: category === value ? colors.primaryForeground : colors.foreground }]}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Duration</Text>
            <View style={styles.chipWrap}>
              {[['15', '15 min'], ['30', '30 min'], ['60', '1 hour'], ['120', '2 hours'], ['custom', 'Custom']].map(([value, label]) => (
                <Pressable key={value} onPress={() => setDuration(value)} style={[styles.chip, { backgroundColor: duration === value ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.chipText, { color: duration === value ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {duration === 'custom' ? (
              <TextInput value={customDuration} onChangeText={setCustomDuration} keyboardType="numeric" placeholder="Minutes" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]} />
            ) : null}
            <Pressable onPress={() => setIsBoss((value) => !value)} style={[styles.bossToggle, { borderColor: isBoss ? colors.accent : colors.border, backgroundColor: isBoss ? colors.secondary : colors.background }]}>
              <Feather name="shield" size={16} color={isBoss ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.bossText, { color: colors.foreground }]}>{isBoss ? 'Boss task selected' : 'Mark as optional Boss Task'}</Text>
            </Pressable>
            <Pressable
              testID="save-task"
              disabled={!title.trim() || create.isPending}
              onPress={submitTask}
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: !title.trim() || create.isPending ? 0.45 : 1 }]}
            >
              <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>{create.isPending ? 'Saving...' : 'Save task'}</Text>
            </Pressable>
             </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!focusTask} transparent animationType="fade" onRequestClose={closeFocus}>
        <View style={[styles.focusBackdrop, { backgroundColor: colors.background }]}>
          <View style={styles.focusHeader}>
            <Text style={[styles.cardEyebrow, { color: colors.primary }]}>Focus mode</Text>
            <Pressable onPress={closeFocus} hitSlop={12}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <Text style={[styles.focusTitle, { color: colors.foreground }]}>{focusTask?.title}</Text>
          <Text style={[styles.focusTimer, { color: colors.primary }]}>{formatFocusTime(focusSeconds)}</Text>
          <Text style={[styles.focusHint, { color: colors.mutedForeground }]}>{focusSeconds === 0 ? "Time's up." : 'One focused block. Nothing else required.'}</Text>
          <View style={styles.focusActions}>
            <Pressable onPress={() => focusTask && toggleTask(focusTask.id)} style={[styles.focusPrimary, { backgroundColor: colors.primary }]}>
              <Text style={[styles.focusPrimaryText, { color: colors.primaryForeground }]}>Complete</Text>
            </Pressable>
            <Pressable onPress={closeFocus} style={[styles.focusSecondary, { borderColor: colors.border }]}>
              <Text style={[styles.focusSecondaryText, { color: colors.foreground }]}>Not yet</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  streakBadge: { alignItems: 'center', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 9, minWidth: 78 },
  streakValue: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  streakLabel: { fontSize: 9, marginTop: 1 },
  doubleXpBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 15, marginBottom: 12 },
  doubleXpCopy: { flex: 1, paddingLeft: 11 },
  doubleXpTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  doubleXpBody: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  levelCard: { borderWidth: 1, borderRadius: 20, padding: 17, marginBottom: 12 },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  levelTitle: { fontSize: 23, fontWeight: '700', marginTop: 5 },
  levelMeta: { alignItems: 'flex-end' },
  levelXp: { fontSize: 16, fontWeight: '700' },
  levelRank: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  levelBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  levelHint: { fontSize: 10 },
  loadingCard: { borderWidth: 1, borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20 },
  loadingText: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  errorTitle: { fontSize: 17, fontWeight: '700', marginTop: 10 },
  retryButton: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  retryText: { fontSize: 13, fontWeight: '700' },
  momentumCard: { borderRadius: 24, padding: 20, marginBottom: 26 },
  momentumTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  momentumCopy: { flex: 1, paddingRight: 12 },
  cardEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
  momentumTitle: { fontSize: 25, lineHeight: 30, fontWeight: '700', marginTop: 7 },
  percentCircle: { width: 68, height: 68, borderWidth: 5, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  percentText: { fontSize: 16, fontWeight: '700' },
  momentumMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  metaText: { fontSize: 11, opacity: 0.8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 21, fontWeight: '700', marginTop: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  addButtonText: { fontSize: 12, fontWeight: '700' },
  coachCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 20, padding: 17, marginTop: 14 },
  coachCopy: { flex: 1, paddingLeft: 11 },
  coachEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 5 },
  coachText: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  nextCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, marginBottom: 20 },
  nextCopy: { flex: 1, paddingRight: 10 },
  nextTitle: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  nextMeta: { fontSize: 11, marginTop: 5, textTransform: 'capitalize' },
  startButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9 },
  startButtonText: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 38 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 25, fontWeight: '700', marginTop: 5 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, marginBottom: 10 },
  notesInput: { minHeight: 82, textAlignVertical: 'top' },
  saveButton: { borderRadius: 14, alignItems: 'center', paddingVertical: 14, marginTop: 5 },
  saveButtonText: { fontSize: 14, fontWeight: '700' },
  formLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 6, marginBottom: 8, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 8 },
  chip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { fontSize: 11, fontWeight: '700' },
  bossToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 13, padding: 12, marginTop: 8, marginBottom: 8 },
  bossText: { fontSize: 12, fontWeight: '600' },
  focusBackdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  focusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  focusTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700', marginTop: 22 },
  focusTimer: { fontSize: 58, fontWeight: '700', letterSpacing: -2, marginTop: 30 },
  focusHint: { fontSize: 14, lineHeight: 20, marginTop: 10 },
  focusActions: { gap: 10, marginTop: 30 },
  focusPrimary: { borderRadius: 14, alignItems: 'center', paddingVertical: 14 },
  focusPrimaryText: { fontSize: 14, fontWeight: '700' },
  focusSecondary: { borderWidth: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 13 },
  focusSecondaryText: { fontSize: 14, fontWeight: '700' },
});