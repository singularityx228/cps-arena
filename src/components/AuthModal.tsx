import React, { useState } from 'react';
import { User, X, Check, LogIn, UserPlus, ShieldCheck, AlertCircle, LogOut } from 'lucide-react';
import { registerUser, loginUser, logoutUser, changeUsernameWithPassword } from '../lib/storage';
import type { UserProfile } from '../types';
import { sounds } from '../lib/sounds';

interface AuthModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onUpdated: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onUpdated,
}) => {
  const isRegistered = !currentUser.id.startsWith('guest_');
  const [tab, setTab] = useState<'login' | 'register' | 'change_name'>(
    isRegistered ? 'change_name' : 'register'
  );

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await registerUser(username, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Kayıt başarısız oldu.');
      sounds.playDefeat();
    } else if (res.user) {
      sounds.playVictory();
      setSuccessMsg('Hesap başarıyla oluşturuldu ve giriş yapıldı!');
      onUpdated(res.user);
      setTimeout(() => {
        onClose();
      }, 900);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await loginUser(username, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Giriş başarısız oldu.');
      sounds.playDefeat();
    } else if (res.user) {
      sounds.playVictory();
      setSuccessMsg('Başarıyla giriş yapıldı!');
      onUpdated(res.user);
      setTimeout(() => {
        onClose();
      }, 900);
    }
  };

  const handleChangeName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await changeUsernameWithPassword(newUsername, password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'İsim değiştirilemedi.');
      sounds.playDefeat();
    } else if (res.user) {
      sounds.playVictory();
      setSuccessMsg('Kullanıcı adı başarıyla güncellendi!');
      onUpdated(res.user);
      setTimeout(() => {
        onClose();
      }, 900);
    }
  };

  const handleLogout = () => {
    sounds.playClick();
    const guest = logoutUser();
    onUpdated(guest);
    setTab('login');
    setSuccessMsg('Çıkış yapıldı.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0f1324] border border-purple-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-wide">
              {tab === 'login' ? 'Giriş Yap' : tab === 'register' ? 'Kayıt Ol' : 'Kullanıcı Adını Değiştir'}
            </h3>
            <p className="text-xs text-gray-400">
              Aktif Profil: <strong className="text-purple-300">{currentUser.username}</strong>
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-[#161a30] p-1 rounded-xl mb-4 border border-gray-800">
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
              tab === 'register' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Kayıt Ol</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
              tab === 'login' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Giriş Yap</span>
          </button>

          {isRegistered && (
            <button
              type="button"
              onClick={() => {
                setTab('change_name');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 ${
                tab === 'change_name' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>İsim Değiştir</span>
            </button>
          )}
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="bg-red-950/70 border border-red-500/60 rounded-xl p-3 text-xs text-red-300 font-semibold mb-3 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-xl p-3 text-xs text-emerald-300 font-semibold mb-3 flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form: Register */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                placeholder="Örn: SpeedMaster_01"
                className="w-full bg-[#161a30] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#161a30] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                required
              />
            </div>

            <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-2.5 text-[11px] text-gray-400">
              💡 Kullanıcı adı benzersizdir. Alınmış isimler tekrar alınamaz.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'Kayıt Yapılıyor...' : 'Hesap Oluştur ve Başla'}</span>
            </button>
          </form>
        )}

        {/* Form: Login */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                placeholder="Kullanıcı Adınız"
                className="w-full bg-[#161a30] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#161a30] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}</span>
            </button>
          </form>
        )}

        {/* Form: Change Username */}
        {tab === 'change_name' && (
          <form onSubmit={handleChangeName} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Yeni Kullanıcı Adı</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                maxLength={20}
                placeholder="Yeni İsim"
                className="w-full bg-[#161a30] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Güvenlik İçin Mevcut Şifreniz</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifreniz"
                className="w-full bg-[#161a30] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Güncelleniyor...' : 'İsmi Değiştir'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl bg-gray-800/80 hover:bg-red-950/60 border border-gray-700 hover:border-red-600 text-xs font-bold text-gray-300 hover:text-red-300 transition-all flex items-center justify-center space-x-2 mt-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Oturumu Kapat / Çıkış Yap</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
