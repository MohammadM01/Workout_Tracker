import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from '../theme/colors';
import type { WeightEntry } from '../types/models';
import { formatShortDate } from '../utils/date';

interface WeightCardProps {
  todayKey: string;
  defaultWeightKg: number;
  isEditable: boolean;
  weights: WeightEntry[];
  onSaveWeight: (kg: number) => void;
  onInvalidWeight: () => void;
}

export function WeightCard({
  todayKey,
  defaultWeightKg,
  isEditable,
  weights,
  onSaveWeight,
  onInvalidWeight,
}: WeightCardProps) {
  const sortedWeights = [...weights].sort((a, b) => b.date.localeCompare(a.date));
  const todayEntry = sortedWeights.find((w) => w.date === todayKey);

  const [inputVal, setInputVal] = useState(todayEntry ? String(todayEntry.kg) : '');

  useEffect(() => {
    if (todayEntry) {
      setInputVal(String(todayEntry.kg));
    }
  }, [todayEntry?.kg, todayKey]);

  const handleSave = () => {
    const kg = parseFloat(inputVal);
    if (isNaN(kg) || kg < 30 || kg > 300) {
      onInvalidWeight();
      return;
    }
    const rounded = Math.round(kg * 10) / 10;
    onSaveWeight(rounded);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Body Weight (kg)</Text>
      <Text style={styles.detail}>Log weekly (ideal on Sunday morning after waking up).</Text>

      <View style={styles.entryRow}>
        <TextInput
          style={[styles.numInput, !isEditable && styles.numInputDisabled]}
          value={inputVal}
          editable={isEditable}
          placeholder={defaultWeightKg.toFixed(1)}
          placeholderTextColor={COLORS.textMuted}
          keyboardType="decimal-pad"
          onChangeText={(txt) => setInputVal(txt.replace(/[^0-9.]/g, ''))}
        />
        <Text style={styles.unitLabel}>kg</Text>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            !isEditable && styles.primaryBtnDisabled,
            pressed && isEditable && styles.pressed,
          ]}
          disabled={!isEditable}
          onPress={handleSave}
        >
          <Text style={styles.primaryBtnText}>Save Weight</Text>
        </Pressable>
      </View>

      <View style={styles.historyWrap}>
        {sortedWeights.length === 0 ? (
          <Text style={styles.emptyHistory}>
            No weigh-ins logged yet. Record your starting baseline now.
          </Text>
        ) : (
          sortedWeights.map((entry, idx) => {
            const prev = sortedWeights[idx + 1];
            let deltaText = 'Baseline';
            let isDown = false;
            if (prev) {
              const diff = +(entry.kg - prev.kg).toFixed(1);
              if (diff < 0) {
                deltaText = `${diff.toFixed(1)} kg`;
                isDown = true;
              } else if (diff > 0) {
                deltaText = `+${diff.toFixed(1)} kg`;
              } else {
                deltaText = '0.0 kg';
              }
            }

            return (
              <View
                key={entry.date}
                style={[
                  styles.historyItem,
                  idx === sortedWeights.length - 1 && styles.historyItemLast,
                ]}
              >
                <Text style={styles.historyLeft}>
                  <Text style={styles.historyWeight}>{entry.kg.toFixed(1)} kg</Text>
                  <Text style={styles.historyDate}> · {formatShortDate(entry.date)}</Text>
                </Text>
                <Text style={isDown ? styles.deltaDown : styles.deltaUp}>{deltaText}</Text>
              </View>
            );
          })
        )}
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
  entryRow: {
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
  primaryBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.8,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accentFg,
  },
  historyWrap: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 10,
  },
  emptyHistory: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  historyItemLast: {
    borderBottomWidth: 0,
  },
  historyLeft: {
    fontSize: 13.5,
  },
  historyWeight: {
    fontWeight: '700',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  historyDate: {
    color: COLORS.textSecondary,
  },
  deltaDown: {
    color: COLORS.green,
    fontWeight: '600',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  deltaUp: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
