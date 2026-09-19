import React, { useState } from 'react';
import { Swords, Plus, LogIn, Bot, Sparkles, Zap, AlertCircle } from 'lucide-react';
import type { UserProfile, VersusMatch } from '../types';
import { VersusBattleRoom } from './VersusBattleRoom';
import { sounds } from '../lib/sounds';

interface VersusArenaProps {
  user: UserProfile;
  onUserUpdate: (u: UserProfile) => void;
  addParticles: (x: number, y: number, text: string, color: string) => void;
}

export const VersusArena: React.FC<VersusArenaProps> = ({
  user,
  onUserUpdate,
  addParticles,
}) => {
  const [currentMatch, setCurrentMatch] = useState<VersusMatch | null>(null);
  const [isBotMatch, setIsBotMatch] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>('');
  const [joinError, setJoinError] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Helper to generate random 1 - 7 seconds match duration
  const generateRandomDuration = (): number => {
    // Random between 1 and 7 seconds (e.g. 1, 2, 3, 4, 5, 6, 7)
    return Math.floor(Math.random() * 7) + 1;
  };

  // Helper to generate 6-digit room code
  const generateRoomCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Quick Matchmaking
  const handleQuickMatch = () => {
    setIsSearching(true);
    sounds.playClick();

    // Fast simulated search or instant match creation
    setTimeout(() => {
      setIsSearching(false);
      const matchDuration = generateRandomDuration();
      const roomId = generateRoomCode();

      const newMatch: VersusMatch = {
        roomId,
        roomName: `Arena #${roomId}`,
        duration: matchDuration,
        startWindowSeconds: 10,
        createdAt: Date.now(),
        startWindowExpiresAt: Date.now() + 10000,
        status: 'ready',
        player1: {
          id: user.id,
          username: user.username,
          clicks: 0,
          cps: 0,
          hasStarted: false,
          hasFinished: false,
        },
      };

      setIsBotMatch(false);
      setCurrentMatch(newMatch);
    }, 1200);
  };

  // Create Private Room
  const handleCreateRoom = () => {
    sounds.playClick();
    const matchDuration = generateRandomDuration();
    const roomId = generateRoomCode();

    const newMatch: VersusMatch = {
      roomId,
      roomName: `Özel Oda #${roomId}`,
      duration: matchDuration,
      startWindowSeconds: 10,
      createdAt: Date.now(),
      startWindowExpiresAt: Date.now() + 10000,
      status: 'waiting',
      player1: {
        id: user.id,
        username: user.username,
        clicks: 0,
        cps: 0,
        hasStarted: false,
        hasFinished: false,
      },
    };

    setIsBotMatch(false);
    setCurrentMatch(newMatch);
  };

  // Join Room with Code
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (code.length < 4) {
      setJoinError('Lütfen geçerli bir oda kodu girin.');
      return;
    }

    sounds.playClick();
    const matchDuration = generateRandomDuration();
    const newMatch: VersusMatch = {
      roomId: code,
      roomName: `Oda #${code}`,
      duration: matchDuration,
      startWindowSeconds: 10,
      createdAt: Date.now(),
      startWindowExpiresAt: Date.now() + 10000,
      status: 'ready',
      player1: {
        id: 'host_' + code,
        username: 'Oda Kurucusu',
        clicks: 0,
        cps: 0,
        hasStarted: false,
        hasFinished: false,
      },
      player2: {
        id: user.id,
        username: user.username,
        clicks: 0,
        cps: 0,
        hasStarted: false,
        hasFinished: false,
      },
    };

    setIsBotMatch(false);
    setCurrentMatch(newMatch);
  };

  // Practice vs AI Cyber Bot
  const handlePlayVsBot = () => {
    sounds.playClick();
    const matchDuration = generateRandomDuration();
    const roomId = 'BOT_' + Math.floor(100 + Math.random() * 900);

    const newMatch: VersusMatch = {
      roomId,
      roomName: `AI Bot Arena`,
      duration: matchDuration,
      startWindowSeconds: 10,
      createdAt: Date.now(),
      startWindowExpiresAt: Date.now() + 10000,
      status: 'ready',
      player1: {
        id: user.id,
        username: user.username,
        clicks: 0,
        cps: 0,
        hasStarted: false,
        hasFinished: false,
      },
      player2: {
        id: 'bot_cyber',
        username: 'CyberBot_X9',
        clicks: 0,
        cps: 0,
        hasStarted: false,
        hasFinished: false,
      },
    };

    setIsBotMatch(true);
    setCurrentMatch(newMatch);
  };

  // If in active battle room
  if (currentMatch) {
    return (
      <VersusBattleRoom
        match={currentMatch}
        currentUser={user}
        isBotMatch={isBotMatch}
        onLeaveRoom={() => setCurrentMatch(null)}
        onUserUpdate={onUserUpdate}
        addParticles={addParticles}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 space-y-6">
      {/* Hero 1v1 Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/80 via-[#16142a] to-purple-950/80 border-2 border-rose-500/40 p-6 md:p-8 shadow-[0_0_50px_rgba(244,63,94,0.2)] text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gerçek Zamanlı 1v1 Online Kapışma</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black font-['Orbitron'] text-white tracking-tight leading-tight">
              KAPIŞMA ARENASI
            </h1>
            <p className="text-sm md:text-base text-gray-300 max-w-lg leading-relaxed">
              Her maçta sistem <strong className="text-yellow-400">1 ile 7 saniye</strong> arasında rastgele bir kapışma süresi belirler. <strong className="text-rose-400">10 saniyelik başlama penceresinde</strong> istediğin an tıkla ve rakibini ez!
            </p>
          </div>

          <div className="bg-[#0f1224]/90 border border-gray-800 rounded-2xl p-4 text-center min-w-[180px] shadow-xl">
            <span className="text-[11px] uppercase font-bold text-gray-400 block">1v1 İstatistiğin</span>
            <div className="text-2xl font-black text-rose-400 font-['Orbitron'] my-1">
              {user.matchesWon} <span className="text-sm font-normal text-gray-500">G</span> / {user.matchesLost} <span className="text-sm font-normal text-gray-500">M</span>
            </div>
            <span className="text-xs text-emerald-400 font-bold">
              Kazanma: {user.matchesPlayed > 0 ? Math.round((user.matchesWon / user.matchesPlayed) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Mode Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Match */}
        <div className="bg-[#111426] border border-gray-800 hover:border-rose-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-lg">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">Hızlı Eşleşme</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Rastgele bir rakip bul ve anında 1-7 saniyelik refleks kapışmasına başla.
            </p>
          </div>

          <button
            onClick={handleQuickMatch}
            disabled={isSearching}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Swords className="w-4 h-4" />
            <span>{isSearching ? 'Rakip Aranıyor...' : 'Hızlı Maç Başlat'}</span>
          </button>
        </div>

        {/* Create Private Room */}
        <div className="bg-[#111426] border border-gray-800 hover:border-purple-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-lg">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">Özel Oda Kur</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Arkadaşına oda kodunu göndererek birebir özel kapışma odası oluştur.
            </p>
          </div>

          <button
            onClick={handleCreateRoom}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Oda Oluştur</span>
          </button>
        </div>

        {/* Practice vs AI Bot */}
        <div className="bg-[#111426] border border-gray-800 hover:border-cyan-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-lg">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">Cyber Bot İle Pratik</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              İnternet veya rakip beklemeden yapay zeka CyberBot ile reflekslerini geliştir.
            </p>
          </div>

          <button
            onClick={handlePlayVsBot}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center space-x-2"
          >
            <Bot className="w-4 h-4" />
            <span>Botla Kapış</span>
          </button>
        </div>
      </div>

      {/* Join Room by Code Card */}
      <div className="bg-[#111426] border border-gray-800 rounded-2xl p-5 shadow-lg">
        <h3 className="text-sm font-bold text-gray-200 mb-3 flex items-center space-x-2">
          <LogIn className="w-4 h-4 text-rose-400" />
          <span>Oda Kodu ile Katıl</span>
        </h3>
        <form onSubmit={handleJoinRoom} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              setJoinError('');
            }}
            placeholder="6 Haneli Oda Kodu (Örn: 849201)"
            maxLength={10}
            className="flex-1 bg-[#161a32] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 font-mono text-sm tracking-wider focus:outline-none focus:border-rose-400"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold text-sm transition-all shrink-0 flex items-center justify-center space-x-2"
          >
            <LogIn className="w-4 h-4 text-rose-400" />
            <span>Odaya Bağlan</span>
          </button>
        </form>
        {joinError && <p className="text-xs text-red-400 mt-2">{joinError}</p>}
      </div>

      {/* Rules Notice */}
      <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-4 text-xs text-gray-400 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-rose-300">1v1 Kapışma Kuralları & Başlama Mekaniği</p>
          <p>
            1. Eşleşme başladığında altta 10 saniyelik hazırlık sayacı çalışır.<br />
            2. Her iki oyuncu da ekstra butona basmadan, doğrudan tıklama alanına dokundukları an kendi kapışma süreleri saymaya başlar.<br />
            3. 10 saniye içinde hiç başlamayan oyuncu hükmen mağlup sayılır.<br />
            4. Süre sonunda en yüksek CPS'e (virgülden sonraki hassasiyetle) ulaşan oyuncu kazanır!
          </p>
        </div>
      </div>
    </div>
  );
};
