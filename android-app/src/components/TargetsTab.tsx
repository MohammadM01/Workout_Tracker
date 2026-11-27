import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  calculatePersonalizedTargets,
  formatHeightSummary,
  getDynamicPhaseConfig,
} from '../engine/planGenerator';
import {
  buildSmartOfflinePlan,
  generateCoachPlan,
  getAiApiKey,
  saveAiApiKey,
} from '../services/aiCoach';
import { COLORS } from '../theme/colors';
import type {
  AIProvider,
  DietPreference,
  GeneratedCoachPlan,
  UserAccount,
} from '../types/models';

interface TargetsTabProps {
  user: UserAccount;
  activeWeek: number;
  onEditProfile: () => void;
}

export function TargetsTab({ user, activeWeek, onEditProfile }: TargetsTabProps) {
  const targets = calculatePersonalizedTargets(user);
  const phase1 = getDynamicPhaseConfig(1, user);
  const phase2 = getDynamicPhaseConfig(5, user);
  const phase3 = getDynamicPhaseConfig(9, user);

  const [dietType, setDietType] = useState<DietPreference>('non_veg');
  const [provider, setProvider] = useState<AIProvider>('offline');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [coachPlan, setCoachPlan] = useState<GeneratedCoachPlan>(() =>
    buildSmartOfflinePlan(user, activeWeek, 'non_veg')
  );

  useEffect(() => {
    setCoachPlan(buildSmartOfflinePlan(user, activeWeek, dietType, customNote));
  }, [user, activeWeek, dietType]);

  useEffect(() => {
    if (provider === 'gemini' || provider === 'openai') {
      getAiApiKey(provider).then(setApiKeyDraft);
    } else {
      setApiKeyDraft('');
    }
    setAiError(null);
  }, [provider]);

  const handleGeneratePlan = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      if (provider === 'gemini' || provider === 'openai') {
        await saveAiApiKey(provider, apiKeyDraft);
      }
      const next = await generateCoachPlan({
        provider,
        profile: user,
        activeWeek,
        dietType,
        customNote: customNote.trim(),
      });
      setCoachPlan(next);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Unable to generate AI plan.');
    } finally {
      setGenerating(false);
    }
  };

  const expLabel =
    user.experience === 'beginner'
      ? 'Beginner'
      : user.experience === 'advanced'
        ? 'Advanced'
        : 'Intermediate';

  const goalLabel =
    user.goal === 'fat_loss'
      ? 'Fat Loss'
      : user.goal === 'lean_bulk'
        ? 'Lean Bulk'
        : 'Recomp';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero 12-Week Blueprint Card */}
      <LinearGradient
        colors={['#171B24', '#11141B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.pillRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{expLabel.toUpperCase()}</Text>
            </View>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>{goalLabel}</Text>
            </View>
          </View>
          <Pressable style={styles.editChip} onPress={onEditProfile}>
            <Feather name="sliders" size={13} color={COLORS.text} />
            <Text style={styles.editChipText}>Edit Profile</Text>
          </Pressable>
        </View>

        <Text style={styles.heroTitle}>12-Week Outlook</Text>
        <Text style={styles.heroHeadline}>{targets.outlookHeadline}</Text>
        <Text style={styles.heroBody}>{targets.outlookDetail}</Text>

        <View style={styles.profileStrip}>
          <Text style={styles.profileStripText}>
            {user.age} yrs · {user.weightKg.toFixed(1)} kg · {formatHeightSummary(user.heightCm)} ·
            BMI {targets.bmi} ({targets.bmiLabel})
          </Text>
        </View>
      </LinearGradient>

      {/* Personalized Daily Targets Grid */}
      <Text style={styles.sectionLabel}>PERSONALIZED QUICK TARGETS</Text>

      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialCommunityIcons name="food-drumstick" size={16} color={COLORS.green} />
            <Text style={styles.metricTitle}>Daily Protein</Text>
          </View>
          <Text style={styles.metricBig}>
            {targets.proteinMinG}–{targets.proteinMaxG}g
          </Text>
          <Text style={styles.metricSub}>per day · preserves lean muscle &amp; fullness</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialCommunityIcons name="fire" size={16} color={COLORS.amberText} />
            <Text style={styles.metricTitle}>{targets.calorieLabel}</Text>
          </View>
          <Text style={styles.metricBig}>{targets.dailyCalories} kcal</Text>
          <Text style={styles.metricSub}>
            {targets.calorieDelta < 0
              ? `~${Math.abs(targets.calorieDelta)} kcal deficit · ${targets.weeklyRateKg}`
              : `+${targets.calorieDelta} kcal surplus · ${targets.weeklyRateKg}`}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialCommunityIcons name="heart-pulse" size={16} color={COLORS.blueText} />
            <Text style={styles.metricTitle}>Zone 2 Heart Rate</Text>
          </View>
          <Text style={styles.metricBig}>
            {targets.zone2MinBpm}–{targets.zone2MaxBpm}
          </Text>
          <Text style={styles.metricSub}>bpm · HRmax ~{targets.hrMax} bpm for Age {user.age}</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <MaterialCommunityIcons name="water" size={16} color={COLORS.purpleText} />
            <Text style={styles.metricTitle}>Daily Hydration</Text>
          </View>
          <Text style={styles.metricBig}>{targets.waterLiters} L</Text>
          <Text style={styles.metricSub}>TDEE ~{targets.tdee} kcal · BMR ~{targets.bmr}</Text>
        </View>
      </View>

      {/* AI Workout & Diet Plan Generator (Built-In + Gemini / ChatGPT) */}
      <Text style={styles.sectionLabel}>AI WORKOUT &amp; DIET COACH</Text>
      <View style={styles.card}>
        <Text style={styles.smallLabel}>Diet Preference</Text>
        <View style={[styles.chipRow, { marginBottom: 10 }]}>
          {[
            { key: 'non_veg' as DietPreference, label: 'Non-Veg' },
            { key: 'eggetarian' as DietPreference, label: 'Eggetarian' },
            { key: 'veg' as DietPreference, label: 'Pure Veg' },
          ].map((d) => (
            <Pressable
              key={d.key}
              style={[styles.choiceChip, dietType === d.key && styles.choiceChipActive]}
              onPress={() => setDietType(d.key)}
            >
              <Text
                style={[
                  styles.choiceChipText,
                  dietType === d.key && styles.choiceChipTextActive,
                ]}
              >
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.smallLabel}>Coach Engine</Text>
        <View style={[styles.chipRow, { marginBottom: 10 }]}>
          {[
            { key: 'offline' as AIProvider, label: 'Smart Engine' },
            { key: 'gemini' as AIProvider, label: 'Gemini AI' },
            { key: 'openai' as AIProvider, label: 'ChatGPT' },
          ].map((p) => (
            <Pressable
              key={p.key}
              style={[styles.choiceChip, provider === p.key && styles.choiceChipActive]}
              onPress={() => setProvider(p.key)}
            >
              <Text
                style={[
                  styles.choiceChipText,
                  provider === p.key && styles.choiceChipTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {provider !== 'offline' ? (
          <TextInput
            style={styles.input}
            value={apiKeyDraft}
            onChangeText={setApiKeyDraft}
            placeholder={
              provider === 'gemini'
                ? 'Paste Gemini API Key (saved encrypted on phone)'
                : 'Paste OpenAI API Key (saved encrypted on phone)'
            }
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
        ) : null}

        <TextInput
          style={styles.input}
          value={customNote}
          onChangeText={setCustomNote}
          placeholder="Optional note: e.g. hostel food, no dairy, knee-friendly..."
          placeholderTextColor={COLORS.textMuted}
        />

        {aiError ? <Text style={styles.aiErrorText}>{aiError}</Text> : null}

        <Pressable
          style={[styles.primaryBtn, generating && { opacity: 0.7 }]}
          onPress={handleGeneratePlan}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color={COLORS.accentFg} />
          ) : (
            <>
              <MaterialCommunityIcons
                name="creation"
                size={17}
                color={COLORS.accentFg}
              />
              <Text style={styles.primaryBtnText}>
                Generate {provider === 'offline' ? 'Tailored' : provider === 'gemini' ? 'Gemini' : 'ChatGPT'} Diet &amp; Plan
              </Text>
            </>
          )}
        </Pressable>

        {/* Generated Meal Plan */}
        <View style={styles.planResultBox}>
          <Text style={styles.planSummary}>{coachPlan.summary}</Text>

          {coachPlan.meals.map((meal, idx) => (
            <View
              key={`${meal.slot}-${idx}`}
              style={[
                styles.mealCard,
                idx === coachPlan.meals.length - 1 && { marginBottom: 0 },
              ]}
            >
              <View style={styles.mealTop}>
                <Text style={styles.mealSlot}>{meal.slot.toUpperCase()}</Text>
                <Text style={styles.mealMacros}>
                  {meal.calories} kcal · {meal.proteinG}g P · {meal.carbsG}g C · {meal.fatsG}g F
                </Text>
              </View>
              <Text style={styles.mealTitle}>{meal.title}</Text>
              <Text style={styles.mealItems}>{meal.items}</Text>
            </View>
          ))}

          {coachPlan.workoutTips.length > 0 ? (
            <View style={styles.tipsBox}>
              <Text style={styles.tipsHeader}>COACH EXECUTION NOTES</Text>
              {coachPlan.workoutTips.map((tip, i) => (
                <Text key={i} style={styles.tipLine}>
                  • {tip}
                </Text>
              ))}
              {coachPlan.postureFocus ? (
                <Text style={styles.postureLine}>Posture: {coachPlan.postureFocus}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {/* Budget Protein Essentials */}
      <Text style={styles.sectionLabel}>BUDGET PROTEIN ESSENTIALS</Text>
      <View style={styles.card}>
        <Text style={styles.cardIntro}>
          Hit your {targets.proteinMinG}–{targets.proteinMaxG}g/day target easily using affordable
          high-protein staples:
        </Text>
        {targets.proteinFoods.map((item, idx) => (
          <View
            key={item.name}
            style={[
              styles.foodRow,
              idx === targets.proteinFoods.length - 1 && styles.foodRowLast,
            ]}
          >
            <View>
              <Text style={styles.foodName}>{item.name}</Text>
              <Text style={styles.foodServing}>Serving: {item.serving}</Text>
            </View>
            <View style={styles.foodProteinBadge}>
              <Text style={styles.foodProteinText}>{item.protein}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Dynamic Training Split & 12-Week Phase Roadmap */}
      <Text style={styles.sectionLabel}>YOUR {expLabel.toUpperCase()} 12-WEEK ROADMAP</Text>
      <View style={styles.card}>
        <Text style={styles.splitHeading}>{targets.splitSummary}</Text>

        {[
          { range: 'Weeks 1–4', cfg: phase1, active: activeWeek <= 4 },
          { range: 'Weeks 5–8', cfg: phase2, active: activeWeek >= 5 && activeWeek <= 8 },
          { range: 'Weeks 9–12', cfg: phase3, active: activeWeek >= 9 },
        ].map((p, idx) => (
          <View
            key={p.range}
            style={[
              styles.phaseItem,
              p.active && styles.phaseItemActive,
              idx === 2 && styles.phaseItemLast,
            ]}
          >
            <View style={styles.phaseTop}>
              <Text style={styles.phaseRange}>{p.range}</Text>
              {p.active ? (
                <View style={styles.currentPhaseBadge}>
                  <Text style={styles.currentPhaseText}>ACTIVE</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.phaseLabel}>{p.cfg.label}</Text>
            <Text style={styles.phaseDetail}>
              {p.cfg.steps.toLocaleString()} steps/day · {p.cfg.treadmillMin} min incline walk /{' '}
              {p.cfg.cycleMin} min cycle
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 96,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  levelBadge: {
    backgroundColor: COLORS.greenSoft,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.green,
    letterSpacing: 0.5,
  },
  goalBadge: {
    backgroundColor: COLORS.blueSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  goalBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.blueText,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.text,
  },
  heroTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  profileStrip: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  profileStripText: {
    fontSize: 12,
    color: COLORS.blueText,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.7,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  metricCard: {
    width: '48.4%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 13,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    flex: 1,
  },
  metricBig: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  metricSub: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 14,
    marginBottom: 12,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  choiceChip: {
    flex: 1,
    height: 35,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  choiceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  choiceChipTextActive: {
    color: COLORS.accentFg,
    fontWeight: '700',
  },
  input: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    color: COLORS.text,
    fontSize: 13.5,
    paddingHorizontal: 11,
    marginBottom: 8,
  },
  aiErrorText: {
    fontSize: 12,
    color: COLORS.dangerText,
    marginBottom: 8,
  },
  primaryBtn: {
    height: 42,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.accentFg,
  },
  planResultBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  planSummary: {
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.blueText,
    fontWeight: '600',
    marginBottom: 10,
  },
  mealCard: {
    backgroundColor: COLORS.surfaceInput,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },
  mealTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  mealSlot: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.green,
    letterSpacing: 0.5,
  },
  mealMacros: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  mealTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  mealItems: {
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  tipsBox: {
    marginTop: 10,
    backgroundColor: COLORS.greenSoft,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    borderRadius: 10,
    padding: 11,
    gap: 4,
  },
  tipsHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.green,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  tipLine: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.text,
  },
  postureLine: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.purpleText,
    fontWeight: '600',
    marginTop: 3,
  },
  cardIntro: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  foodRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  foodName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.text,
  },
  foodServing: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  foodProteinBadge: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  foodProteinText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.green,
    fontVariant: ['tabular-nums'],
  },
  splitHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  phaseItem: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceInput,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 8,
  },
  phaseItemActive: {
    borderColor: COLORS.greenBorder,
    backgroundColor: COLORS.greenSoft,
  },
  phaseItemLast: {
    marginBottom: 0,
  },
  phaseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phaseRange: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  currentPhaseBadge: {
    backgroundColor: COLORS.green,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentPhaseText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.greenDark,
  },
  phaseLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 4,
  },
  phaseDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
});
