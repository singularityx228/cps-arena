import React, { useState, useEffect, useRef } from 'react';
import { Swords, Trophy, Clock, Zap, AlertTriangle, RotateCcw, Bot, User, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { UserProfile, PlayerState, VersusMatch } from '../types';
import { getEvaluation } from '../types';
import { recordMatchResult } from '../lib/storage';
import { sounds } from '../lib/sounds';
import { VersusChannelManager } from '../lib/supabase';

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
  // Player 1 (Local) and Player 2 (Opponent) states
  const [myClicks, setMyClicks] = useState<number>(0);
  const [myCps, setMyCps] = useState<number>(0);
  const [hasMyMatchStarted, setHasMyMatchStarted] = useState<boolean>(false);
  const [hasMyMatchFinished, setHasMyMatchFinished] = useState<boolean>(false);
  const [myTimeRemaining, setMyTimeRemaining] = useState<number>(match.duration);

  // Opponent State
  const [oppState, setOppState] = useState<PlayerState>({
    id: match.player2?.id || (isBotMatch ? 'bot_cyber' : 'waiting_opponent'),
    username: match.player2?.username || (isBotMatch ? 'CyberBot_X9' : 'Rakip Bekleniyor...'),
    clicks: 0,
    cps: 0,
    hasStarted: false,
    hasFinished: false,
    timedOut: false,
  });

  // 10-Second Start Window Timer (Hazırlık Sayacı)
  const [startWindowTimeLeft, setStartWindowTimeLeft] = useState<number>(10.0);
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);

  // Match State
  const [isMatchOver, setIsMatchOver] = useState<boolean>(false);
  const [winnerInfo, setWinnerInfo] = useState<{
    winnerId: string;
    winnerName: string;
    isTie: boolean;
    reason: string;
  } | null>(null);

  // Refs for precise time calculations
  const myStartTimeRef = useRef<number | null>(null);
  const myClicksRef = useRef<number>(0);
  const myTimerRef = useRef<number | null>(null);
  const startWindowTimerRef = useRef<number | null>(null);
  const channelManagerRef = useRef<VersusChannelManager | null>(null);
  const botClickTimerRef = useRef<number | null>(null);

  // Initialize Channel & 10-second Start Window Countdown
  useEffect(() => {
    // Start the 10-Second Start Window Timer
    const startWindowStart = performance.now();
    startWindowTimerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - startWindowStart) / 1000;
      const remaining = Math.max(0, 10.0 - elapsed);
      setStartWindowTimeLeft(remaining);

      // Play tick sound during final 3 seconds
      if (remaining <= 3.0 && remaining > 0 && Math.floor(remaining * 10) % 10 === 0) {
        sounds.playTick(true);
      }

      // If 10 seconds expire and user hasn't clicked/started
      if (remaining <= 0) {
        handleStartWindowExpired();
      }
    }, 50);

    // Setup Supabase Realtime or Bot
    if (!isBotMatch) {
      channelManagerRef.current = new VersusChannelManager(match.roomId);
      channelManagerRef.current.connect(
        currentUser,
        match.player1.id === currentUser.id,
        match.duration,
        {
          onPlayerJoined: (player2) => {
            setOppState((prev) => ({ ...prev, ...player2 }));
          },
          onOpponentStart: () => {
            setOppState((prev) => ({ ...prev, hasStarted: true }));
          },
          onOpponentClickUpdate: (player) => {
            setOppState((prev) => ({ ...prev, clicks: player.clicks, cps: player.cps }));
          },
          onOpponentFinish: (result) => {
            setOppState((prev) => ({
              ...prev,
              clicks: result.clicks,
              cps: result.cps,
              hasFinished: true,
              timedOut: result.timedOut,
            }));
          },
          onRematchRequested: () => {
            handleResetMatch();
          },
        }
      );
    } else {
      // Simulate Bot starting after random 1.0 - 4.5 seconds
      const botDelay = 1000 + Math.random() * 3500;
      const botTimer = setTimeout(() => {
        startBotClicking();
      }, botDelay);

      return () => clearTimeout(botTimer);
    }

    return () => {
      if (startWindowTimerRef.current) clearInterval(startWindowTimerRef.current);
      if (myTimerRef.current) clearInterval(myTimerRef.current);
      if (botClickTimerRef.current) clearInterval(botClickTimerRef.current);
      channelManagerRef.current?.disconnect();
    };
  }, []);

  // Bot click simulation
  const startBotClicking = () => {
    setOppState((prev) => ({ ...prev, hasStarted: true }));
    const targetBotCps = 8.0 + Math.random() * 5.8; // Bot does around 8 - 13.8 CPS
    const botIntervalMs = 1000 / targetBotCps;
    let botClicks = 0;
    const botStart = performance.now();

    botClickTimerRef.current = window.setInterval(() => {
      const elapsedSec = (performance.now() - botStart) / 1000;
      if (elapsedSec >= match.duration) {
        if (botClickTimerRef.current) clearInterval(botClickTimerRef.current);
        const finalBotCps = Number((botClicks / match.duration).toFixed(2));
        setOppState((prev) => ({
          ...prev,
          clicks: botClicks,
          cps: finalBotCps,
          hasFinished: true,
        }));
        return;
      }
      botClicks += 1;
      const curBotCps = Number((botClicks / elapsedSec).toFixed(2));
      setOppState((prev) => ({
        ...prev,
        clicks: botClicks,
        cps: curBotCps,
      }));
    }, botIntervalMs);
  };

  // 10-Second Start Window Expired
  const handleStartWindowExpired = () => {
    if (startWindowTimerRef.current) {
      clearInterval(startWindowTimerRef.current);
      startWindowTimerRef.current = null;
    }

    if (!hasMyMatchStarted) {
      setIsTimedOut(true);
      setHasMyMatchFinished(true);
      sounds.playDefeat();
      channelManagerRef.current?.broadcastFinish(0, 0, true);
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
    channelManagerRef.current?.broadcastStart(Date.now());

    myTimerRef.current = window.setInterval(() => {
      if (!myStartTimeRef.current) return;
      const elapsed = (performance.now() - myStartTimeRef.current) / 1000;
      const remaining = Math.max(0, match.duration - elapsed);
      setMyTimeRemaining(remaining);

      if (elapsed > 0.2) {
        const curCps = Number(((myClicksRef.current / elapsed)).toFixed(2));
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
    const finalCalculatedCps = Number((finalTotalClicks / match.duration).toFixed(2));
    setMyCps(finalCalculatedCps);
    setMyTimeRemaining(0);
    setHasMyMatchFinished(true);

    channelManagerRef.current?.broadcastFinish(finalTotalClicks, finalCalculatedCps, false);
  };

  // Check and evaluate match finish when both players finish or timeout occurs
  useEffect(() => {
    if (hasMyMatchFinished && (oppState.hasFinished || oppState.timedOut || isTimedOut)) {
      evaluateWinner();
    }
  }, [hasMyMatchFinished, oppState.hasFinished, oppState.timedOut, isTimedOut]);

  const evaluateWinner = () => {
    if (isMatchOver) return;
    setIsMatchOver(true);

    let winnerId = '';
    let winnerName = '';
    let isTie = false;
    let reason = '';

    // Handle Timeouts
    if (isTimedOut && oppState.timedOut) {
      winnerName = 'Kimse';
      isTie = true;
      reason = 'Her iki oyuncu da 10 saniye içinde başlamadı!';
    } else if (isTimedOut) {
      winnerId = oppState.id;
      winnerName = oppState.username;
      reason = `${currentUser.username} 10 saniye içinde başlamadığı için hükmen kaybetti!`;
    } else if (oppState.timedOut) {
      winnerId = currentUser.id;
      winnerName = currentUser.username;
      reason = `Rakip 10 saniyede başlamadığı için hükmen kazandın!`;
    } else {
      // Precision float comparison: 13.1 vs 13.0
      const myFinalCps = myCps;
      const oppFinalCps = oppState.cps;

      if (myFinalCps > oppFinalCps) {
        winnerId = currentUser.id;
        winnerName = currentUser.username;
        reason = `${myFinalCps.toFixed(2)} CPS > ${oppFinalCps.toFixed(2)} CPS (${(myFinalCps - oppFinalCps).toFixed(2)} CPS farkla kazandın!)`;
      } else if (oppFinalCps > myFinalCps) {
        winnerId = oppState.id;
        winnerName = oppState.username;
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

    // Save match stats
    const updated = recordMatchResult(iWon, myClicksRef.current, myCps);
    onUserUpdate(updated);
  };

  // Handle User Click
  const handleUserClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'touchstart') {
      e.preventDefault();
    }

    if (hasMyMatchFinished || isTimedOut) return;

    if (!hasMyMatchStarted) {
      startMyMatch();
    }

    myClicksRef.current += 1;
    setMyClicks(myClicksRef.current);
    sounds.playClick(1.0 + (myClicksRef.current % 10) * 0.04);

    // Sync with opponent
    channelManagerRef.current?.broadcastClicks({
      id: currentUser.id,
      username: currentUser.username,
      clicks: myClicksRef.current,
      cps: myCps,
      hasStarted: true,
      hasFinished: false,
    });

    // Spawn Particles
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

  const handleResetMatch = () => {
    // Generate new random duration for rematch (1 - 7 seconds)
    onLeaveRoom();
  };

  const myEval = getEvaluation(myCps);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-5">
      {/* Match Meta Header Bar */}
      <div className="bg-[#111424] border border-rose-900/50 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-orange-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-black text-white tracking-wide">1v1 ARENA KAPISMA</span>
              <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-xs font-bold">
                ODA: #{match.roomId}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {isBotMatch ? 'Cyber AI Antrenman Modu' : 'Canlı Supabase Realtime Maçı'}
            </p>
          </div>
        </div>

        {/* Dynamic Match Duration (1 to 7s) */}
        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 rounded-xl bg-[#161a30] border border-rose-500/40 text-center">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">KAPIŞMA SÜRESİ</span>
            <span className="text-lg font-black text-amber-400 font-['Orbitron']">
              ⚡ {match.duration} SANİYE
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

      {/* 10-Second Start Window Banner (Hazırlık Sayacı) */}
      {!hasMyMatchStarted && !isTimedOut && (
        <div className="bg-gradient-to-r from-amber-950/60 via-purple-950/60 to-rose-950/60 border-2 border-amber-500/60 rounded-2xl p-4 text-center shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-pulse">
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <span className="text-sm font-bold text-amber-200">
              BAŞLAMAK İÇİN SÜREN: <span className="text-xl font-black text-white font-['Orbitron']">{startWindowTimeLeft.toFixed(1)}s</span>
            </span>
            <span className="text-xs text-gray-300 font-medium">
              (İstediğin an tıklama alanına dokunarak başla! 10sn içinde basmazsan hükmen mağlup olursun.)
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
              hasMyMatchFinished
                ? 'bg-[#181c35]/60 border border-gray-700 opacity-80 cursor-default'
                : hasMyMatchStarted
                ? 'bg-gradient-to-b from-rose-950/60 to-[#181c35] border-2 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] active:scale-98'
                : 'bg-gradient-to-b from-[#181d38] to-[#12162b] border-2 border-dashed border-rose-500/50 hover:border-rose-400 animate-pulse'
            }`}
          >
            {!hasMyMatchStarted && !hasMyMatchFinished && (
              <div className="text-center pointer-events-none">
                <span className="text-2xl font-black text-white block">TIKLA VE BAŞLA!</span>
                <span className="text-xs text-rose-300 font-medium">Dokunduğun an {match.duration}s başlar</span>
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
                <span className="text-sm font-black text-white">{oppState.username}</span>
                <p className="text-[11px] text-gray-400">
                  {oppState.hasStarted ? (oppState.hasFinished ? '✅ Bitti' : '🔥 Tıklıyor...') : '⏳ Bekliyor'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-400 font-bold block">Durum</span>
              <span className="text-xs font-bold text-cyan-400">
                {oppState.timedOut ? 'Süre Aşımı' : oppState.hasFinished ? 'Tamamladı' : 'Hazır'}
              </span>
            </div>
          </div>

          {/* Opponent Live Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#181c35] p-3 rounded-2xl text-center border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Tıklama</span>
              <span className="text-3xl font-black text-cyan-400 font-['Orbitron']">{oppState.clicks}</span>
            </div>
            <div className="bg-[#181c35] p-3 rounded-2xl text-center border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">CPS Hızı</span>
              <span className="text-3xl font-black text-cyan-300 font-['Orbitron']">{oppState.cps.toFixed(2)}</span>
            </div>
          </div>

          {/* Opponent Visual Display */}
          <div className="w-full h-44 rounded-2xl bg-[#14182b] border border-cyan-500/20 flex flex-col items-center justify-center p-4 text-center">
            {oppState.hasStarted && !oppState.hasFinished && (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 mx-auto animate-spin">
                  <Zap className="w-6 h-6" />
                </div>
                <p className="text-xs text-cyan-300 font-bold">Rakip Hızla Tıklıyor...</p>
              </div>
            )}

            {!oppState.hasStarted && (
              <p className="text-xs text-gray-400 font-medium">
                Rakip henüz başlamadı (10sn içinde başlayabilir).
              </p>
            )}

            {oppState.hasFinished && (
              <div className="space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-gray-400">Rakip Skoru</p>
                <p className="text-2xl font-black text-cyan-300 font-['Orbitron']">{oppState.cps.toFixed(2)} CPS</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Match Result Overlay / Box */}
      {isMatchOver && winnerInfo && (
        <div className={`rounded-3xl p-6 border-2 text-center shadow-2xl animate-fade-in ${
          winnerInfo.winnerId === currentUser.id
            ? 'bg-gradient-to-b from-amber-950/80 via-purple-950/80 to-[#101324] border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.3)]'
            : winnerInfo.isTie
            ? 'bg-[#15192c] border-gray-600'
            : 'bg-gradient-to-b from-rose-950/80 via-gray-950 to-[#101324] border-rose-600'
        }`}>
          <div className="max-w-xl mx-auto space-y-3">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/20 text-xs font-black uppercase tracking-wider">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>MAÇ SONUCU ({match.duration}sn Kapışma)</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-black font-['Orbitron'] text-white">
              {winnerInfo.winnerId === currentUser.id ? '🏆 KAZANDIN!' : winnerInfo.isTie ? '🤝 BERABERE!' : '💀 KAYBETTİN!'}
            </h2>

            {/* Precision CPS Comparison */}
            <div className="bg-black/50 border border-gray-700/60 rounded-2xl p-4 flex items-center justify-around">
              <div className="text-center">
                <span className="text-xs text-gray-400 block font-bold">{currentUser.username} (Sen)</span>
                <span className={`text-2xl font-black font-['Orbitron'] ${winnerInfo.winnerId === currentUser.id ? 'text-amber-400' : 'text-gray-300'}`}>
                  {myCps.toFixed(2)} CPS
                </span>
              </div>
              <div className="text-lg font-black text-rose-500">VS</div>
              <div className="text-center">
                <span className="text-xs text-gray-400 block font-bold">{oppState.username}</span>
                <span className={`text-2xl font-black font-['Orbitron'] ${winnerInfo.winnerId === oppState.id ? 'text-amber-400' : 'text-gray-300'}`}>
                  {oppState.cps.toFixed(2)} CPS
                </span>
              </div>
            </div>

            <p className="text-xs md:text-sm text-gray-300 font-medium">
              {winnerInfo.reason}
            </p>

            {/* Custom Evaluation Badge for User */}
            <div className="pt-2">
              <span className={`text-sm font-black ${myEval.textColor}`}>
                "{myEval.text}" - {myEval.subtext}
              </span>
            </div>

            {/* Action Buttons */}
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
