import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../theme/colors';

interface StepsCardProps {
  activeWeek: number;
  isSunday: boolean;
  stepTarget: number;
  isEditable: boolean;
  stepsValue: string;
  onChangeSteps: (val: string) => void;
}

export function StepsCard({
  activeWeek,
  isSunday,
  stepTarget,
  isEditable,
  stepsValue,
  onChangeSteps,
}: StepsCardProps) {
  const curSteps = isEditable ? stepsValue : '';
  const stepsNum = parseInt(curSteps, 10) || 0;
  const stepPct = Math.min(100, Math.round((stepsNum / stepTarget) * 100));
  const stepMet = isEditable && stepsNum >= stepTarget;

  return (
    <View style={[styles.card, stepMet && styles.cardCompleted]}>
      <View style={styles.simpleRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Daily Steps</Text>
          <Text style={styles.detail}>
            {isSunday ? 'Optional casual walk · ' : ''}
            Week {activeWeek} target: {stepTarget.toLocaleString()} steps
          </Text>
        </View>
        <Text style={styles.pctLabel}>{isEditable ? `${stepPct}%` : '—'}</Text>
      </View>

      <View style={styles.controlsRow}>
        <TextInput
          style={[styles.numInput, !isEditable && styles.numInputDisabled]}
          value={curSteps}
          editable={isEditable}
          placeholder={String(stepTarget)}
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          onChangeText={(txt) => onChangeSteps(txt.replace(/[^0-9]/g, ''))}
        />
        <Text style={styles.unitLabel}>steps today</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${isEditable ? stepPct : 0}%` },
          ]}
        />
      </View>
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
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  detail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pctLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  numInput: {
    width: 120,
    height: 38,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceInput,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  numInputDisabled: {
    backgroundColor: COLORS.surfaceElevated,
    color: COLORS.textMuted,
    opacity: 0.7,
  },
  unitLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  progressTrack: {
    height: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.green,
    borderRadius: 999,
  },
});
