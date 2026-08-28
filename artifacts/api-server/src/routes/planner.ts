import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  challengeTasksTable,
  challengeDaysTable,
  challengesTable,
  doubleXpWeeksTable,
  personalDaysTable,
  plannerSettingsTable,
  taskChallengesTable,
  tasksTable,
  xpTransactionsTable,
} from "@workspace/db";
import {
  CompleteTaskParams,
  CompleteTaskBody,
  CompleteTaskResponse,
  CreateChallengeBody,
  CreateChallengeResponse,
  CreateTaskBody,
  CreateTaskResponse,
  DeleteTaskParams,
  GetChallengeParams,
  GetChallengeResponse,
  GetDashboardResponse,
  GetHistoryDayParams,
  GetHistoryDayResponse,
  GetSettingsResponse,
  GetStatsResponse,
  ListChallengesResponse,
  ListHistoryResponse,
  ListTasksResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const TIME_ZONE = "Africa/Cairo";
const RANKS = [
  { name: "BEGINNER", minimumLevel: 1 },
  { name: "BRONZE", minimumLevel: 50 },
  { name: "SILVER", minimumLevel: 100 },
  { name: "GOLD", minimumLevel: 250 },
  { name: "PLATINUM", minimumLevel: 500 },
  { name: "DIAMOND", minimumLevel: 750 },
  { name: "ELITE", minimumLevel: 1000 },
  { name: "MASTER", minimumLevel: 1500 },
  { name: "LEGEND", minimumLevel: 2500 },
  { name: "HERO", minimumLevel: 5000 },
];

const REMINDERS = {
  one: [
    "One task left. Finish it and close the day strong.",
    "You're literally one task away.",
    "Just one more. Don't let the day end unfinished.",
  ],
  two: [
    "Two tasks left. You can clear these.",
    "Only two things standing between you and a clean day.",
    "A tiny finish line: two tasks to go.",
  ],
  many: [
    "You still have a few tasks waiting for you.",
    "Your unfinished tasks are piling up. Time to move.",
    "Don't let the remaining tasks follow you into tomorrow.",
    "Small progress still counts. Pick the next task.",
  ],
  done: [
    "Clean slate. You showed up for yourself today.",
    "Every task is clear. Protect that momentum.",
    "Day complete. That is progress you can feel.",
  ],
};

type LocalParts = { year: number; month: number; day: number; minutes: number };

function localParts(date = new Date()): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), minutes: get("hour") * 60 + get("minute") };
}

