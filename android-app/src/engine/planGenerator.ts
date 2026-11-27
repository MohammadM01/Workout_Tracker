import { PROGRAM as INTERMEDIATE_PROGRAM } from '../data/program';
import type {
  CardioType,
  DayOfWeek,
  DayProgram,
  ExerciseSpec,
  ExperienceLevel,
  FitnessGoal,
  PersonalizedTargets,
  PhaseConfig,
  UserProfile,
} from '../types/models';

export function formatHeightSummary(heightCm: number): string {
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  const adjustedFeet = inches === 12 ? feet + 1 : feet;
  const adjustedInches = inches === 12 ? 0 : inches;
  return `${Math.round(heightCm)} cm (${adjustedFeet}'${adjustedInches}")`;
}

export function getBmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Lean / Underweight';
  if (bmi < 25) return 'Healthy Athletic Frame';
  if (bmi < 28.5) return 'Recomp Sweet Spot';
  if (bmi < 32) return 'Fat-Loss Focus';
  return 'Joint-Friendly Recomp';
}

export function calculatePersonalizedTargets(profile: UserProfile): PersonalizedTargets {
  const age = Math.max(15, Math.min(80, Math.round(profile.age || 22)));
  const weightKg = Math.max(35, Math.min(250, Number(profile.weightKg || 89)));
  const heightCm = Math.max(130, Math.min(225, Number(profile.heightCm || 171)));

  const heightM = heightCm / 100;
  const bmi = +(weightKg / (heightM * heightM)).toFixed(1);
  const bmiLabel = getBmiCategory(bmi);

  // Tanaka HRmax formula (208 - 0.7 * age) -> Zone 2 (~61% - 71% HRmax)
  const hrMax = Math.round(208 - 0.7 * age);
  const zone2MinBpm = Math.round(hrMax * 0.61);
  const zone2MaxBpm = Math.round(hrMax * 0.715);

  // Mifflin-St Jeor BMR
  const sexOffset = profile.sex === 'female' ? -161 : 5;
  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset);

  const activityMultiplier =
    profile.experience === 'beginner'
      ? 1.46
      : profile.experience === 'intermediate'
        ? 1.55
        : 1.62;
  const tdee = Math.round(bmr * activityMultiplier);

  // Calorie delta based on goal + body mass
  let calorieDelta = -400;
  let calorieLabel = 'Modest Recomp Deficit';
  let weeklyRateKg = '~0.5–0.7 kg/week fat loss';

  if (profile.goal === 'fat_loss') {
    calorieDelta = weightKg >= 95 ? -550 : -475;
    calorieLabel = 'Steady Fat-Loss Deficit';
    weeklyRateKg = '~0.6–0.8 kg/week fat loss';
  } else if (profile.goal === 'lean_bulk') {
    calorieDelta = profile.experience === 'beginner' ? 275 : 225;
    calorieLabel = 'Lean Muscle Surplus';
    weeklyRateKg = '~0.25–0.35 kg/week lean gain';
  } else {
    // Recomp: ~350-450 kcal deficit for higher BMI, smaller deficit for leaner frames
    calorieDelta = bmi >= 24.5 ? -400 : -250;
    calorieLabel = 'Modest Recomp Deficit';
    weeklyRateKg = bmi >= 24.5 ? '~0.5–0.7 kg/week fat loss' : '~0.25–0.4 kg/week recomp';
  }

  const dailyCalories = Math.max(profile.sex === 'female' ? 1350 : 1600, tdee + calorieDelta);

  // Protein calibrated to body size & goal (~1.4–1.65 g/kg for recomp, 1.6–1.85 g/kg lean bulk)
  const minFactor = profile.goal === 'lean_bulk' ? 1.55 : 1.35;
  const maxFactor = profile.goal === 'lean_bulk' ? 1.8 : 1.58;
  const roundTo5 = (n: number) => Math.max(65, Math.round(n / 5) * 5);

  const proteinMinG = roundTo5(weightKg * minFactor);
  const proteinMaxG = Math.max(proteinMinG + 15, roundTo5(weightKg * maxFactor));
  const proteinTargetG = roundTo5((proteinMinG + proteinMaxG) / 2);

  const waterLiters = +(Math.max(2.5, Math.min(4.8, weightKg * 0.04))).toFixed(1);

  // 12-week projection
  let projectedDeltaMin = -6;
  let projectedDeltaMax = -8;
  if (profile.goal === 'fat_loss') {
    projectedDeltaMin = -7;
    projectedDeltaMax = -9.5;
  } else if (profile.goal === 'lean_bulk') {
    projectedDeltaMin = 2.5;
    projectedDeltaMax = 4.0;
  } else if (bmi < 24.5) {
    projectedDeltaMin = -2.5;
    projectedDeltaMax = -4.5;
  }

  const projectedEndMinKg = +(weightKg + projectedDeltaMax).toFixed(1);
  const projectedEndMaxKg = +(weightKg + projectedDeltaMin).toFixed(1);

  const outlookHeadline =
    profile.goal === 'lean_bulk'
      ? `Expect +${projectedDeltaMin.toFixed(1)} to +${projectedDeltaMax.toFixed(1)} kg lean mass gain`
      : `Expect ${Math.abs(projectedDeltaMin).toFixed(0)}–${Math.abs(projectedDeltaMax).toFixed(0)} kg down (${Math.min(projectedEndMinKg, projectedEndMaxKg)}–${Math.max(projectedEndMinKg, projectedEndMaxKg)} kg)`;

  const outlookDetail =
    profile.goal === 'lean_bulk'
      ? 'Controlled surplus builds upper chest fullness, broader lateral/rear delts, and denser lats while keeping waist tight and posture tall.'
      : `2–3 inches off the waist, noticeably wider shoulders, taller anti-slouch posture, and a sharp jump in strength without draining energy.`;

  const splitSummary =
    profile.experience === 'beginner'
      ? '4-Day Foundation Upper/Lower + 2 Posture/Cardio Days + Sunday Recovery'
      : profile.experience === 'intermediate'
        ? '6-Day Aesthetic V-Taper + Anti-Slouch PPL Split + Sunday Weigh-In'
        : '6-Day High-Volume Aesthetic Specialization PPL + Conditioning Peak';

  return {
    bmi,
    bmiLabel,
    bmr,
    tdee,
    dailyCalories,
    calorieDelta,
    calorieLabel,
    weeklyRateKg,
    proteinMinG,
    proteinMaxG,
    proteinTargetG,
    waterLiters,
    hrMax,
    zone2MinBpm,
    zone2MaxBpm,
    projectedEndMinKg: Math.min(projectedEndMinKg, projectedEndMaxKg),
    projectedEndMaxKg: Math.max(projectedEndMinKg, projectedEndMaxKg),
    outlookHeadline,
    outlookDetail,
    splitSummary,
    proteinFoods: [
      { name: 'Soya Chunks (50g dry)', serving: '50g', protein: '~26g' },
      { name: 'Whole Eggs (3) + Whites (3)', serving: '6 eggs', protein: '~28g' },
      { name: 'Chicken Breast / Fish', serving: '150g cooked', protein: '~42g' },
      { name: 'Dal / Rajma / Chana', serving: '1.5 bowls', protein: '~18g' },
      { name: 'Low-Fat Paneer / Curd / Whey', serving: '100g / 1 scoop', protein: '18–24g' },
    ],
  };
}

