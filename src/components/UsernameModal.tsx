import React, { useState } from 'react';
import { User, X, Check, Sparkles } from 'lucide-react';
import { updateUsername } from '../lib/storage';
import type { UserProfile } from '../types';

interface UsernameModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onUpdated: (user: UserProfile) => void;
}

export const UsernameModal: React.FC<UsernameModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onUpdated,
}) => {
  const [name, setName] = useState(currentUser.username);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Kullanıcı adı en az 2 karakter olmalıdır.');
      return;
    }
    if (trimmed.length > 20) {
      setError('Kullanıcı adı en fazla 20 karakter olabilir.');
      return;
    }
    const updated = updateUsername(trimmed);
    onUpdated(updated);
    onClose();
  };

  const generateRandomName = () => {
    const prefixes = ['Hyper', 'Cyber', 'Apex', 'Nova', 'Vortex', 'Phantom', 'Blitz', 'Turbo'];
    const suffixes = ['Clicker', 'Striker', 'Gamer', 'Master', 'Beast', 'King', 'Legend'];
    const random = `${prefixes[Math.floor(Math.random() * prefixes.length)]}${suffixes[Math.floor(Math.random() * suffixes.length)]}_${Math.floor(100 + Math.random() * 900)}`;
    setName(random);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0f1322] border border-purple-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.2)] text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-wide">Kullanıcı Adını Değiştir</h3>
            <p className="text-xs text-gray-400">1v1 VS ve skor tablolarında bu isimle görünürsün.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Yeni Kullanıcı Adı
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                maxLength={20}
                placeholder="Örn: SpeedDemon_99"
                className="w-full bg-[#161b30] border border-purple-500/40 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 text-base font-semibold"
                autoFocus
              />
              <button
                type="button"
                onClick={generateRandomName}
                title="Rastgele İsim Oluştur"
                className="absolute right-2 top-2.5 px-2.5 py-1 text-xs bg-purple-900/50 hover:bg-purple-800 text-purple-300 rounded-lg flex items-center space-x-1 border border-purple-500/30 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rastgele</span>
              </button>
            </div>
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>

          <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-3 text-xs text-gray-300 space-y-1">
            <p className="font-semibold text-purple-300 flex items-center space-x-1">
              <span>💡 Kalıcı Oturum</span>
            </p>
            <p className="text-gray-400 leading-relaxed">
              Kullanıcı adın tarayıcına otomatik kaydedilir. Siteye her girdiğinde aynı isim ve skorlarınla devam edersin.
            </p>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-700 bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 font-semibold text-sm transition-all"
            >
              İptal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Kaydet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
