import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plannerSettingsTable = pgTable("planner_settings", {
  id: serial("id").primaryKey(),
  sleepTime: text("sleep_time").notNull().default("23:00"),
  wakeTime: text("wake_time").notNull().default("07:00"),
  remindersEnabled: boolean("reminders_enabled").notNull().default(true),
  reminderFrequency: text("reminder_frequency").notNull().default("60"),
  theme: text("theme").notNull().default("dark"),
  carryOver: boolean("carry_over").notNull().default(false),
  doubleXpDaysPerWeek: integer("double_xp_days_per_week").notNull().default(2),
  perfectDayBonus: integer("perfect_day_bonus").notNull().default(25),
  quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("07:00"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const personalDaysTable = pgTable("personal_days", {
  id: serial("id").primaryKey(),
  dayKey: date("day_key", { mode: "string" }).notNull().unique(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  archived: boolean("archived").notNull().default(false),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  dailyXp: integer("daily_xp").notNull().default(0),
  levelAtEnd: integer("level_at_end").notNull().default(1),
  rankName: text("rank_name").notNull().default("BEGINNER"),
  dailyScore: integer("daily_score").notNull().default(0),
  perfectDay: boolean("perfect_day").notNull().default(false),
  doubleXp: boolean("double_xp").notNull().default(false),
  streakAtEnd: integer("streak_at_end").notNull().default(0),
});

export const tasksTable = pgTable("planner_tasks", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id")
    .notNull()
    .references(() => personalDaysTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  xp: integer("xp").notNull().default(10),
  priority: text("priority").notNull().default("normal"),
  category: text("category").notNull().default("Personal"),
  durationMinutes: integer("duration_minutes"),
  isBoss: boolean("is_boss").notNull().default(false),
});

export const xpTransactionsTable = pgTable(
  "xp_transactions",
  {
    id: serial("id").primaryKey(),
    dayId: integer("day_id")
      .notNull()
      .references(() => personalDaysTable.id, { onDelete: "cascade" }),
    taskId: integer("task_id").references(() => tasksTable.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    amount: integer("amount").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("xp_transactions_idempotency_key_idx").on(table.idempotencyKey)],
);

export const achievementsTable = pgTable("planner_achievements", {
  id: serial("id").primaryKey(),
  achievementKey: text("achievement_key").notNull().unique(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const doubleXpWeeksTable = pgTable("double_xp_weeks", {
  id: serial("id").primaryKey(),
  weekKey: date("week_key", { mode: "string" }).notNull().unique(),
  weekdays: text("weekdays").notNull(),
});

export const challengesTable = pgTable("planner_challenges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  durationDays: integer("duration_days").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("active"),
});

export const challengeTasksTable = pgTable("challenge_tasks", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => challengesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  xp: integer("xp").notNull().default(15),
});

export const taskChallengesTable = pgTable(
  "task_challenges",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challengesTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.challengeId] })],
);

export const challengeDaysTable = pgTable(
  "challenge_days",
  {
    id: serial("id").primaryKey(),
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challengesTable.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    dayKey: date("day_key", { mode: "string" }).notNull(),
    totalTasks: integer("total_tasks").notNull().default(0),
    completedTasks: integer("completed_tasks").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("challenge_days_challenge_day_idx").on(
      table.challengeId,
      table.dayNumber,
    ),
    index("challenge_days_day_key_idx").on(table.dayKey),
  ],
);

export const insertPlannerSettingsSchema = createInsertSchema(
  plannerSettingsTable,
).omit({ id: true, updatedAt: true });
export type InsertPlannerSettings = z.infer<
  typeof insertPlannerSettingsSchema
>;

export const insertPersonalDaySchema = createInsertSchema(
  personalDaysTable,
).omit({ id: true });
export type InsertPersonalDay = z.infer<typeof insertPersonalDaySchema>;

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;

export const insertChallengeSchema = createInsertSchema(
  challengesTable,
).omit({ id: true });
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;

export const insertChallengeTaskSchema = createInsertSchema(
  challengeTasksTable,
).omit({ id: true });
export type InsertChallengeTask = z.infer<typeof insertChallengeTaskSchema>;

export type PlannerSettings = typeof plannerSettingsTable.$inferSelect;
export type PersonalDay = typeof personalDaysTable.$inferSelect;
export type PlannerTask = typeof tasksTable.$inferSelect;
export type XpTransaction = typeof xpTransactionsTable.$inferSelect;
export type Achievement = typeof achievementsTable.$inferSelect;
export type DoubleXpWeek = typeof doubleXpWeeksTable.$inferSelect;
export type Challenge = typeof challengesTable.$inferSelect;
export type ChallengeTask = typeof challengeTasksTable.$inferSelect;
export type ChallengeDay = typeof challengeDaysTable.$inferSelect;