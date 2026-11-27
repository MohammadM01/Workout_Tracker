import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getDynamicCardioSpec } from '../engine/planGenerator';
import { COLORS } from '../theme/colors';
import type { CardioLog, CardioType, PhaseConfig } from '../types/models';
import { formatShortDate } from '../utils/date';

interface CardioCardProps {
  cardioType: CardioType;
  phaseConfig: PhaseConfig;
  isEditable: boolean;
  currentCardio: CardioLog;
  lastCardio: ({ date: string } & CardioLog) | null;
  onToggleDone: (targetMin: number) => void;
  onChangeMinutes: (minutes: string) => void;
}

export function CardioCard({
  cardioType,
  phaseConfig,
  isEditable,
  currentCardio,
  lastCardio,
  onToggleDone,
  onChangeMinutes,
}: CardioCardProps) {
  const spec = getDynamicCardioSpec(cardioType, phaseConfig);
  const done = isEditable && currentCardio.done;

  return (
    <View style={[styles.card, done && styles.cardCompleted]}>
      <View style={styles.simpleRow}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{spec.title}</Text>
          <Text style={styles.detail}>{spec.detail}</Text>
        </View>
        <Pressable
          style={[
            styles.checkBtn,
            done && styles.checkBtnChecked,
            !isEditable && styles.checkBtnDisabled,
          ]}
          disabled={!isEditable}
          onPress={() => onToggleDone(spec.targetMin)}
          accessibilityLabel="Complete cardio"
        >
          <Feather name="check" size={17} color={done ? COLORS.greenDark : COLORS.textMuted} />
        </Pressable>
      </View>

      {lastCardio ? (
        <View style={styles.lastSummary}>
          <Text style={styles.lastSummaryText}>
            Last ({formatShortDate(lastCardio.date)}):{' '}
            {lastCardio.minutes ? `${lastCardio.minutes} min` : 'Completed'}
          </Text>
        </View>
      ) : null}

      <View style={styles.controlsRow}>
        <TextInput
          style={[styles.numInput, !isEditable && styles.numInputDisabled]}
          value={isEditable ? currentCardio.minutes : ''}
          editable={isEditable}
          placeholder={String(spec.targetMin)}
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          onChangeText={(txt) => onChangeMinutes(txt.replace(/[^0-9]/g, ''))}
        />
        <Text style={styles.unitLabel}>minutes completed</Text>
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
  lastSummary: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.blueSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 9,
  },
  lastSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blueText,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  numInput: {
    width: 92,
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
});
