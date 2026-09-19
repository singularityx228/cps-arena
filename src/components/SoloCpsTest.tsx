import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Flame, Clock, MousePointer, Share2, Award, Trophy, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { EvaluationTier, UserProfile } from '../types';
import { getEvaluation } from '../types';
import { recordSoloScore } from '../lib/storage';
import { sounds } from '../lib/sounds';
import { GlobalLeaderboardService } from '../lib/realtime';


interface SoloCpsTestProps {
  user: UserProfile;
  onUserUpdate: (u: UserProfile) => void;
  addParticles: (x: number, y: number, text: string, color: string) => void;
}

const PRESET_DURATIONS = [1, 3, 5, 10, 15, 30, 60];

export const SoloCpsTest: React.FC<SoloCpsTestProps> = ({
  user: _user,
  onUserUpdate,
  addParticles,
}) => {
  // Config
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);

  // Test State
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [clicks, setClicks] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(selectedDuration);
  const [liveCps, setLiveCps] = useState<number>(0);
  const [peakCps, setPeakCps] = useState<number>(0);

  // Results
  const [finalCps, setFinalCps] = useState<number>(0);
  const [evaluation, setEvaluation] = useState<EvaluationTier | null>(null);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  // Timekeeping refs
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const clickTimestampsRef = useRef<number[]>([]);
  const clicksRef = useRef<number>(0);

  // Update time left when selected duration changes
  useEffect(() => {
    if (!isActive && !isFinished) {
      setTimeLeft(selectedDuration);
    }
  }, [selectedDuration, isActive, isFinished]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const startTest = () => {
    setIsActive(true);
    setIsFinished(false);
    setClicks(0);
    clicksRef.current = 0;
    clickTimestampsRef.current = [];
    setLiveCps(0);
    setPeakCps(0);
    setTimeLeft(selectedDuration);
    startTimeRef.current = performance.now();

    // High frequency interval for smooth timer & live CPS
    timerIntervalRef.current = window.setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsedMs = performance.now() - startTimeRef.current;
      const remainingSeconds = Math.max(0, selectedDuration - elapsedMs / 1000);
      setTimeLeft(remainingSeconds);

      // Live CPS (based on elapsed or rolling 1 sec window)
      if (elapsedMs > 200) {
        const currentCpsVal = Number(((clicksRef.current / elapsedMs) * 1000).toFixed(2));
        setLiveCps(currentCpsVal);
        setPeakCps((prev) => Math.max(prev, currentCpsVal));
      }

      if (remainingSeconds <= 0) {
        finishTest();
      }
    }, 25);
  };

  const finishTest = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const totalClicks = clicksRef.current;
    const finalCalculatedCps = Number((totalClicks / selectedDuration).toFixed(2));
    setFinalCps(finalCalculatedCps);
    setTimeLeft(0);
    setIsActive(false);
    setIsFinished(true);

    const evalTier = getEvaluation(finalCalculatedCps);
    setEvaluation(evalTier);

    // Play outcome sound & effects
    if (evalTier.isGodMode) {
      sounds.playGodMode();
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
      });
    } else if (finalCalculatedCps > 7.0) {
      sounds.playVictory();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else {
      sounds.playDefeat();
    }

    // Save record to storage
    const { profile, isNewHighScore } = recordSoloScore(
      finalCalculatedCps,
      selectedDuration,
      totalClicks,
      evalTier.text
    );
    setIsNewRecord(isNewHighScore);
    onUserUpdate(profile);

    // Global real-time leaderboard broadcast
    try {
      const ldr = new GlobalLeaderboardService();
      ldr.init();
      setTimeout(() => {
        ldr.broadcastScore({
          id: profile.id,
          username: profile.username,
          cps: finalCalculatedCps,
          duration: selectedDuration,
          tier_text: evalTier.text,
          created_at: new Date().toISOString(),
        });
        setTimeout(() => ldr.disconnect(), 500);
      }, 200);
    } catch {
      // ignore
    }
  };


  // Click handler (supports touch & mouse seamlessly)
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default touch behavior (double-tap zoom, gesture delays)
    if (e.type === 'touchstart') {
      e.preventDefault();
    }

    if (isFinished) return;

    if (!isActive) {
      startTest();
    }

    const now = performance.now();
    clicksRef.current += 1;
    setClicks(clicksRef.current);
    clickTimestampsRef.current.push(now);

    // Audio click
    const pitch = 0.9 + (clicksRef.current % 10) * 0.03;
    sounds.playClick(pitch);

    // Spawn visual particles
    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const colors = ['#ec4899', '#a855f7', '#3b82f6', '#10b981', '#f59e0b'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    addParticles(clientX, clientY, `+1`, randomColor);
  };

  const handleReset = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsActive(false);
    setIsFinished(false);
    setClicks(0);
    clicksRef.current = 0;
    clickTimestampsRef.current = [];
    setTimeLeft(selectedDuration);
    setLiveCps(0);
    setPeakCps(0);
    setEvaluation(null);
    setIsNewRecord(false);
  };

  const handleShare = () => {
    const text = `⚡ CPS ARENA Test Sonucum: ${finalCps} CPS! (${selectedDuration}sn) - Değerlendirme: "${evaluation?.text}"\nSen de rekorunu dene: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 space-y-6">
      {/* Duration Selector Bar (1 to 60 seconds) */}
      <div className="bg-[#111424]/90 border border-gray-800/80 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-bold text-gray-200">Süre Seçimi:</span>
            <span className="text-sm font-black text-purple-400 bg-purple-950/60 px-2.5 py-0.5 rounded-lg border border-purple-500/30">
              {selectedDuration} SANİYE
            </span>
          </div>

          <button
            onClick={() => setIsCustomDuration(!isCustomDuration)}
            disabled={isActive}
            className="text-xs font-semibold text-gray-400 hover:text-purple-300 underline underline-offset-4 disabled:opacity-50"
          >
            {isCustomDuration ? 'Hazır Sürelere Dön' : 'Özel Süre Seç (1-60s)'}
          </button>
        </div>

        {isCustomDuration ? (
          <div className="flex items-center space-x-4 pt-1">
            <input
              type="range"
              min="1"
              max="60"
              value={selectedDuration}
              disabled={isActive}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setSelectedDuration(val);
                if (!isActive) setTimeLeft(val);
              }}
              className="w-full accent-purple-500 cursor-pointer h-2 bg-gray-700 rounded-lg"
            />
            <div className="flex items-center space-x-1.5 shrink-0">
              <input
                type="number"
                min="1"
                max="60"
                value={selectedDuration}
                disabled={isActive}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
                  setSelectedDuration(val);
                  if (!isActive) setTimeLeft(val);
                }}
                className="w-16 bg-[#181d33] border border-purple-500/40 rounded-lg px-2 py-1 text-center font-bold text-white text-sm"
              />
              <span className="text-xs text-gray-400 font-semibold">sn</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {PRESET_DURATIONS.map((dur) => (
              <button
                key={dur}
                disabled={isActive}
                onClick={() => {
                  setSelectedDuration(dur);
                  setTimeLeft(dur);
                  sounds.playClick();
                }}
                className={`py-2 px-1 rounded-xl text-xs md:text-sm font-bold border transition-all ${
                  selectedDuration === dur
                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-102'
                    : 'bg-[#15192c] text-gray-400 border-gray-800 hover:border-purple-500/40 hover:text-white'
                } disabled:opacity-50`}
              >
                {dur}s
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Stats Live Header */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {/* Timer Card */}
        <div className="bg-[#111424] border border-gray-800 rounded-2xl p-3 md:p-4 text-center relative overflow-hidden">
          <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
            Kalan Süre
          </div>
          <div className={`text-2xl md:text-4xl font-black font-['Orbitron'] ${timeLeft <= 2 && isActive ? 'text-red-400 animate-pulse' : 'text-purple-400'}`}>
            {timeLeft.toFixed(1)}<span className="text-xs md:text-sm font-normal text-gray-400 ml-1">s</span>
          </div>
          <div 
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
            style={{ width: `${(timeLeft / selectedDuration) * 100}%` }}
          />
        </div>

        {/* Clicks Card */}
        <div className="bg-[#111424] border border-gray-800 rounded-2xl p-3 md:p-4 text-center">
          <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
            Toplam Tık
          </div>
          <div className="text-2xl md:text-4xl font-black font-['Orbitron'] text-cyan-400">
            {clicks}
          </div>
        </div>

        {/* Live CPS Card */}
        <div className="bg-[#111424] border border-gray-800 rounded-2xl p-3 md:p-4 text-center">
          <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
            Anlık CPS
          </div>
          <div className="text-2xl md:text-4xl font-black font-['Orbitron'] text-amber-400">
            {isFinished ? finalCps.toFixed(2) : liveCps.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Big Reactive Click Pad */}
      <div className="relative">
        <div
          onMouseDown={handleClick}
          onTouchStart={handleClick}
          className={`click-target cursor-pointer relative w-full h-64 md:h-80 rounded-3xl flex flex-col items-center justify-center p-6 transition-all duration-150 select-none overflow-hidden ${
            isActive
              ? 'bg-gradient-to-b from-purple-950/70 via-[#13172e] to-[#0c0f1d] border-2 border-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.35)] active:scale-[0.98]'
              : isFinished
              ? 'bg-[#121524] border-2 border-gray-700 opacity-90'
              : 'bg-gradient-to-b from-[#15192f] to-[#0e1122] border-2 border-dashed border-purple-500/40 hover:border-purple-400 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]'
          }`}
        >
          {/* Cyberpunk Glow Rays */}
          <div className="absolute inset-0 bg-radial from-purple-600/10 via-transparent to-transparent pointer-events-none" />

          {/* Idle / Active Prompts */}
          {!isActive && !isFinished && (
            <div className="flex flex-col items-center space-y-3 pointer-events-none">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.3)] animate-bounce">
                <MousePointer className="w-8 h-8" />
              </div>
              <div className="text-center">
                <p className="text-xl md:text-2xl font-black text-white tracking-wide">
                  BAŞLAMAK İÇİN BURAYA TIKLA!
                </p>
                <p className="text-xs md:text-sm text-gray-400 mt-1">
                  İlk tıkladığın an {selectedDuration} saniyelik test başlar.
                </p>
              </div>
            </div>
          )}

          {isActive && (
            <div className="flex flex-col items-center space-y-2 pointer-events-none">
              <div className="text-4xl md:text-6xl font-black font-['Orbitron'] text-white drop-shadow-[0_0_20px_rgba(168,85,247,0.8)] animate-pulse">
                TIKLA TIKLA!
              </div>
              <div className="flex items-center space-x-2 text-purple-300 font-bold text-sm md:text-base">
                <Flame className="w-5 h-5 text-amber-400 fill-amber-400 animate-bounce" />
                <span>Peak: {peakCps.toFixed(2)} CPS</span>
              </div>
            </div>
          )}

          {isFinished && evaluation && (
            <div className="flex flex-col items-center space-y-2 pointer-events-none text-center">
              <div className="text-4xl md:text-5xl">{evaluation.emoji}</div>
              <div className={`text-2xl md:text-4xl font-black font-['Orbitron'] ${evaluation.textColor} drop-shadow-[0_0_15px_${evaluation.glowColor}]`}>
                {evaluation.text}
              </div>
              <p className="text-sm font-bold text-gray-300">
                Skorun: <span className="text-yellow-400 text-lg font-black">{finalCps.toFixed(2)} CPS</span> ({clicks} tık / {selectedDuration}sn)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Finished Test Result Banner & Actions */}
      {isFinished && evaluation && (
        <div className={`border-2 rounded-3xl p-6 shadow-2xl transition-all animate-fade-in ${evaluation.bgColor} ${evaluation.borderColor} ${evaluation.isGodMode ? 'animate-god-mode' : ''}`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left space-y-2">
              <div className="flex items-center justify-center md:justify-start space-x-2">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black/40 border border-white/20 text-white flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5" />
                  <span>{evaluation.badge}</span>
                </span>
                {isNewRecord && (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-black animate-pulse flex items-center space-x-1">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>YENİ REKOR!</span>
                  </span>
                )}
              </div>

              {/* Exact required text in prominent size */}
              <h2 className={`text-3xl md:text-5xl font-black font-['Orbitron'] tracking-tight ${evaluation.textColor} drop-shadow-[0_0_20px_${evaluation.glowColor}]`}>
                "{evaluation.text}"
              </h2>
              <p className="text-sm text-gray-300 font-medium max-w-xl">
                {evaluation.subtext}
              </p>
            </div>

            {/* Quick Result Stats & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleShare}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg"
              >
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span>{copiedShare ? 'Kopyalandı!' : 'Skoru Paylaş'}</span>
              </button>

              <button
                onClick={handleReset}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center space-x-2 shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all transform hover:scale-105"
              >
                <RotateCcw className="w-4 h-4" />
                <span>TEKRAR DENE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scoring Rules Guide Table */}
      <div className="bg-[#101322]/80 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center space-x-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <span>CPS Rütbe ve Değerlendirme Sistemi</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-400">0 - 7.0 CPS</span>
              <span>💀</span>
            </div>
            <p className="text-xs font-black text-red-300 mt-1">"ÇIK SİTEDEN BİR DAHA GELME"</p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">8.0 - 9.0 CPS</span>
              <span>⚡</span>
            </div>
            <p className="text-xs font-black text-emerald-300 mt-1">"GÜZEL"</p>
          </div>

          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400">9.01 - 13.0 CPS</span>
              <span>🔥</span>
            </div>
            <p className="text-xs font-black text-purple-300 mt-1">"AFERİN LA"</p>
          </div>

          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400">13.0+ CPS</span>
              <span>👑</span>
            </div>
            <p className="text-xs font-black text-amber-300 mt-1">"I AM BETTER"</p>
          </div>
        </div>
      </div>
    </div>
  );
};
