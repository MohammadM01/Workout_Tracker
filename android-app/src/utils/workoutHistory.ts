import { getDynamicProgramForDay } from '../engine/planGenerator';
import type { CardioLog, DayLog, DayOfWeek, ExerciseSetLog, UserProfile } from '../types/models';
import { parseDateKey } from './date';

export function getEmptyDayLog(): DayLog {
  return {
    exercises: {},
    cardio: { done: false, minutes: '' },
    steps: '',
    proteinGrams: '',
  };
}

export function getLastExerciseRecord(
  logs: Record<string, DayLog>,
  exId: string,
  isViewingToday: boolean,
  todayKey: string
): { date: string; sets: ExerciseSetLog[] } | null {
  const dates = Object.keys(logs).sort().reverse();
  for (const d of dates) {
    if (isViewingToday && d >= todayKey) continue;
    const rec = logs[d]?.exercises?.[exId];
    if (!rec || !Array.isArray(rec)) continue;
    if (rec.some((s) => s && (s.w !== '' || s.r !== '' || s.done))) {
      return { date: d, sets: rec };
    }
  }
  return null;
}

export function getLastCardioRecord(
  logs: Record<string, DayLog>,
  dow: DayOfWeek,
  isViewingToday: boolean,
  todayKey: string
): ({ date: string } & CardioLog) | null {
  const dates = Object.keys(logs).sort().reverse();
  for (const d of dates) {
    if (isViewingToday && d >= todayKey) continue;
    if (parseDateKey(d).getDay() !== dow) continue;
    const c = logs[d]?.cardio;
    if (c && (c.done || c.minutes)) {
      return { date: d, ...c };
    }
  }
  return null;
}

export function calculateDayProgress(
  dow: DayOfWeek,
  dayLog: DayLog | null,
  profile: UserProfile
) {
  const plan = getDynamicProgramForDay(dow, profile);
  let total = 0;
  let done = 0;
  const allEx = [...plan.lifts, ...plan.core];

  for (const ex of allEx) {
    total += ex.sets;
    if (dayLog) {
      const rec = dayLog.exercises[ex.id] || [];
      for (let i = 0; i < ex.sets; i++) {
        if (rec[i]?.done) done++;
      }
    }
  }

  if (plan.cardioType) {
    total += 1;
    if (dayLog?.cardio?.done) done++;
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}
