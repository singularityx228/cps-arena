-- ============================================================
-- CPS ARENA - SUPABASE DATABASE SCHEMA & REALTIME CONFIG
-- ============================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  high_score_cps NUMERIC(5, 2) DEFAULT 0,
  total_clicks BIGINT DEFAULT 0,
  matches_played INT DEFAULT 0,
  matches_won INT DEFAULT 0,
  matches_lost INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Leaderboard Records Table (Solo CPS Test Results)
CREATE TABLE IF NOT EXISTS public.solo_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  cps NUMERIC(5, 2) NOT NULL,
  duration NUMERIC(5, 2) NOT NULL,
  total_clicks INT NOT NULL,
  tier_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Match Rooms Table (1v1 VS Battles)
CREATE TABLE IF NOT EXISTS public.match_rooms (
  room_id TEXT PRIMARY KEY,
  duration NUMERIC(4, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'ready', 'active', 'finished'
  host_id TEXT NOT NULL,
  host_username TEXT NOT NULL,
  guest_id TEXT,
  guest_username TEXT,
  winner_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) & Allow Public Read/Write
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Profiles" ON public.profiles FOR ALL USING (true);

CREATE POLICY "Public Read Scores" ON public.solo_scores FOR SELECT USING (true);
CREATE POLICY "Public Insert Scores" ON public.solo_scores FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Manage Rooms" ON public.match_rooms FOR ALL USING (true);

-- Enable Realtime for Match Rooms & Scores
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solo_scores;
