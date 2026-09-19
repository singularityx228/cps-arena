import React from 'react';
import { Zap, Swords, Trophy, Volume2, VolumeX, Edit3, User, Database, Flame } from 'lucide-react';
import type { UserProfile } from '../types';
import { sounds } from '../lib/sounds';

interface NavbarProps {
  activeTab: 'solo' | 'versus' | 'leaderboard';
  setActiveTab: (tab: 'solo' | 'versus' | 'leaderboard') => void;
  user: UserProfile;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenUsernameModal: () => void;
  onOpenSupabaseModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  soundEnabled,
  onToggleSound,
  onOpenUsernameModal,
  onOpenSupabaseModal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#0a0c16]/90 backdrop-blur-xl border-b border-gray-800/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div 
            onClick={() => setActiveTab('solo')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)] group-hover:scale-105 transition-transform">
              <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 font-['Orbitron']">
                  CPS ARENA
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-purple-900/60 text-purple-300 border border-purple-500/40 rounded">
                  ULTRA
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium -mt-0.5">Hız & 1v1 Kapışma</p>
            </div>
          </div>

          {/* Mobile Right Quick Action Icons */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={onToggleSound}
              className="p-2 rounded-xl bg-gray-800/70 border border-gray-700 text-gray-300 hover:text-white"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-purple-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
            </button>
            <button
              onClick={onOpenUsernameModal}
              className="px-2.5 py-1.5 rounded-xl bg-purple-900/40 border border-purple-500/40 text-xs font-bold text-purple-300 flex items-center space-x-1"
            >
              <User className="w-3.5 h-3.5" />
              <span className="max-w-[70px] truncate">{user.username}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#121524] p-1 rounded-xl border border-gray-800 w-full md:w-auto justify-center">
          <button
            onClick={() => {
              setActiveTab('solo');
              sounds.playClick();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
              activeTab === 'solo'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Solo Test (1-60s)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('versus');
              sounds.playClick();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all relative ${
              activeTab === 'versus'
                ? 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>1v1 Online VS</span>
            <span className="hidden sm:inline-flex px-1.5 py-0.2 text-[9px] bg-rose-500 text-white font-black rounded-full animate-pulse">
              CANLI
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('leaderboard');
              sounds.playClick();
            }}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
              activeTab === 'leaderboard'
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Liderler</span>
          </button>
        </div>

        {/* Right Section: User Profile & Actions (Desktop) */}
        <div className="hidden md:flex items-center space-x-3">
          {/* Supabase Button */}
          <button
            onClick={onOpenSupabaseModal}
            title="Supabase Veritabanı ve Realtime Ayarları"
            className="p-2 rounded-xl bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700 text-gray-300 hover:text-cyan-400 transition-all"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
            className="p-2 rounded-xl bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700 text-gray-300 hover:text-purple-400 transition-all"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-purple-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>

          {/* User Profile Pill */}
          <div
            onClick={onOpenUsernameModal}
            className="flex items-center space-x-2.5 px-3.5 py-1.5 bg-[#14182b] hover:bg-[#1a203a] border border-purple-500/30 rounded-xl cursor-pointer transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-black">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors max-w-[110px] truncate">
                  {user.username}
                </span>
                <Edit3 className="w-3 h-3 text-gray-400 group-hover:text-purple-400 transition-colors" />
              </div>
              <div className="flex items-center space-x-1 text-[10px] text-amber-400 font-bold">
                <Flame className="w-2.5 h-2.5 fill-amber-400" />
                <span>Max: {user.highScoreCps} CPS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
