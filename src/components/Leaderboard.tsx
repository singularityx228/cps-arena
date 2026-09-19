import React, { useState, useEffect } from 'react';
import { Trophy, Clock, History } from 'lucide-react';
import type { UserProfile, SoloScoreRecord } from '../types';
import { getEvaluation } from '../types';
import { getSoloHistory } from '../lib/storage';
import { getSupabaseClient } from '../lib/supabase';

interface LeaderboardProps {
  user: UserProfile;
}

interface LeaderboardEntry {
  id: string;
  username: string;
  cps: number;
  duration: number;
  tier_text: string;
  created_at?: string;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ user }) => {
  const [soloHistory, setSoloHistory] = useState<SoloScoreRecord[]>([]);
  const [topScores, setTopScores] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const history = getSoloHistory();
    setSoloHistory(history);

    // Fetch real top scores from Supabase or fallback to local user high score
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data, error } = await client
            .from('solo_scores')
            .select('id, username, cps, duration, tier_text, created_at')
            .order('cps', { ascending: false })
            .limit(10);

          if (!error && data && data.length > 0) {
            setTopScores(data);
            setIsLoading(false);
            return;
          }
        } catch {
          // ignore error and fallback
        }
      }

      // If no Supabase connection yet, show only real local tests
      if (user.highScoreCps > 0) {
        setTopScores([
          {
            id: user.id,
            username: user.username,
            cps: user.highScoreCps,
            duration: 5,
            tier_text: getEvaluation(user.highScoreCps).text,
          },
        ]);
      } else {
        setTopScores([]);
      }
      setIsLoading(false);
    };

    fetchLeaderboard();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:py-6 space-y-6">
      {/* Profile Stats Hero */}
      <div className="bg-[#111426] border border-amber-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-2xl font-black shadow-[0_0_30px_rgba(245,158,11,0.4)]">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black text-white">{user.username}</h2>
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 text-xs font-bold">
                  OYUNCU PROFİLİ
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Kalıcı Kullanıcı Hesabı</p>
            </div>
          </div>

          {/* Quick Stat Chips */}
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div className="bg-[#171b33] border border-gray-800 rounded-2xl p-3 text-center min-w-[100px]">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">En Yüksek</span>
              <span className="text-xl font-black text-amber-400 font-['Orbitron']">{user.highScoreCps}</span>
              <span className="text-[10px] text-gray-400 block font-semibold">CPS</span>
            </div>

            <div className="bg-[#171b33] border border-gray-800 rounded-2xl p-3 text-center min-w-[100px]">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">1v1 Galibiyet</span>
              <span className="text-xl font-black text-rose-400 font-['Orbitron']">{user.matchesWon}</span>
              <span className="text-[10px] text-gray-400 block font-semibold">Zafer</span>
            </div>

            <div className="bg-[#171b33] border border-gray-800 rounded-2xl p-3 text-center min-w-[100px]">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Toplam Tık</span>
              <span className="text-xl font-black text-cyan-400 font-['Orbitron']">{user.totalClicks}</span>
              <span className="text-[10px] text-gray-400 block font-semibold">Vuruş</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real Leaderboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Global Hall of Fame (Real Only) */}
        <div className="bg-[#111426] border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black text-white">En Yüksek CPS Rekorları</h3>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-gray-500 text-xs">Yükleniyor...</div>
          ) : topScores.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs space-y-2">
              <Trophy className="w-8 h-8 mx-auto opacity-30 text-amber-400" />
              <p>Henüz kayıtlı bir rekor bulunmuyor.</p>
              <p className="text-purple-400 font-bold">İlk testi yapıp rekoru sen kır!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topScores.map((item, idx) => {
                const evalInfo = getEvaluation(item.cps);
                const isMe = item.username === user.username;

                return (
                  <div
                    key={item.id || idx}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isMe
                        ? 'bg-purple-950/40 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                        : 'bg-[#15192e] border-gray-800/80'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                        idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-amber-800 text-white' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <span className={`text-xs font-bold ${isMe ? 'text-purple-300' : 'text-gray-200'}`}>
                          {item.username} {isMe && '(Sen)'}
                        </span>
                        <span className={`text-[10px] block font-black ${evalInfo.textColor}`}>
                          "{evalInfo.text}"
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-amber-400 font-['Orbitron']">
                        {item.cps.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-500 block">CPS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Solo Test History */}
        <div className="bg-[#111426] border border-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center space-x-2 mb-4">
            <History className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-black text-white">Son Solo Testlerin</h3>
          </div>

          {soloHistory.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Henüz solo test yapmadın. Solo sekmesinden hemen dene!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {soloHistory.slice(0, 8).map((rec) => {
                const evalTier = getEvaluation(rec.cps);
                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#15192e] border border-gray-800/80 text-left"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-200">{rec.duration}sn Test</span>
                        <span className="text-[10px] text-gray-500">{rec.date}</span>
                      </div>
                      <span className={`text-[11px] font-black ${evalTier.textColor}`}>
                        "{rec.tierText}"
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-purple-400 font-['Orbitron']">
                        {rec.cps.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-gray-500 block">{rec.totalClicks} tık</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
