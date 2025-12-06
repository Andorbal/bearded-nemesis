import type { WebSocket } from 'ws';
import type { WsServerMessage } from '@bearded-nemesis/shared';

interface Connection {
  userId: number;
  socket: WebSocket;
  connectedAt: Date;
}

/**
 * Manages WebSocket connections for playthroughs.
 * Tracks which users are connected to which playthroughs and handles broadcasting.
 */
export class WsConnectionManager {
  // Map: playthroughId -> array of connections
  private connections: Map<number, Connection[]> = new Map();

  /**
   * Add a new WebSocket connection for a user in a playthrough.
   */
  addConnection(playthroughId: number, userId: number, socket: WebSocket): void {
    const connection: Connection = {
      userId,
      socket,
      connectedAt: new Date(),
    };

    const existing = this.connections.get(playthroughId) || [];
    existing.push(connection);
    this.connections.set(playthroughId, existing);

    console.log(`[WS] User ${userId} connected to playthrough ${playthroughId}`);
  }

  /**
   * Remove a connection when user disconnects.
   * Removes only one connection (in case user has multiple devices).
   */
  removeConnection(playthroughId: number, userId: number): void {
    const existing = this.connections.get(playthroughId);
    if (!existing) return;

    // Remove the first matching connection for this user
    const index = existing.findIndex(c => c.userId === userId);
    if (index !== -1) {
      existing.splice(index, 1);
    }

    if (existing.length === 0) {
      this.connections.delete(playthroughId);
    } else {
      this.connections.set(playthroughId, existing);
    }

    console.log(`[WS] User ${userId} disconnected from playthrough ${playthroughId}`);
  }

  /**
   * Broadcast a message to all connected clients in a playthrough.
   * Skips connections that are no longer open.
   */
  broadcast(playthroughId: number, message: WsServerMessage): void {
    const connections = this.connections.get(playthroughId);
    if (!connections || connections.length === 0) return;

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    for (const conn of connections) {
      // WebSocket.OPEN = 1
      if (conn.socket.readyState === 1) {
        try {
          conn.socket.send(messageStr);
          sentCount++;
        } catch (err) {
          console.error(`[WS] Error sending to user ${conn.userId}:`, err);
        }
      }
    }

    console.log(`[WS] Broadcast to playthrough ${playthroughId}: ${message.type} (${sentCount} clients)`);
  }

  /**
   * Send a message to a specific user in a playthrough.
   * Sends to ALL connections for that user (multiple devices).
   */
  sendToUser(playthroughId: number, userId: number, message: WsServerMessage): void {
    const connections = this.connections.get(playthroughId);
    if (!connections) return;

    const messageStr = JSON.stringify(message);
    const userConnections = connections.filter(c => c.userId === userId);

    for (const conn of userConnections) {
      if (conn.socket.readyState === 1) {
        try {
          conn.socket.send(messageStr);
        } catch (err) {
          console.error(`[WS] Error sending to user ${userId}:`, err);
        }
      }
    }
  }

  /**
   * Get the number of active connections for a playthrough.
   */
  getConnectionCount(playthroughId: number): number {
    const connections = this.connections.get(playthroughId);
    return connections ? connections.length : 0;
  }

  /**
   * Get list of unique user IDs connected to a playthrough.
   */
  getConnectedUsers(playthroughId: number): number[] {
    const connections = this.connections.get(playthroughId);
    if (!connections) return [];

    const uniqueUserIds = new Set(connections.map(c => c.userId));
    return Array.from(uniqueUserIds);
  }

  /**
   * Clean up all connections for a playthrough.
   * Called when playthrough is finished.
   */
  cleanupPlaythrough(playthroughId: number): void {
    const connections = this.connections.get(playthroughId);
    if (!connections) return;

    // Close all connections gracefully
    for (const conn of connections) {
      if (conn.socket.readyState === 1) {
        conn.socket.close();
      }
    }

    this.connections.delete(playthroughId);
    console.log(`[WS] Cleaned up playthrough ${playthroughId}`);
  }

  /**
   * Get all active playthrough IDs with connections.
   */
  getActivePlaythroughs(): number[] {
    return Array.from(this.connections.keys());
  }
}
