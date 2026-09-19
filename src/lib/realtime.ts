import mqtt, { type MqttClient } from 'mqtt';
import type { UserProfile, PlayerState } from '../types';
import { saveLeaderboardRecord, getCachedLeaderboard, type GlobalLeaderboardRecord } from './storage';


export interface MatchNetworkCallbacks {
  onOpponentConnected: (opponent: PlayerState, syncedDuration: number) => void;
  onOpponentStart: (startTime: number) => void;
  onOpponentClickUpdate: (opponent: PlayerState) => void;
  onOpponentFinish: (result: { clicks: number; cps: number; timedOut?: boolean }) => void;
  onRematchRequested: () => void;
  onConnectionError: (err: string) => void;
  onStatusChange: (status: string) => void;
}

export interface NetworkMessage {
  type:
    | 'HOST_WAITING'
    | 'GUEST_JOIN'
    | 'MATCH_START'
    | 'GUEST_ACK'
    | 'PLAYER_CLICK'
    | 'PLAYER_START_CLICK'
    | 'PLAYER_FINISH'
    | 'REMATCH';
  senderId: string;
  senderName: string;
  roomId: string;
  payload: any;
}

// Global public MQTT WebSocket brokers with SSL
const BROKER_SERVERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

// ----------------------------------------------------
// Universal 1v1 Room Match Engine
// ----------------------------------------------------
export class UniversalMatchEngine {
  private client: MqttClient | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private roomId: string;
  private currentUser: UserProfile;
  private isHost: boolean;
  private matchDuration: number;
  private callbacks: MatchNetworkCallbacks;
  public isConnected: boolean = false;
  private announceInterval: number | null = null;
  private joinRetryInterval: number | null = null;
  private topic: string;
  private hasMatched: boolean = false;

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
    this.topic = `cps_arena_v3/rooms/${this.roomId}`;
  }

  public init() {
    this.callbacks.onStatusChange(this.isHost ? 'Oda açılıyor...' : 'Odaya bağlanılıyor...');

    // 1. Cross-tab Local Broadcast for instant test
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcast = new BroadcastChannel(`cps_v3_${this.roomId}`);
        this.localBroadcast.onmessage = (event) => {
          this.handleIncoming(event.data);
        };
      }
    } catch {
      // ignore
    }

    // 2. Connect to Global Low-Latency MQTT WebSocket Broker
    const clientId = `cps_${this.isHost ? 'host' : 'guest'}_${this.currentUser.id.substring(0, 8)}_${Math.floor(Math.random() * 10000)}`;

    const connectToBroker = (brokerIndex = 0) => {
      if (brokerIndex >= BROKER_SERVERS.length) {
        this.callbacks.onStatusChange('Oda yerel modda aktif.');
        return;
      }

      try {
        const client = mqtt.connect(BROKER_SERVERS[brokerIndex], {
          clientId: `${clientId}_${brokerIndex}`,
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 2000,
          keepalive: 15,
        });
        this.client = client;

        client.on('connect', () => {
          this.isConnected = true;
          this.callbacks.onStatusChange(
            this.isHost ? 'Oda hazır! Rakip bekleniyor...' : 'Odaya bağlanıldı, rakip aranıyor...'
          );

          // Subscribe to room topic
          client.subscribe(this.topic, { qos: 0 }, (err) => {
            if (!err) {
              if (this.isHost) {
                // Host announces room periodically while waiting
                this.announceInterval = window.setInterval(() => {
                  if (!this.hasMatched) {
                    this.send({
                      type: 'HOST_WAITING',
                      senderId: this.currentUser.id,
                      senderName: this.currentUser.username,
                      roomId: this.roomId,
                      payload: { matchDuration: this.matchDuration },
                    });
                  }
                }, 1000);
              } else {
                // Guest sends join request periodically until matched
                this.sendJoinRequest();
                this.joinRetryInterval = window.setInterval(() => {
                  if (!this.hasMatched) {
                    this.sendJoinRequest();
                  }
                }, 800);
              }
            }
          });
        });

        client.on('message', (_top, payloadBuffer) => {
          try {
            const msgStr = payloadBuffer.toString();
            const parsed = JSON.parse(msgStr);
            this.handleIncoming(parsed);
          } catch {
            // parse error
          }
        });

        client.on('error', () => {
          if (!this.isConnected && brokerIndex + 1 < BROKER_SERVERS.length) {
            client.end(true);
            connectToBroker(brokerIndex + 1);
          }
        });
      } catch (e: any) {
        console.warn('Failed to connect to broker:', e);
      }
    };

    connectToBroker(0);
  }

  private sendJoinRequest() {
    this.send({
      type: 'GUEST_JOIN',
      senderId: this.currentUser.id,
      senderName: this.currentUser.username,
      roomId: this.roomId,
      payload: {
        guest: this.currentUser,
      },
    });
  }

  private handleIncoming(msg: NetworkMessage) {
    if (!msg || msg.senderId === this.currentUser.id || msg.roomId !== this.roomId) return;

    switch (msg.type) {
      // HOST receives GUEST_JOIN -> Host accepts and sends MATCH_START with exact duration
      case 'GUEST_JOIN': {
        if (this.isHost) {
          this.hasMatched = true;
          if (this.announceInterval) {
            clearInterval(this.announceInterval);
            this.announceInterval = null;
          }

          const guestUser = msg.payload?.guest || { id: msg.senderId, username: msg.senderName };

          // Notify Host
          this.callbacks.onOpponentConnected(
            {
              id: guestUser.id,
              username: guestUser.username,
              clicks: 0,
              cps: 0,
              hasStarted: false,
              hasFinished: false,
            },
            this.matchDuration
          );

          // Broadcast MATCH_START with exact Host duration to Guest (send multiple bursts)
          const startMsg: NetworkMessage = {
            type: 'MATCH_START',
            senderId: this.currentUser.id,
            senderName: this.currentUser.username,
            roomId: this.roomId,
            payload: {
              host: this.currentUser,
              guest: guestUser,
              matchDuration: this.matchDuration,
            },
          };

          this.send(startMsg);
          setTimeout(() => this.send(startMsg), 150);
          setTimeout(() => this.send(startMsg), 350);
        }
        break;
      }

      // GUEST receives MATCH_START -> Guest syncs duration and responds with GUEST_ACK
      case 'MATCH_START': {
        if (!this.isHost) {
          this.hasMatched = true;
          if (this.joinRetryInterval) {
            clearInterval(this.joinRetryInterval);
            this.joinRetryInterval = null;
          }

          const hostUser = msg.payload?.host || { id: msg.senderId, username: msg.senderName };
          const syncedDuration = msg.payload?.matchDuration || this.matchDuration;

          this.callbacks.onOpponentConnected(
            {
              id: hostUser.id,
              username: hostUser.username,
              clicks: 0,
              cps: 0,
              hasStarted: false,
              hasFinished: false,
            },
            syncedDuration
          );

          // Send ACK back
          this.send({
            type: 'GUEST_ACK',
            senderId: this.currentUser.id,
            senderName: this.currentUser.username,
            roomId: this.roomId,
            payload: { guest: this.currentUser },
          });
        }
        break;
      }

      // HOST receives GUEST_ACK -> Double confirmation
      case 'GUEST_ACK': {
        if (this.isHost && !this.hasMatched) {
          this.hasMatched = true;
          const guestUser = msg.payload?.guest || { id: msg.senderId, username: msg.senderName };
          this.callbacks.onOpponentConnected(
            {
              id: guestUser.id,
              username: guestUser.username,
              clicks: 0,
              cps: 0,
              hasStarted: false,
              hasFinished: false,
            },
            this.matchDuration
          );
        }
        break;
      }

      case 'HOST_WAITING': {
        if (!this.isHost && !this.hasMatched) {
          this.sendJoinRequest();
        }
        break;
      }

      case 'PLAYER_START_CLICK': {
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

      default:
        break;
    }
  }

  public send(msg: NetworkMessage) {
    const jsonStr = JSON.stringify(msg);

    // 1. Send via MQTT WebSocket
    if (this.client?.connected) {
      try {
        this.client.publish(this.topic, jsonStr, { qos: 0 });
      } catch {
        // ignore
      }
    }

    // 2. Send via Local BroadcastChannel
    if (this.localBroadcast) {
      try {
        this.localBroadcast.postMessage(msg);
      } catch {
        // ignore
      }
    }
  }

  public broadcastPlayerClicks(clicks: number, cps: number) {
    this.send({
      type: 'PLAYER_CLICK',
      senderId: this.currentUser.id,
      senderName: this.currentUser.username,
      roomId: this.roomId,
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
    this.send({
      type: 'PLAYER_START_CLICK',
      senderId: this.currentUser.id,
      senderName: this.currentUser.username,
      roomId: this.roomId,
      payload: { startTime },
    });
  }

  public broadcastPlayerFinish(clicks: number, cps: number, timedOut: boolean = false) {
    this.send({
      type: 'PLAYER_FINISH',
      senderId: this.currentUser.id,
      senderName: this.currentUser.username,
      roomId: this.roomId,
      payload: { clicks, cps, timedOut },
    });
  }

  public broadcastRematch() {
    this.send({
      type: 'REMATCH',
      senderId: this.currentUser.id,
      senderName: this.currentUser.username,
      roomId: this.roomId,
      payload: {},
    });
  }

  public disconnect() {
    if (this.announceInterval) clearInterval(this.announceInterval);
    if (this.joinRetryInterval) clearInterval(this.joinRetryInterval);
    if (this.localBroadcast) {
      this.localBroadcast.close();
      this.localBroadcast = null;
    }
    if (this.client) {
      try {
        this.client.end(false);
      } catch {
        // ignore
      }
      this.client = null;
    }
    this.isConnected = false;
  }
}

// ----------------------------------------------------
// Global Matchmaking Queue Service
// ----------------------------------------------------
const QUEUE_TOPIC = 'cps_arena_v3/matchmaking_queue';

export interface QueueCallbacks {
  onMatched: (params: {
    roomId: string;
    duration: number;
    isHost: boolean;
    opponent: UserProfile;
  }) => void;
  onError: (msg: string) => void;
}

export class MatchmakingQueueService {
  private client: MqttClient | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private user: UserProfile;
  private callbacks: QueueCallbacks;
  private pingInterval: number | null = null;
  private isMatched: boolean = false;

  constructor(user: UserProfile, callbacks: QueueCallbacks) {
    this.user = user;
    this.callbacks = callbacks;
  }

  public start() {
    this.isMatched = false;

    // 1. Cross-tab Broadcast Channel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcast = new BroadcastChannel('cps_v3_matchmaking_queue');
        this.localBroadcast.onmessage = (event) => {
          this.handleQueueMessage(event.data);
        };
      }
    } catch {
      // ignore
    }

    // 2. MQTT WebSocket Connection
    const clientId = `queue_${this.user.id}_${Math.floor(Math.random() * 100000)}`;

    try {
      const client = mqtt.connect(BROKER_SERVERS[0], {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000,
      });
      this.client = client;

      client.on('connect', () => {
        client.subscribe(QUEUE_TOPIC, { qos: 0 });

        // Broadcast presence in queue every 800ms
        this.pingInterval = window.setInterval(() => {
          if (!this.isMatched) {
            this.broadcast({
              type: 'QUEUE_WAITING',
              user: this.user,
              timestamp: Date.now(),
            });
          }
        }, 800);
      });

      client.on('message', (_top, payloadBuf) => {
        try {
          const msg = JSON.parse(payloadBuf.toString());
          this.handleQueueMessage(msg);
        } catch {
          // ignore
        }
      });
    } catch (e: any) {
      console.warn('Queue broker error:', e);
    }
  }

  private broadcast(msg: any) {
    const jsonStr = JSON.stringify(msg);
    if (this.client?.connected) {
      this.client.publish(QUEUE_TOPIC, jsonStr, { qos: 0 });
    }
    if (this.localBroadcast) {
      this.localBroadcast.postMessage(msg);
    }
  }

  private handleQueueMessage(msg: any) {
    if (!msg || this.isMatched) return;

    // If another user is waiting in queue
    if (msg.type === 'QUEUE_WAITING' && msg.user && msg.user.id !== this.user.id) {
      // Deterministic Host Election: user with lexicographically larger ID acts as Host
      const isHost = this.user.id > msg.user.id;

      if (isHost) {
        this.isMatched = true;
        const roomId = `Q${Math.floor(100000 + Math.random() * 900000)}`;
        const duration = Math.floor(Math.random() * 7) + 1; // 1 - 7 seconds

        const matchMsg = {
          type: 'QUEUE_MATCH_CREATED',
          roomId,
          duration,
          targetUserId: msg.user.id,
          hostUser: this.user,
          guestUser: msg.user,
        };

        // Broadcast match creation
        this.broadcast(matchMsg);
        setTimeout(() => this.broadcast(matchMsg), 100);

        this.callbacks.onMatched({
          roomId,
          duration,
          isHost: true,
          opponent: msg.user,
        });

        this.stop();
      }
    }

    // If another player matched us (we are Guest)
    if (msg.type === 'QUEUE_MATCH_CREATED' && msg.targetUserId === this.user.id) {
      this.isMatched = true;

      this.callbacks.onMatched({
        roomId: msg.roomId,
        duration: msg.duration,
        isHost: false,
        opponent: msg.hostUser,
      });

      this.stop();
    }
  }

  public stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.localBroadcast) {
      this.localBroadcast.close();
      this.localBroadcast = null;
    }
    if (this.client) {
      // Graceful disconnect after small delay to flush outbound packets
      setTimeout(() => {
        try {
          this.client?.end(false);
          this.client = null;
        } catch {
          // ignore
        }
      }, 200);
    }
  }
}

