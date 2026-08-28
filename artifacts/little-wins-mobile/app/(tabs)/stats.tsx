import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetStats } from '@workspace/api-client-react';
import { Header, Screen } from '@/components/planner-ui';
import { useColors } from '@/hooks/useColors';

export default function StatsScreen() {
  const colors = useColors();
  const stats = useGetStats();
  const data = stats.data;
  const cards = [
    { label: 'Done', value: `${data?.totalCompleted ?? 0}`, icon: 'check-circle' as const },
    { label: 'Completion', value: `${Math.round(data?.completionPercent ?? 0)}%`, icon: 'trending-up' as const },
    { label: 'Current streak', value: `${data?.currentStreak ?? 0}d`, icon: 'activity' as const },
    { label: 'Average / day', value: `${data?.averagePerDay ?? 0}`, icon: 'bar-chart-2' as const },
  ];
  return (
    <Screen>
      <Header eyebrow="The bigger picture" title="Momentum, measured kindly." subtitle="Numbers are here to notice patterns, not grade you." />
      {stats.isLoading ? <Text style={[styles.state, { color: colors.mutedForeground }]}>Finding your rhythm...</Text> : null}
      {stats.isError ? <Text style={[styles.state, { color: colors.destructive }]}>Could not load stats.</Text> : null}
      {data ? (
        <>
          <View style={styles.grid}>
            {cards.map((card, index) => (
              <View key={card.label} style={[styles.statCard, { backgroundColor: index === 0 ? colors.primary : colors.card, borderColor: index === 0 ? colors.primary : colors.border }]}>
                <Feather name={card.icon} size={17} color={index === 0 ? colors.accent : colors.primary} />
                <Text style={[styles.statLabel, { color: index === 0 ? colors.primaryForeground : colors.mutedForeground }]}>{card.label}</Text>
                <Text style={[styles.statValue, { color: index === 0 ? colors.primaryForeground : colors.foreground }]}>{card.value}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.panelEyebrow, { color: colors.primary }]}>Daily energy</Text>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Your recent rhythm</Text>
            <View style={styles.bars}>
              {(data.daily ?? []).slice(-7).map((point, index) => {
                const max = Math.max(...(data.daily ?? []).map((item) => item.value), 1);
                return (
                  <View key={`${point.label}-${index}`} style={styles.barItem}>
                    <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                      <View style={[styles.bar, { height: `${Math.max(8, point.value / max * 100)}%`, backgroundColor: index === 6 ? colors.accent : colors.primary }]} />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{point.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { textAlign: 'center', fontSize: 14, paddingVertical: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  statCard: { width: '48%', minHeight: 120, borderWidth: 1, borderRadius: 18, padding: 14 },
  statLabel: { fontSize: 10, marginTop: 17 },
  statValue: { fontSize: 26, fontWeight: '700', marginTop: 4 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 18 },
  panelEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  panelTitle: { fontSize: 20, fontWeight: '700', marginTop: 5 },
  bars: { height: 170, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 20 },
  barItem: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { height: 125, width: '100%', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7 },
  barLabel: { fontSize: 9, marginTop: 7 },
});