function dateKey(parts: Pick<LocalParts, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function shiftDate(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function surrogateDate(key: string, time: string) {
  return new Date(`${key}T${time}:00Z`);
}

function timeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function dayBounds(settings: { sleepTime: string; wakeTime: string }, now = new Date()) {
  const parts = localParts(now);
  const today = dateKey(parts);
  const wakeMinutes = timeMinutes(settings.wakeTime);
  const sleepMinutes = timeMinutes(settings.sleepTime);
  const crossesMidnight = sleepMinutes <= wakeMinutes;
  let boundaryDay = today;
  if (crossesMidnight) {
    if (parts.minutes < sleepMinutes) boundaryDay = shiftDate(today, -1);
  } else if (parts.minutes >= sleepMinutes) {
    boundaryDay = shiftDate(today, 1);
  }
  return {
    dayKey: boundaryDay,
    startsAt: surrogateDate(boundaryDay, settings.wakeTime),
    endsAt: surrogateDate(crossesMidnight ? shiftDate(boundaryDay, 1) : boundaryDay, settings.sleepTime),
  };
}

function dateLabel(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function pick<T>(values: T[], seed: number) {
  return values[Math.abs(seed) % values.length];
}

function levelFor(totalXp: number) {
  return Math.floor(Math.max(0, totalXp) / 100) + 1;
}

function rankFor(totalXp: number, totalCompleted = 0) {
  const level = levelFor(totalXp);
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.minimumLevel) current = rank;
  }
  const nextIndex = RANKS.findIndex((rank) => rank.name === current.name) + 1;
  const next = RANKS[nextIndex] ?? null;
  const span = next ? next.minimumLevel - current.minimumLevel : 1;
  const progressPercent = next
    ? Math.min(100, Math.round(((level - current.minimumLevel) / span) * 100))
    : 100;
  const xpIntoLevel = Math.max(0, totalXp - (level - 1) * 100);
  return {
    name: current.name,
    minimum: (current.minimumLevel - 1) * 100,
    nextName: next?.name ?? null,
    nextMinimum: next ? (next.minimumLevel - 1) * 100 : null,
    totalXp,
    level,
    nextLevelXp: level * 100,
    xpIntoLevel,
    xpToNextLevel: Math.max(0, 100 - xpIntoLevel),
    totalCompleted,
    progressPercent,
    remaining: next ? Math.max(0, (next.minimumLevel - level) * 100) : 0,
  };
}

async function ensureLegacyXpLedger() {
  const completedTasks = await db.select().from(tasksTable).where(eq(tasksTable.completed, true));
  for (const task of completedTasks) {
    await db
      .insert(xpTransactionsTable)
      .values({
        dayId: task.dayId,
        taskId: task.id,
        kind: "legacy_completion",
        amount: task.xp,
        idempotencyKey: `legacy-task-${task.id}`,
      })
      .onConflictDoNothing({ target: xpTransactionsTable.idempotencyKey });
  }
}

async function xpLedger() {
  await ensureLegacyXpLedger();
  return db.select().from(xpTransactionsTable).orderBy(xpTransactionsTable.createdAt);
}

async function totalXp() {
  const transactions = await xpLedger();
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}

function mondayFor(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return shiftDate(dayKey, offset);
}

function chooseDoubleXpWeekdays(weekKey: string, count: number) {
  const seed = weekKey.split("-").reduce((total, value) => total + Number(value), 0);
  const weekdays = [1, 2, 3, 4, 5, 6, 0];
  return weekdays
    .map((weekday, index) => ({ weekday, order: (seed + index * 17) % 97 }))
    .sort((a, b) => a.order - b.order)
    .slice(0, Math.max(2, Math.min(4, count)))
    .map((item) => item.weekday)
    .sort((a, b) => a - b);
}

async function doubleXpForDay(dayKey: string, settings: { doubleXpDaysPerWeek: number }) {
  const weekKey = mondayFor(dayKey);
  const existing = await db
    .select()
    .from(doubleXpWeeksTable)
    .where(eq(doubleXpWeeksTable.weekKey, weekKey))
    .limit(1);
  let week = existing[0];
  if (!week) {
    await db
      .insert(doubleXpWeeksTable)
      .values({
        weekKey,
        weekdays: JSON.stringify(chooseDoubleXpWeekdays(weekKey, settings.doubleXpDaysPerWeek)),
      })
      .onConflictDoNothing({ target: doubleXpWeeksTable.weekKey });
    week = (await db
      .select()
      .from(doubleXpWeeksTable)
      .where(eq(doubleXpWeeksTable.weekKey, weekKey))
      .limit(1))[0];
  }
  const weekdays = JSON.parse(week?.weekdays ?? "[]") as number[];
  return weekdays.includes(new Date(`${dayKey}T12:00:00Z`).getUTCDay());
}

async function ensureSettings() {
  const existing = await db.select().from(plannerSettingsTable).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(plannerSettingsTable)
    .values({
      sleepTime: "23:00",
      wakeTime: "07:00",
      remindersEnabled: true,
      reminderFrequency: "60",
      theme: "dark",
      carryOver: false,
      doubleXpDaysPerWeek: 2,
      perfectDayBonus: 25,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    })
    .returning();
  return created;
}

async function createStarterChallenge() {
  const existing = await db.select().from(challengesTable).limit(1);
  if (existing[0]) return;
  const [challenge] = await db
    .insert(challengesTable)
    .values({ name: "14 Day Momentum", durationDays: 14, startDate: dateKey(localParts()) })
    .returning();
  await db.insert(challengeTasksTable).values([
    { challengeId: challenge.id, name: "Move for 20 minutes" },
    { challengeId: challenge.id, name: "Read 10 pages" },
  ]);
}

async function ensureChallengeTasks(dayId: number, dayKey: string) {
  const challenges = await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.status, "active"));
  for (const challenge of challenges) {
    const elapsed = Math.floor(
      (new Date(`${dayKey}T12:00:00Z`).getTime() - new Date(`${challenge.startDate}T12:00:00Z`).getTime()) /
        86400000,
    ) + 1;
    if (elapsed < 1 || elapsed > challenge.durationDays) continue;
    const challengeTasks = await db
      .select()
      .from(challengeTasksTable)
      .where(eq(challengeTasksTable.challengeId, challenge.id));
    for (let index = 0; index < challenge.durationDays; index += 1) {
      await db
        .insert(challengeDaysTable)
        .values({
          challengeId: challenge.id,
          dayNumber: index + 1,
          dayKey: shiftDate(challenge.startDate, index),
          totalTasks: challengeTasks.length,
        })
        .onConflictDoNothing();
    }
    for (const challengeTask of challengeTasks) {
      const existing = await db
        .select({ taskId: taskChallengesTable.taskId })
        .from(taskChallengesTable)
        .innerJoin(tasksTable, eq(tasksTable.id, taskChallengesTable.taskId))
        .where(
          and(
            eq(taskChallengesTable.challengeId, challenge.id),
            eq(tasksTable.dayId, dayId),
            eq(tasksTable.title, challengeTask.name),
          ),
        )
        .limit(1);
      if (existing[0]) continue;
      const [task] = await db
        .insert(tasksTable)
        .values({ dayId, title: challengeTask.name, xp: challengeTask.xp })
        .returning();
      await db.insert(taskChallengesTable).values({ taskId: task.id, challengeId: challenge.id });
    }
  }
}

