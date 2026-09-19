import mqtt, { type MqttClient } from 'mqtt';
import type { UserProfile, PlayerState } from '../types';
import { saveLeaderboardRecord, getCachedLeaderboard, safeMergeLeaderboardRecords, type GlobalLeaderboardRecord } from './storage';


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
// Global Live Leaderboard Synchronization Service (ChronoPulse Dual-Broker Architecture)
// ----------------------------------------------------
const PRIMARY_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const BACKUP_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

const PRIMARY_RETAINED_TOPIC = 'cps_arena_v4/global/leaderboard_retained/v1';
const BACKUP_RETAINED_TOPIC = 'cps_arena_v4/backup/leaderboard_retained/v1';
const GOSSIP_TOPIC = 'cps_arena_v4/global/leaderboard_gossip/v1';

export class GlobalLeaderboardService {
  private primaryClient: MqttClient | null = null;
  private backupClient: MqttClient | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();
  private pendingBroadcasts: GlobalLeaderboardRecord[] = [];
  public isConnected: boolean = false;
  private maxSeenGlobalCount: number = 0;
  private lastPeerSyncResponseTime: number = 0;

  public init() {
    if (this.primaryClient || this.backupClient) return; // already initialized

    this.maxSeenGlobalCount = getCachedLeaderboard().length;

    // 1. Cross-tab Broadcast Channel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcast = new BroadcastChannel('cps_arena_leaderboard_channel');
        this.localBroadcast.onmessage = (event) => {
          const { type, payload, records } = event.data || {};
          if (type === 'NEW_SCORE' && payload) {
            saveLeaderboardRecord(payload);
            this.notifyListeners();
          } else if (type === 'STATE_UPDATE' && records && Array.isArray(records)) {
            safeMergeLeaderboardRecords(records);
            this.maxSeenGlobalCount = Math.max(this.maxSeenGlobalCount, records.length);
            this.notifyListeners();
          } else if (type === 'REQUEST_LEADERBOARD_SYNC') {
            const current = getCachedLeaderboard();
            if (current.length > 0 && this.localBroadcast) {
              this.localBroadcast.postMessage({ type: 'STATE_UPDATE', records: current });
            }
          }
        };
      }
    } catch {
      // ignore
    }

    // 2. Primary MQTT Broker (EMQX)
    this.initPrimaryMqtt();

    // 3. Backup MQTT Broker (HiveMQ Cloud Fallback)
    this.initBackupMqtt();

    // 4. Initial Peer Sync Request after 1.5s
    setTimeout(() => {
      this.requestPeerSync();
    }, 1500);

    // 5. Periodic Sync interval (every 20s)
    setInterval(() => {
      this.requestPeerSync();
    }, 20000);
  }

  private initPrimaryMqtt() {
    try {
      const clientId = `cps_p_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      const client = mqtt.connect(PRIMARY_BROKER, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2500,
        keepalive: 30,
      });
      this.primaryClient = client;

      client.on('connect', () => {
        this.isConnected = true;
        client.subscribe([PRIMARY_RETAINED_TOPIC, BACKUP_RETAINED_TOPIC, GOSSIP_TOPIC], { qos: 1 });

        // Flush any pending broadcasts
        this.flushPending();

        // Akıllıca mevcut listeyi retained olarak senkronize et
        this.publishLeaderboardRetained();
      });

      client.on('message', (topic, payloadBuf) => {
        this.handleMqttMessage(topic, payloadBuf);
      });

      client.on('close', () => {
        if (!this.backupClient?.connected) {
          this.isConnected = false;
        }
      });
    } catch (err) {
      console.warn('Primary MQTT init error:', err);
    }
  }

  private initBackupMqtt() {
    try {
      const clientId = `cps_b_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      const client = mqtt.connect(BACKUP_BROKER, {
        clientId,
        clean: true,
        connectTimeout: 6000,
        reconnectPeriod: 3000,
        keepalive: 45,
      });
      this.backupClient = client;

      client.on('connect', () => {
        this.isConnected = true;
        client.subscribe([PRIMARY_RETAINED_TOPIC, BACKUP_RETAINED_TOPIC, GOSSIP_TOPIC], { qos: 1 });
        this.publishLeaderboardRetained();
      });

      client.on('message', (topic, payloadBuf) => {
        this.handleMqttMessage(topic, payloadBuf);
      });
    } catch (err) {
      console.warn('Backup MQTT init error:', err);
    }
  }

  private handleMqttMessage(topic: string, payloadBuf: any) {
    try {
      const msgStr = payloadBuf.toString();
      const parsed = JSON.parse(msgStr);
      if (!parsed) return;

      // 1. Retained list or direct state array
      if (topic === PRIMARY_RETAINED_TOPIC || topic === BACKUP_RETAINED_TOPIC) {
        let records: GlobalLeaderboardRecord[] = [];
        if (Array.isArray(parsed)) {
          records = parsed;
        } else if (parsed.records && Array.isArray(parsed.records)) {
          records = parsed.records;
        }

        if (records.length > 0) {
          safeMergeLeaderboardRecords(records);
          this.maxSeenGlobalCount = Math.max(this.maxSeenGlobalCount, records.length);
          this.notifyListeners();
        }
      }

      // 2. Gossip channel messages
      if (topic === GOSSIP_TOPIC) {
        if (parsed.type === 'GLOBAL_SCORE_ANNOUNCE' && parsed.record) {
          safeMergeLeaderboardRecords([parsed.record]);
          this.notifyListeners();
        } else if (parsed.type === 'SYNC_LEADERBOARD_RECORDS' && Array.isArray(parsed.records)) {
          safeMergeLeaderboardRecords(parsed.records);
          this.maxSeenGlobalCount = Math.max(this.maxSeenGlobalCount, parsed.records.length);
          this.notifyListeners();
        } else if (parsed.type === 'REQUEST_LEADERBOARD_SYNC') {
          // Send back our records if not sent in the last 4 seconds
          const now = Date.now();
          if (now - this.lastPeerSyncResponseTime > 4000) {
            this.lastPeerSyncResponseTime = now;
            const current = getCachedLeaderboard();
            if (current.length > 0) {
              const respPayload = JSON.stringify({
                type: 'SYNC_LEADERBOARD_RECORDS',
                records: current,
              });
              if (this.primaryClient?.connected) {
                this.primaryClient.publish(GOSSIP_TOPIC, respPayload, { qos: 0 });
              } else if (this.backupClient?.connected) {
                this.backupClient.publish(GOSSIP_TOPIC, respPayload, { qos: 0 });
              }
            }
          }
        }
      }
    } catch {
      // ignore
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

  private flushPending() {
    while (this.pendingBroadcasts.length > 0) {
      const item = this.pendingBroadcasts.shift();
      if (item) {
        this.broadcastScore(item);
      }
    }
  }

  public requestPeerSync() {
    const syncReq = JSON.stringify({ type: 'REQUEST_LEADERBOARD_SYNC', timestamp: Date.now() });
    try {
      if (this.primaryClient?.connected) {
        this.primaryClient.publish(GOSSIP_TOPIC, syncReq, { qos: 0 });
      }
      if (this.backupClient?.connected) {
        this.backupClient.publish(GOSSIP_TOPIC, syncReq, { qos: 0 });
      }
    } catch {}

    if (this.localBroadcast) {
      try {
        this.localBroadcast.postMessage({ type: 'REQUEST_LEADERBOARD_SYNC' });
      } catch {}
    }
  }

  public publishLeaderboardRetained() {
    const recs = getCachedLeaderboard();
    if (!recs || recs.length === 0) return; // Asla boş liste yayınlanmaz!

    // Koruma kalkanı: Eğer yereldeki sayı bugüne kadar gördüğümüz global sayıdan belirgin küçükse ezme!
    if (recs.length < this.maxSeenGlobalCount) return;

    const payload = JSON.stringify({
      type: 'LEADERBOARD_STATE',
      updatedAt: new Date().toISOString(),
      records: recs.slice(0, 50),
    });

    try {
      if (this.primaryClient?.connected) {
        this.primaryClient.publish(PRIMARY_RETAINED_TOPIC, payload, { retain: true, qos: 1 });
        this.primaryClient.publish(BACKUP_RETAINED_TOPIC, payload, { retain: true, qos: 1 });
      }
    } catch {}

    try {
      if (this.backupClient?.connected) {
        this.backupClient.publish(PRIMARY_RETAINED_TOPIC, payload, { retain: true, qos: 1 });
        this.backupClient.publish(BACKUP_RETAINED_TOPIC, payload, { retain: true, qos: 1 });
      }
    } catch {}
  }

  public broadcastScore(record: GlobalLeaderboardRecord) {
    safeMergeLeaderboardRecords([record]);

    if (!this.isConnected) {
      this.pendingBroadcasts.push(record);
      this.init();
    }

    const updatedTopList = getCachedLeaderboard();
    this.maxSeenGlobalCount = Math.max(this.maxSeenGlobalCount, updatedTopList.length);

    const statePayload = JSON.stringify({
      type: 'LEADERBOARD_STATE',
      updatedAt: new Date().toISOString(),
      records: updatedTopList.slice(0, 50),
    });

    const feedPayload = JSON.stringify({
      type: 'GLOBAL_SCORE_ANNOUNCE',
      record,
    });

    // 1. Publish to Primary MQTT
    try {
      if (this.primaryClient?.connected) {
        this.primaryClient.publish(PRIMARY_RETAINED_TOPIC, statePayload, { retain: true, qos: 1 });
        this.primaryClient.publish(BACKUP_RETAINED_TOPIC, statePayload, { retain: true, qos: 1 });
        this.primaryClient.publish(GOSSIP_TOPIC, feedPayload, { qos: 1 });
      }
    } catch {}

    // 2. Publish to Backup MQTT (HiveMQ)
    try {
      if (this.backupClient?.connected) {
        this.backupClient.publish(PRIMARY_RETAINED_TOPIC, statePayload, { retain: true, qos: 1 });
        this.backupClient.publish(BACKUP_RETAINED_TOPIC, statePayload, { retain: true, qos: 1 });
        this.backupClient.publish(GOSSIP_TOPIC, feedPayload, { qos: 1 });
      }
    } catch {}

    // 3. Local BroadcastChannel
    if (this.localBroadcast) {
      try {
        this.localBroadcast.postMessage({ type: 'STATE_UPDATE', records: updatedTopList });
        this.localBroadcast.postMessage({ type: 'NEW_SCORE', payload: record });
      } catch {}
    }

    this.notifyListeners();
  }
}

export const globalLeaderboardService = new GlobalLeaderboardService();


