import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import {
  getGetDashboardQueryKey,
  getGetDashboardQueryOptions,
  getGetSettingsQueryKey,
  useGetSettings,
  useUpdateSettings,
} from '@workspace/api-client-react';
import { Header, Screen } from '@/components/planner-ui';
import { useColors } from '@/hooks/useColors';
import {
  cancelAllPlannerNotifications,
  getNotificationPermission,
  reconcileNotifications,
  requestNotificationPermission,
} from '@/services/notifications';

export default function SettingsScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const settings = useGetSettings();
  const update = useUpdateSettings();
  const data = settings.data;
  const [permissionGranted, setPermissionGranted] = useState(false);

  const refreshPermission = async () => {
    try {
      setPermissionGranted(await getNotificationPermission());
    } catch {
      setPermissionGranted(false);
    }
  };

  useEffect(() => {
    void refreshPermission();
  }, []);

  const syncNotifications = async () => {
    try {
      const dashboard = await queryClient.fetchQuery(getGetDashboardQueryOptions());
      await reconcileNotifications(dashboard);
    } catch {
      // The planner remains usable if notification reconciliation is temporarily unavailable.
    }
  };

  const save = async (field: 'remindersEnabled' | 'carryOver', value: boolean) => {
    if (field === 'remindersEnabled' && value) {
      const granted = await requestNotificationPermission();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert('Notifications are off', 'Allow Little Wins notifications in Android settings to turn reminders on.');
        return;
      }
    }

    update.mutate(
      { data: { [field]: value } },
      {
        onSuccess: async (next) => {
          queryClient.setQueryData(getGetSettingsQueryKey(), next);
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          if (field === 'remindersEnabled' && !value) await cancelAllPlannerNotifications();
          else await syncNotifications();
        },
        onError: () => Alert.alert('Could not save setting', 'Check your connection and try again.'),
      },
    );
  };

  const saveFrequency = (value: string) => {
    update.mutate(
      { data: { reminderFrequency: value } },
      {
        onSuccess: async (next) => {
          queryClient.setQueryData(getGetSettingsQueryKey(), next);
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          await syncNotifications();
        },
        onError: () => Alert.alert('Could not save frequency', 'Check your connection and try again.'),
      },
    );
  };

  return (
    <Screen>
      <Header eyebrow="Make it yours" title="Settings that support you." subtitle="Tune the edges of your day so the center can stay human." />
      {settings.isLoading ? <Text style={[styles.state, { color: colors.mutedForeground }]}>Loading settings...</Text> : null}
      {settings.isError ? <Text style={[styles.state, { color: colors.destructive }]}>Could not load settings.</Text> : null}
      {data ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={[styles.icon, { backgroundColor: colors.secondary }]}><Feather name="clock" size={18} color={colors.primary} /></View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your natural day</Text>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>Wake at {data.wakeTime} · wind down at {data.sleepTime}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Gentle reminders</Text>
                <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>Real Android reminders that follow your personal day.</Text>
              </View>
              <Switch testID="toggle-reminders" value={data.remindersEnabled} onValueChange={(value) => void save('remindersEnabled', value)} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.card} />
            </View>
            <View style={styles.permissionRow}>
              <View style={[styles.statusDot, { backgroundColor: permissionGranted ? colors.primary : colors.destructive }]} />
              <Text style={[styles.permissionText, { color: colors.mutedForeground }]}>{permissionGranted ? 'Android notifications allowed' : 'Android notification permission not allowed'}</Text>
              {!permissionGranted ? <Pressable onPress={() => void requestNotificationPermission().then((granted) => setPermissionGranted(granted))}><Text style={[styles.permissionAction, { color: colors.primary }]}>Allow</Text></Pressable> : null}
            </View>
            <Text style={[styles.frequencyLabel, { color: colors.mutedForeground }]}>Reminder frequency</Text>
            <View style={styles.chipWrap}>
              {['30', '60', '120'].map((value) => {
                const selected = (data.reminderFrequency === 'balanced' ? '60' : data.reminderFrequency) === value;
                return (
                  <Pressable key={value} onPress={() => saveFrequency(value)} style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.secondary }]}>
                    <Text style={[styles.chipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{value} min</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Carry unfinished things forward</Text>
                <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>Tomorrow can hold what today couldn't.</Text>
              </View>
              <Switch testID="toggle-carry-over" value={data.carryOver} onValueChange={(value) => void save('carryOver', value)} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.card} />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  state: { textAlign: 'center', fontSize: 14, paddingVertical: 30 },
  card: { borderWidth: 1, borderRadius: 20, padding: 17, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowCopy: { flex: 1 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  permissionText: { flex: 1, fontSize: 12 },
  permissionAction: { fontSize: 12, fontWeight: '800' },
  frequencyLabel: { fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
});
