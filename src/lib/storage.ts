import type { UserProfile, SoloScoreRecord } from '../types';

const LOCAL_PROFILE_KEY = 'cps_arena_user_profile';
const SESSION_PROFILE_KEY = 'cps_arena_session_profile';
const SOLO_HISTORY_KEY = 'cps_arena_solo_history';

// Generate fun default gaming name if none exists
const DEFAULT_NAMES = [
  'CyberClicker', 'NeonReflex', 'SpeedDemon', 'QuantumFinger',
  'TitanClicker', 'VortexPro', 'PulseMaster', 'ApexStriker'
];

export function getOrCreateUserProfile(): UserProfile {
  // 1. Check current tab session first
  try {
    const sessionSaved = sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (sessionSaved) {
      return JSON.parse(sessionSaved);
    }
  } catch {
    // ignore
  }

  // 2. Check localStorage
  let baseProfile: UserProfile | null = null;
  try {
    const localSaved = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (localSaved) {
      baseProfile = JSON.parse(localSaved);
    }
  } catch {
    // ignore
  }

  // If local exists and tab has no session yet, we use a distinct tab session ID to allow multi-tab testing
  const tabRandomId = 'user_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const randomName = `${DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)]}_${randomSuffix}`;

  const profile: UserProfile = {
    id: tabRandomId,
    username: baseProfile ? baseProfile.username : randomName,
    highScoreCps: baseProfile ? baseProfile.highScoreCps : 0,
    totalClicks: baseProfile ? baseProfile.totalClicks : 0,
    matchesPlayed: baseProfile ? baseProfile.matchesPlayed : 0,
    matchesWon: baseProfile ? baseProfile.matchesWon : 0,
    matchesLost: baseProfile ? baseProfile.matchesLost : 0,
    createdAt: baseProfile ? baseProfile.createdAt : new Date().toISOString(),
  };

  saveUserProfile(profile);
  return profile;
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save user profile:', err);
  }
}

export function updateUsername(newUsername: string): UserProfile {
  const profile = getOrCreateUserProfile();
  const cleaned = newUsername.trim().substring(0, 20);
  if (cleaned.length > 0) {
    profile.username = cleaned;
    saveUserProfile(profile);
  }
  return profile;
}

export function recordSoloScore(cps: number, duration: number, totalClicks: number, tierText: string): { profile: UserProfile, isNewHighScore: boolean } {
  const profile = getOrCreateUserProfile();
  const isNewHighScore = cps > profile.highScoreCps;
  if (isNewHighScore) {
    profile.highScoreCps = Number(cps.toFixed(2));
  }
  profile.totalClicks += totalClicks;
  saveUserProfile(profile);

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
  saveUserProfile(profile);
  return profile;
}
