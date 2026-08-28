import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useListHistory } from '@workspace/api-client-react';
import { EmptyState, Header, ProgressBar, Screen } from '@/components/planner-ui';
import { useColors } from '@/hooks/useColors';

export default function HistoryScreen() {
  const colors = useColors();
  const history = useListHistory();
  const days = history.data ?? [];
  return (
    <Screen>
      <Header eyebrow="Your archive" title="Look how far you've come." subtitle="Past days are proof that small steps add up." />
      {history.isLoading ? <Text style={[styles.state, { color: colors.mutedForeground }]}>Loading your archive...</Text> : null}
      {history.isError ? <Text style={[styles.state, { color: colors.destructive }]}>Could not load history. Pull to try again.</Text> : null}
      {!history.isLoading && !history.isError && !days.length ? <EmptyState title="Your story starts today" body="Completed personal days will gather here as a quiet record of your momentum." icon="book-open" /> : null}
      {days.map((day) => (
        <View key={day.id} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dayTop}>
            <View>
              <Text style={[styles.date, { color: colors.primary }]}>{day.dateLabel}</Text>
              <Text style={[styles.count, { color: colors.foreground }]}>{day.completed}<Text style={[styles.total, { color: colors.mutedForeground }]}>/{day.total}</Text></Text>
            </View>
            <View style={styles.xp}>
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.xpText, { color: colors.primary }]}>+{day.xpEarned} xp</Text>
            </View>
          </View>
          <ProgressBar value={day.progressPercent} />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { textAlign: 'center', fontSize: 14, paddingVertical: 30 },
  dayCard: { borderWidth: 1, borderRadius: 20, padding: 17, marginBottom: 10 },
  dayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  date: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  count: { fontSize: 30, fontWeight: '700', marginTop: 7 },
  total: { fontSize: 18 },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 },
  xpText: { fontSize: 12, fontWeight: '700' },
});