export function getDynamicPhaseConfig(week: number, profile: UserProfile): PhaseConfig {
  const targets = calculatePersonalizedTargets(profile);
  const hrText = `Zone 2 (${targets.zone2MinBpm}–${targets.zone2MaxBpm} bpm)`;
  const exp: ExperienceLevel = profile.experience;
  const heavyJointGuard = targets.bmi >= 28 || profile.weightKg >= 100;

  const stepBase = exp === 'beginner' ? 6000 : exp === 'intermediate' ? 7000 : 8500;
  const stepIncrement = exp === 'beginner' ? 1200 : 1500;

  const minCardio = exp === 'beginner' ? 15 : exp === 'intermediate' ? 20 : 25;

  if (week <= 4) {
    return {
      phase: 1,
      label:
        exp === 'beginner'
          ? 'Phase 1 · Form & Consistency (3 RIR)'
          : 'Phase 1 · Foundation (2–3 RIR)',
      steps: stepBase,
      treadmillMin: minCardio,
      treadmillSpec: heavyJointGuard
        ? `4.2–4.8 km/h · 3–5% incline (joint-friendly) · ${hrText}`
        : `4.5–5.0 km/h · 4–6% incline · ${hrText}`,
      cycleMin: minCardio,
      cycleSpec: `70–80 RPM · Moderate resistance · ${hrText}`,
      wedFlushMin: exp === 'beginner' ? 15 : 10,
      satCycleMin: minCardio + 5,
      satSpec: `75–85 RPM · Moderate resistance · ${hrText}`,
    };
  }

  if (week <= 8) {
    const isDeload = week === 7 || week === 8;
    return {
      phase: 2,
      label: isDeload
        ? 'Phase 2 · Build (Deload Option: -40% sets)'
        : exp === 'advanced'
          ? 'Phase 2 · Hypertrophy Overload (1 RIR)'
          : 'Phase 2 · Build (1–2 RIR)',
      steps: stepBase + stepIncrement,
      treadmillMin: minCardio + 5,
      treadmillSpec: heavyJointGuard
        ? `4.5–5.1 km/h · 5–7% incline · ${hrText}`
        : `4.8–5.4 km/h · 6–8% incline · ${hrText}`,
      cycleMin: minCardio + 5,
      cycleSpec: `75–85 RPM · +1–2 resistance · ${hrText}`,
      wedFlushMin: exp === 'beginner' ? 18 : 12,
      satCycleMin: minCardio + 10,
      satSpec: `75–85 RPM · Moderate-firm resistance · ${hrText}`,
    };
  }

  return {
    phase: 3,
    label:
      exp === 'beginner'
        ? 'Phase 3 · Lean Strength & Stamina (1–2 RIR)'
        : exp === 'advanced'
          ? 'Phase 3 · Aesthetic & Conditioning Peak (0–1 RIR)'
          : 'Phase 3 · Aesthetic & Conditioning Peak (1–2 RIR)',
    steps: stepBase + stepIncrement * 2,
    treadmillMin: minCardio + 5,
    treadmillSpec: heavyJointGuard
      ? `4.8–5.3 km/h · 6–8% incline · ${hrText}`
      : `5.0–5.6 km/h · 7–9% incline · ${hrText}`,
    cycleMin: minCardio + 5,
    cycleSpec: `75–85 RPM · Steady ${hrText}`,
    wedFlushMin: exp === 'beginner' ? 20 : 12,
    satCycleMin: minCardio + 10,
    satSpec:
      exp === 'beginner'
        ? `Steady ${hrText} · smooth cadence`
        : `${hrText} or 8 × (1 min brisk RPE 7.5 / 90s easy)`,
  };
}

