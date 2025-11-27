/**
 * WebSocket Service for Real-time Collaboration
 * Sprint 11 - ATELIER FORGE
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

interface CollaboratorInfo {
  odisque: string;
  odiskette: string;
  userId: string;
  firstName: string;
  lastName: string;
  color: string;
  cursor?: { section: string; position: number };
  selection?: { section: string; start: number; end: number };
  lastActivity: Date;
}

interface SheetSession {
  sheetId: string;
  collaborators: Map<string, CollaboratorInfo>;
  lockedSections: Map<string, string>; // sectionId -> odisque
}

interface WSMessage {
  type: string;
  payload: any;
}

// Color palette for collaborators
const COLLABORATOR_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16'  // lime
];

class CollaborationService {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, SheetSession> = new Map();
  private connections: Map<string, { ws: WebSocket; sheetId: string; userId: string }> = new Map();
  private colorIndex: number = 0;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/collab' });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const sheetId = url.searchParams.get('sheetId');

      if (!token || !sheetId) {
        ws.close(4001, 'Missing token or sheetId');
        return;
      }

      // Verify JWT token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        const odisque = this.generateOdisque();

        this.handleConnection(ws, {
          odisque,
          odiskette: odisque.substring(0, 8),
          userId: decoded.userId,
          firstName: decoded.firstName || 'Utilisateur',
          lastName: decoded.lastName || '',
          sheetId
        });
      } catch (error) {
        ws.close(4002, 'Invalid token');
      }
    });

    console.log('🔌 WebSocket collaboration server initialized');
  }

  private generateOdisque(): string {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  private getNextColor(): string {
    const color = COLLABORATOR_COLORS[this.colorIndex % COLLABORATOR_COLORS.length];
    this.colorIndex++;
    return color;
  }

  private handleConnection(ws: WebSocket, info: {
    odisque: string;
    odiskette: string;
    userId: string;
    firstName: string;
    lastName: string;
    sheetId: string;
  }) {
    const { odisque, odiskette, userId, firstName, lastName, sheetId } = info;

    // Create or get session
    if (!this.sessions.has(sheetId)) {
      this.sessions.set(sheetId, {
        sheetId,
        collaborators: new Map(),
        lockedSections: new Map()
      });
    }

    const session = this.sessions.get(sheetId)!;
    const collaborator: CollaboratorInfo = {
      odisque,
      odiskette,
      userId,
      firstName,
      lastName,
      color: this.getNextColor(),
      lastActivity: new Date()
    };

    // Add collaborator to session
    session.collaborators.set(odisque, collaborator);
    this.connections.set(odisque, { ws, sheetId, userId });

    // Send welcome message with session info
    this.send(ws, {
      type: 'connected',
      payload: {
        odisque,
        odiskette,
        color: collaborator.color,
        collaborators: Array.from(session.collaborators.values()).map(c => ({
          odiskette: c.odiskette,
          firstName: c.firstName,
          lastName: c.lastName,
          color: c.color,
          cursor: c.cursor,
          isYou: c.odisque === odisque
        })),
        lockedSections: Object.fromEntries(session.lockedSections)
      }
    });

    // Broadcast new collaborator to others
    this.broadcastToSession(sheetId, {
      type: 'collaborator_joined',
      payload: {
        odiskette,
        firstName,
        lastName,
        color: collaborator.color
      }
    }, odisque);

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(odisque, sheetId, message);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      this.handleDisconnect(odisque, sheetId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect(odisque, sheetId);
    });
  }

  private handleMessage(odisque: string, sheetId: string, message: WSMessage) {
    const session = this.sessions.get(sheetId);
    if (!session) return;

    const collaborator = session.collaborators.get(odisque);
    if (!collaborator) return;

    collaborator.lastActivity = new Date();

    switch (message.type) {
      case 'cursor_move':
        collaborator.cursor = message.payload;
        this.broadcastToSession(sheetId, {
          type: 'cursor_update',
          payload: {
            odiskette: collaborator.odiskette,
            cursor: message.payload
          }
        }, odisque);
        break;

      case 'selection_change':
        collaborator.selection = message.payload;
        this.broadcastToSession(sheetId, {
          type: 'selection_update',
          payload: {
            odiskette: collaborator.odiskette,
            selection: message.payload,
            color: collaborator.color
          }
        }, odisque);
        break;

      case 'lock_section':
        const sectionToLock = message.payload.section;
        if (!session.lockedSections.has(sectionToLock)) {
          session.lockedSections.set(sectionToLock, odisque);
          this.broadcastToSession(sheetId, {
            type: 'section_locked',
            payload: {
              section: sectionToLock,
              lockedBy: {
                odiskette: collaborator.odiskette,
                firstName: collaborator.firstName,
                color: collaborator.color
              }
            }
          });
        } else {
          // Section already locked
          this.send(this.connections.get(odisque)?.ws!, {
            type: 'lock_denied',
            payload: {
              section: sectionToLock,
              lockedBy: session.lockedSections.get(sectionToLock)
            }
          });
        }
        break;

      case 'unlock_section':
        const sectionToUnlock = message.payload.section;
        if (session.lockedSections.get(sectionToUnlock) === odisque) {
          session.lockedSections.delete(sectionToUnlock);
          this.broadcastToSession(sheetId, {
            type: 'section_unlocked',
            payload: { section: sectionToUnlock }
          });
        }
        break;

      case 'content_change':
        // Broadcast content change to all collaborators
        this.broadcastToSession(sheetId, {
          type: 'content_changed',
          payload: {
            ...message.payload,
            changedBy: {
              odiskette: collaborator.odiskette,
              firstName: collaborator.firstName
            }
          }
        }, odisque);
        break;

      case 'comment_add':
        this.broadcastToSession(sheetId, {
          type: 'comment_added',
          payload: {
            ...message.payload,
            author: {
              odiskette: collaborator.odiskette,
              firstName: collaborator.firstName,
              lastName: collaborator.lastName,
              color: collaborator.color
            },
            createdAt: new Date().toISOString()
          }
        });
        break;

      case 'comment_resolve':
        this.broadcastToSession(sheetId, {
          type: 'comment_resolved',
          payload: {
            commentId: message.payload.commentId,
            resolvedBy: {
              odiskette: collaborator.odiskette,
              firstName: collaborator.firstName
            }
          }
        });
        break;

      case 'typing_start':
        this.broadcastToSession(sheetId, {
          type: 'user_typing',
          payload: {
            odiskette: collaborator.odiskette,
            firstName: collaborator.firstName,
            section: message.payload.section,
            isTyping: true
          }
        }, odisque);
        break;

      case 'typing_stop':
        this.broadcastToSession(sheetId, {
          type: 'user_typing',
          payload: {
            odiskette: collaborator.odiskette,
            firstName: collaborator.firstName,
            section: message.payload.section,
            isTyping: false
          }
        }, odisque);
        break;

      case 'ping':
        this.send(this.connections.get(odisque)?.ws!, { type: 'pong', payload: {} });
        break;
    }
  }

  private handleDisconnect(odisque: string, sheetId: string) {
    const session = this.sessions.get(sheetId);
    if (!session) return;

    const collaborator = session.collaborators.get(odisque);
    if (collaborator) {
      // Unlock any sections locked by this collaborator
      for (const [section, lockedBy] of session.lockedSections.entries()) {
        if (lockedBy === odisque) {
          session.lockedSections.delete(section);
          this.broadcastToSession(sheetId, {
            type: 'section_unlocked',
            payload: { section }
          });
        }
      }

      // Remove collaborator and broadcast
      session.collaborators.delete(odisque);
      this.broadcastToSession(sheetId, {
        type: 'collaborator_left',
        payload: { odiskette: collaborator.odiskette }
      });
    }

    this.connections.delete(odisque);

    // Clean up empty sessions
    if (session.collaborators.size === 0) {
      this.sessions.delete(sheetId);
    }
  }

  private send(ws: WebSocket, message: WSMessage) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToSession(sheetId: string, message: WSMessage, excludeOdisque?: string) {
    const session = this.sessions.get(sheetId);
    if (!session) return;

    for (const [odisque, collaborator] of session.collaborators) {
      if (odisque !== excludeOdisque) {
        const connection = this.connections.get(odisque);
        if (connection?.ws) {
          this.send(connection.ws, message);
        }
      }
    }
  }

  // Public API for REST endpoints
  getSessionInfo(sheetId: string) {
    const session = this.sessions.get(sheetId);
    if (!session) return null;

    return {
      collaboratorCount: session.collaborators.size,
      collaborators: Array.from(session.collaborators.values()).map(c => ({
        odiskette: c.odiskette,
        firstName: c.firstName,
        lastName: c.lastName,
        color: c.color,
        lastActivity: c.lastActivity
      })),
      lockedSections: Object.fromEntries(session.lockedSections)
    };
  }

  isUserInSession(sheetId: string, userId: string): boolean {
    const session = this.sessions.get(sheetId);
    if (!session) return false;

    for (const collaborator of session.collaborators.values()) {
      if (collaborator.userId === userId) return true;
    }
    return false;
  }
}

export const collaborationService = new CollaborationService();
