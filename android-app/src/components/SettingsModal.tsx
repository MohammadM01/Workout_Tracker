import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getDynamicPhaseConfig } from '../engine/planGenerator';
import {
  changePassword,
  getBiometricAvailability,
  setBiometricUnlock,
  setQuickPin,
  updateUserProfile,
} from '../services/auth';
import { COLORS } from '../theme/colors';
import type {
  ExperienceLevel,
  FitnessGoal,
  Sex,
  UserAccount,
  WorkoutState,
} from '../types/models';

interface SettingsModalProps {
  visible: boolean;
  user: UserAccount;
  workoutState: WorkoutState;
  todayKey: string;
  onClose: () => void;
  onSelectWeek: (week: number) => void;
  onImportBackup: (parsed: unknown) => Promise<void>;
  onEraseAllLogs: () => Promise<void>;
  onUserUpdated: (user: UserAccount) => void;
  onSignOut: () => void;
  onToast: (msg: string) => void;
}

export function SettingsModal({
  visible,
  user,
  workoutState,
  todayKey,
  onClose,
  onSelectWeek,
  onImportBackup,
  onEraseAllLogs,
  onUserUpdated,
  onSignOut,
  onToast,
}: SettingsModalProps) {
  const [bioAvailable, setBioAvailable] = useState(false);

  // Editable Profile Fields
  const [ageText, setAgeText] = useState(String(user.age));
  const [weightText, setWeightText] = useState(String(user.weightKg));
  const [heightText, setHeightText] = useState(String(user.heightCm));
  const [sex, setSex] = useState<Sex>(user.sex);
  const [experience, setExperience] = useState<ExperienceLevel>(user.experience);
  const [goal, setGoal] = useState<FitnessGoal>(user.goal);

  const [showPinForm, setShowPinForm] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAgeText(String(user.age));
    setWeightText(String(user.weightKg));
    setHeightText(String(user.heightCm));
    setSex(user.sex);
    setExperience(user.experience);
    setGoal(user.goal);
    getBiometricAvailability().then((res) => {
      setBioAvailable(res.available && res.enrolled);
    });
  }, [visible, user]);

  const cfg = getDynamicPhaseConfig(workoutState.activeWeek, user);

  const handleSaveProfile = async () => {
    const age = parseInt(ageText, 10);
    const weightKg = parseFloat(weightText);
    const heightCm = parseFloat(heightText);
    if (isNaN(age) || age < 15 || age > 80) {
      onToast('Enter a valid age (15–80)');
      return;
    }
    if (isNaN(weightKg) || weightKg < 35 || weightKg > 250) {
      onToast('Enter a valid weight (35–250 kg)');
      return;
    }
    if (isNaN(heightCm) || heightCm < 130 || heightCm > 225) {
      onToast('Enter a valid height (130–225 cm)');
      return;
    }

    try {
      const updated = await updateUserProfile(user.id, {
        age,
        weightKg,
        heightCm,
        sex,
        experience,
        goal,
      });
      onUserUpdated(updated);
      onToast('Plan updated for your profile');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to update profile');
    }
  };

  const handleToggleBiometric = async (nextVal: boolean) => {
    try {
      const updated = await setBiometricUnlock(user.id, nextVal);
      onUserUpdated(updated);
      onToast(nextVal ? 'Biometric unlock enabled' : 'Biometric unlock disabled');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Unable to update biometric setting');
    }
  };

  const handleSavePin = async () => {
    try {
      const updated = await setQuickPin(user.id, pinDraft.trim());
      onUserUpdated(updated);
      setPinDraft('');
      setShowPinForm(false);
      onToast('4-digit Quick PIN saved');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Invalid PIN');
    }
  };

  const handleRemovePin = async () => {
    try {
      const updated = await setQuickPin(user.id, null);
      onUserUpdated(updated);
      setPinDraft('');
      setShowPinForm(false);
      onToast('Quick PIN removed');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to remove PIN');
    }
  };

  const handleChangePassword = async () => {
    try {
      await changePassword({
        userId: user.id,
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setCurrentPw('');
      setNewPw('');
      setShowPwForm(false);
      onToast('Password updated');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Password update failed');
    }
  };

  const handleExportBackup = async () => {
    try {
      const file = new File(Paths.cache, `gymlog-backup-${todayKey}.json`);
      file.create({ overwrite: true });
      await file.write(JSON.stringify(workoutState, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export GymLog Backup',
        });
      } else {
        await Clipboard.setStringAsync(JSON.stringify(workoutState));
        onToast('Backup JSON copied to clipboard');
      }
    } catch {
      onToast('Failed to export backup');
    }
  };

  const handleCopyBackup = async () => {
    try {
      await Clipboard.setStringAsync(JSON.stringify(workoutState));
      onToast('Backup JSON copied');
    } catch {
      onToast('Copy failed — use Export Backup');
    }
  };

  const handleImportBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const pickedFile = new File(res.assets[0].uri);
      const text = await pickedFile.text();
      const parsed = JSON.parse(text);
      await onImportBackup(parsed);
      onToast('Backup restored');
    } catch {
      onToast('Invalid backup file');
    }
  };

  const confirmErase = () => {
    Alert.alert(
      'Erase All Saved Logs?',
      'Erase all saved workout logs and body weights for this account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase All',
          style: 'destructive',
          onPress: async () => {
            await onEraseAllLogs();
            onToast('All data cleared');
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Profile, Plan &amp; Backup</Text>
            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Body Profile & Dynamic Plan Generator */}
            <View style={[styles.settingBlock, styles.firstBlock]}>
              <Text style={styles.settingTitle}>Body Profile &amp; Dynamic Plan</Text>
              <Text style={styles.settingDesc}>
                Update your stats or level anytime — GymLog automatically recalibrates your split,
                sets, Zone 2 HR, calories, protein, and 12-week outlook.
              </Text>

              <View style={styles.tripleRow}>
                <View style={styles.tripleCol}>
                  <Text style={styles.smallLabel}>Age</Text>
                  <TextInput
                    style={styles.formInput}
                    value={ageText}
                    onChangeText={(t) => setAgeText(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.tripleCol}>
                  <Text style={styles.smallLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={weightText}
                    onChangeText={(t) => setWeightText(t.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.tripleCol}>
                  <Text style={styles.smallLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={heightText}
                    onChangeText={(t) => setHeightText(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.smallLabel}>Biological Sex</Text>
              <View style={[styles.chipRow, { marginBottom: 8 }]}>
                {(['male', 'female'] as Sex[]).map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.choiceChip, sex === s && styles.choiceChipActive]}
                    onPress={() => setSex(s)}
                  >
                    <Text
                      style={[styles.choiceChipText, sex === s && styles.choiceChipTextActive]}
                    >
                      {s === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.smallLabel}>Training Level</Text>
              <View style={[styles.chipRow, { marginBottom: 8 }]}>
                {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map((lvl) => (
                  <Pressable
                    key={lvl}
                    style={[styles.choiceChip, experience === lvl && styles.choiceChipActive]}
                    onPress={() => setExperience(lvl)}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        experience === lvl && styles.choiceChipTextActive,
                      ]}
                    >
                      {lvl[0].toUpperCase() + lvl.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.smallLabel}>Goal</Text>
              <View style={[styles.chipRow, { marginBottom: 10 }]}>
                {[
                  { key: 'recomp' as FitnessGoal, label: 'Recomp' },
                  { key: 'fat_loss' as FitnessGoal, label: 'Fat Loss' },
                  { key: 'lean_bulk' as FitnessGoal, label: 'Lean Bulk' },
                ].map((g) => (
                  <Pressable
                    key={g.key}
                    style={[styles.choiceChip, goal === g.key && styles.choiceChipActive]}
                    onPress={() => setGoal(g.key)}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        goal === g.key && styles.choiceChipTextActive,
                      ]}
                    >
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={styles.primaryMiniBtn} onPress={handleSaveProfile}>
                <Text style={styles.primaryMiniBtnText}>Apply &amp; Regenerate Plan</Text>
              </Pressable>
            </View>

            {/* Account & Security */}
            <View style={styles.settingBlock}>
              <Text style={styles.settingTitle}>Account &amp; Security</Text>
              <View style={styles.accountCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{user.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.accountMeta}>
                  <Text style={styles.accountName}>{user.name}</Text>
                  <Text style={styles.accountEmail}>{user.email}</Text>
                </View>
                <Pressable style={styles.signOutBtn} onPress={onSignOut}>
                  <Feather name="log-out" size={14} color={COLORS.text} />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </Pressable>
              </View>

              {bioAvailable ? (
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabelWrap}>
                    <MaterialCommunityIcons
                      name="fingerprint"
                      size={18}
                      color={COLORS.green}
                    />
                    <Text style={styles.toggleLabel}>Biometric Quick Unlock</Text>
                  </View>
                  <Switch
                    value={user.biometricEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: COLORS.border, true: COLORS.green }}
                    thumbColor={COLORS.text}
                  />
                </View>
              ) : null}

              <View style={styles.btnRow}>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => setShowPinForm((p) => !p)}
                >
                  <Text style={styles.secondaryBtnText}>
                    {user.hasPin ? 'Manage 4-Digit PIN' : 'Set 4-Digit Quick PIN'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => setShowPwForm((p) => !p)}
                >
                  <Text style={styles.secondaryBtnText}>Change Password</Text>
                </Pressable>
              </View>

              {showPinForm ? (
                <View style={styles.inlineForm}>
                  <TextInput
                    style={styles.formInput}
                    value={pinDraft}
                    onChangeText={(t) => setPinDraft(t.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="Enter new 4-digit PIN"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                  />
                  <View style={styles.btnRow}>
                    <Pressable
                      style={[styles.primaryMiniBtn, pinDraft.length < 4 && styles.disabledBtn]}
                      disabled={pinDraft.length < 4}
                      onPress={handleSavePin}
                    >
                      <Text style={styles.primaryMiniBtnText}>Save PIN</Text>
                    </Pressable>
                    {user.hasPin ? (
                      <Pressable style={styles.dangerBtn} onPress={handleRemovePin}>
                        <Text style={styles.dangerBtnText}>Remove PIN</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {showPwForm ? (
                <View style={styles.inlineForm}>
                  <TextInput
                    style={styles.formInput}
                    value={currentPw}
                    onChangeText={setCurrentPw}
                    placeholder="Current password"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={styles.formInput}
                    value={newPw}
                    onChangeText={setNewPw}
                    placeholder="New password (6+ chars)"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Pressable style={styles.primaryMiniBtn} onPress={handleChangePassword}>
                    <Text style={styles.primaryMiniBtnText}>Update Password</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {/* Active Programme Week */}
            <View style={styles.settingBlock}>
              <Text style={styles.settingTitle}>
                Active Programme Week (Auto-Scales Cardio &amp; Steps)
              </Text>
              <Text style={styles.settingDesc}>
                Week {workoutState.activeWeek}: {cfg.label} · {cfg.steps.toLocaleString()} steps/day ·{' '}
                {cfg.treadmillMin} min cardio
              </Text>
              <View style={styles.weekGrid}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const w = i + 1;
                  const selected = w === workoutState.activeWeek;
                  return (
                    <Pressable
                      key={w}
                      style={[styles.wkChoice, selected && styles.wkChoiceSelected]}
                      onPress={() => onSelectWeek(w)}
                    >
                      <Text
                        style={[
                          styles.wkChoiceText,
                          selected && styles.wkChoiceTextSelected,
                        ]}
                      >
                        Wk {w}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Backup & Restore */}
            <View style={styles.settingBlock}>
              <Text style={styles.settingTitle}>Backup &amp; Restore</Text>
              <Text style={styles.settingDesc}>
                All logs stay encrypted and local in SQLite on your phone. Export a JSON backup
                before switching devices.
              </Text>
              <View style={styles.btnRow}>
                <Pressable style={styles.secondaryBtn} onPress={handleExportBackup}>
                  <Text style={styles.secondaryBtnText}>Export Backup</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={handleCopyBackup}>
                  <Text style={styles.secondaryBtnText}>Copy JSON</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={handleImportBackup}>
                  <Text style={styles.secondaryBtnText}>Import Backup</Text>
                </Pressable>
              </View>
            </View>

            {/* Reset */}
            <View style={styles.settingBlock}>
              <Text style={styles.settingTitle}>Reset</Text>
              <View style={styles.btnRow}>
                <Pressable style={styles.dangerBtn} onPress={confirmErase}>
                  <Text style={styles.dangerBtnText}>Erase All Saved Logs</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 18,
    maxHeight: '88%',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  settingBlock: {
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  firstBlock: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  settingDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 17,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  tripleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tripleCol: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  choiceChip: {
    flex: 1,
    height: 34,
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
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  accountMeta: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  accountEmail: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 6,
  },
  toggleLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  inlineForm: {
    marginTop: 10,
    gap: 8,
    backgroundColor: COLORS.surfaceInput,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 10,
    padding: 10,
  },
  formInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 10,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wkChoice: {
    width: '23.4%',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    alignItems: 'center',
  },
  wkChoiceSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  wkChoiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  wkChoiceTextSelected: {
    color: COLORS.accentFg,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryMiniBtn: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryMiniBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accentFg,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  secondaryBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  dangerBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.dangerText,
  },
});
