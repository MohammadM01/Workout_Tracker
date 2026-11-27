import * as SQLite from 'expo-sqlite';
import type { DayLog, WeightEntry, WorkoutState } from '../types/models';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  pin_hash: string | null;
  biometric_enabled: number;
  start_weight_kg: number;
  age: number;
  height_ft: string;
  height_cm: number;
  sex: string;
  experience: string;
  goal: string;
  created_at: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function ensureUserColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users)');
  const names = new Set(cols.map((c) => c.name));

  if (!names.has('height_cm')) {
    await db.execAsync('ALTER TABLE users ADD COLUMN height_cm REAL NOT NULL DEFAULT 171.0');
  }
  if (!names.has('sex')) {
    await db.execAsync("ALTER TABLE users ADD COLUMN sex TEXT NOT NULL DEFAULT 'male'");
  }
  if (!names.has('experience')) {
    await db.execAsync(
      "ALTER TABLE users ADD COLUMN experience TEXT NOT NULL DEFAULT 'intermediate'"
    );
  }
  if (!names.has('goal')) {
    await db.execAsync("ALTER TABLE users ADD COLUMN goal TEXT NOT NULL DEFAULT 'recomp'");
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('gymlog_android.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          pin_hash TEXT,
          biometric_enabled INTEGER NOT NULL DEFAULT 0,
          start_weight_kg REAL NOT NULL DEFAULT 89.0,
          age INTEGER NOT NULL DEFAULT 22,
          height_ft TEXT NOT NULL DEFAULT '5.62',
          height_cm REAL NOT NULL DEFAULT 171.0,
          sex TEXT NOT NULL DEFAULT 'male',
          experience TEXT NOT NULL DEFAULT 'intermediate',
          goal TEXT NOT NULL DEFAULT 'recomp',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_state (
          user_id TEXT PRIMARY KEY NOT NULL,
          active_week INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS day_logs (
          user_id TEXT NOT NULL,
          date_key TEXT NOT NULL,
          exercises_json TEXT NOT NULL,
          cardio_done INTEGER NOT NULL DEFAULT 0,
          cardio_minutes TEXT NOT NULL DEFAULT '',
          steps TEXT NOT NULL DEFAULT '',
          PRIMARY KEY (user_id, date_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS weights (
          user_id TEXT NOT NULL,
          date_key TEXT NOT NULL,
          kg REAL NOT NULL,
          PRIMARY KEY (user_id, date_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      await ensureUserColumns(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function loadUserWorkoutState(userId: string): Promise<WorkoutState> {
  const db = await getDatabase();

  const stateRow = await db.getFirstAsync<{ active_week: number }>(
    'SELECT active_week FROM user_state WHERE user_id = ?',
    [userId]
  );

  const logRows = await db.getAllAsync<{
    date_key: string;
    exercises_json: string;
    cardio_done: number;
    cardio_minutes: string;
    steps: string;
  }>(
    'SELECT date_key, exercises_json, cardio_done, cardio_minutes, steps FROM day_logs WHERE user_id = ?',
    [userId]
  );

  const weightRows = await db.getAllAsync<{ date_key: string; kg: number }>(
    'SELECT date_key, kg FROM weights WHERE user_id = ? ORDER BY date_key DESC',
    [userId]
  );

  const logs: Record<string, DayLog> = {};
  for (const row of logRows) {
    let parsedRaw: Record<string, unknown> = {};
    try {
      parsedRaw = JSON.parse(row.exercises_json || '{}');
    } catch {
      parsedRaw = {};
    }
    const proteinGrams =
      typeof parsedRaw.__proteinGrams === 'string' ? parsedRaw.__proteinGrams : '';
    const exercises: Record<string, DayLog['exercises'][string]> = {};
    for (const [k, v] of Object.entries(parsedRaw)) {
      if (k !== '__proteinGrams' && Array.isArray(v)) {
        exercises[k] = v;
      }
    }

    logs[row.date_key] = {
      exercises,
      cardio: {
        done: row.cardio_done === 1,
        minutes: row.cardio_minutes ?? '',
      },
      steps: row.steps ?? '',
      proteinGrams,
    };
  }

  const weights: WeightEntry[] = weightRows.map((w) => ({
    date: w.date_key,
    kg: w.kg,
  }));

  return {
    activeWeek: stateRow?.active_week ?? 1,
    logs,
    weights,
  };
}

export async function saveActiveWeek(userId: string, week: number): Promise<void> {
  const db = await getDatabase();
  const clamped = Math.max(1, Math.min(12, Math.round(week)));
  await db.runAsync(
    `INSERT INTO user_state (user_id, active_week, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET active_week = excluded.active_week, updated_at = excluded.updated_at`,
    [userId, clamped, new Date().toISOString()]
  );
}

export async function saveDayLog(userId: string, dateKey: string, dayLog: DayLog): Promise<void> {
  const db = await getDatabase();
  const payload = {
    ...(dayLog.exercises || {}),
    ...(dayLog.proteinGrams ? { __proteinGrams: dayLog.proteinGrams } : {}),
  };
  await db.runAsync(
    `INSERT INTO day_logs (user_id, date_key, exercises_json, cardio_done, cardio_minutes, steps)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date_key) DO UPDATE SET
       exercises_json = excluded.exercises_json,
       cardio_done = excluded.cardio_done,
       cardio_minutes = excluded.cardio_minutes,
       steps = excluded.steps`,
    [
      userId,
      dateKey,
      JSON.stringify(payload),
      dayLog.cardio?.done ? 1 : 0,
      dayLog.cardio?.minutes ?? '',
      dayLog.steps ?? '',
    ]
  );
}

export async function saveWeightEntry(userId: string, dateKey: string, kg: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO weights (user_id, date_key, kg)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, date_key) DO UPDATE SET kg = excluded.kg`,
    [userId, dateKey, kg]
  );
}

export async function importUserBackup(userId: string, payload: unknown): Promise<WorkoutState> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup payload');
  }
  const parsed = payload as Partial<WorkoutState>;
  if (!parsed.logs || typeof parsed.logs !== 'object') {
    throw new Error('Backup missing logs object');
  }

  const activeWeek =
    typeof parsed.activeWeek === 'number' && parsed.activeWeek >= 1 && parsed.activeWeek <= 12
      ? Math.round(parsed.activeWeek)
      : 1;

  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM day_logs WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM weights WHERE user_id = ?', [userId]);

    await db.runAsync(
      `INSERT INTO user_state (user_id, active_week, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET active_week = excluded.active_week, updated_at = excluded.updated_at`,
      [userId, activeWeek, new Date().toISOString()]
    );

    for (const [dateKey, log] of Object.entries(parsed.logs!)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !log) continue;
      const exPayload = {
        ...(log.exercises || {}),
        ...(log.proteinGrams ? { __proteinGrams: log.proteinGrams } : {}),
      };
      await db.runAsync(
        `INSERT INTO day_logs (user_id, date_key, exercises_json, cardio_done, cardio_minutes, steps)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          dateKey,
          JSON.stringify(exPayload),
          log.cardio?.done ? 1 : 0,
          String(log.cardio?.minutes ?? ''),
          String(log.steps ?? ''),
        ]
      );
    }

    if (Array.isArray(parsed.weights)) {
      for (const w of parsed.weights) {
        if (!w || typeof w.date !== 'string' || typeof w.kg !== 'number' || isNaN(w.kg)) continue;
        await db.runAsync(
          `INSERT INTO weights (user_id, date_key, kg)
           VALUES (?, ?, ?)
           ON CONFLICT(user_id, date_key) DO UPDATE SET kg = excluded.kg`,
          [userId, w.date, Math.round(w.kg * 10) / 10]
        );
      }
    }
  });

  return loadUserWorkoutState(userId);
}

export async function eraseUserLogs(userId: string): Promise<WorkoutState> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM day_logs WHERE user_id = ?', [userId]);
    await db.runAsync('DELETE FROM weights WHERE user_id = ?', [userId]);
    await db.runAsync(
      `INSERT INTO user_state (user_id, active_week, updated_at)
       VALUES (?, 1, ?)
       ON CONFLICT(user_id) DO UPDATE SET active_week = 1, updated_at = excluded.updated_at`,
      [userId, new Date().toISOString()]
    );
  });
  return { activeWeek: 1, logs: {}, weights: [] };
}
