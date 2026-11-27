import * as SecureStore from 'expo-secure-store';
import { calculatePersonalizedTargets, getDynamicPhaseConfig } from '../engine/planGenerator';
import type {
  AIProvider,
  DietPreference,
  GeneratedCoachPlan,
  MealItem,
  UserProfile,
} from '../types/models';

const GEMINI_KEY_STORE = 'gymlog_gemini_api_key';
const OPENAI_KEY_STORE = 'gymlog_openai_api_key';

export async function saveAiApiKey(provider: 'gemini' | 'openai', key: string): Promise<void> {
  const storeKey = provider === 'gemini' ? GEMINI_KEY_STORE : OPENAI_KEY_STORE;
  const trimmed = key.trim();
  if (!trimmed) {
    await SecureStore.deleteItemAsync(storeKey);
  } else {
    await SecureStore.setItemAsync(storeKey, trimmed);
  }
}

export async function getAiApiKey(provider: 'gemini' | 'openai'): Promise<string> {
  const storeKey = provider === 'gemini' ? GEMINI_KEY_STORE : OPENAI_KEY_STORE;
  return (await SecureStore.getItemAsync(storeKey)) || '';
}

export function buildSmartOfflinePlan(
  profile: UserProfile,
  activeWeek: number,
  dietType: DietPreference,
  customNote?: string
): GeneratedCoachPlan {
  const targets = calculatePersonalizedTargets(profile);
  const phase = getDynamicPhaseConfig(activeWeek, profile);
  const cal = targets.dailyCalories;
  const prot = targets.proteinTargetG;
  const scale = cal / 2450;
  const pScale = prot / 135;

  const r = (n: number) => Math.max(5, Math.round(n / 5) * 5);

  let meals: MealItem[];
  if (dietType === 'veg') {
    meals = [
      {
        slot: 'Breakfast',
        title: 'High-Protein Oats & Paneer Toast',
        items: `${r(60 * scale)}g rolled oats in 250ml milk + ${r(80 * pScale)}g low-fat paneer + 10g chia/peanut butter`,
        calories: Math.round(cal * 0.24),
        proteinG: Math.round(prot * 0.23),
        carbsG: Math.round(62 * scale),
        fatsG: Math.round(16 * scale),
      },
      {
        slot: 'Lunch',
        title: 'Soya Chunks Pulao + Thick Dal + Curd',
        items: `${r(55 * pScale)}g soya chunks (boiled & sautéed) + 1.5 bowls thick dal + ${r(140 * scale)}g cooked rice + 150g curd + cucumber salad`,
        calories: Math.round(cal * 0.31),
        proteinG: Math.round(prot * 0.32),
        carbsG: Math.round(78 * scale),
        fatsG: Math.round(14 * scale),
      },
      {
        slot: 'Pre-Workout',
        title: 'Banana + Black Coffee + Roasted Chana',
        items: `1 medium banana + black coffee (no sugar) + ${r(30 * scale)}g roasted chana`,
        calories: Math.round(cal * 0.11),
        proteinG: Math.round(prot * 0.08),
        carbsG: Math.round(36 * scale),
        fatsG: 3,
      },
      {
        slot: 'Post-Workout',
        title: 'Whey / Sattu + Curd Bowl',
        items: `1 scoop whey (or 250g high-protein dahi + ${r(30 * pScale)}g roasted soya granules) + 1 apple`,
        calories: Math.round(cal * 0.14),
        proteinG: Math.round(prot * 0.21),
        carbsG: Math.round(24 * scale),
        fatsG: 4,
      },
      {
        slot: 'Dinner',
        title: 'Grilled Paneer + 2 Whole-Wheat Rotis + Sabzi',
        items: `${r(110 * pScale)}g low-fat paneer bhurji/tikka + 2 phulkas + sautéed green veggies`,
        calories: Math.round(cal * 0.2),
        proteinG: Math.round(prot * 0.16),
        carbsG: Math.round(38 * scale),
        fatsG: Math.round(15 * scale),
      },
    ];
  } else if (dietType === 'eggetarian') {
    meals = [
      {
        slot: 'Breakfast',
        title: 'Egg Bhurji + Oats / Multigrain Toast',
        items: `3 whole eggs + 3 egg whites + 2 toast slices (or ${r(50 * scale)}g oats) + black coffee`,
        calories: Math.round(cal * 0.24),
        proteinG: Math.round(prot * 0.25),
        carbsG: Math.round(44 * scale),
        fatsG: Math.round(17 * scale),
      },
      {
        slot: 'Lunch',
        title: 'Soya Chunks + Dal + Rice + Salad',
        items: `${r(50 * pScale)}g soya chunks masala + 1.5 bowls dal + ${r(140 * scale)}g cooked rice + 150g curd + salad`,
        calories: Math.round(cal * 0.31),
        proteinG: Math.round(prot * 0.31),
        carbsG: Math.round(76 * scale),
        fatsG: Math.round(13 * scale),
      },
      {
        slot: 'Pre-Workout',
        title: 'Banana + Black Coffee',
        items: `1 large banana + black coffee 30 min before lifting`,
        calories: Math.round(cal * 0.08),
        proteinG: 2,
        carbsG: Math.round(28 * scale),
        fatsG: 1,
      },
      {
        slot: 'Post-Workout',
        title: 'Egg Whites + Fruit Recovery',
        items: `5 boiled egg whites (or 1 scoop whey) + 1 apple / berries`,
        calories: Math.round(cal * 0.14),
        proteinG: Math.round(prot * 0.22),
        carbsG: Math.round(22 * scale),
        fatsG: 2,
      },
      {
        slot: 'Dinner',
        title: 'Paneer / Dal + 2 Rotis + Veggies',
        items: `${r(100 * pScale)}g paneer + 1 bowl dal + 2 rotis + mixed stir-fried vegetables`,
        calories: Math.round(cal * 0.23),
        proteinG: Math.round(prot * 0.2),
        carbsG: Math.round(42 * scale),
        fatsG: Math.round(14 * scale),
      },
    ];
  } else {
    meals = [
      {
        slot: 'Breakfast',
        title: 'Eggs + Oats Power Start',
        items: `3 whole eggs + 2 egg whites + ${r(50 * scale)}g oats in milk/water + 1 fruit`,
        calories: Math.round(cal * 0.24),
        proteinG: Math.round(prot * 0.24),
        carbsG: Math.round(48 * scale),
        fatsG: Math.round(16 * scale),
      },
      {
        slot: 'Lunch',
        title: 'Chicken Breast + Rice + Dal + Salad',
        items: `${r(150 * pScale)}g grilled/air-fried chicken breast + ${r(150 * scale)}g cooked rice + 1 bowl dal + salad`,
        calories: Math.round(cal * 0.31),
        proteinG: Math.round(prot * 0.34),
        carbsG: Math.round(72 * scale),
        fatsG: Math.round(11 * scale),
      },
      {
        slot: 'Pre-Workout',
        title: 'Banana + Black Coffee',
        items: `1 medium banana + black coffee 30 min pre-workout`,
        calories: Math.round(cal * 0.08),
        proteinG: 2,
        carbsG: Math.round(27 * scale),
        fatsG: 1,
      },
      {
        slot: 'Post-Workout',
        title: 'Lean Protein Shake or Boiled Eggs',
        items: `1 scoop whey in water OR 5 boiled egg whites + ${r(30 * pScale)}g roasted soya`,
        calories: Math.round(cal * 0.13),
        proteinG: Math.round(prot * 0.21),
        carbsG: Math.round(12 * scale),
        fatsG: 2,
      },
      {
        slot: 'Dinner',
        title: 'Chicken/Fish + 2 Rotis + Greens',
        items: `${r(130 * pScale)}g chicken breast or fish + 2 whole-wheat rotis + sautéed greens`,
        calories: Math.round(cal * 0.24),
        proteinG: Math.round(prot * 0.19),
        carbsG: Math.round(40 * scale),
        fatsG: Math.round(12 * scale),
      },
    ];
  }

  const levelNotes =
    profile.experience === 'beginner'
      ? [
          'Master 2–3s controlled eccentrics on every rep; stop 2–3 reps shy of failure.',
          `Walk ${phase.steps.toLocaleString()} steps daily and hit ${phase.treadmillMin} min Zone 2 (${targets.zone2MinBpm}–${targets.zone2MaxBpm} bpm).`,
          'Add +2.5 kg only once you hit the top of the rep range cleanly across all sets.',
        ]
      : profile.experience === 'intermediate'
        ? [
            'Prioritize double progression on lateral raises, incline presses, and lat pulldowns.',
            `Stay strictly in Zone 2 (${targets.zone2MinBpm}–${targets.zone2MaxBpm} bpm) for ${phase.treadmillMin} min post-lift to burn fat without hurting leg recovery.`,
            'Use Weeks 7–8 deload (-40% sets) if sleep or joint recovery dips.',
          ]
        : [
            'Push top sets to 1 RIR on compounds and 0–1 RIR on isolation lateral/rear-delt sets.',
            `Pair ${phase.steps.toLocaleString()} daily steps with strict protein (${targets.proteinMinG}–${targets.proteinMaxG}g/day) to protect lean mass.`,
            'Track Sunday morning fasted weight and waist circumference weekly.',
          ];

  return {
    source: 'offline',
    generatedAt: new Date().toISOString(),
    dietType,
    summary: `${targets.splitSummary} · ${targets.dailyCalories} kcal/day (${targets.weeklyRateKg}) · ${targets.proteinMinG}–${targets.proteinMaxG}g protein.${customNote ? ` Focus: ${customNote}` : ''}`,
    meals,
    workoutTips: levelNotes,
    postureFocus:
      'Keep face pulls, band pull-aparts, scapular wall slides, and pelvic-tilt glute bridges non-negotiable for taller upright posture and a sharper V-taper.',
  };
}

