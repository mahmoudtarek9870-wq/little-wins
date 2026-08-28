# Little Wins — Phase 2 Notifications

Implemented in the current project:

- Expo SDK 54-compatible `expo-notifications` dependency (`~0.32.17`).
- Android notification channel `little-wins-reminders`.
- Android notification permission request/status handling.
- Real local Android reminder scheduling.
- Reminder frequency controls for 30/60/120 minutes.
- Notification cancellation when reminders are disabled or all tasks are complete.
- Reconciliation on app launch and foreground resume.
- Reconciliation after dashboard/task data changes.
- Quiet-hours filtering using the existing planner settings.
- Wake/sleep-aware scheduling, including personal days crossing midnight.
- Dynamic message pools based on remaining tasks, Level, streak, Double XP, and time to sleep.
- Double XP reminder messages.
- Deduplication by cancelling the app's previously scheduled reminder set before rescheduling.
- `SCHEDULE_EXACT_ALARM` Android permission in Expo config for scheduled date triggers.
- Backend/settings default reminder frequency normalized from `balanced` to `60` for new settings rows.

Important limitation:

Scheduled local notifications are OS-managed once scheduled, so if the user completes tasks while the app remains fully closed, already-scheduled messages can become stale until the app next reconciles them. The app reconciles on launch/foreground and after task/settings changes. True server-driven/dynamic closed-app notifications would require a remote push service/backend or a native background execution strategy beyond this local-notification implementation.

Installation:

The mobile package now declares `expo-notifications ~0.32.17`, which is the Expo SDK 54 recommended version. Run the workspace package install before building the Android binary so the lockfile/dependency tree is regenerated if needed.
