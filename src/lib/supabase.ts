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
// (Uses Supabase Realtime + Local BroadcastChannel fallback)
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
  private localBroadcast: BroadcastChannel | null = null;
  private roomId: string;
  public isConnected: boolean = false;
  private callbacks: MatchCallbacks | null = null;

  constructor(roomId: string) {
    this.roomId = roomId.toUpperCase().trim();
  }

  public connect(
    currentUser: UserProfile,
    isHost: boolean,
    matchDuration: number,
    callbacks: MatchCallbacks
  ): boolean {
    this.callbacks = callbacks;

    // 1. Initialize Cross-Tab Local Broadcast Channel for instant offline/local testing
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcast = new BroadcastChannel(`cps_room_${this.roomId}`);
        this.localBroadcast.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'player_joined' && isHost && payload?.user?.id !== currentUser.id) {
            this.callbacks?.onPlayerJoined({
              id: payload.user.id,
              username: payload.user.username,
              clicks: 0,
              cps: 0,
              hasStarted: false,
              hasFinished: false,
            });
            // Acknowledge back to guest
            this.localBroadcast?.postMessage({
              type: 'host_ack',
              payload: { host: currentUser },
            });
          } else if (type === 'host_ack' && !isHost && payload?.host?.id !== currentUser.id) {
            this.callbacks?.onPlayerJoined({
              id: payload.host.id,
              username: payload.host.username,
              clicks: 0,
              cps: 0,
              hasStarted: false,
              hasFinished: false,
            });
          } else if (type === 'player_start' && payload?.senderId !== currentUser.id) {
            this.callbacks?.onOpponentStart(payload.startTime);
          } else if (type === 'click_update' && payload?.senderId !== currentUser.id && payload?.player) {
            this.callbacks?.onOpponentClickUpdate(payload.player);
          } else if (type === 'player_finish' && payload?.senderId !== currentUser.id) {
            this.callbacks?.onOpponentFinish(payload);
          } else if (type === 'rematch' && payload?.senderId !== currentUser.id) {
            this.callbacks?.onRematchRequested();
          }
        };

        // If guest joining, announce to host
        if (!isHost) {
          setTimeout(() => {
            this.localBroadcast?.postMessage({
              type: 'player_joined',
              payload: { user: currentUser, matchDuration },
            });
          }, 200);
        }
      }
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }

    // 2. Initialize Supabase Realtime Channel
    const client = getSupabaseClient();
    if (client) {
      try {
        this.channel = client.channel(`room_${this.roomId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: currentUser.id },
          },
        });

        this.channel
          .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
            if (payload && payload.user && payload.user.id !== currentUser.id) {
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
            if (!isHost) {
              this.channel?.send({
                type: 'broadcast',
                event: 'player_joined',
                payload: { user: currentUser, matchDuration },
              });
            }
          }
        });
      } catch (err) {
        console.warn('Supabase Realtime error:', err);
      }
    }

    this.isConnected = true;
    return true;
  }

  public broadcastStart(startTime: number, senderId: string) {
    this.localBroadcast?.postMessage({
      type: 'player_start',
      payload: { startTime, senderId },
    });
    this.channel?.send({
      type: 'broadcast',
      event: 'player_start',
      payload: { startTime, senderId },
    });
  }

  public broadcastClicks(player: PlayerState, senderId: string) {
    this.localBroadcast?.postMessage({
      type: 'click_update',
      payload: { player, senderId },
    });
    this.channel?.send({
      type: 'broadcast',
      event: 'click_update',
      payload: { player, senderId },
    });
  }

  public broadcastFinish(clicks: number, cps: number, timedOut: boolean = false, senderId: string = '') {
    this.localBroadcast?.postMessage({
      type: 'player_finish',
      payload: { clicks, cps, timedOut, senderId },
    });
    this.channel?.send({
      type: 'broadcast',
      event: 'player_finish',
      payload: { clicks, cps, timedOut, senderId },
    });
  }

  public broadcastRematch(senderId: string) {
    this.localBroadcast?.postMessage({
      type: 'rematch',
      payload: { senderId },
    });
    this.channel?.send({
      type: 'broadcast',
      event: 'rematch',
      payload: { senderId },
    });
  }

  public disconnect() {
    if (this.localBroadcast) {
      this.localBroadcast.close();
      this.localBroadcast = null;
    }
    if (this.channel) {
      const client = getSupabaseClient();
      client?.removeChannel(this.channel);
      this.channel = null;
    }
    this.isConnected = false;
    this.callbacks = null;
  }
}
