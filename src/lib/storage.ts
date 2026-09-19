import type { UserProfile, SoloScoreRecord } from '../types';

const PROFILE_KEY = 'cps_arena_user_profile';
const SOLO_HISTORY_KEY = 'cps_arena_solo_history';

// Generate fun default gaming name if none exists
const DEFAULT_NAMES = [
  'CyberClicker', 'NeonReflex', 'SpeedDemon', 'QuantumFinger',
  'TitanClicker', 'VortexPro', 'PulseMaster', 'ApexStriker'
];

export function getOrCreateUserProfile(): UserProfile {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore parse error
  }

  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const randomName = `${DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)]}_${randomSuffix}`;
  const newProfile: UserProfile = {
    id: 'user_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    username: randomName,
    highScoreCps: 0,
    totalClicks: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    createdAt: new Date().toISOString(),
  };

  saveUserProfile(newProfile);
  return newProfile;
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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
    // Keep last 30 tests
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