export function getDynamicCardioSpec(type: CardioType, phaseCfg: PhaseConfig) {
  switch (type) {
    case 'treadmill':
      return {
        title: `Incline Treadmill Walk · ${phaseCfg.treadmillMin} min`,
        detail: phaseCfg.treadmillSpec,
        targetMin: phaseCfg.treadmillMin,
      };
    case 'cycle':
      return {
        title: `Stationary Cycle · ${phaseCfg.cycleMin} min`,
        detail: phaseCfg.cycleSpec,
        targetMin: phaseCfg.cycleMin,
      };
    case 'flush':
      return {
        title: `Stationary Cycle (Active Flush) · ${phaseCfg.wedFlushMin} min`,
        detail: 'Very light resistance · 65–75 RPM · Zone 1 recovery',
        targetMin: phaseCfg.wedFlushMin,
      };
    case 'sat_cycle':
      return {
        title: `Stationary Cycle Endurance · ${phaseCfg.satCycleMin} min`,
        detail: phaseCfg.satSpec,
        targetMin: phaseCfg.satCycleMin,
      };
    case 'walk_recovery':
      return {
        title: `Active Zone 2 Recovery Walk · ${phaseCfg.wedFlushMin} min`,
        detail: phaseCfg.treadmillSpec,
        targetMin: phaseCfg.wedFlushMin,
      };
  }
}

