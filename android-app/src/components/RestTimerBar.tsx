import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/colors';
import { formatMMSS } from '../utils/date';

interface RestTimerBarProps {
  visible: boolean;
  paused: boolean;
  remainingMs: number;
  label: string;
  onAdjust: (deltaSec: number) => void;
  onTogglePause: () => void;
  onClose: () => void;
}

export function RestTimerBar({
  visible,
  paused,
  remainingMs,
  label,
  onAdjust,
  onTogglePause,
  onClose,
}: RestTimerBarProps) {
  if (!visible) return null;

  const finished = remainingMs <= 0;

  return (
    <View style={[styles.bar, finished && styles.barFinished]}>
      <View style={styles.left}>
        <Text style={styles.clock}>{formatMMSS(remainingMs)}</Text>
        <Text style={[styles.label, finished && styles.labelFinished]} numberOfLines={1}>
          {finished ? 'Rest complete — next set' : label}
        </Text>
      </View>

      <View style={styles.btns}>
        <Pressable style={styles.tBtn} onPress={() => onAdjust(-15)}>
          <Text style={styles.tBtnText}>-15s</Text>
        </Pressable>
        <Pressable style={styles.tBtn} onPress={() => onAdjust(15)}>
          <Text style={styles.tBtnText}>+15s</Text>
        </Pressable>
        <Pressable style={styles.tBtn} onPress={onTogglePause}>
          <Text style={styles.tBtnText}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <Pressable style={styles.tBtn} onPress={onClose} accessibilityLabel="Close timer">
          <Text style={styles.tBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: COLORS.timerBg,
    borderWidth: 1,
    borderColor: COLORS.timerBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    elevation: 10,
  },
  barFinished: {
    backgroundColor: COLORS.greenTimerBg,
    borderColor: COLORS.green,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  clock: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 58,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  labelFinished: {
    color: COLORS.greenTimerLabel,
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  tBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.text,
  },
});
