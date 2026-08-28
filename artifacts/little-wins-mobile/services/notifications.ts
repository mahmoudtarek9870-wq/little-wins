import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import type { Dashboard, Settings } from '@workspace/api-client-react';

const CHANNEL_ID = 'little-wins-reminders';
const SCHEDULE_PREFIX = 'little-wins-reminder:';
const MAX_SCHEDULED_REMINDERS = 8;

let initialized = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function normalizeFrequency(value: string | undefined) {
  if (value === '30' || value === '60' || value === '120') return Number(value);
  if (value === 'balanced') return 60;
  const parsed = Number(value);
  return parsed === 30 || parsed === 60 || parsed === 120 ? parsed : 60;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isInWindow(minutes: number, start: number, end: number) {
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function isQuietTime(date: Date, settings: Settings) {
  const start = timeToMinutes(settings.quietHoursStart);
  const end = timeToMinutes(settings.quietHoursEnd);
  return isInWindow(minutesSinceMidnight(date), start, end);
}

function minutesUntilSleep(settings: Settings, now: Date) {
  const nowMinutes = minutesSinceMidnight(now);
  const wake = timeToMinutes(settings.wakeTime);
  const sleep = timeToMinutes(settings.sleepTime);
  let delta = sleep - nowMinutes;
  if (sleep <= wake && nowMinutes < sleep) delta = sleep + 1440 - nowMinutes;
  if (sleep > wake && nowMinutes >= sleep) delta = 0;
  return Math.max(0, delta);
}

function urgencyFor(minutes: number) {
  if (minutes <= 10) return 'final';
  if (minutes <= 30) return 'urgent';
  if (minutes <= 60) return 'high';
  if (minutes <= 180) return 'higher';
  if (minutes <= 360) return 'normal';
  return 'low';
}

const ONE = [
  'One task left. Finish strong.',
  "You're one task away.",
  'Just one more.',
  'One last win before the day closes.',
  'One task. One final push.',
];
const TWO = [
  'Two tasks left. Clear them.',
  'Only two things stand between you and a finished day.',
  'Two more wins.',
  'Two tasks. You can close these out.',
  'The finish line is two tasks away.',
];
const MANY = [
  'You still have unfinished tasks.',
  'Your remaining tasks are waiting.',
  "Don't carry today's tasks into tomorrow.",
  "Your day isn't finished yet.",
  'Keep moving. Pick the next small win.',
  'There is still time to make progress.',
  'Your next win is waiting.',
  'Clear one more task before the day ends.',
];
const DOUBLE = [
  '⚡ 2X XP is active today.',
  'Everything you complete today earns double XP.',
  "Today's a 2X XP day. Make it count.",
  'Double XP is waiting for your next win.',
];
const DONE = [
  'Clean slate. You showed up for yourself today.',
  'Every task is clear. Protect that momentum.',
  'Day complete. That is progress you can feel.',
];

function pick<T>(items: T[], seed: number) {
  return items[Math.abs(seed) % items.length];
}

function buildMessage(dashboard: Dashboard, at: Date, index: number) {
  const remaining = dashboard.tasks.filter((task) => !task.completed).length;
  if (remaining === 0) return pick(DONE, index + dashboard.rank.totalXp);
  const minutes = minutesUntilSleep(dashboard.settings, at);
  const urgency = urgencyFor(minutes);
  const base = dashboard.day.doubleXp
    ? pick(DOUBLE, index + dashboard.rank.totalXp)
    : remaining === 1
      ? pick(ONE, index + dashboard.streak.current)
      : remaining === 2
        ? pick(TWO, index + dashboard.streak.current)
        : pick(MANY, index + dashboard.streak.current);

  const detail = `${remaining} ${remaining === 1 ? 'task' : 'tasks'} left · Level ${dashboard.rank.level} · ${minutes}m until sleep`;
  if (urgency === 'final') return `${base} Final push — ${detail}.`;
  if (urgency === 'urgent') return `${base} ${detail}.`;
  return base;
}

export async function initializeNotifications() {
  if (initialized || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Little Wins Reminders',
    description: 'Gentle reminders to finish your Little Wins tasks.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    sound: undefined,
  });
  initialized = true;
}

export async function getNotificationPermission() {
  if (Platform.OS !== 'android') return false;
  await initializeNotifications();
  const permissions = await Notifications.getPermissionsAsync();
  return permissions.granted;
}

export async function requestNotificationPermission() {
  if (Platform.OS !== 'android') return false;
  await initializeNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function cancelPlannerReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.source === SCHEDULE_PREFIX)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

function nextReminderTimes(dashboard: Dashboard) {
  const now = new Date();
  const frequency = normalizeFrequency(dashboard.settings.reminderFrequency);
  const sleepMinutes = minutesUntilSleep(dashboard.settings, now);
  if (sleepMinutes <= 0) return [] as Date[];

  const result: Date[] = [];
  let cursor = new Date(now.getTime() + Math.max(1, frequency) * 60_000);
  const horizon = now.getTime() + sleepMinutes * 60_000;

  for (let i = 0; i < MAX_SCHEDULED_REMINDERS && cursor.getTime() < horizon; i += 1) {
    if (!isQuietTime(cursor, dashboard.settings)) result.push(new Date(cursor.getTime()));
    cursor = new Date(cursor.getTime() + frequency * 60_000);
  }
  return result;
}

export async function reconcileNotifications(dashboard: Dashboard | null | undefined) {
  if (Platform.OS !== 'android' || !dashboard) return;
  await initializeNotifications();
  await cancelPlannerReminders();

  if (!dashboard.settings.remindersEnabled) return;
  if (!(await getNotificationPermission())) return;
  if (dashboard.tasks.every((task) => task.completed)) return;

  const times = nextReminderTimes(dashboard);
  await Promise.all(
    times.map(async (date, index) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: dashboard.day.doubleXp ? '⚡ Little Wins · 2X XP' : 'Little Wins',
          body: buildMessage(dashboard, date, index),
          data: { source: SCHEDULE_PREFIX, index, dayId: dashboard.day.id },
          channelId: CHANNEL_ID,
          sound: undefined,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
    }),
  );
}

export async function cancelAllPlannerNotifications() {
  if (Platform.OS !== 'android') return;
  await initializeNotifications();
  await cancelPlannerReminders();
}

export function attachNotificationAppStateSync(sync: () => Promise<void> | void) {
  return AppState.addEventListener('change', (state) => {
    if (state === 'active') void sync();
  });
}

