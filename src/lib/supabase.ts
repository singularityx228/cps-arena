import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { UserProfile, PlayerState } from '../types';

// Default / Configurable Supabase credentials
const STORAGE_SUPABASE_URL_KEY = 'cps_supabase_custom_url';
const STORAGE_SUPABASE_KEY_KEY = 'cps_supabase_custom_key';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseConfig(): { url: string; key: string; isConfigured: boolean } {
  const url = localStorage.getItem(STORAGE_SUPABASE_URL_KEY) || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem(STORAGE_SUPABASE_KEY_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const isConfigured = Boolean(url && key && url.startsWith('http'));
  return { url, key, isConfigured };
}

export function saveSupabaseConfig(url: string, key: string): boolean {
  try {
    localStorage.setItem(STORAGE_SUPABASE_URL_KEY, url.trim());
    localStorage.setItem(STORAGE_SUPABASE_KEY_KEY, key.trim());
    supabaseInstance = null; // Recreate next time
    return true;
  } catch (err) {
    console.error('Failed to save Supabase config:', err);
    return false;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, key, isConfigured } = getSupabaseConfig();
  if (isConfigured) {
    try {
      supabaseInstance = createClient(url, key, {
        realtime: {
          params: {
            eventsPerSecond: 30,
          },
        },
      });
      return supabaseInstance;
    } catch (err) {
      console.warn('Could not initialize Supabase client, using fallback mode:', err);
    }
  }
  return null;
}

// ----------------------------------------------------
// Realtime 1v1 Room & Match Manager
// ----------------------------------------------------

export interface MatchCallbacks {
  onPlayerJoined: (player2: PlayerState) => void;
  onOpponentClickUpdate: (opponent: PlayerState) => void;
  onOpponentStart: (startTime: number) => void;
  onOpponentFinish: (result: { clicks: number; cps: number; timedOut?: boolean }) => void;
  onRematchRequested: () => void;
}

export class VersusChannelManager {
  private channel: RealtimeChannel | null = null;
  private roomId: string;
  public isConnected: boolean = false;
  private callbacks: MatchCallbacks | null = null;
  private isSimulated: boolean = false;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  public connect(
    currentUser: UserProfile,
    isHost: boolean,
    matchDuration: number,
    callbacks: MatchCallbacks
  ): boolean {
    this.callbacks = callbacks;
    const client = getSupabaseClient();

    if (!client) {
      // Offline / Simulated Match Mode
      this.isSimulated = true;
      this.isConnected = true;
      return true;
    }

    try {
      this.channel = client.channel(`room_${this.roomId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: currentUser.id },
        },
      });

      this.channel
        .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
          if (payload && payload.user) {
            this.callbacks?.onPlayerJoined({
              id: payload.user.id,
              username: payload.user.username,
              clicks: 0,
              cps: 0,
              hasStarted: false,
              hasFinished: false,
            });
          }
        })
        .on('broadcast', { event: 'player_start' }, ({ payload }) => {
          this.callbacks?.onOpponentStart(payload.startTime);
        })
        .on('broadcast', { event: 'click_update' }, ({ payload }) => {
          if (payload && payload.player) {
            this.callbacks?.onOpponentClickUpdate(payload.player);
          }
        })
        .on('broadcast', { event: 'player_finish' }, ({ payload }) => {
          if (payload) {
            this.callbacks?.onOpponentFinish(payload);
          }
        })
        .on('broadcast', { event: 'rematch' }, () => {
          this.callbacks?.onRematchRequested();
        });

      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          // If joining, notify host
          if (!isHost) {
            this.channel?.send({
              type: 'broadcast',
              event: 'player_joined',
              payload: { user: currentUser, matchDuration },
            });
          }
        }
      });

      return true;
    } catch (err) {
      console.warn('Realtime channel error, switching to simulated mode:', err);
      this.isSimulated = true;
      this.isConnected = true;
      return true;
    }
  }

  public broadcastStart(startTime: number) {
    if (this.channel && !this.isSimulated) {
      this.channel.send({
        type: 'broadcast',
        event: 'player_start',
        payload: { startTime },
      });
    }
  }

  public broadcastClicks(player: PlayerState) {
    if (this.channel && !this.isSimulated) {
      this.channel.send({
        type: 'broadcast',
        event: 'click_update',
        payload: { player },
      });
    }
  }

  public broadcastFinish(clicks: number, cps: number, timedOut: boolean = false) {
    if (this.channel && !this.isSimulated) {
      this.channel.send({
        type: 'broadcast',
        event: 'player_finish',
        payload: { clicks, cps, timedOut },
      });
    }
  }

  public broadcastRematch() {
    if (this.channel && !this.isSimulated) {
      this.channel.send({
        type: 'broadcast',
        event: 'rematch',
        payload: {},
      });
    }
  }

  public disconnect() {
    if (this.channel) {
      const client = getSupabaseClient();
      client?.removeChannel(this.channel);
      this.channel = null;
    }
    this.isConnected = false;
    this.callbacks = null;
  }
}
