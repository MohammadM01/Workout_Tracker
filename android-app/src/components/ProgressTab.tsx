import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { calculatePersonalizedTargets } from '../engine/planGenerator';
import { COLORS } from '../theme/colors';
import type { UserAccount, WorkoutState } from '../types/models';
import { formatShortDate } from '../utils/date';
import { WeightCard } from './WeightCard';

interface ProgressTabProps {
  user: UserAccount;
  workoutState: WorkoutState;
  todayKey: string;
  onSaveWeight: (kg: number) => void;
  onInvalidWeight: () => void;
}

export function ProgressTab({
  user,
  workoutState,
  todayKey,
  onSaveWeight,
  onInvalidWeight,
}: ProgressTabProps) {
  const targets = calculatePersonalizedTargets(user);
  const sortedAsc = [...workoutState.weights].sort((a, b) => a.date.localeCompare(b.date));

  // Stats summary
  const daysLogged = Object.keys(workoutState.logs).length;
  let setsCompleted = 0;
  for (const day of Object.values(workoutState.logs)) {
    for (const setArr of Object.values(day.exercises || {})) {
      for (const s of setArr) {
        if (s?.done) setsCompleted++;
      }
    }
  }

  const startKg = sortedAsc[0]?.kg ?? user.weightKg;
  const currentKg = sortedAsc[sortedAsc.length - 1]?.kg ?? user.weightKg;
  const totalDelta = +(currentKg - startKg).toFixed(1);

  // SVG Chart geometry
  const chartWidth = Math.min(540, Dimensions.get('window').width - 56);
  const chartHeight = 176;
  const padL = 36;
  const padR = 16;
  const padT = 18;
  const padB = 26;
  const innerW = Math.max(120, chartWidth - padL - padR);
  const innerH = chartHeight - padT - padB;

  const pointsData =
    sortedAsc.length > 0 ? sortedAsc : [{ date: todayKey, kg: user.weightKg }];

  const allY = [
    ...pointsData.map((p) => p.kg),
    targets.projectedEndMinKg,
    targets.projectedEndMaxKg,
  ];
  const rawMin = Math.min(...allY);
  const rawMax = Math.max(...allY);
  const yMin = Math.floor(rawMin - 1.5);
  const yMax = Math.ceil(rawMax + 1.5);
  const ySpan = Math.max(2, yMax - yMin);

  const coords = pointsData.map((p, idx) => {
    const x =
      pointsData.length === 1
        ? padL + innerW / 2
        : padL + (idx / (pointsData.length - 1)) * innerW;
    const y = padT + ((yMax - p.kg) / ySpan) * innerH;
    return { x, y, ...p };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length >= 2
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : '';

  const goalY =
    padT +
    ((yMax - (targets.projectedEndMinKg + targets.projectedEndMaxKg) / 2) / ySpan) * innerH;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* KPI Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Current</Text>
          <Text style={styles.kpiValue}>{currentKg.toFixed(1)} kg</Text>
          <Text style={[styles.kpiSub, totalDelta < 0 && styles.greenText]}>
            {totalDelta === 0
              ? 'At baseline'
              : `${totalDelta > 0 ? '+' : ''}${totalDelta.toFixed(1)} kg total`}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Days Logged</Text>
          <Text style={styles.kpiValue}>{daysLogged}</Text>
          <Text style={styles.kpiSub}>Week {workoutState.activeWeek} / 12</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Sets Done</Text>
          <Text style={styles.kpiValue}>{setsCompleted}</Text>
          <Text style={styles.kpiSub}>All workouts</Text>
        </View>
      </View>

      {/* Weight Trend Chart */}
      <Text style={styles.sectionLabel}>WEIGHT TREND &amp; 12-WEEK TARGET</Text>
      <View style={styles.card}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Body Weight Trajectory</Text>
          <Text style={styles.chartTarget}>
            12-Wk Goal: {targets.projectedEndMinKg}–{targets.projectedEndMaxKg} kg
          </Text>
        </View>

        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <SvgGradient id="weightArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={COLORS.green} stopOpacity="0.32" />
              <Stop offset="100%" stopColor={COLORS.green} stopOpacity="0.0" />
            </SvgGradient>
          </Defs>

          {/* Horizontal guides */}
          {[yMax, (yMax + yMin) / 2, yMin].map((val, idx) => {
            const yPos = padT + (idx / 2) * innerH;
            return (
              <React.Fragment key={idx}>
                <Line
                  x1={padL}
                  y1={yPos}
                  x2={padL + innerW}
                  y2={yPos}
                  stroke={COLORS.borderSubtle}
                  strokeWidth={1}
                />
                <SvgText
                  x={4}
                  y={yPos + 4}
                  fill={COLORS.textMuted}
                  fontSize={10}
                  fontWeight="600"
                >
                  {val.toFixed(0)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* 12-week target dashed line */}
          <Line
            x1={padL}
            y1={goalY}
            x2={padL + innerW}
            y2={goalY}
            stroke={COLORS.blueText}
            strokeDasharray="4 4"
            strokeWidth={1.2}
          />

          {areaPath ? <Path d={areaPath} fill="url(#weightArea)" /> : null}
          {coords.length >= 2 ? (
            <Path d={linePath} fill="none" stroke={COLORS.green} strokeWidth={2.5} />
          ) : null}

          {coords.map((c) => (
            <React.Fragment key={c.date}>
              <Circle
                cx={c.x}
                cy={c.y}
                r={4.5}
                fill={COLORS.green}
                stroke={COLORS.surface}
                strokeWidth={2}
              />
            </React.Fragment>
          ))}

          {/* First and last date labels */}
          {coords.length > 0 ? (
            <>
              <SvgText
                x={coords[0].x}
                y={chartHeight - 6}
                fill={COLORS.textMuted}
                fontSize={10}
                textAnchor={coords.length === 1 ? 'middle' : 'start'}
              >
                {formatShortDate(coords[0].date)}
              </SvgText>
              {coords.length > 1 ? (
                <SvgText
                  x={coords[coords.length - 1].x}
                  y={chartHeight - 6}
                  fill={COLORS.textMuted}
                  fontSize={10}
                  textAnchor="end"
                >
                  {formatShortDate(coords[coords.length - 1].date)}
                </SvgText>
              ) : null}
            </>
          ) : null}
        </Svg>
      </View>

      {/* Weigh-In Logger */}
      <Text style={styles.sectionLabel}>WEIGH-IN LOG</Text>
      <WeightCard
        todayKey={todayKey}
        defaultWeightKg={user.weightKg}
        isEditable={true}
        weights={workoutState.weights}
        onSaveWeight={onSaveWeight}
        onInvalidWeight={onInvalidWeight}
      />
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
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 12,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  kpiSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  greenText: {
    color: COLORS.green,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.7,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 14,
    marginBottom: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  chartTarget: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.blueText,
  },
});
