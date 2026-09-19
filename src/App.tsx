import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SoloCpsTest } from './components/SoloCpsTest';
import { VersusArena } from './components/VersusArena';
import { Leaderboard } from './components/Leaderboard';
import { AuthModal } from './components/AuthModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { ClickEffects } from './components/ClickEffects';
import type { ClickParticle } from './components/ClickEffects';
import { getOrCreateUserProfile } from './lib/storage';
import { sounds } from './lib/sounds';
import { initSecurityGuards } from './lib/security';
import type { UserProfile } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'solo' | 'versus' | 'leaderboard'>('solo');
  const [user, setUser] = useState<UserProfile>(getOrCreateUserProfile());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(sounds.isEnabled());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [particles, setParticles] = useState<ClickParticle[]>([]);

  // Initialize Anti-Inspect / Anti-DevTools Security Guards
  useEffect(() => {
    initSecurityGuards();
  }, []);

  // Sound toggle handler
  const handleToggleSound = () => {
    const newState = sounds.toggleSound();
    setSoundEnabled(newState);
  };

  // Global Particle Trigger
  const addParticles = (x: number, y: number, text: string, color: string) => {
    const id = Date.now() + Math.random();
    setParticles((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#080a12] text-gray-100 cyber-grid flex flex-col justify-between selection:bg-purple-600 selection:text-white select-none">
      {/* Click Particles Effect Layer */}
      <ClickEffects particles={particles} />

      {/* Main Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenUsernameModal={() => setIsAuthModalOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      {/* Main App Content Body */}
      <main className="flex-1 w-full max-w-6xl mx-auto py-2">
        {activeTab === 'solo' && (
          <SoloCpsTest
            user={user}
            onUserUpdate={(u) => setUser(u)}
            addParticles={addParticles}
          />
        )}

        {activeTab === 'versus' && (
          <VersusArena
            user={user}
            onUserUpdate={(u) => setUser(u)}
            addParticles={addParticles}
          />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard user={user} />
        )}
      </main>

      {/* Modern Cyber Footer */}
      <footer className="w-full border-t border-gray-800/80 bg-[#090b14]/90 backdrop-blur-md py-4 px-4 text-center text-xs text-gray-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-black text-purple-400 font-['Orbitron']">CPS ARENA ⚡</span>
            <span>- Ultra Hızlı Tıklama Testi & 1v1 Online Kapışma</span>
          </div>

          <div className="flex items-center space-x-3 text-gray-400">
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
              <span>Tüm Cihazlarla Uyumlu</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Authentication & Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        currentUser={user}
        onClose={() => setIsAuthModalOpen(false)}
        onUpdated={(u) => setUser(u)}
      />

      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onSaved={() => {}}
      />
    </div>
  );
}

export default App;