// ----------------------------------------------------
// Global Live Leaderboard Synchronization Service (Retained Cloud State)
// ----------------------------------------------------
const LEADERBOARD_STATE_TOPIC = 'cps_arena_v3/global_leaderboard_state';
const LEADERBOARD_FEED_TOPIC = 'cps_arena_v3/global_leaderboard_feed';

export class GlobalLeaderboardService {
  private client: MqttClient | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();
  private pendingBroadcasts: GlobalLeaderboardRecord[] = [];
  public isConnected: boolean = false;

  public init() {
    if (this.client) return; // already initialized

    // 1. Local Broadcast Channel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcast = new BroadcastChannel('cps_arena_leaderboard_channel');
        this.localBroadcast.onmessage = (event) => {
          const { type, payload, records } = event.data || {};
          if (type === 'NEW_SCORE' && payload) {
            saveLeaderboardRecord(payload);
            this.notifyListeners();
          } else if (type === 'STATE_UPDATE' && records) {
            for (const r of records) {
              saveLeaderboardRecord(r);
            }
            this.notifyListeners();
          }
        };
      }
    } catch {
      // ignore
    }

    // 2. MQTT WebSocket Global Feed & Retained Cloud State
    const clientId = `ldr_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    try {
      const client = mqtt.connect(BROKER_SERVERS[0], {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2500,
        keepalive: 15,
      });
      this.client = client;

      client.on('connect', () => {
        this.isConnected = true;
        // Subscribe to retained state topic & live feed topic with QoS 1
        client.subscribe([LEADERBOARD_STATE_TOPIC, LEADERBOARD_FEED_TOPIC], { qos: 1 });

        // Flush any pending broadcasts
        while (this.pendingBroadcasts.length > 0) {
          const item = this.pendingBroadcasts.shift();
          if (item) {
            this.broadcastScore(item);
          }
        }
      });

      client.on('message', (topic, payloadBuf) => {
        try {
          const msg = JSON.parse(payloadBuf.toString());
          if (!msg) return;

          if (topic === LEADERBOARD_STATE_TOPIC && msg.records && Array.isArray(msg.records)) {
            for (const r of msg.records) {
              saveLeaderboardRecord(r);
            }
            this.notifyListeners();
          } else if (msg.type === 'GLOBAL_SCORE_ANNOUNCE' && msg.record) {
            saveLeaderboardRecord(msg.record);
            this.notifyListeners();
          }
        } catch {
          // ignore
        }
      });

      client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err) {
      console.warn('Leaderboard sync error:', err);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    });
  }

  public broadcastScore(record: GlobalLeaderboardRecord) {
    saveLeaderboardRecord(record);

    if (!this.client || !this.isConnected) {
      this.pendingBroadcasts.push(record);
      this.init();
    }

    // Merge and compute new global top 30 ledger
    const currentCached = getCachedLeaderboard();
    const map = new Map<string, GlobalLeaderboardRecord>();
    for (const r of currentCached) {
      map.set(r.username.toLowerCase(), r);
    }
    const existing = map.get(record.username.toLowerCase());
    if (!existing || record.cps >= existing.cps) {
      map.set(record.username.toLowerCase(), record);
    }
    const updatedTopList = Array.from(map.values()).sort((a, b) => b.cps - a.cps).slice(0, 30);

    const statePayload = JSON.stringify({
      type: 'LEADERBOARD_STATE',
      updatedAt: new Date().toISOString(),
      records: updatedTopList,
    });

    const feedPayload = JSON.stringify({
      type: 'GLOBAL_SCORE_ANNOUNCE',
      record,
    });

    if (this.client?.connected) {
      // Retained update ensures ANY new player or fresh device immediately receives the leaderboard!
      this.client.publish(LEADERBOARD_STATE_TOPIC, statePayload, { retain: true, qos: 1 });
      this.client.publish(LEADERBOARD_FEED_TOPIC, feedPayload, { qos: 0 });
    }
    if (this.localBroadcast) {
      this.localBroadcast.postMessage({ type: 'STATE_UPDATE', records: updatedTopList });
      this.localBroadcast.postMessage({ type: 'NEW_SCORE', payload: record });
    }
    this.notifyListeners();
  }
}

export const globalLeaderboardService = new GlobalLeaderboardService();


