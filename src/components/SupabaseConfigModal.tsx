import React, { useState } from 'react';
import { Database, X, Check, Copy, ShieldCheck } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig } from '../lib/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [key, setKey] = useState(currentConfig.key);
  const [statusMsg, setStatusMsg] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(url, key);
    setStatusMsg('Supabase bağlantı bilgileri kaydedildi!');
    setTimeout(() => {
      onSaved();
      onClose();
    }, 1000);
  };

  const copySqlSchema = () => {
    const sql = `-- CPS Arena Supabase Setup
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  high_score_cps NUMERIC(5, 2) DEFAULT 0,
  total_clicks BIGINT DEFAULT 0,
  matches_played INT DEFAULT 0,
  matches_won INT DEFAULT 0,
  matches_lost INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Profiles" ON public.profiles FOR ALL USING (true);
`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#0d111d] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-left max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-wide">Supabase Veritabanı & Realtime</h3>
            <p className="text-xs text-gray-400">Canlı 1v1 multiplayer ve global skor tablosu bağlantısı</p>
          </div>
        </div>

        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 mb-5 flex items-start space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-300">
            <p className="font-semibold text-emerald-200">Otomatik Hazır Mod Aktif!</p>
            <p className="text-emerald-300/80 mt-0.5">
              Uygulama şu anda dahili gerçek zamanlı motor ile kutudan çıktığı gibi 1v1 ve solo testlerde tam çalışır. Kendi Supabase projenizi bağlamak isterseniz aşağıdaki bilgileri girebilirsiniz.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Project URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full bg-[#151928] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Anon / Public API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-[#151928] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 font-mono text-xs"
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={copySqlSchema}
              className="w-full py-2.5 px-3 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-300 font-medium flex items-center justify-center space-x-2 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              <span>{copied ? 'SQL Şeması Kopyalandı!' : 'Supabase SQL Şemasını Kopyala'}</span>
            </button>
          </div>

          {statusMsg && (
            <p className="text-xs text-emerald-400 font-semibold text-center">{statusMsg}</p>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-700 bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 font-semibold text-sm transition-all"
            >
              Kapat
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Kaydet & Bağlan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
