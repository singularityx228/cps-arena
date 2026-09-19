export interface UserProfile {
  id: string;
  username: string;
  highScoreCps: number;
  totalClicks: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  createdAt: string;
}

export type EvaluationTier = {
  text: string;
  subtext: string;
  badge: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  emoji: string;
  isGodMode?: boolean;
};

export function getEvaluation(cps: number): EvaluationTier {
  if (cps <= 7.0) {
    return {
      text: 'ÇIK SİTEDEN BİR DAHA GELME',
      subtext: 'Bebekler bile daha hızlı tıklar! Klavyeyi/mouse\'u yavaşça yere bırak...',
      badge: '💀 ÇÖP SEVİYE',
      color: 'red',
      textColor: 'text-red-500',
      bgColor: 'bg-red-950/60',
      borderColor: 'border-red-600',
      glowColor: 'rgba(239, 68, 68, 0.6)',
      emoji: '💀',
      isGodMode: false,
    };
  } else if (cps <= 9.0) {
    return {
      text: 'GÜZEL',
      subtext: 'Fena değil! Ortalama bir oyuncu refleksine ulaştın.',
      badge: '⚡ GÜZEL',
      color: 'emerald',
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-950/60',
      borderColor: 'border-emerald-500',
      glowColor: 'rgba(16, 185, 129, 0.6)',
      emoji: '⚡',
      isGodMode: false,
    };
  } else if (cps <= 13.0) {
    return {
      text: 'AFERİN LA',
      subtext: 'İşte bu! Parmakların alev alıyor, rakiplerine korku saldın.',
      badge: '🔥 PRO OYUNCU',
      color: 'purple',
      textColor: 'text-purple-400',
      bgColor: 'bg-purple-950/60',
      borderColor: 'border-purple-500',
      glowColor: 'rgba(168, 85, 247, 0.7)',
      emoji: '🔥',
      isGodMode: false,
    };
  } else {
    return {
      text: 'I AM BETTER',
      subtext: 'SEN BİR MAKİNESİN! Bu hız insan sınırlarının çok ötesinde!',
      badge: '👑 GOD MODE',
      color: 'amber',
      textColor: 'text-amber-300',
      bgColor: 'bg-gradient-to-r from-amber-950/80 via-purple-950/80 to-rose-950/80',
      borderColor: 'border-amber-400',
      glowColor: 'rgba(251, 191, 36, 0.9)',
      emoji: '👑',
      isGodMode: true,
    };
  }
}

export interface SoloScoreRecord {
  id: string;
  username: string;
  cps: number;
  duration: number;
  totalClicks: number;
  tierText: string;
  date: string;
}

export interface PlayerState {
  id: string;
  username: string;
  clicks: number;
  cps: number;
  hasStarted: boolean;
  hasFinished: boolean;
  startTime?: number;
  endTime?: number;
  timedOut?: boolean;
}

export interface VersusMatch {
  roomId: string;
  roomName: string;
  duration: number; // Random 1 - 7 seconds
  startWindowSeconds: number; // 10 seconds to begin
  createdAt: number;
  startWindowExpiresAt: number;
  status: 'waiting' | 'ready' | 'battling' | 'finished';
  player1: PlayerState;
  player2?: PlayerState;
  winnerId?: string | 'draw' | 'both_timeout';
  winnerReason?: string;
}
