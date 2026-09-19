import Peer, { type DataConnection } from 'peerjs';
import type { UserProfile, PlayerState } from '../types';
import { getSupabaseClient } from './supabase';

export interface MatchNetworkCallbacks {
  onOpponentConnected: (opponent: PlayerState, matchDuration?: number) => void;
  onOpponentStart: (startTime: number) => void;
  onOpponentClickUpdate: (opponent: PlayerState) => void;
  onOpponentFinish: (result: { clicks: number; cps: number; timedOut?: boolean }) => void;
  onRematchRequested: () => void;
  onConnectionError: (err: string) => void;
  onStatusChange: (status: string) => void;
}

export interface NetworkMessage {
  type: 'HELLO_JOIN' | 'HOST_WELCOME' | 'START_COUNTDOWN' | 'PLAYER_CLICK' | 'PLAYER_FINISH' | 'REMATCH' | 'PING' | 'PONG';
  payload: any;
  senderId: string;
}

export class UniversalMatchEngine {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private roomId: string;
  private currentUser: UserProfile;
  private isHost: boolean;
  private matchDuration: number;
  private callbacks: MatchNetworkCallbacks;
  public isConnected: boolean = false;
  private pingInterval: number | null = null;

  constructor(
    roomId: string,
    currentUser: UserProfile,
    isHost: boolean,
    matchDuration: number,
    callbacks: MatchNetworkCallbacks
  ) {
    this.roomId = roomId.toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '');
    this.currentUser = currentUser;
    this.isHost = isHost;
    this.matchDuration = matchDuration;
    this.callbacks = callbacks;
  }

  public init() {
    this.callbacks.onStatusChange(this.isHost ? 'Oda açılıyor, sunucuya bağlanılıyor...' : 'Odaya bağlanılıyor...');

    // 1. Cross-tab BroadcastChannel for instant local tests
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcast = new BroadcastChannel(`cps_mesh_${this.roomId}`);
        this.localBroadcast.onmessage = (event) => {
          this.handleIncomingMessage(event.data);
        };
      }
    } catch {
      // ignore
    }

    // 2. Initialize Universal WebRTC PeerJS across all Operating Systems & Devices
    const hostPeerId = `cps-room-${this.roomId}-host`;
    const guestPeerId = `cps-room-${this.roomId}-g-${this.currentUser.id.substring(0, 8)}`;

    const myPeerId = this.isHost ? hostPeerId : guestPeerId;

    try {
      this.peer = new Peer(myPeerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
          ],
        },
      });

      this.peer.on('open', (_id) => {
        this.callbacks.onStatusChange(this.isHost ? 'Oda hazır! Rakip bekleniyor...' : 'Oda bulundu, katılınıyor...');

        if (!this.isHost) {
          // Connect to Host Peer
          this.connectToHost(hostPeerId);
        }
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        console.warn('PeerJS warning/error:', err.type || err);
        if (err.type === 'unavailable-id') {
          // If host ID is already taken, someone else is host, join as guest
          if (this.isHost) {
            this.callbacks.onConnectionError('Bu oda numarası şu an başka bir oyuncu tarafından kullanılıyor. Lütfen başka bir oda numarası seçin.');
          }
        } else if (err.type === 'peer-unavailable') {
          if (!this.isHost) {
            this.callbacks.onConnectionError(`Oda #${this.roomId} bulunamadı. Oda numarasını doğru girdiğinizden emin olun.`);
          }
        }
      });
    } catch (e: any) {
      console.warn('Failed to init PeerJS:', e);
    }

    // 3. If Supabase configured, subscribe to Supabase Realtime channel as well
    this.initSupabaseRealtime();

    // If Guest, broadcast HELLO on local channel as well
    if (!this.isHost) {
      setTimeout(() => {
        this.broadcastLocal({
          type: 'HELLO_JOIN',
          senderId: this.currentUser.id,
          payload: {
            user: this.currentUser,
          },
        });
      }, 500);
    }
  }

  private connectToHost(hostPeerId: string) {
    if (!this.peer) return;
    const conn = this.peer.connect(hostPeerId, { reliable: true });
    this.setupConnection(conn);
  }

  private setupConnection(conn: DataConnection) {
    this.connection = conn;

    conn.on('open', () => {
      this.isConnected = true;
      this.callbacks.onStatusChange('Bağlantı kuruldu!');

      if (!this.isHost) {
        // Send join info to host
        this.sendMessage({
          type: 'HELLO_JOIN',
          senderId: this.currentUser.id,
          payload: {
            user: this.currentUser,
          },
        });
      } else {
        // Host sends welcome with room duration
        this.sendMessage({
          type: 'HOST_WELCOME',
          senderId: this.currentUser.id,
          payload: {
            host: this.currentUser,
            matchDuration: this.matchDuration,
          },
        });
      }

      // Start keep-alive ping
      this.pingInterval = window.setInterval(() => {
        if (this.connection?.open) {
          this.sendMessage({
            type: 'PING',
            senderId: this.currentUser.id,
            payload: {},
          });
        }
      }, 3000);
    });

    conn.on('data', (data) => {
      this.handleIncomingMessage(data as NetworkMessage);
    });

    conn.on('close', () => {
      this.isConnected = false;
      this.callbacks.onStatusChange('Rakip odadan ayrıldı.');
    });

    conn.on('error', (err) => {
      console.warn('Connection error:', err);
    });
  }

  private initSupabaseRealtime() {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const channel = client.channel(`mesh_room_${this.roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel.on('broadcast', { event: 'cps_msg' }, ({ payload }) => {
        if (payload && payload.senderId !== this.currentUser.id) {
          this.handleIncomingMessage(payload);
        }
      });

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this.isHost) {
          channel.send({
            type: 'broadcast',
            event: 'cps_msg',
            payload: {
              type: 'HELLO_JOIN',
              senderId: this.currentUser.id,
              payload: { user: this.currentUser },
            },
          });
        }
      });
    } catch (e) {
      console.warn('Supabase realtime mesh init error:', e);
    }
  }

  private handleIncomingMessage(msg: NetworkMessage) {
    if (!msg || msg.senderId === this.currentUser.id) return;

    switch (msg.type) {
      case 'HELLO_JOIN': {
        const guest = msg.payload?.user;
        if (guest && this.isHost) {
          // Notify Host that guest connected
          this.callbacks.onOpponentConnected({
            id: guest.id,
            username: guest.username,
            clicks: 0,
            cps: 0,
            hasStarted: false,
            hasFinished: false,
          }, this.matchDuration);

          // Reply with Host Welcome & Duration
          this.sendMessage({
            type: 'HOST_WELCOME',
            senderId: this.currentUser.id,
            payload: {
              host: this.currentUser,
              matchDuration: this.matchDuration,
            },
          });
        }
        break;
      }

      case 'HOST_WELCOME': {
        const host = msg.payload?.host;
        const duration = msg.payload?.matchDuration || this.matchDuration;
        if (host && !this.isHost) {
          this.callbacks.onOpponentConnected({
            id: host.id,
            username: host.username,
            clicks: 0,
            cps: 0,
            hasStarted: false,
            hasFinished: false,
          }, duration);
        }
        break;
      }

      case 'START_COUNTDOWN': {
        this.callbacks.onOpponentStart(msg.payload?.startTime || Date.now());
        break;
      }

      case 'PLAYER_CLICK': {
        if (msg.payload?.player) {
          this.callbacks.onOpponentClickUpdate(msg.payload.player);
        }
        break;
      }

      case 'PLAYER_FINISH': {
        this.callbacks.onOpponentFinish(msg.payload);
        break;
      }

      case 'REMATCH': {
        this.callbacks.onRematchRequested();
        break;
      }

      case 'PING': {
        this.sendMessage({
          type: 'PONG',
          senderId: this.currentUser.id,
          payload: {},
        });
        break;
      }

      default:
        break;
    }
  }

  public sendMessage(msg: NetworkMessage) {
    // 1. Send via WebRTC DataChannel (Ultra fast)
    if (this.connection?.open) {
      try {
        this.connection.send(msg);
      } catch {
        // fallback
      }
    }

    // 2. Send via Local BroadcastChannel
    this.broadcastLocal(msg);

    // 3. Send via Supabase Realtime if active
    const client = getSupabaseClient();
    if (client) {
      try {
        client.channel(`mesh_room_${this.roomId}`).send({
          type: 'broadcast',
          event: 'cps_msg',
          payload: msg,
        });
      } catch {
        // ignore
      }
    }
  }

  private broadcastLocal(msg: NetworkMessage) {
    if (this.localBroadcast) {
      try {
        this.localBroadcast.postMessage(msg);
      } catch {
        // ignore
      }
    }
  }

  public broadcastPlayerClicks(clicks: number, cps: number) {
    this.sendMessage({
      type: 'PLAYER_CLICK',
      senderId: this.currentUser.id,
      payload: {
        player: {
          id: this.currentUser.id,
          username: this.currentUser.username,
          clicks,
          cps,
          hasStarted: true,
          hasFinished: false,
        },
      },
    });
  }

  public broadcastPlayerStart(startTime: number) {
    this.sendMessage({
      type: 'START_COUNTDOWN',
      senderId: this.currentUser.id,
      payload: { startTime },
    });
  }

  public broadcastPlayerFinish(clicks: number, cps: number, timedOut: boolean = false) {
    this.sendMessage({
      type: 'PLAYER_FINISH',
      senderId: this.currentUser.id,
      payload: { clicks, cps, timedOut },
    });
  }

  public broadcastRematch() {
    this.sendMessage({
      type: 'REMATCH',
      senderId: this.currentUser.id,
      payload: {},
    });
  }

  public disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.localBroadcast) {
      this.localBroadcast.close();
      this.localBroadcast = null;
    }
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isConnected = false;
  }
}
