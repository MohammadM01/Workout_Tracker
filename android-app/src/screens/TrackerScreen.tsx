import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CardioCard } from '../components/CardioCard';
import { ExerciseCard } from '../components/ExerciseCard';
import { ProgressTab } from '../components/ProgressTab';
import { ProteinQuickCard } from '../components/ProteinQuickCard';
import { RestTimerBar } from '../components/RestTimerBar';
import { SettingsModal } from '../components/SettingsModal';
import { StepsCard } from '../components/StepsCard';
import { TargetsTab } from '../components/TargetsTab';
import { WeightCard } from '../components/WeightCard';
import { DAY_FULL, DAY_ORDER, DAY_SHORT } from '../data/program';
import {
  calculatePersonalizedTargets,
  getDynamicPhaseConfig,
  getDynamicProgramForDay,
} from '../engine/planGenerator';
import {
  eraseUserLogs,
  importUserBackup,
  loadUserWorkoutState,
  saveActiveWeek,
  saveDayLog,
  saveWeightEntry,
} from '../services/database';
import {
  cancelRestFinishedNotification,
  initRestNotifications,
  scheduleRestFinishedNotification,
  triggerRestDoneAlert,
  triggerSetCheckHaptic,
} from '../services/notifications';
import { COLORS } from '../theme/colors';
import type {
  DayLog,
  DayOfWeek,
  ExerciseSetLog,
  RestTimerState,
  UserAccount,
  WorkoutState,
} from '../types/models';
import {
  formatHeaderDate,
  getLocalDateKey,
  getLocalDayOfWeek,
} from '../utils/date';
import {
  calculateDayProgress,
  getEmptyDayLog,
  getLastCardioRecord,
  getLastExerciseRecord,
} from '../utils/workoutHistory';

interface TrackerScreenProps {
  user: UserAccount;
  onUserUpdated: (user: UserAccount) => void;
  onSignOut: () => void;
}

type AppTab = 'today' | 'targets' | 'progress';