async function finalizeDay(dayId: number, settings: typeof plannerSettingsTable.$inferSelect) {
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.dayId, dayId));
  const transactions = await db.select().from(xpTransactionsTable).where(eq(xpTransactionsTable.dayId, dayId));
  const completed = tasks.filter((task) => task.completed).length;
  const dailyXp = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const allXp = await totalXp();
  const rank = rankFor(allXp, (await db.select().from(tasksTable)).filter((task) => task.completed).length);
  const perfectDay = tasks.length > 0 && completed === tasks.length;
  const dailyScore = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const streak = await streakStats();
  await db
    .update(personalDaysTable)
    .set({
      archived: true,
      archivedAt: new Date(),
      dailyXp,
      levelAtEnd: rank.level,
      rankName: rank.name,
      dailyScore,
      perfectDay,
      doubleXp: (await db.select().from(personalDaysTable).where(eq(personalDaysTable.id, dayId)).limit(1))[0]?.doubleXp ?? false,
      streakAtEnd: streak.current,
    })
    .where(eq(personalDaysTable.id, dayId));
}

async function ensureCurrentDay() {
  const settings = await ensureSettings();
  await createStarterChallenge();
  const bounds = dayBounds(settings);
  const allDays = await db.select().from(personalDaysTable).orderBy(desc(personalDaysTable.id));
  const totalXpValue = await totalXp();
  const totalCompleted = (await db.select().from(tasksTable)).filter((task) => task.completed).length;
  let current = allDays.find((day) => day.dayKey === bounds.dayKey);
  if (!current) {
    const previous = allDays.find((day) => !day.archived);
    if (previous) {
      const tasks = await db.select().from(tasksTable).where(eq(tasksTable.dayId, previous.id));
      await finalizeDay(previous.id, settings);
      if (settings.carryOver) {
        const createdDayRows = await db
          .insert(personalDaysTable)
          .values({
            dayKey: bounds.dayKey,
            startsAt: bounds.startsAt,
            endsAt: bounds.endsAt,
            rankName: rankFor(totalXpValue, totalCompleted).name,
          })
          .onConflictDoNothing({ target: personalDaysTable.dayKey })
          .returning();
        const createdDay = createdDayRows[0] ?? (await db
          .select()
          .from(personalDaysTable)
          .where(eq(personalDaysTable.dayKey, bounds.dayKey))
          .limit(1))[0];
        current = createdDay;
        const incomplete = tasks.filter((task) => !task.completed);
        if (incomplete.length) {
          await db.insert(tasksTable).values(
            incomplete.map((task) => ({
              dayId: createdDay.id,
              title: task.title,
              notes: task.notes,
              xp: task.xp,
              priority: task.priority,
              category: task.category,
              durationMinutes: task.durationMinutes,
              isBoss: task.isBoss,
            })),
          );
        }
      }
    }
    if (!current) {
      const createdDayRows = await db
        .insert(personalDaysTable)
        .values({
          dayKey: bounds.dayKey,
          startsAt: bounds.startsAt,
          endsAt: bounds.endsAt,
          rankName: rankFor(totalXpValue, totalCompleted).name,
        })
        .onConflictDoNothing({ target: personalDaysTable.dayKey })
        .returning();
      current = createdDayRows[0] ?? (await db
        .select()
        .from(personalDaysTable)
        .where(eq(personalDaysTable.dayKey, bounds.dayKey))
        .limit(1))[0];
      if (allDays.length === 0) {
        await db.insert(tasksTable).values([
          { dayId: current.id, title: "Choose your one thing", notes: "Start with the task that makes everything else easier.", xp: 10 },
          { dayId: current.id, title: "Move for 20 minutes", notes: "A little movement changes the whole day.", xp: 15 },
          { dayId: current.id, title: "Read 10 pages", notes: null, xp: 10 },
        ]);
      }
    }
  } else {
    await db
      .update(personalDaysTable)
      .set({ startsAt: bounds.startsAt, endsAt: bounds.endsAt })
      .where(eq(personalDaysTable.id, current.id));
  }
  await ensureChallengeTasks(current.id, bounds.dayKey);
  await db
    .update(personalDaysTable)
    .set({ doubleXp: await doubleXpForDay(bounds.dayKey, settings) })
    .where(eq(personalDaysTable.id, current.id));
  return { settings, current, bounds };
}