function scaleExercise(ex: ExerciseSpec, exp: ExperienceLevel, isSenior: boolean): ExerciseSpec {
  if (exp === 'beginner') {
    return {
      ...ex,
      sets: Math.max(2, ex.sets - 1),
      rest: Math.min(180, ex.rest + (isSenior ? 20 : 15)),
    };
  }
  if (exp === 'advanced') {
    return {
      ...ex,
      sets: ex.sets >= 3 && !ex.posture ? ex.sets + 1 : ex.sets,
      cue: isSenior ? `${ex.cue} Prioritize controlled joint tempo.` : ex.cue,
    };
  }
  return isSenior
    ? { ...ex, rest: ex.rest + 15, cue: `${ex.cue} Prioritize smooth joint control.` }
    : ex;
}

const BEGINNER_PROGRAM: Record<DayOfWeek, DayProgram> = {
  1: {
    title: 'Upper Body A (Foundation)',
    subtitle: 'Upper Chest, Lat Width, Shoulders & Anti-Slouch Posture',
    lifts: [
      {
        id: 'beg_mon_inc_db',
        name: 'Incline DB Chest Press (30°)',
        sets: 3,
        target: '8–12 reps',
        rest: 120,
        cue: 'Low 30° bench, elbows ~45°, 2–3s controlled lowering. Alt: Incline Machine Press.',
      },
      {
        id: 'beg_mon_lat_pd',
        name: 'Wide/Medium Lat Pulldown',
        sets: 3,
        target: '10–12 reps',
        rest: 120,
        cue: 'Pull shoulder blades down first, drive elbows to hips, 1s squeeze at upper chest.',
      },
      {
        id: 'beg_mon_db_ohp',
        name: 'Seated DB Shoulder Press (75°)',
        sets: 2,
        target: '10–12 reps',
        rest: 120,
        cue: 'Ribs tucked down, elbows slightly forward. Alt: Machine Shoulder Press.',
      },
      {
        id: 'beg_mon_lat_raise',
        name: 'Standing DB Lateral Raises',
        sets: 3,
        target: '12–15 reps',
        rest: 75,
        cue: 'Lead with elbows 30° forward to shoulder height; light weight, zero swing.',
      },
    ],
    coreLabel: 'Posture & Core Foundation A',
    core: [
      {
        id: 'beg_mon_pullapart',
        name: 'Band / Cable Pull-Aparts',
        sets: 2,
        target: '15 reps',
        rest: 45,
        weighted: false,
        repLabel: 'Reps',
        posture: true,
        cue: 'Anti-slouch shoulder opener; squeeze shoulder blades back and down.',
      },
      {
        id: 'beg_mon_deadbug',
        name: 'Dead Bug',
        sets: 2,
        target: '8–10 / side',
        rest: 60,
        weighted: false,
        repLabel: 'Reps',
        cue: 'Press lower back flat into floor as opposite arm and leg extend.',
      },
    ],
    cardioType: 'treadmill',
  },
  2: {
    title: 'Lower Body A (Athletic Base)',
    subtitle: 'Quads, Hamstrings, Glutes & Calves + Light Cycle',
    lifts: [
      {
        id: 'beg_tue_goblet',
        name: 'Dumbbell Goblet Squat',
        sets: 3,
        target: '10–12 reps',
        rest: 120,
        cue: 'Hold DB at chest, upright torso, sit between knees. Alt: 45° Leg Press.',
      },
      {
        id: 'beg_tue_rdl',
        name: 'Dumbbell Romanian Deadlift',
        sets: 3,
        target: '10–12 reps',
        rest: 120,
        cue: 'Soft knees, push hips back keeping DBs close to legs until hamstring stretch.',
      },
      {
        id: 'beg_tue_leg_curl',
        name: 'Seated / Lying Leg Curl',
        sets: 2,
        target: '12–15 reps',
        rest: 90,
        cue: 'Hips pinned to pad, 1s hamstring squeeze, slow 2–3s return.',
      },
      {
        id: 'beg_tue_calves',
        name: 'Standing / Leg-Press Calf Raises',
        sets: 2,
        target: '12–15 reps',
        rest: 60,
        cue: 'Full 2s bottom stretch + 1s top pause.',
      },
    ],
    coreLabel: 'Pelvic Alignment',
    core: [
      {
        id: 'beg_tue_bridge',
        name: 'Pelvic-Tilt Glute Bridge',
        sets: 2,
        target: '12 reps (3s hold)',
        rest: 45,
        weighted: false,
        repLabel: 'Reps',
        posture: true,
        cue: 'Tuck pelvis flat before lifting; squeeze glutes hard for 3 seconds.',
      },
    ],
    cardioType: 'cycle',
  },
  3: {
    title: 'Active Recovery & Posture',
    subtitle: 'Zero Joint Fatigue · Anti-Slouch Mobility + Zone 2 Walk',
    lifts: [],
    coreLabel: 'Posture Reset Flow',
    core: [
      {
        id: 'beg_wed_wall_slide',
        name: 'Scapular Wall Slides',
        sets: 2,
        target: '10 slow reps',
        rest: 45,
        weighted: false,
        repLabel: 'Reps',
        posture: true,
        cue: 'Back & head against wall, slide forearms W to Y without shrugging.',
      },
      {
        id: 'beg_wed_birddog',
        name: 'Bird-Dog',
        sets: 2,
        target: '10 / side (2s hold)',
        rest: 45,
        weighted: false,
        repLabel: 'Reps',
        posture: true,
        cue: 'Neutral spine, reach forward and push heel back smoothly.',
      },
    ],
    cardioType: 'walk_recovery',
  },
  4: {
    title: 'Upper Body B (V-Taper & Arms)',
    subtitle: 'Chest, Anti-Slouch Upper Back, Rear Delts & Arms',
    lifts: [
      {
        id: 'beg_thu_mach_press',
        name: 'Machine / Flat DB Chest Press',
        sets: 3,
        target: '8–12 reps',
        rest: 120,
        cue: 'Shoulder blades pinned back, smooth press without shoulder roll.',
      },
      {
        id: 'beg_thu_cs_row',
        name: 'Chest-Supported DB / Seated Row',
        sets: 3,
        target: '10–12 reps',
        rest: 90,
        posture: true,
        cue: 'Pull toward lower ribs and squeeze mid-back for 1s.',
      },
      {
        id: 'beg_thu_face_pull',
        name: 'High-Cable Face Pulls',
        sets: 3,
        target: '15 reps',
        rest: 60,
        posture: true,
        cue: 'Pull rope toward forehead separating handles into double-biceps pose.',
      },
      {
        id: 'beg_thu_curl',
        name: 'Alternating DB Biceps Curl',
        sets: 2,
        target: '10–12 / arm',
        rest: 75,
        cue: 'Elbows pinned to ribs, zero torso swing.',
      },
      {
        id: 'beg_thu_tri',
        name: 'Cable Triceps Pushdown',
        sets: 2,
        target: '10–12 reps',
        rest: 75,
        cue: 'Full lockout squeeze, control return above 90°.',
      },
    ],
    coreLabel: 'Posture & Core B',
    core: [
      {
        id: 'beg_thu_pallof',
        name: 'Cable Pallof Press',
        sets: 2,
        target: '10 / side (2s hold)',
        rest: 60,
        weighted: true,
        repLabel: 'Reps',
        cue: 'Press straight ahead and resist torso rotation.',
      },
    ],
    cardioType: 'treadmill',
  },
  5: {
    title: 'Lower Body B (Glutes & Balance)',
    subtitle: 'Leg Press, Hamstrings, Split Squat & Core Stability',
    lifts: [
      {
        id: 'beg_fri_leg_press',
        name: 'High-Foot 45° Leg Press',
        sets: 3,
        target: '10–12 reps',
        rest: 120,
        cue: 'Tailbone glued to seat, drive through heels, no hard knee lockout.',
      },
      {
        id: 'beg_fri_leg_ext',
        name: 'Seated Leg Extension',
        sets: 2,
        target: '12–15 reps',
        rest: 90,
        cue: '1s top quad squeeze, slow 2–3s descent.',
      },
      {
        id: 'beg_fri_split_sq',
        name: 'Bodyweight / Light DB Split Squat',
        sets: 2,
        target: '8–10 / leg',
        rest: 90,
        cue: 'Start bodyweight in Weeks 1–2 for balance before adding dumbbells.',
      },
      {
        id: 'beg_fri_calves',
        name: 'Seated / Machine Calf Raises',
        sets: 2,
        target: '12–15 reps',
        rest: 60,
        cue: 'Pause 2s at bottom stretch and 1s at top.',
      },
    ],
    coreLabel: 'Core & Posture Carry',
    core: [
      {
        id: 'beg_fri_suitcase',
        name: 'Single-Arm DB Suitcase Carry',
        sets: 2,
        target: '30 sec / side',
        rest: 60,
        weighted: true,
        repLabel: 'Sec',
        posture: true,
        cue: 'Stand tall without leaning; strengthens obliques and upright posture.',
      },
    ],
    cardioType: 'cycle',
  },
  6: {
    title: 'Conditioning & Posture Flow',
    subtitle: 'Endurance Zone 2 Cycle + Upper-Back Opening',
    lifts: [],
    coreLabel: 'Anti-Slouch Mobility',
    core: [
      {
        id: 'beg_sat_ytw',
        name: 'Prone Floor Y-T-W Raises',
        sets: 2,
        target: '8 reps / shape',
        rest: 45,
        weighted: false,
        repLabel: 'Reps',
        posture: true,
        cue: 'Lift thumbs-up arms gently into Y, T, W squeezing mid-back.',
      },
      {
        id: 'beg_sat_plank',
        name: 'Side Plank (Bent-Knee or Full)',
        sets: 2,
        target: '25–30 sec / side',
        rest: 45,
        weighted: false,
        repLabel: 'Sec',
        cue: 'Keep hips lifted in a straight line; breathe steadily.',
      },
    ],
    cardioType: 'sat_cycle',
  },
  0: INTERMEDIATE_PROGRAM[0],
};

export function getDynamicProgramForDay(dow: DayOfWeek, profile: UserProfile): DayProgram {
  const isSenior = profile.age >= 45;
  const base =
    profile.experience === 'beginner'
      ? BEGINNER_PROGRAM[dow]
      : INTERMEDIATE_PROGRAM[dow];

  return {
    ...base,
    lifts: base.lifts.map((ex) => scaleExercise(ex, profile.experience, isSenior)),
    core: base.core.map((ex) => scaleExercise(ex, profile.experience, isSenior)),
  };
}

export function getDynamicProgram(profile: UserProfile): Record<DayOfWeek, DayProgram> {
  return {
    0: getDynamicProgramForDay(0, profile),
    1: getDynamicProgramForDay(1, profile),
    2: getDynamicProgramForDay(2, profile),
    3: getDynamicProgramForDay(3, profile),
    4: getDynamicProgramForDay(4, profile),
    5: getDynamicProgramForDay(5, profile),
    6: getDynamicProgramForDay(6, profile),
  };
}
