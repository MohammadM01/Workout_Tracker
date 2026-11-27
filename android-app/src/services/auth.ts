import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type {
  ExperienceLevel,
  FitnessGoal,
  Sex,
  UserAccount,
  UserProfile,
} from '../types/models';
import { getLocalDateKey } from '../utils/date';
import { getDatabase, saveWeightEntry, type UserRow } from './database';

const SESSION_USER_KEY = 'gymlog_active_user_id';
const REMEMBERED_USER_KEY = 'gymlog_remembered_user_id';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashSecret(secret: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}::gymlog::${secret}`
  );
}

function mapUserRow(row: UserRow): UserAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    biometricEnabled: row.biometric_enabled === 1,
    hasPin: Boolean(row.pin_hash),
    weightKg: row.start_weight_kg || 89.0,
    age: row.age || 22,
    heightCm: row.height_cm || 171,
    sex: (row.sex === 'female' ? 'female' : 'male') as Sex,
    experience: (
      row.experience === 'beginner' || row.experience === 'advanced'
        ? row.experience
        : 'intermediate'
    ) as ExperienceLevel,
    goal: (
      row.goal === 'fat_loss' || row.goal === 'lean_bulk' ? row.goal : 'recomp'
    ) as FitnessGoal,
    createdAt: row.created_at,
  };
}

export async function getBiometricAvailability(): Promise<{
  available: boolean;
  enrolled: boolean;
}> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
    return { available: hasHardware, enrolled };
  } catch {
    return { available: false, enrolled: false };
  }
}

export async function getRememberedUser(): Promise<UserAccount | null> {
  const rememberedId = await SecureStore.getItemAsync(REMEMBERED_USER_KEY);
  if (!rememberedId) return null;
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [rememberedId]);
  return row ? mapUserRow(row) : null;
}

export async function restoreSessionUser(): Promise<{
  user: UserAccount | null;
  requiresQuickUnlock: boolean;
}> {
  const activeId = await SecureStore.getItemAsync(SESSION_USER_KEY);
  if (activeId) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [activeId]);
    if (row) {
      const account = mapUserRow(row);
      const requiresQuickUnlock = account.biometricEnabled || account.hasPin;
      return { user: account, requiresQuickUnlock };
    }
  }
  return { user: null, requiresQuickUnlock: false };
}

export async function registerAccount(params: {
  name: string;
  email: string;
  password: string;
  age?: number;
  weightKg?: number;
  heightCm?: number;
  sex?: Sex;
  experience?: ExperienceLevel;
  goal?: FitnessGoal;
}): Promise<UserAccount> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const password = params.password;

  if (name.length < 2) {
    throw new Error('Please enter your name (at least 2 characters).');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );
  if (existing) {
    throw new Error('An account with this email already exists on this device.');
  }

  const id = Crypto.randomUUID();
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = toHex(saltBytes);
  const passwordHash = await hashSecret(password, salt);
  const createdAt = new Date().toISOString();

  const weightKg =
    params.weightKg && params.weightKg >= 35 && params.weightKg <= 250
      ? Math.round(params.weightKg * 10) / 10
      : 89.0;
  const age =
    params.age && params.age >= 15 && params.age <= 80 ? Math.round(params.age) : 22;
  const heightCm =
    params.heightCm && params.heightCm >= 130 && params.heightCm <= 225
      ? Math.round(params.heightCm)
      : 171;
  const sex: Sex = params.sex === 'female' ? 'female' : 'male';
  const experience: ExperienceLevel = params.experience ?? 'intermediate';
  const goal: FitnessGoal = params.goal ?? 'recomp';

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO users (
         id, name, email, password_hash, salt, pin_hash, biometric_enabled,
         start_weight_kg, age, height_ft, height_cm, sex, experience, goal, created_at
       ) VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        email,
        passwordHash,
        salt,
        weightKg,
        age,
        (heightCm / 30.48).toFixed(2),
        heightCm,
        sex,
        experience,
        goal,
        createdAt,
      ]
    );
    await db.runAsync(
      `INSERT INTO user_state (user_id, active_week, updated_at) VALUES (?, 1, ?)`,
      [id, createdAt]
    );
  });

  // Auto-seed starting weight as baseline weigh-in
  await saveWeightEntry(id, getLocalDateKey(), weightKg);

  await SecureStore.setItemAsync(SESSION_USER_KEY, id);
  await SecureStore.setItemAsync(REMEMBERED_USER_KEY, id);

  const created = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  if (!created) throw new Error('Failed to load created account.');
  return mapUserRow(created);
}

export async function updateUserProfile(
  userId: string,
  profile: UserProfile
): Promise<UserAccount> {
  const age = Math.max(15, Math.min(80, Math.round(profile.age)));
  const weightKg = Math.max(35, Math.min(250, Math.round(profile.weightKg * 10) / 10));
  const heightCm = Math.max(130, Math.min(225, Math.round(profile.heightCm)));

  const db = await getDatabase();
  await db.runAsync(
    `UPDATE users
     SET age = ?, start_weight_kg = ?, height_cm = ?, height_ft = ?, sex = ?, experience = ?, goal = ?
     WHERE id = ?`,
    [
      age,
      weightKg,
      heightCm,
      (heightCm / 30.48).toFixed(2),
      profile.sex,
      profile.experience,
      profile.goal,
      userId,
    ]
  );

  const updated = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!updated) throw new Error('Account not found.');
  return mapUserRow(updated);
}

export async function loginWithPassword(params: {
  email: string;
  password: string;
}): Promise<UserAccount> {
  const email = params.email.trim().toLowerCase();
  const password = params.password;

  if (!email || !password) {
    throw new Error('Enter your email and password.');
  }

  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  if (!row) {
    throw new Error('No account found for that email on this device.');
  }

  const candidateHash = await hashSecret(password, row.salt);
  if (candidateHash !== row.password_hash) {
    throw new Error('Incorrect password. Please try again.');
  }

  await SecureStore.setItemAsync(SESSION_USER_KEY, row.id);
  await SecureStore.setItemAsync(REMEMBERED_USER_KEY, row.id);
  return mapUserRow(row);
}

export async function unlockWithBiometrics(userId: string): Promise<UserAccount> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock GymLog',
    cancelLabel: 'Use Password',
    disableDeviceFallback: false,
  });

  if (!result.success) {
    throw new Error('Biometric verification was cancelled or did not match.');
  }

  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!row) throw new Error('Account not found.');

  await SecureStore.setItemAsync(SESSION_USER_KEY, row.id);
  await SecureStore.setItemAsync(REMEMBERED_USER_KEY, row.id);
  return mapUserRow(row);
}

export async function unlockWithPin(userId: string, pin: string): Promise<UserAccount> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('Enter your 4-digit PIN.');
  }
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!row || !row.pin_hash) {
    throw new Error('Quick PIN is not configured for this account.');
  }
  const candidate = await hashSecret(pin, row.salt);
  if (candidate !== row.pin_hash) {
    throw new Error('Incorrect 4-digit PIN.');
  }

  await SecureStore.setItemAsync(SESSION_USER_KEY, row.id);
  await SecureStore.setItemAsync(REMEMBERED_USER_KEY, row.id);
  return mapUserRow(row);
}

export async function setQuickPin(userId: string, pin: string | null): Promise<UserAccount> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!row) throw new Error('Account not found.');

  if (pin === null) {
    await db.runAsync('UPDATE users SET pin_hash = NULL WHERE id = ?', [userId]);
  } else {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('Quick PIN must be exactly 4 digits.');
    }
    const pinHash = await hashSecret(pin, row.salt);
    await db.runAsync('UPDATE users SET pin_hash = ? WHERE id = ?', [pinHash, userId]);
  }

  const updated = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  return mapUserRow(updated!);
}

export async function setBiometricUnlock(
  userId: string,
  enabled: boolean
): Promise<UserAccount> {
  if (enabled) {
    const bio = await getBiometricAvailability();
    if (!bio.available || !bio.enrolled) {
      throw new Error('No biometric lock is enrolled on this device.');
    }
    const verify = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm biometric unlock for GymLog',
      cancelLabel: 'Cancel',
    });
    if (!verify.success) {
      throw new Error('Biometric confirmation failed.');
    }
  }

  const db = await getDatabase();
  await db.runAsync('UPDATE users SET biometric_enabled = ? WHERE id = ?', [
    enabled ? 1 : 0,
    userId,
  ]);
  const updated = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [userId]);
  return mapUserRow(updated!);
}

export async function changePassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (params.newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [params.userId]);
  if (!row) throw new Error('Account not found.');

  const currentHash = await hashSecret(params.currentPassword, row.salt);
  if (currentHash !== row.password_hash) {
    throw new Error('Current password is incorrect.');
  }

  const nextHash = await hashSecret(params.newPassword, row.salt);
  await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [nextHash, params.userId]);
}

export async function signOut(forgetRemembered = false): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_USER_KEY);
  if (forgetRemembered) {
    await SecureStore.deleteItemAsync(REMEMBERED_USER_KEY);
  }
}

export async function listDeviceAccounts(): Promise<UserAccount[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<UserRow>('SELECT * FROM users ORDER BY created_at DESC');
  return rows.map(mapUserRow);
}
