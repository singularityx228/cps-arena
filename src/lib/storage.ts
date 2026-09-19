import type { UserProfile, SoloScoreRecord } from '../types';

const USERS_DB_KEY = 'cps_arena_registered_users_db';
const ACTIVE_SESSION_KEY = 'cps_arena_active_session';
const SOLO_HISTORY_KEY = 'cps_arena_solo_history';

export interface StoredUserAccount {
  id: string;
  username: string;
  passwordHash: string;
  highScoreCps: number;
  totalClicks: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  createdAt: string;
}

// SHA-256 Password Hash using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_cps_arena_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getAllUsers(): StoredUserAccount[] {
  try {
    const saved = localStorage.getItem(USERS_DB_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveAllUsers(users: StoredUserAccount[]): void {
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users database:', err);
  }
}

// ----------------------------------------------------
// Authentication: Register, Login, Logout, Session
// ----------------------------------------------------

export async function registerUser(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (cleanUsername.length < 2) {
    return { success: false, error: 'Kullanıcı adı en az 2 karakter olmalıdır.' };
  }
  if (cleanUsername.length > 20) {
    return { success: false, error: 'Kullanıcı adı en fazla 20 karakter olabilir.' };
  }
  if (cleanPassword.length < 3) {
    return { success: false, error: 'Şifre en az 3 karakter olmalıdır.' };
  }

  const users = getAllUsers();
  // Check if username is already taken (case-insensitive)
  const isTaken = users.some(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (isTaken) {
    return {
      success: false,
      error: 'Bu kullanıcı adı zaten alınmış! Lütfen başka bir kullanıcı adı seçin.',
    };
  }

  const passwordHash = await hashPassword(cleanPassword);
  const newAccount: StoredUserAccount = {
    id: 'user_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    username: cleanUsername,
    passwordHash,
    highScoreCps: 0,
    totalClicks: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    createdAt: new Date().toISOString(),
  };

  users.push(newAccount);
  saveAllUsers(users);

  const profile: UserProfile = {
    id: newAccount.id,
    username: newAccount.username,
    highScoreCps: 0,
    totalClicks: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    createdAt: newAccount.createdAt,
  };

  setActiveUser(profile);
  return { success: true, user: profile };
}

export async function loginUser(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  const cleanUsername = usernameInput.trim();
  const cleanPassword = passwordInput.trim();

  if (!cleanUsername || !cleanPassword) {
    return { success: false, error: 'Lütfen kullanıcı adı ve şifrenizi girin.' };
  }

  const users = getAllUsers();
  const account = users.find(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (!account) {
    return {
      success: false,
      error: 'Böyle bir kullanıcı bulunamadı! Lütfen önce "Kayıt Ol" sekmesinden hesap oluşturun.',
    };
  }

  const inputHash = await hashPassword(cleanPassword);
  if (account.passwordHash !== inputHash) {
    return { success: false, error: 'Hatalı şifre! Lütfen şifrenizi kontrol edin.' };
  }

  const profile: UserProfile = {
    id: account.id,
    username: account.username,
    highScoreCps: account.highScoreCps,
    totalClicks: account.totalClicks,
    matchesPlayed: account.matchesPlayed,
    matchesWon: account.matchesWon,
    matchesLost: account.matchesLost,
    createdAt: account.createdAt,
  };

  setActiveUser(profile);
  return { success: true, user: profile };
}

export function setActiveUser(profile: UserProfile): void {
  try {
    sessionStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(profile));
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to set active user:', err);
  }
}

export function getOrCreateUserProfile(): UserProfile {
  // Check session first, then local
  try {
    const session = sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (session) return JSON.parse(session);
    const local = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      sessionStorage.setItem(ACTIVE_SESSION_KEY, local);
      return parsed;
    }
  } catch {
    // ignore
  }

  // If no user logged in, create a temporary guest profile
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const guestName = `Oyuncu_${randomSuffix}`;
  const guestProfile: UserProfile = {
    id: 'guest_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    username: guestName,
    highScoreCps: 0,
    totalClicks: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    createdAt: new Date().toISOString(),
  };

  setActiveUser(guestProfile);
  return guestProfile;
}

export async function changeUsernameWithPassword(
  newUsernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  const current = getOrCreateUserProfile();
  const cleanNew = newUsernameInput.trim();
  const cleanPass = passwordInput.trim();

  if (cleanNew.length < 2) return { success: false, error: 'Yeni isim en az 2 karakter olmalıdır.' };
  if (cleanNew.length > 20) return { success: false, error: 'Yeni isim en fazla 20 karakter olabilir.' };

  const users = getAllUsers();
  const accountIndex = users.findIndex((u) => u.id === current.id);

  if (accountIndex === -1) {
    // Guest profile rename
    const isTaken = users.some((u) => u.username.toLowerCase() === cleanNew.toLowerCase());
    if (isTaken) {
      return { success: false, error: 'Bu kullanıcı adı zaten alınmış!' };
    }
    current.username = cleanNew;
    setActiveUser(current);
    return { success: true, user: current };
  }

  // Registered account rename
  const passHash = await hashPassword(cleanPass);
  if (users[accountIndex].passwordHash !== passHash) {
    return { success: false, error: 'Şifre hatalı! İsim değiştirmek için doğru şifrenizi girmelisiniz.' };
  }

  const isTaken = users.some(
    (u, idx) => idx !== accountIndex && u.username.toLowerCase() === cleanNew.toLowerCase()
  );
  if (isTaken) {
    return { success: false, error: 'Bu kullanıcı adı zaten alınmış!' };
  }

  users[accountIndex].username = cleanNew;
  saveAllUsers(users);

  current.username = cleanNew;
  setActiveUser(current);
  return { success: true, user: current };
}

export function logoutUser(): UserProfile {
  try {
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // ignore
  }
  return getOrCreateUserProfile();
}

// ----------------------------------------------------
// Scores & Match Recording
// ----------------------------------------------------

export function recordSoloScore(
  cps: number,
  duration: number,
  totalClicks: number,
  tierText: string
): { profile: UserProfile; isNewHighScore: boolean } {
  const profile = getOrCreateUserProfile();
  const isNewHighScore = cps > profile.highScoreCps;
  if (isNewHighScore) {
    profile.highScoreCps = Number(cps.toFixed(2));
  }
  profile.totalClicks += totalClicks;
  setActiveUser(profile);

  // Sync to database if registered
  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === profile.id);
  if (idx !== -1) {
    if (isNewHighScore) users[idx].highScoreCps = profile.highScoreCps;
    users[idx].totalClicks += totalClicks;
    saveAllUsers(users);
  }

  // Save history
  try {
    const history: SoloScoreRecord[] = getSoloHistory();
    const newRecord: SoloScoreRecord = {
      id: Date.now().toString(),
      username: profile.username,
      cps: Number(cps.toFixed(2)),
      duration,
      totalClicks,
      tierText,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    history.unshift(newRecord);
    localStorage.setItem(SOLO_HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
  } catch (err) {
    console.error('Failed to save solo record:', err);
  }

  return { profile, isNewHighScore };
}

export function getSoloHistory(): SoloScoreRecord[] {
  try {
    const saved = localStorage.getItem(SOLO_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function recordMatchResult(won: boolean, clicks: number, cps: number): UserProfile {
  const profile = getOrCreateUserProfile();
  profile.matchesPlayed += 1;
  if (won) {
    profile.matchesWon += 1;
  } else {
    profile.matchesLost += 1;
  }
  profile.totalClicks += clicks;
  if (cps > profile.highScoreCps) {
    profile.highScoreCps = Number(cps.toFixed(2));
  }
  setActiveUser(profile);

  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === profile.id);
  if (idx !== -1) {
    users[idx].matchesPlayed += 1;
    if (won) users[idx].matchesWon += 1;
    else users[idx].matchesLost += 1;
    users[idx].totalClicks += clicks;
    if (cps > users[idx].highScoreCps) users[idx].highScoreCps = profile.highScoreCps;
    saveAllUsers(users);
  }

  return profile;
}