function buildAiPrompt(
  profile: UserProfile,
  activeWeek: number,
  dietType: DietPreference,
  customNote: string
): string {
  const targets = calculatePersonalizedTargets(profile);
  return `You are an elite strength, physique, and nutrition coach.
Create a concise, accurate JSON workout & diet plan for:
- Age: ${profile.age}, Sex: ${profile.sex}, Weight: ${profile.weightKg} kg, Height: ${profile.heightCm} cm (BMI ${targets.bmi})
- Level: ${profile.experience}, Goal: ${profile.goal}, Current Program Week: ${activeWeek}/12
- Diet Preference: ${dietType} (Indian/global budget-friendly foods preferred)
- Target Calories: ${targets.dailyCalories} kcal/day, Protein: ${targets.proteinMinG}-${targets.proteinMaxG}g/day, Zone 2 HR: ${targets.zone2MinBpm}-${targets.zone2MaxBpm} bpm
${customNote ? `- User Custom Request: ${customNote}` : ''}

Return STRICT valid JSON only (no markdown fences) with this exact shape:
{
  "summary": "2-sentence overview",
  "meals": [
    { "slot": "Breakfast", "title": "...", "items": "exact gram portions", "calories": 500, "proteinG": 35, "carbsG": 55, "fatsG": 14 }
  ],
  "workoutTips": ["tip 1", "tip 2", "tip 3"],
  "postureFocus": "1-sentence anti-slouch & core cue"
}`;
}