async function taskResponse(task: typeof tasksTable.$inferSelect) {
  const memberships = await db
    .select({ challengeId: taskChallengesTable.challengeId })
    .from(taskChallengesTable)
    .where(eq(taskChallengesTable.taskId, task.id));
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    completed: task.completed,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    xp: task.xp,
    dayId: task.dayId,
    challengeIds: memberships.map((membership) => membership.challengeId),
    priority: task.priority,
    category: task.category,
    durationMinutes: task.durationMinutes,
    isBoss: task.isBoss,
  };
}

async function currentTasks(dayId: number) {
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.dayId, dayId));
  return Promise.all(tasks.map(taskResponse));
}

async function dayStats(dayId: number) {
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.dayId, dayId));
  const transactions = await db.select().from(xpTransactionsTable).where(eq(xpTransactionsTable.dayId, dayId));
  const completed = tasks.filter((task) => task.completed).length;
  return {
    completed,
    total: tasks.length,
    progressPercent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    xpEarned: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
  };
}

async function streakStats() {
  const days = await db
    .select()
    .from(personalDaysTable)
    .where(eq(personalDaysTable.archived, true))
    .orderBy(desc(personalDaysTable.dayKey));
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const [index, day] of days.entries()) {
    const stats = await dayStats(day.id);
    const nextDay = days[index - 1];
    if (nextDay && new Date(`${day.dayKey}T12:00:00Z`).getTime() - new Date(`${nextDay.dayKey}T12:00:00Z`).getTime() > 86400000) {
      run = 0;
    }
    if (stats.completed > 0) {
      run += 1;
      longest = Math.max(longest, run);
      if (index === 0 || current === run - 1) current = run;
    } else {
      run = 0;
      if (index === 0) current = 0;
    }
  }
  return { current, longest };
}

async function challengeResponse(challenge: typeof challengesTable.$inferSelect) {
  const taskNamesRows = await db
    .select()
    .from(challengeTasksTable)
    .where(eq(challengeTasksTable.challengeId, challenge.id));
  const { current, bounds } = await ensureCurrentDay();
  const dayNumber = Math.min(
    challenge.durationDays,
    Math.max(
      1,
      Math.floor(
        (new Date(`${bounds.dayKey}T12:00:00Z`).getTime() -
          new Date(`${challenge.startDate}T12:00:00Z`).getTime()) /
          86400000,
      ) + 1,
    ),
  );
  const memberships = await db
    .select({ taskId: taskChallengesTable.taskId })
    .from(taskChallengesTable)
    .where(eq(taskChallengesTable.challengeId, challenge.id));
  const challengeTaskIds = memberships.map((item) => item.taskId);
  const linkedTasks = challengeTaskIds.length
    ? await db.select().from(tasksTable).where(inArray(tasksTable.id, challengeTaskIds))
    : [];
  const completedTasks = linkedTasks.filter((task) => task.completed).length;
  const totalTasks = Math.max(1, dayNumber * taskNamesRows.length);
  return {
    id: challenge.id,
    name: challenge.name,
    durationDays: challenge.durationDays,
    dayNumber,
    remainingDays: Math.max(0, challenge.durationDays - dayNumber),
    completedTasks,
    totalTasks,
    progressPercent: Math.min(100, Math.round((completedTasks / totalTasks) * 100)),
    status: challenge.status,
    taskNames: taskNamesRows.map((item) => item.name),
    currentDayId: current.id,
  };
}

