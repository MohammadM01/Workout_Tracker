export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CardioType = 'treadmill' | 'cycle' | 'flush' | 'sat_cycle' | 'walk_recovery';

export type Sex = 'male' | 'female';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type FitnessGoal = 'recomp' | 'fat_loss' | 'lean_bulk';

export type DietPreference = 'non_veg' | 'eggetarian' | 'veg';

export type AIProvider = 'offline' | 'gemini' | 'openai';

export interface ExerciseSpec {
  id: string;
  name: string;
  sets: number;
  target: string;
  rest: number;
  cue: string;
  weighted?: boolean;
  repLabel?: 'Reps' | 'Sec';
  posture?: boolean;
}

export interface DayProgram {
  title: string;
  subtitle: string;
  lifts: ExerciseSpec[];
  coreLabel: string | null;
  core: ExerciseSpec[];
  cardioType: CardioType | null;
}

export interface PhaseConfig {
  phase: 1 | 2 | 3;
  label: string;
  steps: number;
  treadmillMin: number;
  treadmillSpec: string;
  cycleMin: number;
  cycleSpec: string;
  wedFlushMin: number;
  satCycleMin: number;
  satSpec: string;
}

export interface ExerciseSetLog {
  w: string;
  r: string;
  done: boolean;
}

export interface CardioLog {
  done: boolean;
  minutes: string;
}

export interface DayLog {
  exercises: Record<string, ExerciseSetLog[]>;
  cardio: CardioLog;
  steps: string;
  proteinGrams?: string;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  kg: number;
}

export interface WorkoutState {
  activeWeek: number;
  logs: Record<string, DayLog>;
  weights: WeightEntry[];
}

export interface UserProfile {
  age: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  experience: ExperienceLevel;
  goal: FitnessGoal;
}

export interface UserAccount extends UserProfile {
  id: string;
  name: string;
  email: string;
  biometricEnabled: boolean;
  hasPin: boolean;
  createdAt: string;
}

export interface RestTimerState {
  active: boolean;
  paused: boolean;
  endAt: number;
  remainingMs: number;
  label: string;
}

export interface PersonalizedTargets {
  bmi: number;
  bmiLabel: string;
  bmr: number;
  tdee: number;
  dailyCalories: number;
  calorieDelta: number;
  calorieLabel: string;
  weeklyRateKg: string;
  proteinMinG: number;
  proteinMaxG: number;
  proteinTargetG: number;
  waterLiters: number;
  hrMax: number;
  zone2MinBpm: number;
  zone2MaxBpm: number;
  projectedEndMinKg: number;
  projectedEndMaxKg: number;
  outlookHeadline: string;
  outlookDetail: string;
  splitSummary: string;
  proteinFoods: { name: string; serving: string; protein: string }[];
}

export interface MealItem {
  slot: string;
  title: string;
  items: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
}

export interface GeneratedCoachPlan {
  source: AIProvider;
  generatedAt: string;
  dietType: DietPreference;
  summary: string;
  meals: MealItem[];
  workoutTips: string[];
  postureFocus: string;
}