export function TrackerScreen({
  user,
  onUserUpdated,
  onSignOut,
}: TrackerScreenProps) {
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [todayDow, setTodayDow] = useState<DayOfWeek>(() => getLocalDayOfWeek());
  const [todayKey, setTodayKey] = useState<string>(() => getLocalDateKey());
  const [todayLabel, setTodayLabel] = useState<string>(() => formatHeaderDate());
  const [selectedDow, setSelectedDow] = useState<DayOfWeek>(() => getLocalDayOfWeek());

  const [workoutState, setWorkoutState] = useState<WorkoutState>({
    activeWeek: 1,
    logs: {},
    weights: [],
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [timer, setTimer] = useState<RestTimerState>({
    active: false,
    paused: false,
    endAt: 0,
    remainingMs: 0,
    label: '',
  });
  const timerDoneAlertedRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  useEffect(() => {
    let active = true;
    initRestNotifications().catch(() => {});
    loadUserWorkoutState(user.id)
      .then((loaded) => {
        if (active) setWorkoutState(loaded);
      })
      .catch(() => {
        if (active) showToast('Failed to load workout logs');
      });
    return () => {
      active = false;
    };
  }, [user.id, showToast]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const nowKey = getLocalDateKey();
        const nowDow = getLocalDayOfWeek();
        if (nowKey !== todayKey) {
          setTodayKey(nowKey);
          setTodayDow(nowDow);
          setSelectedDow(nowDow);
        }
        setTodayLabel(formatHeaderDate());
      }
    });
    return () => sub.remove();
  }, [todayKey]);

  useEffect(() => {
    if (!timer.active || timer.paused) return;
    const id = setInterval(() => {
      const rem = Math.max(0, timer.endAt - Date.now());
      setTimer((prev) => ({ ...prev, remainingMs: rem }));
      if (rem <= 0 && !timerDoneAlertedRef.current) {
        timerDoneAlertedRef.current = true;
        triggerRestDoneAlert();
        cancelRestFinishedNotification();
      }
    }, 250);
    return () => clearInterval(id);
  }, [timer.active, timer.paused, timer.endAt]);

  const startRestTimer = useCallback((seconds: number, exName: string) => {
    timerDoneAlertedRef.current = false;
    const ms = seconds * 1000;
    setTimer({
      active: true,
      paused: false,
      endAt: Date.now() + ms,
      remainingMs: ms,
      label: exName || 'Rest',
    });
    scheduleRestFinishedNotification(seconds, exName);
  }, []);

  const adjustTimer = useCallback((deltaSec: number) => {
    setTimer((prev) => {
      if (!prev.active) return prev;
      if (prev.paused) {
        const nextMs = Math.max(0, prev.remainingMs + deltaSec * 1000);
        if (nextMs > 0) timerDoneAlertedRef.current = false;
        return { ...prev, remainingMs: nextMs };
      }
      const nextRem = Math.max(0, prev.endAt - Date.now() + deltaSec * 1000);
      if (nextRem > 0) {
        timerDoneAlertedRef.current = false;
        scheduleRestFinishedNotification(Math.ceil(nextRem / 1000), prev.label);
      } else {
        cancelRestFinishedNotification();
      }
      return {
        ...prev,
        endAt: Date.now() + nextRem,
        remainingMs: nextRem,
      };
    });
  }, []);

  const toggleTimerPause = useCallback(() => {
    setTimer((prev) => {
      if (!prev.active) return prev;
      if (prev.paused) {
        const nextEnd = Date.now() + prev.remainingMs;
        if (prev.remainingMs > 0) {
          scheduleRestFinishedNotification(Math.ceil(prev.remainingMs / 1000), prev.label);
        }
        return { ...prev, paused: false, endAt: nextEnd };
      } else {
        const rem = Math.max(0, prev.endAt - Date.now());
        cancelRestFinishedNotification();
        return { ...prev, paused: true, remainingMs: rem };
      }
    });
  }, []);

  const stopTimer = useCallback(() => {
    cancelRestFinishedNotification();
    setTimer((prev) => ({ ...prev, active: false }));
  }, []);

  const persistDayLog = useCallback(
    (dateKey: string, updater: (cur: DayLog) => DayLog) => {
      setWorkoutState((prev) => {
        const existing = prev.logs[dateKey] || getEmptyDayLog();
        const nextLog = updater(existing);
        saveDayLog(user.id, dateKey, nextLog).catch(() => {
          showToast('Save error — check storage');
        });
        return {
          ...prev,
          logs: {
            ...prev.logs,
            [dateKey]: nextLog,
          },
        };
      });
    },
    [user.id, showToast]
  );

  const handleUpdateSet = useCallback(
    (exId: string, setIndex: number, patch: Partial<ExerciseSetLog>) => {
      persistDayLog(todayKey, (cur) => {
        const list = [...(cur.exercises[exId] || [])];
        const currentObj = list[setIndex] || { w: '', r: '', done: false };
        list[setIndex] = { ...currentObj, ...patch };
        return {
          ...cur,
          exercises: {
            ...cur.exercises,
            [exId]: list,
          },
        };
      });
    },
    [persistDayLog, todayKey]
  );

  const handleToggleSetDone = useCallback(
    (exId: string, setIndex: number, restSec: number, exName: string) => {
      triggerSetCheckHaptic();
      let becameDone = false;
      persistDayLog(todayKey, (cur) => {
        const list = [...(cur.exercises[exId] || [])];
        const currentObj = list[setIndex] || { w: '', r: '', done: false };
        becameDone = !currentObj.done;
        list[setIndex] = { ...currentObj, done: becameDone };
        return {
          ...cur,
          exercises: {
            ...cur.exercises,
            [exId]: list,
          },
        };
      });
      if (becameDone) {
        startRestTimer(restSec, exName);
      }
    },
    [persistDayLog, todayKey, startRestTimer]
  );

  const handleToggleCardioDone = useCallback(
    (targetMin: number) => {
      triggerSetCheckHaptic();
      persistDayLog(todayKey, (cur) => {
        const nextDone = !cur.cardio.done;
        const nextMin =
          nextDone && !cur.cardio.minutes ? String(targetMin) : cur.cardio.minutes;
        return {
          ...cur,
          cardio: {
            done: nextDone,
            minutes: nextMin,
          },
        };
      });
    },
    [persistDayLog, todayKey]
  );

  const handleChangeCardioMin = useCallback(
    (minutes: string) => {
      persistDayLog(todayKey, (cur) => ({
        ...cur,
        cardio: {
          ...cur.cardio,
          minutes,
        },
      }));
    },
    [persistDayLog, todayKey]
  );

  const handleChangeSteps = useCallback(
    (steps: string) => {
      persistDayLog(todayKey, (cur) => ({
        ...cur,
        steps,
      }));
    },
    [persistDayLog, todayKey]
  );

  const handleChangeProtein = useCallback(
    (proteinGrams: string) => {
      persistDayLog(todayKey, (cur) => ({
        ...cur,
        proteinGrams,
      }));
    },
    [persistDayLog, todayKey]
  );

  const handleSaveWeight = useCallback(
    (kg: number) => {
      setWorkoutState((prev) => {
        const filtered = prev.weights.filter((w) => w.date !== todayKey);
        return {
          ...prev,
          weights: [...filtered, { date: todayKey, kg }],
        };
      });
      saveWeightEntry(user.id, todayKey, kg)
        .then(() => showToast(`Saved ${kg.toFixed(1)} kg`))
        .catch(() => showToast('Failed to save weight'));
    },
    [user.id, todayKey, showToast]
  );

  const handleSelectWeek = useCallback(
    (week: number) => {
      setWorkoutState((prev) => ({ ...prev, activeWeek: week }));
      saveActiveWeek(user.id, week).catch(() => {});
      showToast(`Switched to Week ${week}`);
    },
    [user.id, showToast]
  );

  const plan = getDynamicProgramForDay(selectedDow, user);
  const phaseCfg = getDynamicPhaseConfig(workoutState.activeWeek, user);
  const targets = calculatePersonalizedTargets(user);
  const isEditable = selectedDow === todayDow;
  const todayLog = isEditable ? workoutState.logs[todayKey] || getEmptyDayLog() : null;
  const progress = calculateDayProgress(selectedDow, todayLog, user);
  const stepTarget =
    selectedDow === 0 ? Math.max(5000, phaseCfg.steps - 1500) : phaseCfg.steps;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Sticky Topbar */}
      <View style={styles.topbar}>
        <View style={styles.topbarRow}>
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>GymLog</Text>
            <Text style={styles.dateSub}>{todayLabel}</Text>
          </View>

          <View style={styles.topbarActions}>
            <Pressable
              style={styles.weekPill}
              onPress={() => setSettingsOpen(true)}
              accessibilityLabel="Select program week"
            >
              <Text style={styles.weekPillText}>Wk {workoutState.activeWeek} / 12</Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => setSettingsOpen(true)}
              accessibilityLabel="Profile and Settings"
            >
              <Feather name="settings" size={16} color={COLORS.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* 7-Day Strip (only on Today workout tab) */}
        {activeTab === 'today' ? (
          <View style={styles.dayStrip}>
            {DAY_ORDER.map((dow) => {
              const active = dow === selectedDow;
              const isToday = dow === todayDow;
              return (
                <Pressable
                  key={dow}
                  style={[
                    styles.dayBtn,
                    active && styles.dayBtnActive,
                    isToday && !active && styles.dayBtnToday,
                  ]}
                  onPress={() => setSelectedDow(dow)}
                >
                  <Text
                    style={[
                      styles.dayBtnText,
                      active && styles.dayBtnTextActive,
                      isToday && !active && styles.dayBtnTextToday,
                    ]}
                  >
                    {DAY_SHORT[dow]}
                  </Text>
                  {isToday ? (
                    <View style={[styles.todayDot, active && styles.todayDotActive]} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Active Tab Body */}
      {activeTab === 'today' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.container,
            timer.active && styles.containerWithTimer,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {!isEditable ? (
            <View style={styles.lockBanner}>
              <Text style={styles.lockBannerText}>
                Viewing <Text style={styles.bold}>{DAY_FULL[selectedDow]}</Text> (Read-only —
                unlocks on {DAY_FULL[selectedDow]})
              </Text>
              <Pressable
                style={styles.lockTodayBtn}
                onPress={() => setSelectedDow(todayDow)}
              >
                <Text style={styles.lockTodayBtnText}>Today</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.dayHeader}>
            <View style={styles.dayTitleRow}>
              <Text style={styles.dayTitle}>
                {DAY_FULL[selectedDow]} — {plan.title}
              </Text>
              <Text style={styles.phaseTag}>Week {workoutState.activeWeek}</Text>
            </View>
            <Text style={styles.dayMeta}>
              {plan.subtitle} · {phaseCfg.label}
            </Text>

            {isEditable && progress.total > 0 ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress.pct}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {progress.done} / {progress.total} done
                </Text>
              </View>
            ) : null}
          </View>

          {plan.lifts.length > 0 ? (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabelText}>
                  WORKOUT ({plan.lifts.length} EXERCISES)
                </Text>
                <Text style={styles.sectionLabelText}>DOUBLE PROGRESSION</Text>
              </View>
              {plan.lifts.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  isWeightedDefault={true}
                  isEditable={isEditable}
                  currentSets={todayLog?.exercises[ex.id] || []}
                  lastRecord={getLastExerciseRecord(workoutState.logs, ex.id, isEditable, todayKey)}
                  onUpdateSet={handleUpdateSet}
                  onToggleSetDone={handleToggleSetDone}
                  onStartRest={startRestTimer}
                />
              ))}
            </>
          ) : null}

          {plan.core.length > 0 ? (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabelText}>
                  {(plan.coreLabel || 'POSTURE & CORE').toUpperCase()}
                </Text>
                <Text style={styles.sectionLabelText}>CONTROL &amp; ALIGNMENT</Text>
              </View>
              {plan.core.map((ex) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  isWeightedDefault={false}
                  isEditable={isEditable}
                  currentSets={todayLog?.exercises[ex.id] || []}
                  lastRecord={getLastExerciseRecord(workoutState.logs, ex.id, isEditable, todayKey)}
                  onUpdateSet={handleUpdateSet}
                  onToggleSetDone={handleToggleSetDone}
                  onStartRest={startRestTimer}
                />
              ))}
            </>
          ) : null}

          {plan.cardioType ? (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabelText}>POST-WORKOUT CARDIO</Text>
                <Text style={styles.sectionLabelText}>
                  ZONE 2 ({targets.zone2MinBpm}–{targets.zone2MaxBpm} BPM)
                </Text>
              </View>
              <CardioCard
                cardioType={plan.cardioType}
                phaseConfig={phaseCfg}
                isEditable={isEditable}
                currentCardio={todayLog?.cardio || { done: false, minutes: '' }}
                lastCardio={getLastCardioRecord(
                  workoutState.logs,
                  selectedDow,
                  isEditable,
                  todayKey
                )}
                onToggleDone={handleToggleCardioDone}
                onChangeMinutes={handleChangeCardioMin}
              />
            </>
          ) : null}

          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabelText}>DAILY MOVEMENT</Text>
            <Text style={styles.sectionLabelText}>
              GOAL: {stepTarget.toLocaleString()} STEPS
            </Text>
          </View>
          <StepsCard
            activeWeek={workoutState.activeWeek}
            isSunday={selectedDow === 0}
            stepTarget={stepTarget}
            isEditable={isEditable}
            stepsValue={todayLog?.steps || ''}
            onChangeSteps={handleChangeSteps}
          />

          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabelText}>NUTRITION CHECK-IN</Text>
            <Text style={styles.sectionLabelText}>{targets.dailyCalories} KCAL TARGET</Text>
          </View>
          <ProteinQuickCard
            proteinMinG={targets.proteinMinG}
            proteinMaxG={targets.proteinMaxG}
            isEditable={isEditable}
            proteinValue={todayLog?.proteinGrams || ''}
            onChangeProtein={handleChangeProtein}
          />

          {selectedDow === 0 ? (
            <>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabelText}>WEEKLY WEIGH-IN</Text>
                <Text style={styles.sectionLabelText}>SUNDAY MORNING</Text>
              </View>
              <WeightCard
                todayKey={todayKey}
                defaultWeightKg={user.weightKg}
                isEditable={isEditable}
                weights={workoutState.weights}
                onSaveWeight={handleSaveWeight}
                onInvalidWeight={() => showToast('Enter a valid weight in kg')}
              />
            </>
          ) : null}
        </ScrollView>
      ) : activeTab === 'targets' ? (
        <TargetsTab
          user={user}
          activeWeek={workoutState.activeWeek}
          onEditProfile={() => setSettingsOpen(true)}
        />
      ) : (
        <ProgressTab
          user={user}
          workoutState={workoutState}
          todayKey={todayKey}
          onSaveWeight={handleSaveWeight}
          onInvalidWeight={() => showToast('Enter a valid weight in kg')}
        />
      )}

      {/* Floating Rest Timer Bar (raised above Bottom Nav) */}
      <View
        style={[styles.timerDock, timer.active && styles.timerDockVisible]}
        pointerEvents="box-none"
      >
        <RestTimerBar
          visible={timer.active}
          paused={timer.paused}
          remainingMs={timer.remainingMs}
          label={timer.label}
          onAdjust={adjustTimer}
          onTogglePause={toggleTimerPause}
          onClose={stopTimer}
        />
      </View>

      {/* Bottom Tab Navigation */}
      <View style={styles.bottomNav}>
        <Pressable
          style={styles.navItem}
          onPress={() => setActiveTab('today')}
        >
          <MaterialCommunityIcons
            name="dumbbell"
            size={20}
            color={activeTab === 'today' ? COLORS.text : COLORS.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'today' && styles.navLabelActive,
            ]}
          >
            Today
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => setActiveTab('targets')}
        >
          <Feather
            name="target"
            size={19}
            color={activeTab === 'targets' ? COLORS.text : COLORS.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'targets' && styles.navLabelActive,
            ]}
          >
            Plan &amp; Targets
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() => setActiveTab('progress')}
        >
          <Feather
            name="trending-up"
            size={19}
            color={activeTab === 'progress' ? COLORS.text : COLORS.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'progress' && styles.navLabelActive,
            ]}
          >
            Progress
          </Text>
        </Pressable>
      </View>

      <SettingsModal
        visible={settingsOpen}
        user={user}
        workoutState={workoutState}
        todayKey={todayKey}
        onClose={() => setSettingsOpen(false)}
        onSelectWeek={handleSelectWeek}
        onImportBackup={async (parsed) => {
          const next = await importUserBackup(user.id, parsed);
          setWorkoutState(next);
        }}
        onEraseAllLogs={async () => {
          const next = await eraseUserLogs(user.id);
          setWorkoutState(next);
        }}
        onUserUpdated={onUserUpdated}
        onSignOut={() => {
          setSettingsOpen(false);
          stopTimer();
          onSignOut();
        }}
        onToast={showToast}
      />

      {toastMsg ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  topbar: {
    backgroundColor: COLORS.topbarBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  topbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  dateSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekPill: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  weekPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStrip: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  dayBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 7,
    paddingBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  dayBtnActive: {
    backgroundColor: COLORS.accent,
  },
  dayBtnToday: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  dayBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dayBtnTextActive: {
    color: COLORS.accentFg,
  },
  dayBtnTextToday: {
    color: COLORS.text,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.green,
    position: 'absolute',
    bottom: 3,
  },
  todayDotActive: {
    backgroundColor: '#16A34A',
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 88,
  },
  containerWithTimer: {
    paddingBottom: 148,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: COLORS.amberSoft,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  lockBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.amberText,
    fontWeight: '500',
  },
  bold: {
    fontWeight: '700',
  },
  lockTodayBtn: {
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.5)',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lockTodayBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.amberText,
  },
  dayHeader: {
    marginBottom: 8,
  },
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  phaseTag: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  dayMeta: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  progressWrap: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.green,
    borderRadius: 999,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    minWidth: 64,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.7,
  },
  timerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 62,
  },
  timerDockVisible: {
    zIndex: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    height: 58,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  navLabelActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    elevation: 12,
  },
  toastText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.accentFg,
  },
});
