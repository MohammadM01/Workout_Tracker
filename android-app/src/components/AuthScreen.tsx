import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calculatePersonalizedTargets } from '../engine/planGenerator';
import {
  getBiometricAvailability,
  getRememberedUser,
  listDeviceAccounts,
  loginWithPassword,
  registerAccount,
  signOut,
  unlockWithBiometrics,
  unlockWithPin,
} from '../services/auth';
import { COLORS } from '../theme/colors';
import type {
  ExperienceLevel,
  FitnessGoal,
  Sex,
  UserAccount,
} from '../types/models';

interface AuthScreenProps {
  lockedUser?: UserAccount | null;
  onAuthenticated: (user: UserAccount) => void;
}

type AuthMode = 'login' | 'signup';

export function AuthScreen({ lockedUser, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [remembered, setRemembered] = useState<UserAccount | null>(lockedUser ?? null);
  const [deviceAccounts, setDeviceAccounts] = useState<UserAccount[]>([]);
  const [biometricSupported, setBiometricSupported] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Dynamic Onboarding Profile
  const [ageText, setAgeText] = useState('22');
  const [weightText, setWeightText] = useState('89.0');
  const [heightText, setHeightText] = useState('171');
  const [sex, setSex] = useState<Sex>('male');
  const [experience, setExperience] = useState<ExperienceLevel>('intermediate');
  const [goal, setGoal] = useState<FitnessGoal>('recomp');

  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showQuickUnlock, setShowQuickUnlock] = useState(Boolean(lockedUser));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewTargets = useMemo(
    () =>
      calculatePersonalizedTargets({
        age: parseInt(ageText, 10) || 22,
        weightKg: parseFloat(weightText) || 89,
        heightCm: parseFloat(heightText) || 171,
        sex,
        experience,
        goal,
      }),
    [ageText, weightText, heightText, sex, experience, goal]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [bio, rem, accounts] = await Promise.all([
        getBiometricAvailability(),
        lockedUser ? Promise.resolve(lockedUser) : getRememberedUser(),
        listDeviceAccounts(),
      ]);
      if (!mounted) return;
      setBiometricSupported(bio.available && bio.enrolled);
      setRemembered(rem);
      setDeviceAccounts(accounts);
      if (rem && (rem.biometricEnabled || rem.hasPin)) {
        setShowQuickUnlock(true);
      } else if (rem) {
        setEmail(rem.email);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lockedUser]);

  const handleBiometricUnlock = async () => {
    if (!remembered) return;
    setError(null);
    setBusy(true);
    try {
      const user = await unlockWithBiometrics(remembered.id);
      onAuthenticated(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Biometric unlock failed.');
    } finally {
      setBusy(false);
    }
  };

  const handlePinUnlock = async () => {
    if (!remembered) return;
    setError(null);
    setBusy(true);
    try {
      const user = await unlockWithPin(remembered.id, pinInput.trim());
      onAuthenticated(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PIN unlock failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitCredentials = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const user = await loginWithPassword({ email, password });
        onAuthenticated(user);
      } else {
        const parsedAge = parseInt(ageText, 10);
        const parsedWeight = parseFloat(weightText);
        const parsedHeight = parseFloat(heightText);
        if (isNaN(parsedAge) || parsedAge < 15 || parsedAge > 80) {
          throw new Error('Enter a valid age between 15 and 80.');
        }
        if (isNaN(parsedWeight) || parsedWeight < 35 || parsedWeight > 250) {
          throw new Error('Enter a valid weight in kg (35–250).');
        }
        if (isNaN(parsedHeight) || parsedHeight < 130 || parsedHeight > 225) {
          throw new Error('Enter a valid height in cm (130–225).');
        }

        const user = await registerAccount({
          name,
          email,
          password,
          age: parsedAge,
          weightKg: parsedWeight,
          heightCm: parsedHeight,
          sex,
          experience,
          goal,
        });
        onAuthenticated(user);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut(false);
    setShowQuickUnlock(false);
    setPinInput('');
    setError(null);
    if (remembered) setEmail(remembered.email);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="dumbbell" size={26} color={COLORS.accentFg} />
            </View>
            <Text style={styles.brandTitle}>GymLog</Text>
            <Text style={styles.brandSub}>Dynamic 12-Week Aesthetic &amp; Posture Tracker</Text>
            <View style={styles.vaultPill}>
              <Feather name="shield" size={12} color={COLORS.green} />
              <Text style={styles.vaultPillText}>Encrypted Offline Vault · Keystore &amp; SQLite</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={15} color={COLORS.dangerText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {showQuickUnlock && remembered ? (
            <View style={styles.card}>
              <View style={styles.accountBadgeRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {remembered.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{remembered.name}</Text>
                  <Text style={styles.accountEmail}>{remembered.email}</Text>
                </View>
              </View>

              {remembered.biometricEnabled && biometricSupported ? (
                <Pressable
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                  onPress={handleBiometricUnlock}
                  disabled={busy}
                >
                  <MaterialCommunityIcons
                    name="fingerprint"
                    size={20}
                    color={COLORS.accentFg}
                  />
                  <Text style={styles.primaryBtnText}>Unlock with Biometrics</Text>
                </Pressable>
              ) : null}

              {remembered.hasPin ? (
                <View style={styles.pinBlock}>
                  <Text style={styles.fieldLabel}>4-Digit Quick PIN</Text>
                  <View style={styles.pinRow}>
                    <TextInput
                      style={[styles.input, styles.pinInput]}
                      value={pinInput}
                      onChangeText={(t) => setPinInput(t.replace(/[^0-9]/g, '').slice(0, 4))}
                      placeholder="••••"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        styles.pinSubmitBtn,
                        pressed && styles.pressed,
                      ]}
                      onPress={handlePinUnlock}
                      disabled={busy || pinInput.length < 4}
                    >
                      <Text style={styles.secondaryBtnText}>Unlock</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <Pressable style={styles.linkBtn} onPress={handleSwitchAccount}>
                <Text style={styles.linkBtnText}>Use Password or Switch Account</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.tabs}>
                <Pressable
                  style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
                  onPress={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.tabBtn, mode === 'signup' && styles.tabBtnActive]}
                  onPress={() => {
                    setMode('signup');
                    setError(null);
                  }}
                >
                  <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                    Create Account
                  </Text>
                </Pressable>
              </View>

              {mode === 'signup' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Mohammad"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter password'}
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityLabel="Toggle password visibility"
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color={COLORS.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              {mode === 'signup' ? (
                <>
                  {/* Age, Weight, Height */}
                  <View style={styles.tripleRow}>
                    <View style={styles.tripleCol}>
                      <Text style={styles.fieldLabel}>Age</Text>
                      <TextInput
                        style={styles.input}
                        value={ageText}
                        onChangeText={(t) => setAgeText(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="22"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                    <View style={styles.tripleCol}>
                      <Text style={styles.fieldLabel}>Weight (kg)</Text>
                      <TextInput
                        style={styles.input}
                        value={weightText}
                        onChangeText={(t) => setWeightText(t.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="89.0"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                    <View style={styles.tripleCol}>
                      <Text style={styles.fieldLabel}>Height (cm)</Text>
                      <TextInput
                        style={styles.input}
                        value={heightText}
                        onChangeText={(t) => setHeightText(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="171"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </View>
                  </View>

                  {/* Sex */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Biological Sex (for BMR / Calorie Math)</Text>
                    <View style={styles.chipRow}>
                      {(['male', 'female'] as Sex[]).map((s) => (
                        <Pressable
                          key={s}
                          style={[styles.choiceChip, sex === s && styles.choiceChipActive]}
                          onPress={() => setSex(s)}
                        >
                          <Text
                            style={[
                              styles.choiceChipText,
                              sex === s && styles.choiceChipTextActive,
                            ]}
                          >
                            {s === 'male' ? 'Male' : 'Female'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Experience Level */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Training Level</Text>
                    <View style={styles.chipRow}>
                      {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map(
                        (lvl) => (
                          <Pressable
                            key={lvl}
                            style={[
                              styles.choiceChip,
                              experience === lvl && styles.choiceChipActive,
                            ]}
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
                        )
                      )}
                    </View>
                  </View>

                  {/* Goal */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Primary Goal</Text>
                    <View style={styles.chipRow}>
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
                  </View>

                  {/* Live Dynamic Plan Preview */}
                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Your Auto-Generated Plan Preview</Text>
                    <Text style={styles.previewLine}>
                      • Protein: {previewTargets.proteinMinG}–{previewTargets.proteinMaxG}g/day ·{' '}
                      {previewTargets.dailyCalories} kcal/day
                    </Text>
                    <Text style={styles.previewLine}>
                      • Zone 2 HR: {previewTargets.zone2MinBpm}–{previewTargets.zone2MaxBpm} bpm
                    </Text>
                    <Text style={styles.previewLine}>• {previewTargets.outlookHeadline}</Text>
                  </View>
                </>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                onPress={handleSubmitCredentials}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={COLORS.accentFg} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {mode === 'login' ? 'Sign In to GymLog' : 'Create Account & Build Plan'}
                  </Text>
                )}
              </Pressable>

              {mode === 'login' && deviceAccounts.length > 0 ? (
                <View style={styles.savedAccountsBox}>
                  <Text style={styles.savedAccountsLabel}>Accounts on this device</Text>
                  <View style={styles.savedAccountsList}>
                    {deviceAccounts.map((acc) => (
                      <Pressable
                        key={acc.id}
                        style={styles.accountChip}
                        onPress={() => {
                          setEmail(acc.email);
                          setRemembered(acc);
                          if (acc.biometricEnabled || acc.hasPin) {
                            setShowQuickUnlock(true);
                          }
                        }}
                      >
                        <Text style={styles.accountChipText}>{acc.name}</Text>
                        <Text style={styles.accountChipSub}>{acc.email}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  brandSub: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  vaultPill: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  vaultPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 10,
    padding: 11,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.dangerText,
    fontWeight: '500',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceInput,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 7,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: COLORS.accent,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.accentFg,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  input: {
    height: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    color: COLORS.text,
    fontSize: 14.5,
    paddingHorizontal: 11,
  },
  tripleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
    height: 36,
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
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  choiceChipTextActive: {
    color: COLORS.accentFg,
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: COLORS.greenSoft,
    borderWidth: 1,
    borderColor: COLORS.greenBorder,
    borderRadius: 10,
    padding: 11,
    marginBottom: 12,
    gap: 3,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.green,
    marginBottom: 2,
  },
  previewLine: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 0,
    height: 42,
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    height: 44,
    borderRadius: 9,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accentFg,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.text,
  },
  pressed: {
    opacity: 0.82,
  },
  accountBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  accountEmail: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },
  pinBlock: {
    marginTop: 14,
  },
  pinRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pinInput: {
    flex: 1,
    textAlign: 'center',
    letterSpacing: 6,
    fontWeight: '700',
  },
  pinSubmitBtn: {
    minWidth: 96,
  },
  linkBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blueText,
  },
  savedAccountsBox: {
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  savedAccountsLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  savedAccountsList: {
    gap: 7,
  },
  accountChip: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceInput,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  accountChipSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