async function statsResponse() {
  const days = await db.select().from(personalDaysTable).orderBy(personalDaysTable.dayKey);
  const tasks = await db.select().from(tasksTable);
  const ledger = await xpLedger();
  const totalXpValue = ledger.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalCompleted = tasks.filter((task) => task.completed).length;
  const totalUnfinished = tasks.filter((task) => !task.completed).length;
  const currentRank = rankFor(totalXpValue, totalCompleted);
  const daily = await Promise.all(days.slice(-7).map(async (day) => ({ label: dateLabel(day.dayKey), value: (await dayStats(day.id)).xpEarned })));
  const weekly = daily.map((point, index) => ({ label: `W${index + 1}`, value: point.value }));
  const monthly = daily.slice(-6).map((point) => ({ label: point.label.split(" ")[0], value: point.value }));
  let cumulative = 0;
  const rankHistory = await Promise.all(
    days.slice(-7).map(async (day) => {
      cumulative += (await dayStats(day.id)).xpEarned;
      return { label: dateLabel(day.dayKey), value: cumulative };
    }),
  );
  const archivedDays = days.filter((day) => day.archived);
  const perfectDays = archivedDays.filter((day) => day.perfectDay).length;
  const doubleXpXpEarned = ledger
    .filter((transaction) => transaction.amount > 0 && transaction.kind === "task_completion")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    totalCompleted,
    totalUnfinished,
    averagePerDay: days.length ? Math.round((totalCompleted / days.length) * 10) / 10 : 0,
    completionPercent: tasks.length ? Math.round((totalCompleted / tasks.length) * 100) : 0,
    totalXp: totalXpValue,
    currentLevel: currentRank.level,
    currentRank: currentRank.name,
    xpToNextLevel: currentRank.xpToNextLevel,
    perfectDays,
    averageXpPerDay: days.length ? Math.round((totalXpValue / days.length) * 10) / 10 : 0,
    doubleXpXpEarned,
    ...(await streakStats()),
    daily,
    weekly,
    monthly,
    rankHistory,
  };
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const { settings, current, bounds } = await ensureCurrentDay();
  const tasks = await currentTasks(current.id);
  const allTasks = await db.select().from(tasksTable);
  const totalCompleted = allTasks.filter((task) => task.completed).length;
  const totalXpValue = await totalXp();
  const remainingTasks = tasks.length - tasks.filter((task) => task.completed).length;
  const now = new Date();
  const minutesUntilSleep = Math.max(0, Math.round((bounds.endsAt.getTime() - new Date(Date.UTC(localParts(now).year, localParts(now).month - 1, localParts(now).day, Math.floor(localParts(now).minutes / 60), localParts(now).minutes % 60)).getTime()) / 60000));
  const reminderKey = remainingTasks === 0 ? "done" : remainingTasks === 1 ? "one" : remainingTasks === 2 ? "two" : "many";
  const urgency = minutesUntilSleep <= 10 ? "final" : minutesUntilSleep <= 60 ? "urgent" : minutesUntilSleep <= 180 ? "soon" : "steady";
  const dayData = {
    id: current.id,
    label: current.dayKey,
    dateLabel: dateLabel(current.dayKey),
    completed: tasks.filter((task) => task.completed).length,
    total: tasks.length,
    progressPercent: tasks.length ? Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100) : 0,
    endsAt: bounds.endsAt.toISOString(),
    hoursRemaining: Math.round((minutesUntilSleep / 60) * 10) / 10,
    doubleXp: current.doubleXp,
  };
  const response = {
    day: dayData,
    tasks,
    rank: rankFor(totalXpValue, totalCompleted),
    streak: await streakStats(),
    reminder: {
      message: pick(REMINDERS[reminderKey as keyof typeof REMINDERS], totalCompleted + remainingTasks),
      urgency,
      minutesUntilSleep,
    },
    settings: {
      id: settings.id,
      sleepTime: settings.sleepTime,
      wakeTime: settings.wakeTime,
      remindersEnabled: settings.remindersEnabled,
      reminderFrequency: settings.reminderFrequency,
      theme: settings.theme,
      carryOver: settings.carryOver,
      doubleXpDaysPerWeek: settings.doubleXpDaysPerWeek,
      perfectDayBonus: settings.perfectDayBonus,
      quietHoursStart: settings.quietHoursStart,
      quietHoursEnd: settings.quietHoursEnd,
    },
  };
  res.json(GetDashboardResponse.parse(response));
});

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await ensureSettings();
  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await ensureSettings();
  const [updated] = await db
    .update(plannerSettingsTable)
    .set(parsed.data)
    .where(eq(plannerSettingsTable.id, settings.id))
    .returning();
  await ensureCurrentDay();
  res.json(UpdateSettingsResponse.parse(updated));
});

