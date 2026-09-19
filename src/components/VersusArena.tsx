import React, { useState, useEffect, useRef } from 'react';
import { Swords, Plus, LogIn, Bot, Sparkles, Zap, Hash, X, Check, Loader2 } from 'lucide-react';
import type { UserProfile, VersusMatch } from '../types';
import { VersusBattleRoom } from './VersusBattleRoom';
import { sounds } from '../lib/sounds';
import { MatchmakingQueueService } from '../lib/realtime';

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

  // Custom Room Creation Modal
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState<boolean>(false);
  const [customRoomNumber, setCustomRoomNumber] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');

  // Queue State
  const [isQueueActive, setIsQueueActive] = useState<boolean>(false);
  const [queueTime, setQueueTime] = useState<number>(0);
  const queueServiceRef = useRef<MatchmakingQueueService | null>(null);
  const queueTimerRef = useRef<number | null>(null);

  // Helper to generate random 1 - 7 seconds match duration
  const generateRandomDuration = (): number => {
    return Math.floor(Math.random() * 7) + 1;
  };

  const generateRandomRoomCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // ----------------------------------------------------
  // Matchmaking Queue System
  // ----------------------------------------------------
  const handleEnterQueue = () => {
    sounds.playClick();
    setIsQueueActive(true);
    setQueueTime(0);

    const startTime = Date.now();
    queueTimerRef.current = window.setInterval(() => {
      setQueueTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const queueService = new MatchmakingQueueService(user, {
      onMatched: ({ roomId, duration, isHost, opponent }) => {
        sounds.playVictory();
        handleLeaveQueue();

        setCurrentMatch({
          roomId,
          roomName: `Sıra Maçı #${roomId}`,
          isHost,
          duration,
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
          player2: {
            id: opponent.id,
            username: opponent.username,
            clicks: 0,
            cps: 0,
            hasStarted: false,
            hasFinished: false,
          },
        });
      },
      onError: (err) => {
        console.warn('Queue error:', err);
      },
    });

    queueServiceRef.current = queueService;
    queueService.start();
  };

  const handleLeaveQueue = () => {
    if (queueTimerRef.current) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    if (queueServiceRef.current) {
      queueServiceRef.current.stop();
      queueServiceRef.current = null;
    }
    setIsQueueActive(false);
  };

  useEffect(() => {
    return () => {
      handleLeaveQueue();
    };
  }, []);


  // ----------------------------------------------------
  // Room Creation & Joining
  // ----------------------------------------------------
  const handleOpenCreateModal = () => {
    sounds.playClick();
    setCustomRoomNumber(generateRandomRoomCode());
    setCreateError('');
    setIsCreateRoomModalOpen(true);
  };

  const handleConfirmCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoomCode = customRoomNumber.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanRoomCode.length < 2) {
      setCreateError('Oda numarası en az 2 karakter olmalıdır.');
      return;
    }
    if (cleanRoomCode.length > 12) {
      setCreateError('Oda numarası en fazla 12 karakter olabilir.');
      return;
    }

    sounds.playClick();
    setIsCreateRoomModalOpen(false);
    const matchDuration = generateRandomDuration();

    const newMatch: VersusMatch = {
      roomId: cleanRoomCode,
      roomName: `Özel Oda #${cleanRoomCode}`,
      isHost: true,
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

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (code.length < 2) {
      setJoinError('Lütfen geçerli bir oda kodu girin.');
      return;
    }

    sounds.playClick();
    const newMatch: VersusMatch = {
      roomId: code,
      roomName: `Oda #${code}`,
      isHost: false, // guest
      duration: 5, // synced from host
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

  const handlePlayVsBot = () => {
    sounds.playClick();
    const matchDuration = generateRandomDuration();
    const roomId = 'BOT_' + Math.floor(100 + Math.random() * 900);

    const newMatch: VersusMatch = {
      roomId,
      roomName: `AI Bot Arena`,
      isHost: true,
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
              Hızlı eşleşmeye basıp sıraya girin veya özel oda kurup arkadaşınızı davet edin! İki oyuncu buluştuğu anda <strong className="text-yellow-400">"RAKİP BULUNDU!"</strong> sayımı ve <strong className="text-rose-400">1-7 saniyelik</strong> kapışma başlar!
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
        {/* Quick Matchmaking (Queue) */}
        <div className="bg-[#111426] border border-gray-800 hover:border-rose-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-lg">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">Hızlı Eşleşme (Sıraya Gir)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Tek tıkla sıraya girin. Başka bir oyuncu sıraya girdiği an otomatik olarak maça başlayın!
            </p>
          </div>

          <button
            onClick={handleEnterQueue}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all flex items-center justify-center space-x-2"
          >
            <Swords className="w-4 h-4" />
            <span>Sıraya Gir & Rakip Bul</span>
          </button>
        </div>

        {/* Create Private Room with Custom Room Number */}
        <div className="bg-[#111426] border border-gray-800 hover:border-purple-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-lg">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-white">Özel Oda Kur</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              İstediğiniz oda numarasını belirleyin ve arkadaşınızı özel 1v1 maçına davet edin.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Oda Numarası Belirle & Kur</span>
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
              Rakip beklemeden yapay zeka CyberBot ile reflekslerinizi test edin.
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
          <span>Oda Numarası Yazarak Katıl</span>
        </h3>
        <form onSubmit={handleJoinRoom} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value.toUpperCase());
              setJoinError('');
            }}
            placeholder="Oda Numarasını Gir (Örn: 582910 veya OYUN1)"
            maxLength={12}
            className="flex-1 bg-[#161a32] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 font-mono text-sm tracking-wider focus:outline-none focus:border-rose-400 uppercase font-bold"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-sm transition-all shrink-0 flex items-center justify-center space-x-2 shadow-lg"
          >
            <LogIn className="w-4 h-4" />
            <span>Odaya Katıl</span>
          </button>
        </form>
        {joinError && <p className="text-xs text-red-400 mt-2 font-semibold">{joinError}</p>}
      </div>

      {/* Matchmaking Queue Modal */}
      {isQueueActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0f1324] border-2 border-rose-500/60 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(244,63,94,0.3)] space-y-5">
            <div className="w-20 h-20 rounded-3xl bg-rose-600/20 border-2 border-rose-500 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(244,63,94,0.4)] animate-pulse">
              <Loader2 className="w-10 h-10 text-rose-400 animate-spin" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black font-['Orbitron'] text-white">
                SIRADASINIZ...
              </h2>
              <p className="text-sm text-gray-300">
                Rakip aranıyor! Başka bir oyuncu sıraya girdiği an maç başlayacak.
              </p>
            </div>

            <div className="bg-black/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-around">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Geçen Süre</span>
                <span className="text-2xl font-black text-rose-400 font-['Orbitron']">{queueTime}s</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Durum</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                  <span>Eşleşme Aktif</span>
                </span>
              </div>
            </div>

            <button
              onClick={handleLeaveQueue}
              className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white font-bold text-sm transition-all"
            >
              Sıradan Ayrıl
            </button>
          </div>
        </div>
      )}

      {/* Custom Room Creation Modal */}
      {isCreateRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0f1322] border border-purple-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-left">
            <button
              onClick={() => setIsCreateRoomModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-wide">Oda Numarası Belirle</h3>
                <p className="text-xs text-gray-400">Arkadaşınızın odaya girmesi için bir numara/kod yazın</p>
              </div>
            </div>

            <form onSubmit={handleConfirmCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Oda Numarası / Kodu
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customRoomNumber}
                    onChange={(e) => {
                      setCustomRoomNumber(e.target.value.toUpperCase());
                      setCreateError('');
                    }}
                    maxLength={12}
                    placeholder="Örn: 123456 veya VS99"
                    className="w-full bg-[#161b30] border border-purple-500/40 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 font-mono text-lg font-black tracking-wider uppercase"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setCustomRoomNumber(generateRandomRoomCode())}
                    className="absolute right-2 top-2.5 px-2.5 py-1 text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-lg border border-purple-500/30 transition-all font-bold"
                  >
                    Rastgele
                  </button>
                </div>
                {createError && <p className="text-xs text-red-400 mt-1.5">{createError}</p>}
              </div>

              <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-3 text-xs text-gray-300 space-y-1">
                <p className="font-semibold text-purple-300">💡 Nasıl Çalışır?</p>
                <p className="text-gray-400 leading-relaxed">
                  Odayı oluşturduktan sonra rakip beklenir. Arkadaşınız bu numarayı girdiğinde <strong>3 saniyelik "RAKİP BULUNDU"</strong> sayımı ile kapışma başlar!
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoomModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-700 bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 font-semibold text-sm transition-all"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Odayı Aç</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
