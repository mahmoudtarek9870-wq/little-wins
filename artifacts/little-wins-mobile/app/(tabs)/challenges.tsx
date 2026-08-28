import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useListChallenges } from '@workspace/api-client-react';
import { EmptyState, Header, ProgressBar, Screen } from '@/components/planner-ui';
import { useColors } from '@/hooks/useColors';

export default function ChallengesScreen() {
  const colors = useColors();
  const challenges = useListChallenges();
  const items = challenges.data ?? [];
  return (
    <Screen>
      <Header eyebrow="Longer threads" title="Keep a little practice going." subtitle="Small repeatable actions become a rhythm." />
      {challenges.isLoading ? <Text style={[styles.state, { color: colors.mutedForeground }]}>Loading challenges...</Text> : null}
      {challenges.isError ? <Text style={[styles.state, { color: colors.destructive }]}>Could not load challenges.</Text> : null}
      {!challenges.isLoading && !challenges.isError && !items.length ? <EmptyState title="Nothing in motion yet" body="Challenges you start will live here as a gentle thread to return to." icon="flag" /> : null}
      {items.map((challenge) => (
        <View key={challenge.id} style={[styles.challengeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.challengeTop}>
            <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
              <Feather name="target" size={18} color={colors.primary} />
            </View>
            <View style={styles.challengeTitleWrap}>
              <Text style={[styles.challengeName, { color: colors.foreground }]}>{challenge.name}</Text>
              <Text style={[styles.challengeMeta, { color: colors.mutedForeground }]}>{challenge.durationDays} day practice · day {challenge.dayNumber}</Text>
            </View>
            <Text style={[styles.status, { color: colors.primary }]}>{challenge.status}</Text>
          </View>
          <View style={styles.challengeProgress}>
            <ProgressBar value={challenge.progressPercent} />
            <Text style={[styles.challengeMeta, { color: colors.mutedForeground }]}>{challenge.completedTasks} of {challenge.totalTasks} tasks</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { textAlign: 'center', fontSize: 14, paddingVertical: 30 },
  challengeCard: { borderWidth: 1, borderRadius: 20, padding: 17, marginBottom: 10 },
  challengeTop: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  challengeTitleWrap: { flex: 1, paddingHorizontal: 11 },
  challengeName: { fontSize: 16, fontWeight: '700' },
  challengeMeta: { fontSize: 11, marginTop: 4 },
  status: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  challengeProgress: { marginTop: 17, gap: 7 },
});