router.get("/tasks", async (_req, res): Promise<void> => {
  const { current } = await ensureCurrentDay();
  res.json(ListTasksResponse.parse(await currentTasks(current.id)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { current } = await ensureCurrentDay();
  const [task] = await db
    .insert(tasksTable)
    .values({
      dayId: current.id,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      xp: parsed.data.xp,
      priority: parsed.data.priority ?? "normal",
      category: parsed.data.category ?? "Personal",
      durationMinutes: parsed.data.durationMinutes ?? null,
      isBoss: parsed.data.isBoss ?? false,
    })
    .returning();
  if (parsed.data.challengeIds?.length) {
    await db.insert(taskChallengesTable).values(
      parsed.data.challengeIds.map((challengeId) => ({ taskId: task.id, challengeId })),
    );
  }
  res.status(201).json(CreateTaskResponse.parse(await taskResponse(task)));
});

router.patch("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid task update" });
    return;
  }
  const { current } = await ensureCurrentDay();
  const currentTask = (await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.dayId, current.id)))
    .limit(1))[0];
  if (!currentTask) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const [updated] = await db
    .update(tasksTable)
    .set({
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes ?? null } : {}),
      ...(parsed.data.xp !== undefined ? { xp: parsed.data.xp } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.durationMinutes !== undefined ? { durationMinutes: parsed.data.durationMinutes ?? null } : {}),
      ...(parsed.data.isBoss !== undefined ? { isBoss: parsed.data.isBoss } : {}),
    })
    .where(eq(tasksTable.id, currentTask.id))
    .returning();
  if (parsed.data.challengeIds) {
    await db.delete(taskChallengesTable).where(eq(taskChallengesTable.taskId, currentTask.id));
    if (parsed.data.challengeIds.length) {
      await db.insert(taskChallengesTable).values(
        parsed.data.challengeIds.map((challengeId) => ({ taskId: currentTask.id, challengeId })),
      );
    }
  }
  res.json(UpdateTaskResponse.parse(await taskResponse(updated)));
});

