import type { UserProfile, SoloScoreRecord } from '../types';
import { enforceRuntimeValidation } from './security';


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

export function getAllUsers(): StoredUserAccount[] {
  try {
    const saved = localStorage.getItem(USERS_DB_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveAllUsers(users: StoredUserAccount[]): void {
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users database:', err);
  }
}

const GLOBAL_LEADERBOARD_KEY = 'cps_arena_global_leaderboard_cache_v2';

export interface GlobalLeaderboardRecord {
  id: string;
  username: string;
  cps: number;
  duration: number;
  tier_text: string;
  created_at: string;
  isMe?: boolean;
}

export function getCachedLeaderboard(): GlobalLeaderboardRecord[] {
  try {
    const saved = localStorage.getItem(GLOBAL_LEADERBOARD_KEY);
    const cached: GlobalLeaderboardRecord[] = saved ? JSON.parse(saved) : [];
    
    // Merge with registered local users
    const localUsers = getAllUsers();
    const map = new Map<string, GlobalLeaderboardRecord>();
    
    // Add cached
    for (const c of cached) {
      map.set(c.username.toLowerCase(), c);
    }
    
    // Add local users
    for (const u of localUsers) {
      if (u.highScoreCps > 0) {
        const existing = map.get(u.username.toLowerCase());
        if (!existing || u.highScoreCps > existing.cps) {
          map.set(u.username.toLowerCase(), {
            id: u.id,
            username: u.username,
            cps: u.highScoreCps,
            duration: 5,
            tier_text: u.highScoreCps >= 13 ? 'I AM BETTER' : u.highScoreCps >= 9.01 ? 'AFERİN LA' : u.highScoreCps >= 8 ? 'GÜZEL' : 'ÇIK SİTEDEN BİR DAHA GELME',
            created_at: u.createdAt || new Date().toISOString(),
          });
        }
      }
    }

    const result = Array.from(map.values()).sort((a, b) => b.cps - a.cps);
    return result;
  } catch {
    return [];
  }
}

export function saveLeaderboardRecord(record: GlobalLeaderboardRecord): void {
  try {
    safeMergeLeaderboardRecords([record]);
  } catch (err) {
    console.error('Failed to cache leaderboard record:', err);
  }
}

export function safeMergeLeaderboardRecords(incoming: GlobalLeaderboardRecord[]): GlobalLeaderboardRecord[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return getCachedLeaderboard();

  const current = getCachedLeaderboard();
  const map = new Map<string, GlobalLeaderboardRecord>();

  // 1. Existing
  for (const r of current) {
    if (r && r.username) {
      map.set(r.username.toLowerCase(), r);
    }
  }

  // 2. Incoming
  for (const r of incoming) {
    if (r && r.username) {
      const key = r.username.toLowerCase();
      const existing = map.get(key);
      if (!existing || Number(r.cps) >= Number(existing.cps)) {
        map.set(key, {
          id: r.id || existing?.id || 'rec_' + Math.random().toString(36).substring(2, 9),
          username: r.username,
          cps: Number(r.cps),
          duration: Number(r.duration) || 5,
          tier_text: r.tier_text || (r.cps >= 13 ? 'I AM BETTER' : r.cps >= 9.01 ? 'AFERİN LA' : r.cps >= 8 ? 'GÜZEL' : 'ÇIK SİTEDEN BİR DAHA GELME'),
          created_at: r.created_at || new Date().toISOString(),
        });
      }
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => b.cps - a.cps).slice(0, 50);
  try {
    localStorage.setItem(GLOBAL_LEADERBOARD_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('Failed to save merged leaderboard:', err);
  }
  return merged;
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
  enforceRuntimeValidation();
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

    // Also update global leaderboard cache
    saveLeaderboardRecord({
      id: profile.id,
      username: profile.username,
      cps: Number(cps.toFixed(2)),
      duration,
      tier_text: tierText,
      created_at: new Date().toISOString(),
    });

    // Notify other tabs via BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('cps_arena_leaderboard_channel');
      bc.postMessage({
        type: 'NEW_SCORE',
        payload: {
          id: profile.id,
          username: profile.username,
          cps: Number(cps.toFixed(2)),
          duration,
          tier_text: tierText,
          created_at: new Date().toISOString(),
        },
      });
      bc.close();
    }
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

  if (cps > 0) {
    saveLeaderboardRecord({
      id: profile.id,
      username: profile.username,
      cps: Number(cps.toFixed(2)),
      duration: 5,
      tier_text: cps >= 13 ? 'I AM BETTER' : cps >= 9.01 ? 'AFERİN LA' : cps >= 8 ? 'GÜZEL' : 'ÇIK SİTEDEN BİR DAHA GELME',
      created_at: new Date().toISOString(),
    });
  }

  return profile;
}

