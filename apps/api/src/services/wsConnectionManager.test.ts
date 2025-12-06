import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { WsConnectionManager } from './wsConnectionManager.js';
import type { WsServerMessage } from '@bearded-nemesis/shared';

// Mock WebSocket class for testing
class MockWebSocket {
  public readyState = 1; // OPEN
  public sentMessages: string[] = [];

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
  }
}

describe('WsConnectionManager', () => {
  let manager: WsConnectionManager;

  beforeEach(() => {
    manager = new WsConnectionManager();
  });

  it('should add connection to playthrough', () => {
    const ws = new MockWebSocket() as unknown as WebSocket;
    const userId = 1;
    const playthroughId = 100;

    manager.addConnection(playthroughId, userId, ws);

    const count = manager.getConnectionCount(playthroughId);
    expect(count).toBe(1);
  });

  it('should remove connection', () => {
    const ws = new MockWebSocket() as unknown as WebSocket;
    const userId = 1;
    const playthroughId = 100;

    manager.addConnection(playthroughId, userId, ws);
    manager.removeConnection(playthroughId, userId);

    const count = manager.getConnectionCount(playthroughId);
    expect(count).toBe(0);
  });

  it('should broadcast message to all connections in playthrough', () => {
    const ws1 = new MockWebSocket() as unknown as WebSocket;
    const ws2 = new MockWebSocket() as unknown as WebSocket;
    const playthroughId = 100;

    manager.addConnection(playthroughId, 1, ws1);
    manager.addConnection(playthroughId, 2, ws2);

    const message: WsServerMessage = {
      type: 'song_advanced',
      position: 1,
      song: { id: 42 } as any,
    };

    manager.broadcast(playthroughId, message);

    const mock1 = ws1 as unknown as MockWebSocket;
    const mock2 = ws2 as unknown as MockWebSocket;

    expect(mock1.sentMessages.length).toBe(1);
    expect(mock2.sentMessages.length).toBe(1);
    expect(JSON.parse(mock1.sentMessages[0])).toEqual(message);
    expect(JSON.parse(mock2.sentMessages[0])).toEqual(message);
  });

  it('should send message to specific user', () => {
    const ws1 = new MockWebSocket() as unknown as WebSocket;
    const ws2 = new MockWebSocket() as unknown as WebSocket;
    const playthroughId = 100;

    manager.addConnection(playthroughId, 1, ws1);
    manager.addConnection(playthroughId, 2, ws2);

    const message: WsServerMessage = {
      type: 'state_sync',
      state: { playthroughId: 100 } as any,
    };

    manager.sendToUser(playthroughId, 1, message);

    const mock1 = ws1 as unknown as MockWebSocket;
    const mock2 = ws2 as unknown as MockWebSocket;

    expect(mock1.sentMessages.length).toBe(1);
    expect(mock2.sentMessages.length).toBe(0);
  });

  it('should not send to closed connections', () => {
    const ws = new MockWebSocket() as unknown as WebSocket;
    const playthroughId = 100;

    manager.addConnection(playthroughId, 1, ws);

    // Close the connection
    ws.close();

    const message: WsServerMessage = {
      type: 'song_advanced',
      position: 1,
      song: { id: 42 } as any,
    };

    // Should not throw, should silently skip closed connections
    manager.broadcast(playthroughId, message);

    const mock = ws as unknown as MockWebSocket;
    expect(mock.sentMessages.length).toBe(0);
  });

  it('should get list of connected user IDs for playthrough', () => {
    const ws1 = new MockWebSocket() as unknown as WebSocket;
    const ws2 = new MockWebSocket() as unknown as WebSocket;
    const playthroughId = 100;

    manager.addConnection(playthroughId, 1, ws1);
    manager.addConnection(playthroughId, 2, ws2);

    const userIds = manager.getConnectedUsers(playthroughId);
    expect(userIds).toContain(1);
    expect(userIds).toContain(2);
    expect(userIds.length).toBe(2);
  });

  it('should handle multiple connections from same user', () => {
    const ws1 = new MockWebSocket() as unknown as WebSocket;
    const ws2 = new MockWebSocket() as unknown as WebSocket;
    const playthroughId = 100;
    const userId = 1;

    manager.addConnection(playthroughId, userId, ws1);
    manager.addConnection(playthroughId, userId, ws2);

    const count = manager.getConnectionCount(playthroughId);
    expect(count).toBe(2); // Same user, two devices

    const message: WsServerMessage = {
      type: 'song_advanced',
      position: 1,
      song: { id: 42 } as any,
    };

    manager.broadcast(playthroughId, message);

    const mock1 = ws1 as unknown as MockWebSocket;
    const mock2 = ws2 as unknown as MockWebSocket;

    // Both connections should receive the message
    expect(mock1.sentMessages.length).toBe(1);
    expect(mock2.sentMessages.length).toBe(1);
  });

  it('should clean up all connections for a playthrough', () => {
    const ws1 = new MockWebSocket() as unknown as WebSocket;
    const ws2 = new MockWebSocket() as unknown as WebSocket;
    const playthroughId = 100;

    manager.addConnection(playthroughId, 1, ws1);
    manager.addConnection(playthroughId, 2, ws2);

    manager.cleanupPlaythrough(playthroughId);

    const count = manager.getConnectionCount(playthroughId);
    expect(count).toBe(0);
  });
});