function parseAiJsonResponse(
  rawText: string,
  provider: AIProvider,
  dietType: DietPreference
): GeneratedCoachPlan {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!parsed || !Array.isArray(parsed.meals) || parsed.meals.length === 0) {
    throw new Error('AI returned an unexpected format.');
  }
  return {
    source: provider,
    generatedAt: new Date().toISOString(),
    dietType,
    summary: String(parsed.summary || ''),
    meals: parsed.meals.map((m: Partial<MealItem>) => ({
      slot: String(m.slot || 'Meal'),
      title: String(m.title || 'Balanced Meal'),
      items: String(m.items || ''),
      calories: Number(m.calories) || 0,
      proteinG: Number(m.proteinG) || 0,
      carbsG: Number(m.carbsG) || 0,
      fatsG: Number(m.fatsG) || 0,
    })),
    workoutTips: Array.isArray(parsed.workoutTips)
      ? parsed.workoutTips.map(String)
      : [],
    postureFocus: String(parsed.postureFocus || ''),
  };
}

export async function generateCoachPlan(params: {
  provider: AIProvider;
  profile: UserProfile;
  activeWeek: number;
  dietType: DietPreference;
  customNote: string;
}): Promise<GeneratedCoachPlan> {
  if (params.provider === 'offline') {
    return buildSmartOfflinePlan(
      params.profile,
      params.activeWeek,
      params.dietType,
      params.customNote
    );
  }

  const prompt = buildAiPrompt(
    params.profile,
    params.activeWeek,
    params.dietType,
    params.customNote
  );

  if (params.provider === 'gemini') {
    const apiKey = await getAiApiKey('gemini');
    if (!apiKey) {
      throw new Error('Enter your Gemini API key first (or switch to Built-In Coach).');
    }
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        }),
      }
    );
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini error (${resp.status}): ${errText.slice(0, 120)}`);
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned empty output.');
    return parseAiJsonResponse(text, 'gemini', params.dietType);
  }

  // OpenAI / ChatGPT
  const apiKey = await getAiApiKey('openai');
  if (!apiKey) {
    throw new Error('Enter your OpenAI API key first (or switch to Built-In Coach).');
  }
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'You respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ChatGPT error (${resp.status}): ${errText.slice(0, 120)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('ChatGPT returned empty output.');
  return parseAiJsonResponse(text, 'openai', params.dietType);
}
