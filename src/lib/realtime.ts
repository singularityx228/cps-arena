import mqtt, { type MqttClient } from 'mqtt';
import type { UserProfile, PlayerState } from '../types';

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
  type: 'HOST_WAITING' | 'GUEST_JOIN' | 'MATCH_START' | 'PLAYER_CLICK' | 'PLAYER_START_CLICK' | 'PLAYER_FINISH' | 'REMATCH';
  senderId: string;
  senderName: string;
  roomId: string;
  payload: any;
}

// Global public MQTT WebSocket brokers with SSL
const BROKER_SERVERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
];

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
    this.topic = `cps_arena_v2/rooms/${this.roomId}`;
  }

  public init() {
    this.callbacks.onStatusChange(this.isHost ? 'Oda açılıyor...' : 'Odaya bağlanılıyor...');

    // 1. Cross-tab Local Broadcast for instant test
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcast = new BroadcastChannel(`cps_v2_${this.roomId}`);
        this.localBroadcast.onmessage = (event) => {
          this.handleIncoming(event.data);
        };
      }
    } catch {
      // ignore
    }

    // 2. Connect to Global Ultra-Low-Latency MQTT WebSocket Broker
    const clientId = `cps_${this.isHost ? 'host' : 'guest'}_${this.currentUser.id.substring(0, 8)}_${Math.floor(Math.random() * 1000)}`;

    try {
      this.client = mqtt.connect(BROKER_SERVERS[0], {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2000,
        keepalive: 15,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.callbacks.onStatusChange(this.isHost ? 'Oda hazır! Rakip bekleniyor...' : 'Odaya bağlanıldı, rakip aranıyor...');

        // Subscribe to room topic
        this.client?.subscribe(this.topic, { qos: 0 }, (err) => {
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
              }, 1200);
            } else {
              // Guest sends join request periodically until matched
              this.sendJoinRequest();
              this.joinRetryInterval = window.setInterval(() => {
                if (!this.hasMatched) {
                  this.sendJoinRequest();
                }
              }, 1000);
            }
          }
        });
      });

      this.client.on('message', (_top, payloadBuffer) => {
        try {
          const msgStr = payloadBuffer.toString();
          const parsed = JSON.parse(msgStr);
          this.handleIncoming(parsed);
        } catch {
          // parse error
        }
      });

      this.client.on('error', (err) => {
        console.warn('MQTT error, trying fallback:', err);
      });
    } catch (e: any) {
      console.warn('Failed to connect to primary broker:', e);
    }
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
      // HOST receives GUEST_JOIN -> Host accepts and initiates match with Host's duration
      case 'GUEST_JOIN': {
        if (this.isHost && !this.hasMatched) {
          this.hasMatched = true;
          if (this.announceInterval) clearInterval(this.announceInterval);

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

          // Broadcast MATCH_START with exact Host duration to Guest
          this.send({
            type: 'MATCH_START',
            senderId: this.currentUser.id,
            senderName: this.currentUser.username,
            roomId: this.roomId,
            payload: {
              host: this.currentUser,
              guest: guestUser,
              matchDuration: this.matchDuration,
            },
          });
        }
        break;
      }

      // GUEST receives MATCH_START -> Guest syncs duration and starts
      case 'MATCH_START': {
        if (!this.isHost && !this.hasMatched) {
          this.hasMatched = true;
          if (this.joinRetryInterval) clearInterval(this.joinRetryInterval);

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
        }
        break;
      }

      case 'HOST_WAITING': {
        if (!this.isHost && !this.hasMatched) {
          // Host is waiting, send join immediately
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
      this.client.end(true);
      this.client = null;
    }
    this.isConnected = false;
  }
}
