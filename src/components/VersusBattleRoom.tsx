import React, { useState, useEffect, useRef } from 'react';
import { Swords, Trophy, Clock, Zap, AlertTriangle, RotateCcw, Bot, User, CheckCircle2, Copy, Check, ShieldAlert, Loader2, Signal } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { UserProfile, PlayerState, VersusMatch } from '../types';
import { getEvaluation } from '../types';
import { recordMatchResult } from '../lib/storage';
import { sounds } from '../lib/sounds';
import { UniversalMatchEngine } from '../lib/realtime';

interface VersusBattleRoomProps {
  match: VersusMatch;
  currentUser: UserProfile;
  isBotMatch: boolean;
  onLeaveRoom: () => void;
  onUserUpdate: (u: UserProfile) => void;
  addParticles: (x: number, y: number, text: string, color: string) => void;
}

export const VersusBattleRoom: React.FC<VersusBattleRoomProps> = ({
  match,
  currentUser,
  isBotMatch,
  onLeaveRoom,
  onUserUpdate,
  addParticles,
}) => {
  const isHost = match.isHost;
  const [matchDuration, setMatchDuration] = useState<number>(match.duration);

  // Network & Room Status
  const [statusMessage, setStatusMessage] = useState<string>('Sunucuya bağlanılıyor...');
  const [networkError, setNetworkError] = useState<string>('');

  // Opponent State
  const [opponent, setOpponent] = useState<PlayerState | null>(
    isBotMatch
      ? {
          id: 'bot_cyber',
          username: 'CyberBot_X9',
          clicks: 0,
          cps: 0,
          hasStarted: false,
          hasFinished: false,
        }
      : null
  );

  // Phases: 'waiting' | 'found_countdown' | 'active' | 'finished'
  const [phase, setPhase] = useState<'waiting' | 'found_countdown' | 'active' | 'finished'>(
    isBotMatch ? 'found_countdown' : 'waiting'
  );

  // 3-Second "RAKİP BULUNDU" Countdown
  const [foundCountdown, setFoundCountdown] = useState<number>(3);

  // Local Player Match State
  const [myClicks, setMyClicks] = useState<number>(0);
  const [myCps, setMyCps] = useState<number>(0);
  const [hasMyMatchStarted, setHasMyMatchStarted] = useState<boolean>(false);
  const [hasMyMatchFinished, setHasMyMatchFinished] = useState<boolean>(false);
  const [myTimeRemaining, setMyTimeRemaining] = useState<number>(matchDuration);

  // 10-Second Start Window Timer (Hazırlık Sayacı)
  const [startWindowTimeLeft, setStartWindowTimeLeft] = useState<number>(10.0);
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);

  // Outcome
  const [isMatchOver, setIsMatchOver] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [winnerInfo, setWinnerInfo] = useState<{
    winnerId: string;
    winnerName: string;
    isTie: boolean;
    reason: string;
  } | null>(null);

  // Precise timing refs
  const myStartTimeRef = useRef<number | null>(null);
  const myClicksRef = useRef<number>(0);
  const myTimerRef = useRef<number | null>(null);
  const startWindowTimerRef = useRef<number | null>(null);
  const foundCountdownIntervalRef = useRef<number | null>(null);
  const engineRef = useRef<UniversalMatchEngine | null>(null);
  const botClickTimerRef = useRef<number | null>(null);

  // 1. Initialize Universal Match Engine
  useEffect(() => {
    if (!isBotMatch) {
      engineRef.current = new UniversalMatchEngine(
        match.roomId,
        currentUser,
        isHost,
        matchDuration,
        {
          onOpponentConnected: (opp, syncedDuration) => {
            setOpponent(opp);
            if (syncedDuration && syncedDuration > 0) {
              setMatchDuration(syncedDuration);
              setMyTimeRemaining(syncedDuration);
            }
            startFoundCountdown();
          },
          onOpponentStart: () => {
            setOpponent((prev) => (prev ? { ...prev, hasStarted: true } : null));
          },
          onOpponentClickUpdate: (opp) => {
            setOpponent((prev) => (prev ? { ...prev, clicks: opp.clicks, cps: opp.cps } : null));
          },
          onOpponentFinish: (result) => {
            setOpponent((prev) =>
              prev
                ? {
                    ...prev,
                    clicks: result.clicks,
                    cps: result.cps,
                    hasFinished: true,
                    timedOut: result.timedOut,
                  }
                : null
            );
          },
          onRematchRequested: () => {
            onLeaveRoom();
          },
          onConnectionError: (err) => {
            setNetworkError(err);
          },
          onStatusChange: (status) => {
            setStatusMessage(status);
          },
        }
      );

      engineRef.current.init();
    } else {
      // Bot matches trigger countdown immediately
      startFoundCountdown();
    }

    return () => {
      if (foundCountdownIntervalRef.current) clearInterval(foundCountdownIntervalRef.current);
      if (startWindowTimerRef.current) clearInterval(startWindowTimerRef.current);
      if (myTimerRef.current) clearInterval(myTimerRef.current);
      if (botClickTimerRef.current) clearInterval(botClickTimerRef.current);
      engineRef.current?.disconnect();
    };
  }, []);

  // 2. 3-Second "RAKİP BULUNDU" Countdown
  const startFoundCountdown = () => {
    setPhase('found_countdown');
    setFoundCountdown(3);
    sounds.playTick(true);

    let count = 3;
    if (foundCountdownIntervalRef.current) clearInterval(foundCountdownIntervalRef.current);

    foundCountdownIntervalRef.current = window.setInterval(() => {
      count -= 1;
      setFoundCountdown(count);

      if (count > 0) {
        sounds.playTick(true);
      } else if (count === 0) {
        sounds.playVictory();
        if (foundCountdownIntervalRef.current) {
          clearInterval(foundCountdownIntervalRef.current);
          foundCountdownIntervalRef.current = null;
        }
        startActivePhase();
      }
    }, 1000);
  };

  // 3. Active Phase (10s Start Window)
  const startActivePhase = () => {
    setPhase('active');
    const startWindowStart = performance.now();

    startWindowTimerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - startWindowStart) / 1000;
      const remaining = Math.max(0, 10.0 - elapsed);
      setStartWindowTimeLeft(remaining);

      if (remaining <= 3.0 && remaining > 0 && Math.floor(remaining * 10) % 10 === 0) {
        sounds.playTick(true);
      }

      if (remaining <= 0) {
        handleStartWindowExpired();
      }
    }, 50);

    if (isBotMatch) {
      const botDelay = 800 + Math.random() * 3000;
      setTimeout(() => {
        startBotClicking();
      }, botDelay);
    }
  };

  // Bot Click Simulation
  const startBotClicking = () => {
    setOpponent((prev) => (prev ? { ...prev, hasStarted: true } : null));
    const targetBotCps = 8.0 + Math.random() * 5.5;
    const botIntervalMs = 1000 / targetBotCps;
    let botClicks = 0;
    const botStart = performance.now();

    botClickTimerRef.current = window.setInterval(() => {
      const elapsedSec = (performance.now() - botStart) / 1000;
      if (elapsedSec >= matchDuration) {
        if (botClickTimerRef.current) clearInterval(botClickTimerRef.current);
        const finalBotCps = Number((botClicks / matchDuration).toFixed(2));
        setOpponent((prev) =>
          prev
            ? {
                ...prev,
                clicks: botClicks,
                cps: finalBotCps,
                hasFinished: true,
              }
            : null
        );
        return;
      }
      botClicks += 1;
      const curBotCps = Number((botClicks / elapsedSec).toFixed(2));
      setOpponent((prev) =>
        prev
          ? {
              ...prev,
              clicks: botClicks,
              cps: curBotCps,
            }
          : null
      );
    }, botIntervalMs);
  };

  // 10s Window Expired
  const handleStartWindowExpired = () => {
    if (startWindowTimerRef.current) {
      clearInterval(startWindowTimerRef.current);
      startWindowTimerRef.current = null;
    }

    if (!hasMyMatchStarted) {
      setIsTimedOut(true);
      setHasMyMatchFinished(true);
      sounds.playDefeat();
      engineRef.current?.broadcastPlayerFinish(0, 0, true);
    }
  };

  // Start My Match on First Click
  const startMyMatch = () => {
    if (startWindowTimerRef.current) {
      clearInterval(startWindowTimerRef.current);
      startWindowTimerRef.current = null;
    }

    setHasMyMatchStarted(true);
    myStartTimeRef.current = performance.now();
    engineRef.current?.broadcastPlayerStart(Date.now());

    myTimerRef.current = window.setInterval(() => {
      if (!myStartTimeRef.current) return;
      const elapsed = (performance.now() - myStartTimeRef.current) / 1000;
      const remaining = Math.max(0, matchDuration - elapsed);
      setMyTimeRemaining(remaining);

      if (elapsed > 0.2) {
        const curCps = Number((myClicksRef.current / elapsed).toFixed(2));
        setMyCps(curCps);
      }

      if (remaining <= 0) {
        finishMyMatch();
      }
    }, 25);
  };

  // Finish My Match
  const finishMyMatch = () => {
    if (myTimerRef.current) {
      clearInterval(myTimerRef.current);
      myTimerRef.current = null;
    }

    const finalTotalClicks = myClicksRef.current;
    const finalCalculatedCps = Number((finalTotalClicks / matchDuration).toFixed(2));
    setMyCps(finalCalculatedCps);
    setMyTimeRemaining(0);
    setHasMyMatchFinished(true);

    engineRef.current?.broadcastPlayerFinish(finalTotalClicks, finalCalculatedCps, false);
  };

  // Check and evaluate match finish
  useEffect(() => {
    if (hasMyMatchFinished && opponent && (opponent.hasFinished || opponent.timedOut || isTimedOut)) {
      evaluateWinner();
    }
  }, [hasMyMatchFinished, opponent?.hasFinished, opponent?.timedOut, isTimedOut]);

  const evaluateWinner = () => {
    if (isMatchOver || !opponent) return;
    setIsMatchOver(true);
    setPhase('finished');

    let winnerId = '';
    let winnerName = '';
    let isTie = false;
    let reason = '';

    if (isTimedOut && opponent.timedOut) {
      winnerName = 'Kimse';
      isTie = true;
      reason = 'Her iki oyuncu da 10 saniye içinde başlamadı!';
    } else if (isTimedOut) {
      winnerId = opponent.id;
      winnerName = opponent.username;
      reason = `${currentUser.username} 10 saniye içinde başlamadığı için hükmen kaybetti!`;
    } else if (opponent.timedOut) {
      winnerId = currentUser.id;
      winnerName = currentUser.username;
      reason = `Rakip 10 saniyede başlamadığı için hükmen kazandın!`;
    } else {
      const myFinalCps = myCps;
      const oppFinalCps = opponent.cps;

      if (myFinalCps > oppFinalCps) {
        winnerId = currentUser.id;
        winnerName = currentUser.username;
        reason = `${myFinalCps.toFixed(2)} CPS > ${oppFinalCps.toFixed(2)} CPS (${(myFinalCps - oppFinalCps).toFixed(2)} CPS farkla kazandın!)`;
      } else if (oppFinalCps > myFinalCps) {
        winnerId = opponent.id;
        winnerName = opponent.username;
        reason = `${oppFinalCps.toFixed(2)} CPS > ${myFinalCps.toFixed(2)} CPS (${(oppFinalCps - myFinalCps).toFixed(2)} CPS farkla rakip kazandı)`;
      } else {
        isTie = true;
        winnerName = 'Berabere!';
        reason = `İki oyuncu da tam olarak ${myFinalCps.toFixed(2)} CPS yaptı!`;
      }
    }

    setWinnerInfo({ winnerId, winnerName, isTie, reason });

    const iWon = winnerId === currentUser.id;
    if (iWon) {
      sounds.playVictory();
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
      });
    } else if (!isTie) {
      sounds.playDefeat();
    }

    const updated = recordMatchResult(iWon, myClicksRef.current, myCps);
    onUserUpdate(updated);
  };

  // Click Handler
  const handleUserClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'touchstart') {
      e.preventDefault();
    }

    if (phase === 'waiting' || phase === 'found_countdown') return;
    if (hasMyMatchFinished || isTimedOut) return;

    if (!hasMyMatchStarted) {
      startMyMatch();
    }

    myClicksRef.current += 1;
    setMyClicks(myClicksRef.current);
    sounds.playClick(1.0 + (myClicksRef.current % 10) * 0.04);

    engineRef.current?.broadcastPlayerClicks(myClicksRef.current, myCps);

    let clientX = window.innerWidth / 3;
    let clientY = window.innerHeight / 2;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    addParticles(clientX, clientY, `+1`, '#f43f5e');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(match.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const myEval = getEvaluation(myCps);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-5">
      {/* Top Header Bar */}
      <div className="bg-[#111424] border border-rose-900/50 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-orange-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-black text-white tracking-wide">1v1 ARENA</span>
              <button
                onClick={copyRoomCode}
                title="Oda Numarasını Kopyala"
                className="px-2.5 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold flex items-center space-x-1.5 transition-all"
              >
                <span>ODA: #{match.roomId}</span>
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-gray-400 mt-0.5">
              <Signal className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>{statusMessage}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Match Duration (1 to 7s) */}
        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 rounded-xl bg-[#161a30] border border-rose-500/40 text-center">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">KAPIŞMA SÜRESİ</span>
            <span className="text-lg font-black text-amber-400 font-['Orbitron']">
              ⚡ {matchDuration} SANİYE
            </span>
          </div>

          <button
            onClick={onLeaveRoom}
            className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 transition-all border border-gray-700"
          >
            Ayrıl
          </button>
        </div>
      </div>

      {networkError && (
        <div className="bg-red-950/80 border border-red-500 rounded-2xl p-3 text-xs text-red-300 font-bold flex items-center justify-between">
          <span>{networkError}</span>
          <button onClick={() => setNetworkError('')} className="underline text-white ml-2">Kapat</button>
        </div>
      )}

      {/* PHASE 1: WAITING FOR OPPONENT */}
      {phase === 'waiting' && (
        <div className="bg-gradient-to-b from-[#151930] to-[#0f1224] border-2 border-purple-500/40 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(168,85,247,0.2)] space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-purple-600/20 border-2 border-purple-500 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(168,85,247,0.4)] animate-pulse">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-black font-['Orbitron'] text-white">
              RAKİP BEKLENİYOR...
            </h2>
            <p className="text-sm text-gray-300 max-w-md mx-auto">
              {isHost ? 'Arkadaşına aşağıdaki oda numarasını ver. Odaya girdiği anda otomatik olarak 3 saniyelik geri sayım başlayacak!' : 'Oda kurucusuna bağlanılıyor, lütfen bekleyin...'}
            </p>
          </div>

          {/* Big Copyable Room Code Card */}
          <div className="max-w-xs mx-auto bg-black/50 border-2 border-dashed border-purple-400 rounded-2xl p-4 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] font-bold uppercase text-gray-400 block">Oda Numarası</span>
              <span className="text-2xl font-black font-mono text-purple-300">{match.roomId}</span>
            </div>
            <button
              onClick={copyRoomCode}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg transition-all"
            >
              {copiedCode ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Kopyalandı!' : 'Kopyala'}</span>
            </button>
          </div>

          <div className="text-xs text-purple-400 font-medium flex items-center justify-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Rakip bağlanana kadar tıklama alanı kilitlidir.</span>
          </div>
        </div>
      )}

      {/* PHASE 2: 3-SECOND "RAKİP BULUNDU" COUNTDOWN BANNER */}
      {phase === 'found_countdown' && (
        <div className="bg-gradient-to-r from-emerald-950 via-purple-950 to-rose-950 border-2 border-emerald-400 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(16,185,129,0.4)] animate-fade-in space-y-4">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-900/60 border border-emerald-400 text-emerald-300 text-xs font-black uppercase tracking-wider animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>RAKİP BULUNDU!</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-black font-['Orbitron'] text-white">
            {currentUser.username} <span className="text-rose-500">VS</span> {opponent?.username || 'Rakip'}
          </h2>

          <div className="text-6xl md:text-8xl font-black font-['Orbitron'] text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-pulse">
            {foundCountdown > 0 ? foundCountdown : 'BAŞLA!'}
          </div>

          <p className="text-sm font-bold text-emerald-300">
            Hazır ol! Sayaç bitince 10 saniyelik başlama penceresi açılacak.
          </p>
        </div>
      )}

      {/* PHASE 3: 10-Second Start Window Banner (Hazırlık Sayacı) */}
      {phase === 'active' && !hasMyMatchStarted && !isTimedOut && (
        <div className="bg-gradient-to-r from-amber-950/70 via-purple-950/70 to-rose-950/70 border-2 border-amber-500/70 rounded-2xl p-4 text-center shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-pulse">
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-sm font-bold text-amber-200">
              BAŞLAMAK İÇİN SÜREN: <span className="text-xl font-black text-white font-['Orbitron']">{startWindowTimeLeft.toFixed(1)}s</span>
            </span>
            <span className="text-xs text-gray-300 font-medium">
              (Doğrudan tıklama alanına basarak başla! 10sn içinde basmazsan hükmen mağlup olursun.)
            </span>
          </div>
          <div className="w-full bg-gray-800/80 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-75"
              style={{ width: `${(startWindowTimeLeft / 10.0) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Timeout Alert */}
      {isTimedOut && (
        <div className="bg-red-950/80 border-2 border-red-600 rounded-2xl p-4 text-center text-red-300 font-bold flex items-center justify-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span>SÜRE AŞIMI! 10 saniye içinde tıklamadığın için hükmen kaybettin.</span>
        </div>
      )}

      {/* Head-to-Head Split Arena */}
      {phase !== 'waiting' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: YOU */}
          <div className="bg-[#121527] border-2 border-rose-500/40 rounded-3xl p-5 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-600/30 border border-rose-500 flex items-center justify-center text-rose-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-black text-white">{currentUser.username} (SEN)</span>
                  <p className="text-[11px] text-gray-400">
                    {hasMyMatchStarted ? (hasMyMatchFinished ? '✅ Bitti' : '🔥 Tıklıyor...') : '⏳ Bekliyor'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 font-bold block">Kalan Süren</span>
                <span className="text-lg font-black text-purple-400 font-['Orbitron']">
                  {myTimeRemaining.toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Live Big Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#181c35] p-3 rounded-2xl text-center border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Tıklama</span>
                <span className="text-3xl font-black text-rose-400 font-['Orbitron']">{myClicks}</span>
              </div>
              <div className="bg-[#181c35] p-3 rounded-2xl text-center border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">CPS Hızı</span>
                <span className="text-3xl font-black text-amber-400 font-['Orbitron']">{myCps.toFixed(2)}</span>
              </div>
            </div>

            {/* My Click Pad */}
            <div
              onMouseDown={handleUserClick}
              onTouchStart={handleUserClick}
              className={`click-target cursor-pointer w-full h-44 rounded-2xl flex flex-col items-center justify-center p-4 transition-all select-none ${
                phase === 'found_countdown'
                  ? 'bg-[#181c35]/40 border border-gray-700 opacity-60 cursor-not-allowed'
                  : hasMyMatchFinished
                  ? 'bg-[#181c35]/60 border border-gray-700 opacity-80 cursor-default'
                  : hasMyMatchStarted
                  ? 'bg-gradient-to-b from-rose-950/60 to-[#181c35] border-2 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] active:scale-98'
                  : 'bg-gradient-to-b from-[#181d38] to-[#12162b] border-2 border-dashed border-rose-500/50 hover:border-rose-400 animate-pulse'
              }`}
            >
              {phase === 'found_countdown' && (
                <div className="text-center pointer-events-none">
                  <span className="text-xl font-bold text-gray-400">Geri Sayım Sürüyor...</span>
                </div>
              )}

              {phase === 'active' && !hasMyMatchStarted && !hasMyMatchFinished && (
                <div className="text-center pointer-events-none">
                  <span className="text-2xl font-black text-white block">TIKLA VE BAŞLA!</span>
                  <span className="text-xs text-rose-300 font-medium">Dokunduğun an {matchDuration}s başlar</span>
                </div>
              )}

              {hasMyMatchStarted && !hasMyMatchFinished && (
                <div className="text-center pointer-events-none">
                  <span className="text-4xl font-black text-rose-400 font-['Orbitron'] animate-ping">HIZLI TIKLA!</span>
                </div>
              )}

              {hasMyMatchFinished && (
                <div className="text-center pointer-events-none">
                  <span className="text-xs font-bold text-gray-400 block">TAMAMLANDI</span>
                  <span className="text-2xl font-black text-yellow-400 font-['Orbitron']">{myCps.toFixed(2)} CPS</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: OPPONENT */}
          <div className="bg-[#121527] border-2 border-cyan-500/30 rounded-3xl p-5 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-600/30 border border-cyan-500 flex items-center justify-center text-cyan-400">
                  {isBotMatch ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div>
                  <span className="text-sm font-black text-white">{opponent?.username || 'Rakip'}</span>
                  <p className="text-[11px] text-gray-400">
                    {opponent?.hasStarted ? (opponent?.hasFinished ? '✅ Bitti' : '🔥 Tıklıyor...') : '⏳ Bekliyor'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 font-bold block">Durum</span>
                <span className="text-xs font-bold text-cyan-400">
                  {opponent?.timedOut ? 'Süre Aşımı' : opponent?.hasFinished ? 'Tamamladı' : 'Hazır'}
                </span>
              </div>
            </div>

            {/* Opponent Live Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#181c35] p-3 rounded-2xl text-center border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Tıklama</span>
                <span className="text-3xl font-black text-cyan-400 font-['Orbitron']">{opponent?.clicks || 0}</span>
              </div>
              <div className="bg-[#181c35] p-3 rounded-2xl text-center border border-gray-800">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">CPS Hızı</span>
                <span className="text-3xl font-black text-cyan-300 font-['Orbitron']">{(opponent?.cps || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Opponent Visual Display */}
            <div className="w-full h-44 rounded-2xl bg-[#14182b] border border-cyan-500/20 flex flex-col items-center justify-center p-4 text-center">
              {opponent?.hasStarted && !opponent?.hasFinished && (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 mx-auto animate-spin">
                    <Zap className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-cyan-300 font-bold">Rakip Hızla Tıklıyor...</p>
                </div>
              )}

              {!opponent?.hasStarted && (
                <p className="text-xs text-gray-400 font-medium">
                  {phase === 'found_countdown' ? 'Geri sayım sürüyor...' : 'Rakip henüz başlamadı (10sn içinde başlayabilir).'}
                </p>
              )}

              {opponent?.hasFinished && (
                <div className="space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-gray-400">Rakip Skoru</p>
                  <p className="text-2xl font-black text-cyan-300 font-['Orbitron']">{opponent.cps.toFixed(2)} CPS</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match Result Overlay / Box */}
      {isMatchOver && winnerInfo && opponent && (
        <div
          className={`rounded-3xl p-6 border-2 text-center shadow-2xl animate-fade-in ${
            winnerInfo.winnerId === currentUser.id
              ? 'bg-gradient-to-b from-amber-950/80 via-purple-950/80 to-[#101324] border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.3)]'
              : winnerInfo.isTie
              ? 'bg-[#15192c] border-gray-600'
              : 'bg-gradient-to-b from-rose-950/80 via-gray-950 to-[#101324] border-rose-600'
          }`}
        >
          <div className="max-w-xl mx-auto space-y-3">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/20 text-xs font-black uppercase tracking-wider">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>MAÇ SONUCU ({matchDuration}sn Kapışma)</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-black font-['Orbitron'] text-white">
              {winnerInfo.winnerId === currentUser.id ? '🏆 KAZANDIN!' : winnerInfo.isTie ? '🤝 BERABERE!' : '💀 KAYBETTİN!'}
            </h2>

            {/* Precision CPS Comparison */}
            <div className="bg-black/50 border border-gray-700/60 rounded-2xl p-4 flex items-center justify-around">
              <div className="text-center">
                <span className="text-xs text-gray-400 block font-bold">{currentUser.username} (Sen)</span>
                <span
                  className={`text-2xl font-black font-['Orbitron'] ${
                    winnerInfo.winnerId === currentUser.id ? 'text-amber-400' : 'text-gray-300'
                  }`}
                >
                  {myCps.toFixed(2)} CPS
                </span>
              </div>
              <div className="text-lg font-black text-rose-500">VS</div>
              <div className="text-center">
                <span className="text-xs text-gray-400 block font-bold">{opponent.username}</span>
                <span
                  className={`text-2xl font-black font-['Orbitron'] ${
                    winnerInfo.winnerId === opponent.id ? 'text-amber-400' : 'text-gray-300'
                  }`}
                >
                  {opponent.cps.toFixed(2)} CPS
                </span>
              </div>
            </div>

            <p className="text-xs md:text-sm text-gray-300 font-medium">{winnerInfo.reason}</p>

            <div className="pt-2">
              <span className={`text-sm font-black ${myEval.textColor}`}>
                "{myEval.text}" - {myEval.subtext}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                onClick={onLeaveRoom}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-black text-sm flex items-center justify-center space-x-2 shadow-lg transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>YENİ 1v1 MAÇ BUL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
