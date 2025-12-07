import { writable, type Writable } from 'svelte/store';
import type {
  WsServerMessage,
  WsClientMessage,
  PlaythroughState,
} from '@bearded-nemesis/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface PendingRating {
  rating: number;
  timestamp: Date;
}

/**
 * WebSocket service for real-time playthrough synchronization.
 * Handles connection, reconnection, message sending, and state management.
 */
export class WsPlaythroughService {
  private ws: WebSocket | null = null;
  private playthroughId: number;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;
  private wsBaseUrl: string;

  // Stores
  public connectionStatus: Writable<ConnectionStatus> = writable('disconnected');
  public currentState: Writable<PlaythroughState | null> = writable(null);
  public pendingRating: Writable<PendingRating | null> = writable(null);
  public lastError: Writable<string | null> = writable(null);

  constructor(playthroughId: number, token: string, wsBaseUrl?: string) {
    this.playthroughId = playthroughId;
    this.token = token;
    this.wsBaseUrl = wsBaseUrl || this.getDefaultWsUrl();
  }

  private getDefaultWsUrl(): string {
    // Determine WebSocket URL based on current location
    if (typeof window === 'undefined') {
      // SSR fallback
      return 'ws://localhost:3010';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // In dev, use API port directly; in prod, use same port
    const isDev = window.location.port === '5173';
    const port = isDev ? '3010' : window.location.port;
    return `${protocol}//${host}${port ? ':' + port : ''}`;
  }

  /**
   * Connect to WebSocket server.
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    this.connectionStatus.set('connecting');

    const url = `${this.wsBaseUrl}/playthroughs/${this.playthroughId}/live?token=${this.token}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected to playthrough', this.playthroughId);
        this.connectionStatus.set('connected');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.lastError.set(null);

        // If we have a pending rating, send it now
        let currentPending: PendingRating | null = null;
        const unsubscribe = this.pendingRating.subscribe(pending => {
          currentPending = pending;
        });
        unsubscribe();

        if (currentPending) {
          this.submitRating((currentPending as PendingRating).rating);
          this.pendingRating.set(null);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WsServerMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onerror = () => {
        console.error('[WS] Error');
        this.connectionStatus.set('error');
        this.lastError.set('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Connection closed:', event.code, event.reason);
        this.ws = null;

        if (!this.isIntentionallyClosed) {
          this.connectionStatus.set('disconnected');
          this.attemptReconnect();
        }
      };
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this.connectionStatus.set('error');
      this.lastError.set('Failed to create WebSocket connection');
    }
  }

  /**
   * Disconnect from WebSocket server.
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connectionStatus.set('disconnected');
  }

  /**
   * Submit a rating for the current song.
   * Queues locally if disconnected.
   */
  submitRating(rating: number): void {
    const message: WsClientMessage = {
      type: 'submit_rating',
      rating,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('[WS] Sent rating:', rating);
    } else {
      // Queue for later
      this.pendingRating.set({ rating, timestamp: new Date() });
      console.log('[WS] Queued rating (offline):', rating);
    }
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(message: WsServerMessage): void {
    console.log('[WS] Received:', message.type);

    switch (message.type) {
      case 'state_sync':
        this.currentState.set(message.state);
        break;

      case 'song_advanced':
      case 'song_back':
        // Update current position and song
        this.currentState.update(state => {
          if (!state) return state;
          return {
            ...state,
            currentPosition: message.position,
            currentSong: message.song,
            ratingsThisSong: {}, // Clear ratings for new song
          };
        });
        break;

      case 'rating_submitted':
        // Add rating to current state
        this.currentState.update(state => {
          if (!state) return state;
          return {
            ...state,
            ratingsThisSong: {
              ...state.ratingsThisSong,
              [message.user]: message.rating,
            },
          };
        });
        break;

      case 'player_joined':
        this.currentState.update(state => {
          if (!state) return state;
          if (state.players.includes(message.user)) return state;
          return {
            ...state,
            players: [...state.players, message.user],
          };
        });
        break;

      case 'player_left':
        this.currentState.update(state => {
          if (!state) return state;
          return {
            ...state,
            players: state.players.filter(p => p !== message.user),
          };
        });
        break;

      case 'stats_captured':
        // Phase 10: Handle screenshot OCR completion
        console.log('[WS] Stats captured for position:', message.position);
        break;

      case 'playthrough_finished':
        console.log('[WS] Playthrough finished:', message.summary);
        // Could trigger a summary modal or redirect
        break;

      default:
        console.warn('[WS] Unknown message type:', (message as WsServerMessage).type);
    }
  }

  /**
   * Attempt to reconnect with exponential backoff.
   */
  private attemptReconnect(): void {
    if (this.isIntentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      this.lastError.set('Failed to reconnect after multiple attempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Force reconnect (for screen wake scenarios).
   */
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }
}

/**
 * Create a WebSocket service instance.
 * Call this once per playthrough page.
 */
export function createWsPlaythroughService(
  playthroughId: number,
  token: string,
  wsBaseUrl?: string
): WsPlaythroughService {
  return new WsPlaythroughService(playthroughId, token, wsBaseUrl);
}
