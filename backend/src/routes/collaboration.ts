/**
 * Collaboration API Routes
 * Sprint 11 - ATELIER FORGE
 */

import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { collaborationService } from '../services/websocket.js';
import jwt from 'jsonwebtoken';

export const collaborationRouter = Router();

interface Comment {
  id: string;
  sheetId: string;
  section: string;
  content: string;
  position?: { start: number; end: number };
  authorId: string;
  authorName: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  replies: CommentReply[];
  createdAt: Date;
  updatedAt: Date;
}

interface CommentReply {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

// In-memory comments store (in production, use database)
const commentsStore: Map<string, Comment[]> = new Map();

// GET /api/collaboration/token - Get WebSocket connection token
collaborationRouter.get('/token', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId } = req.query;

    if (!sheetId || typeof sheetId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'sheetId is required'
      });
    }

    // Verify user has access to the sheet
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: sheetId,
        OR: [
          { userId: req.user!.id },
          // Add team/sharing logic here if needed
        ]
      }
    });

    if (!sheet) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this sheet'
      });
    }

    // Generate short-lived WebSocket token
    const wsToken = jwt.sign(
      {
        userId: req.user!.id,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        sheetId
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      data: {
        token: wsToken,
        wsUrl: `/ws/collab?token=${wsToken}&sheetId=${sheetId}`
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/collaboration/session/:sheetId - Get current session info
collaborationRouter.get('/session/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId } = req.params;

    const sessionInfo = collaborationService.getSessionInfo(sheetId);

    res.json({
      success: true,
      data: {
        active: !!sessionInfo,
        ...sessionInfo
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/collaboration/comments/:sheetId - Get all comments for a sheet
collaborationRouter.get('/comments/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId } = req.params;
    const { resolved } = req.query;

    let comments = commentsStore.get(sheetId) || [];

    if (resolved === 'false') {
      comments = comments.filter(c => !c.resolved);
    } else if (resolved === 'true') {
      comments = comments.filter(c => c.resolved);
    }

    res.json({
      success: true,
      data: {
        comments: comments.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/collaboration/comments/:sheetId - Add a comment
collaborationRouter.post('/comments/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId } = req.params;
    const { section, content, position } = req.body;

    if (!section || !content) {
      return res.status(400).json({
        success: false,
        message: 'section and content are required'
      });
    }

    const comment: Comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      sheetId,
      section,
      content,
      position,
      authorId: req.user!.id,
      authorName: `${req.user!.firstName} ${req.user!.lastName}`,
      resolved: false,
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!commentsStore.has(sheetId)) {
      commentsStore.set(sheetId, []);
    }
    commentsStore.get(sheetId)!.push(comment);

    res.status(201).json({
      success: true,
      data: { comment }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/collaboration/comments/:sheetId/:commentId/reply - Add a reply to a comment
collaborationRouter.post('/comments/:sheetId/:commentId/reply', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId, commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'content is required'
      });
    }

    const comments = commentsStore.get(sheetId);
    const comment = comments?.find(c => c.id === commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const reply: CommentReply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      content,
      authorId: req.user!.id,
      authorName: `${req.user!.firstName} ${req.user!.lastName}`,
      createdAt: new Date()
    };

    comment.replies.push(reply);
    comment.updatedAt = new Date();

    res.status(201).json({
      success: true,
      data: { reply }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/collaboration/comments/:sheetId/:commentId/resolve - Resolve a comment
collaborationRouter.post('/comments/:sheetId/:commentId/resolve', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId, commentId } = req.params;

    const comments = commentsStore.get(sheetId);
    const comment = comments?.find(c => c.id === commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    comment.resolved = true;
    comment.resolvedBy = `${req.user!.firstName} ${req.user!.lastName}`;
    comment.resolvedAt = new Date();
    comment.updatedAt = new Date();

    res.json({
      success: true,
      data: { comment }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/collaboration/comments/:sheetId/:commentId - Delete a comment
collaborationRouter.delete('/comments/:sheetId/:commentId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId, commentId } = req.params;

    const comments = commentsStore.get(sheetId);
    if (!comments) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const comment = comments[commentIndex];

    // Only author or admin can delete
    if (comment.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }

    comments.splice(commentIndex, 1);

    res.json({
      success: true,
      message: 'Comment deleted'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/collaboration/activity/:sheetId - Get recent collaboration activity
collaborationRouter.get('/activity/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sheetId } = req.params;
    const { limit = '20' } = req.query;

    // Get recent versions/changes
    const versions = await prisma.sheetVersion.findMany({
      where: { sheetId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        versionNum: true,
        changeNote: true,
        createdAt: true
      }
    });

    // Get comments
    const comments = (commentsStore.get(sheetId) || [])
      .slice(0, parseInt(limit as string))
      .map(c => ({
        type: 'comment',
        id: c.id,
        content: c.content.substring(0, 100),
        author: c.authorName,
        createdAt: c.createdAt
      }));

    // Combine and sort activity
    const activity = [
      ...versions.map(v => ({
        type: 'version',
        id: v.id,
        content: v.changeNote || `Version ${v.versionNum}`,
        createdAt: v.createdAt
      })),
      ...comments
    ].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, parseInt(limit as string));

    res.json({
      success: true,
      data: { activity }
    });
  } catch (error) {
    next(error);
  }
});