router.delete("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { current } = await ensureCurrentDay();
  const [deleted] = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.dayId, current.id)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/tasks/:taskId/complete", async (req, res): Promise<void> => {
  const params = CompleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsedBody = CompleteTaskBody.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ error: "Invalid completion request" });
    return;
  }
  const { current } = await ensureCurrentDay();
  const beforeTotalXp = await totalXp();
  const beforeRank = rankFor(beforeTotalXp);
  const day = (await db
    .select()
    .from(personalDaysTable)
    .where(eq(personalDaysTable.id, current.id))
    .limit(1))[0];
  const requestedKey =
    parsedBody.data.idempotencyKey ??
    `task-${params.data.taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const priorTransaction = await db
    .select({ taskId: xpTransactionsTable.taskId })
    .from(xpTransactionsTable)
    .where(eq(xpTransactionsTable.idempotencyKey, requestedKey))
    .limit(1);
  if (priorTransaction[0]) {
    const existingTask = (await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, params.data.taskId))
      .limit(1))[0];
    if (!existingTask) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const existingTotalXp = await totalXp();
    const existingRank = rankFor(existingTotalXp);
    res.json(
      CompleteTaskResponse.parse({
        ...(await taskResponse(existingTask)),
        earnedXp: 0,
        level: existingRank.level,
        rank: existingRank.name,
        leveledUp: false,
        rankedUp: false,
        perfectDay: day?.perfectDay ?? false,
        doubleXp: day?.doubleXp ?? false,
      }),
    );
    return;
  }
  const currentTask = (await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.dayId, current.id)))
    .limit(1))[0];
  if (!currentTask) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const nextCompleted = parsedBody.data.completed ?? !currentTask.completed;
  if (nextCompleted === currentTask.completed) {
    const rank = rankFor(beforeTotalXp);
    res.json(
      CompleteTaskResponse.parse({
        ...(await taskResponse(currentTask)),
        earnedXp: 0,
        level: rank.level,
        rank: rank.name,
        leveledUp: false,
        rankedUp: false,
        perfectDay: day?.perfectDay ?? false,
        doubleXp: day?.doubleXp ?? false,
      }),
    );
    return;
  }
  if (!day) {
    res.status(404).json({ error: "Personal day not found" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [nextTask] = await tx
      .update(tasksTable)
      .set({
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date() : null,
      })
      .where(eq(tasksTable.id, currentTask.id))
      .returning();

    if (nextCompleted) {
      const earnedXp = currentTask.xp * (day.doubleXp ? 2 : 1);
      await tx.insert(xpTransactionsTable).values({
        dayId: currentTask.dayId,
        taskId: currentTask.id,
        kind: "task_completion",
        amount: earnedXp,
        idempotencyKey: requestedKey,
      });
      const dayTasks = await tx
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.dayId, currentTask.dayId));
      if (dayTasks.length > 0 && dayTasks.every((task) => task.completed)) {
        const [bonus] = await tx
          .select()
          .from(plannerSettingsTable)
          .limit(1);
        if (bonus && bonus.perfectDayBonus > 0) {
          await tx
            .insert(xpTransactionsTable)
            .values({
              dayId: currentTask.dayId,
              kind: "perfect_day",
              amount: bonus.perfectDayBonus,
              idempotencyKey: `perfect-day-${currentTask.dayId}`,
            })
            .onConflictDoNothing({ target: xpTransactionsTable.idempotencyKey });
          await tx
            .update(personalDaysTable)
            .set({ perfectDay: true })
            .where(eq(personalDaysTable.id, currentTask.dayId));
        }
      }
    } else {
      const latestPositive = (await tx
        .select()
        .from(xpTransactionsTable)
        .where(
          and(
            eq(xpTransactionsTable.taskId, currentTask.id),
            eq(xpTransactionsTable.dayId, currentTask.dayId),
          ),
        )
        .orderBy(desc(xpTransactionsTable.createdAt))
        .limit(1))[0];
      await tx.insert(xpTransactionsTable).values({
        dayId: currentTask.dayId,
        taskId: currentTask.id,
        kind: "task_reversal",
        amount: latestPositive && latestPositive.amount > 0 ? -latestPositive.amount : 0,
        idempotencyKey: requestedKey,
      });
      const dayTasks = await tx
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.dayId, currentTask.dayId));
      if (dayTasks.some((task) => !task.completed)) {
        await tx
          .update(personalDaysTable)
          .set({ perfectDay: false })
          .where(eq(personalDaysTable.id, currentTask.dayId));
        await tx
          .insert(xpTransactionsTable)
          .values({
            dayId: currentTask.dayId,
            kind: "perfect_day_reversal",
            amount: -(await ensureSettings()).perfectDayBonus,
            idempotencyKey: `perfect-day-reversal-${currentTask.dayId}-${requestedKey}`,
          })
          .onConflictDoNothing({ target: xpTransactionsTable.idempotencyKey });
      }
    }
    return nextTask;
  });
  const afterTotalXp = await totalXp();
  const afterTasks = await db.select().from(tasksTable);
  const afterRank = rankFor(afterTotalXp, afterTasks.filter((task) => task.completed).length);
  const afterDay = (await db
    .select()
    .from(personalDaysTable)
    .where(eq(personalDaysTable.id, currentTask.dayId))
    .limit(1))[0];
  res.json(
    CompleteTaskResponse.parse({
      ...(await taskResponse(updated)),
      earnedXp: afterTotalXp - beforeTotalXp,
      level: afterRank.level,
      rank: afterRank.name,
      leveledUp: afterRank.level > beforeRank.level,
      rankedUp: afterRank.name !== beforeRank.name,
      perfectDay: afterDay?.perfectDay ?? false,
      doubleXp: day.doubleXp,
    }),
  );
});

router.get("/history", async (_req, res): Promise<void> => {
  await ensureCurrentDay();
  const days = await db
    .select()
    .from(personalDaysTable)
    .where(eq(personalDaysTable.archived, true))
    .orderBy(desc(personalDaysTable.dayKey));
  const response = await Promise.all(days.map(async (day) => {
    const stats = await dayStats(day.id);
    return {
      id: day.id,
      dateLabel: dateLabel(day.dayKey),
      ...stats,
      levelAtEnd: day.levelAtEnd,
      rankName: day.rankName,
      dailyScore: day.dailyScore,
      perfectDay: day.perfectDay,
      doubleXp: day.doubleXp,
      streakAtEnd: day.streakAtEnd,
    };
  }));
  res.json(ListHistoryResponse.parse(response));
});

router.get("/history/:dayId", async (req, res): Promise<void> => {
  const params = GetHistoryDayParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const day = (await db.select().from(personalDaysTable).where(eq(personalDaysTable.id, params.data.dayId)).limit(1))[0];
  if (!day) {
    res.status(404).json({ error: "Day not found" });
    return;
  }
  const stats = await dayStats(day.id);
  const tasks = await currentTasks(day.id);
  res.json(GetHistoryDayResponse.parse({
    id: day.id,
    dateLabel: dateLabel(day.dayKey),
    ...stats,
    tasks,
    rankName: day.rankName,
    notes: null,
  }));
});

router.get("/challenges", async (_req, res): Promise<void> => {
  await ensureCurrentDay();
  const challenges = await db.select().from(challengesTable).orderBy(desc(challengesTable.id));
  res.json(ListChallengesResponse.parse(await Promise.all(challenges.map(challengeResponse))));
});

router.post("/challenges", async (req, res): Promise<void> => {
  const parsed = CreateChallengeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { current, bounds } = await ensureCurrentDay();
  const [challenge] = await db
    .insert(challengesTable)
    .values({
      name: parsed.data.name,
      durationDays: parsed.data.durationDays,
      startDate: bounds.dayKey,
      status: "active",
    })
    .returning();
  if (parsed.data.taskNames.length) {
    await db.insert(challengeTasksTable).values(
      parsed.data.taskNames.map((name) => ({ challengeId: challenge.id, name })),
    );
  }
  await ensureChallengeTasks(current.id, bounds.dayKey);
  res.status(201).json(CreateChallengeResponse.parse(await challengeResponse(challenge)));
});

router.get("/challenges/:challengeId", async (req, res): Promise<void> => {
  const params = GetChallengeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const challenge = (await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.id, params.data.challengeId))
    .limit(1))[0];
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }
  const base = await challengeResponse(challenge);
  const memberships = await db
    .select({ taskId: taskChallengesTable.taskId })
    .from(taskChallengesTable)
    .where(eq(taskChallengesTable.challengeId, challenge.id));
  const linkedTasks = memberships.length
    ? await db.select().from(tasksTable).where(inArray(tasksTable.id, memberships.map((item) => item.taskId)))
    : [];
  const linkedDays = await db.select().from(personalDaysTable);
  const history = await Promise.all(
    linkedDays.slice(-challenge.durationDays).map(async (day, index) => {
      const tasks = linkedTasks.filter((task) => task.dayId === day.id);
      const total = (await db.select().from(challengeTasksTable).where(eq(challengeTasksTable.challengeId, challenge.id))).length;
      const completed = tasks.filter((task) => task.completed).length;
      return { dayNumber: index + 1, dateLabel: dateLabel(day.dayKey), completed, total, progressPercent: total ? Math.round((completed / total) * 100) : 0 };
    }),
  );
  const response = {
    ...base,
    history,
    bestDay: history.length ? history.reduce((best, item) => item.progressPercent > best.progressPercent ? item : best).dateLabel : null,
    worstDay: history.length ? history.reduce((worst, item) => item.progressPercent < worst.progressPercent ? item : worst).dateLabel : null,
    consistency: history.length ? Math.round((history.filter((item) => item.progressPercent === 100).length / history.length) * 100) : 0,
  };
  res.json(GetChallengeResponse.parse(response));
});

router.get("/stats", async (_req, res): Promise<void> => {
  await ensureCurrentDay();
  res.json(GetStatsResponse.parse(await statsResponse()));
});

export default router;