import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../theme/colors';
import type { ExerciseSetLog, ExerciseSpec } from '../types/models';
import { formatRest, formatShortDate } from '../utils/date';

interface ExerciseCardProps {
  exercise: ExerciseSpec;
  isWeightedDefault?: boolean;
  isEditable: boolean;
  currentSets: ExerciseSetLog[];
  lastRecord: { date: string; sets: ExerciseSetLog[] } | null;
  onUpdateSet: (exId: string, setIndex: number, patch: Partial<ExerciseSetLog>) => void;
  onToggleSetDone: (exId: string, setIndex: number, restSec: number, exName: string) => void;
  onStartRest: (restSec: number, exName: string) => void;
}

export function ExerciseCard({
  exercise,
  isWeightedDefault = true,
  isEditable,
  currentSets,
  lastRecord,
  onUpdateSet,
  onToggleSetDone,
  onStartRest,
}: ExerciseCardProps) {
  const [cueOpen, setCueOpen] = useState(false);

  const weighted = exercise.weighted !== undefined ? exercise.weighted : isWeightedDefault;
  const repColLabel = exercise.repLabel || 'Reps';

  let allDone = isEditable && exercise.sets > 0;
  for (let i = 0; i < exercise.sets; i++) {
    if (!currentSets[i]?.done) {
      allDone = false;
      break;
    }
  }

  let lastSummaryText: string | null = null;
  let topWeightText: string | null = null;
  if (lastRecord) {
    const weights = lastRecord.sets
      .map((s) => Number(s?.w))
      .filter((n) => !isNaN(n) && n > 0);
    if (weighted && weights.length > 0) {
      topWeightText = `${Math.max(...weights)} kg`;
    }
    const repsList = lastRecord.sets.map((s) => s?.r || '–').join(', ');
    lastSummaryText = `${repsList} ${repColLabel.toLowerCase()}`;
  }

  return (
    <View style={[styles.card, allDone && styles.cardCompleted]}>
      {/* Header */}
      <View style={styles.exTop}>
        <View style={styles.exTitleCol}>
          <View style={styles.exTitleLine}>
            <Text style={styles.exName}>{exercise.name}</Text>
            {exercise.posture ? (
              <View style={styles.badgePosture}>
                <Text style={styles.badgePostureText}>POSTURE</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.exTarget}>
            {exercise.sets} sets × {exercise.target} · Rest {formatRest(exercise.rest)}
          </Text>
        </View>

        <View style={styles.exTools}>
          <Pressable
            style={({ pressed }) => [styles.miniBtn, pressed && styles.pressed]}
            onPress={() => setCueOpen((prev) => !prev)}
          >
            <Text style={styles.miniBtnText}>Cue</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.miniBtn, pressed && styles.pressed]}
            onPress={() => onStartRest(exercise.rest, exercise.name)}
          >
            <Text style={styles.miniBtnText}>⏱ {formatRest(exercise.rest)}</Text>
          </Pressable>
        </View>
      </View>

      {/* Collapsible Form Cue */}
      {cueOpen ? (
        <View style={styles.cueBox}>
          <Text style={styles.cueText}>
            <Text style={styles.cueStrong}>Form: </Text>
            {exercise.cue}
          </Text>
        </View>
      ) : null}

      {/* Last Record Summary */}
      {lastRecord ? (
        <View style={styles.lastSummary}>
          <Text style={styles.lastSummaryText}>
            Last ({formatShortDate(lastRecord.date)}):{' '}
            {topWeightText ? <Text style={styles.lastSummaryBold}>{topWeightText} · </Text> : null}
            {lastSummaryText}
          </Text>
        </View>
      ) : null}

      {/* Set Table Header */}
      <View style={styles.setHeader}>
        <Text style={[styles.setHeaderCell, styles.colSet]}>SET</Text>
        <Text style={[styles.setHeaderCell, styles.colLast]}>LAST TIME</Text>
        {weighted ? <Text style={[styles.setHeaderCell, styles.colWeight]}>KG</Text> : null}
        <Text style={[styles.setHeaderCell, weighted ? styles.colReps : styles.colRepsWide]}>
          {repColLabel.toUpperCase()}
        </Text>
        <Text style={[styles.setHeaderCell, styles.colCheck]}>✓</Text>
      </View>

      {/* Set Rows */}
      {Array.from({ length: exercise.sets }).map((_, idx) => {
        const cur = currentSets[idx] || { w: '', r: '', done: false };
        const prev = lastRecord?.sets?.[idx];
        let lastText = '—';
        if (prev && (prev.w !== '' || prev.r !== '')) {
          lastText = weighted
            ? `${prev.w || '0'} kg × ${prev.r || '0'}`
            : `${prev.r || '0'} ${repColLabel.toLowerCase()}`;
        }

        return (
          <View
            key={idx}
            style={[styles.setRow, cur.done && styles.setRowDone]}
          >
            <Text style={[styles.setNum, styles.colSet]}>{idx + 1}</Text>
            <Text
              style={[
                styles.lastCell,
                styles.colLast,
                lastText === '—' && styles.lastCellEmpty,
              ]}
              numberOfLines={1}
            >
              {lastText}
            </Text>

            {weighted ? (
              <TextInput
                style={[
                  styles.numInput,
                  styles.colWeight,
                  !isEditable && styles.numInputDisabled,
                ]}
                value={cur.w}
                editable={isEditable}
                placeholder="kg"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                onChangeText={(txt) => {
                  const clean = txt.replace(/[^0-9.]/g, '');
                  onUpdateSet(exercise.id, idx, { w: clean });
                }}
              />
            ) : null}

            <TextInput
              style={[
                styles.numInput,
                weighted ? styles.colReps : styles.colRepsWide,
                !isEditable && styles.numInputDisabled,
              ]}
              value={cur.r}
              editable={isEditable}
              placeholder={repColLabel}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              onChangeText={(txt) => {
                const clean = txt.replace(/[^0-9]/g, '');
                onUpdateSet(exercise.id, idx, { r: clean });
              }}
            />

            <View style={styles.colCheckWrap}>
              <Pressable
                style={[
                  styles.checkBtn,
                  cur.done && styles.checkBtnChecked,
                  !isEditable && styles.checkBtnDisabled,
                ]}
                disabled={!isEditable}
                onPress={() => onToggleSetDone(exercise.id, idx, exercise.rest, exercise.name)}
                accessibilityLabel={`Complete set ${idx + 1}`}
              >
                <Feather
                  name="check"
                  size={17}
                  color={cur.done ? COLORS.greenDark : COLORS.textMuted}
                />
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 14,
    marginBottom: 10,
  },
  cardCompleted: {
    borderColor: COLORS.greenBorder,
  },
  exTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  exTitleCol: {
    flex: 1,
  },
  exTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  exName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  badgePosture: {
    backgroundColor: COLORS.purpleSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgePostureText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.purpleText,
    letterSpacing: 0.4,
  },
  exTarget: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  exTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  miniBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pressed: {
    opacity: 0.75,
  },
  cueBox: {
    backgroundColor: COLORS.surfaceInput,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 10,
  },
  cueText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  cueStrong: {
    color: COLORS.text,
    fontWeight: '700',
  },
  lastSummary: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.blueSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 10,
  },
  lastSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blueText,
    fontVariant: ['tabular-nums'],
  },
  lastSummaryBold: {
    fontWeight: '800',
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  setHeaderCell: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  setRowDone: {
    backgroundColor: COLORS.greenSoft,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderTopColor: 'transparent',
  },
  colSet: {
    width: 28,
    textAlign: 'center',
  },
  colLast: {
    flex: 1,
  },
  colWeight: {
    width: 72,
    textAlign: 'center',
  },
  colReps: {
    width: 62,
    textAlign: 'center',
  },
  colRepsWide: {
    width: 88,
    textAlign: 'center',
  },
  colCheck: {
    width: 38,
    textAlign: 'center',
  },
  colCheckWrap: {
    width: 38,
    alignItems: 'center',
  },
  setNum: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  lastCell: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blueText,
    fontVariant: ['tabular-nums'],
  },
  lastCellEmpty: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  numInput: {
    height: 38,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceInput,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  numInputDisabled: {
    backgroundColor: COLORS.surfaceElevated,
    color: COLORS.textMuted,
    opacity: 0.7,
  },
  checkBtn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnChecked: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  checkBtnDisabled: {
    opacity: 0.35,
  },
});
