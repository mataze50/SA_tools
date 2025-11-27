import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import Anthropic from '@anthropic-ai/sdk';

export const feedbackRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// GET /api/feedback/:sheetId - Get all feedbacks for a sheet
feedbackRouter.get('/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const feedbacks = await prisma.sheetFeedback.findMany({
      where: { sheetId: req.params.sheetId },
      orderBy: { workshopDate: 'desc' }
    });

    res.json({
      success: true,
      data: feedbacks
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/feedback/:sheetId/summary - Get aggregated feedback summary
feedbackRouter.get('/:sheetId/summary', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const feedbacks = await prisma.sheetFeedback.findMany({
      where: { sheetId: req.params.sheetId }
    });

    if (feedbacks.length === 0) {
      return res.json({
        success: true,
        data: {
          count: 0,
          avgRating: null,
          totalParticipants: 0,
          situationStats: {},
          timingStats: { short: 0, perfect: 0, long: 0 }
        }
      });
    }

    // Calculate statistics
    const totalParticipants = feedbacks.reduce((sum, f) => sum + f.participantCount, 0);
    const avgRating = feedbacks.reduce((sum, f) => sum + f.overallRating, 0) / feedbacks.length;

    // Situation stats
    const situationStats: Record<string, { top: number; bof: number; review: number }> = {};
    feedbacks.forEach((f) => {
      const ratings = f.situationRatings as Record<string, string>;
      Object.entries(ratings || {}).forEach(([sitId, rating]) => {
        if (!situationStats[sitId]) {
          situationStats[sitId] = { top: 0, bof: 0, review: 0 };
        }
        if (rating === 'top' || rating === 'bof' || rating === 'review') {
          situationStats[sitId][rating]++;
        }
      });
    });

    // Timing stats
    const timingStats = { short: 0, perfect: 0, long: 0 };
    feedbacks.forEach((f) => {
      const timing = f.timingFeedback as 'short' | 'perfect' | 'long';
      if (timingStats[timing] !== undefined) {
        timingStats[timing]++;
      }
    });

    res.json({
      success: true,
      data: {
        count: feedbacks.length,
        avgRating: Math.round(avgRating * 10) / 10,
        totalParticipants,
        situationStats,
        timingStats,
        recentComments: feedbacks
          .filter(f => f.comments)
          .slice(0, 5)
          .map(f => ({
            comment: f.comments,
            date: f.workshopDate,
            participants: f.participantCount
          }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/feedback/:sheetId/ai-suggestions - Generate AI suggestions based on feedback
feedbackRouter.post('/:sheetId/ai-suggestions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: { competency: true }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const feedbacks = await prisma.sheetFeedback.findMany({
      where: { sheetId: req.params.sheetId }
    });

    if (feedbacks.length < 2) {
      throw new AppError('At least 2 feedbacks required for AI analysis', 400);
    }

    // Prepare feedback data for AI analysis
    const feedbackSummary = {
      totalSessions: feedbacks.length,
      avgRating: feedbacks.reduce((sum, f) => sum + f.overallRating, 0) / feedbacks.length,
      totalParticipants: feedbacks.reduce((sum, f) => sum + f.participantCount, 0),
      situationRatings: {} as Record<string, { top: number; bof: number; review: number }>,
      timingIssues: {
        short: feedbacks.filter(f => f.timingFeedback === 'short').length,
        perfect: feedbacks.filter(f => f.timingFeedback === 'perfect').length,
        long: feedbacks.filter(f => f.timingFeedback === 'long').length
      },
      comments: feedbacks.map(f => f.comments).filter(Boolean)
    };

    // Aggregate situation ratings
    feedbacks.forEach(f => {
      const ratings = f.situationRatings as Record<string, string>;
      Object.entries(ratings || {}).forEach(([sitId, rating]) => {
        if (!feedbackSummary.situationRatings[sitId]) {
          feedbackSummary.situationRatings[sitId] = { top: 0, bof: 0, review: 0 };
        }
        if (rating === 'top' || rating === 'bof' || rating === 'review') {
          feedbackSummary.situationRatings[sitId][rating]++;
        }
      });
    });

    const situations = sheet.situations as any[];

    const prompt = `Tu es un expert en ingénierie pédagogique. Analyse les retours d'ateliers suivants et propose des améliorations concrètes.

## FICHE ANALYSÉE
Titre: ${sheet.title}
Compétence: ${sheet.competency?.code} - ${sheet.competency?.title}
Durée prévue: ${sheet.duration} minutes

## SITUATIONS DE LA FICHE
${situations.map((s, i) => `S${i + 1}: ${s.title} - ${s.description}`).join('\n')}

## SYNTHÈSE DES RETOURS (${feedbackSummary.totalSessions} sessions, ${feedbackSummary.totalParticipants} participants)

Note moyenne: ${feedbackSummary.avgRating.toFixed(1)}/5

### Timing
- Trop court: ${feedbackSummary.timingIssues.short} retours
- Parfait: ${feedbackSummary.timingIssues.perfect} retours
- Trop long: ${feedbackSummary.timingIssues.long} retours

### Performance des situations
${Object.entries(feedbackSummary.situationRatings)
  .map(([id, stats]) => `- ${id}: ${stats.top} top, ${stats.bof} bof, ${stats.review} à revoir`)
  .join('\n')}

### Commentaires des formateurs
${feedbackSummary.comments.map(c => `- "${c}"`).join('\n') || 'Aucun commentaire'}

## TÂCHE
Génère 3-5 suggestions d'amélioration concrètes et actionnables pour cette fiche, basées sur les retours.
Focus sur:
1. Les situations qui ont mal fonctionné (beaucoup de "bof" ou "à revoir")
2. Les problèmes de timing s'il y en a
3. Les points soulevés dans les commentaires

Réponds UNIQUEMENT avec un tableau JSON de suggestions (strings):
["suggestion 1", "suggestion 2", ...]`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse suggestions');
    }

    const suggestions = JSON.parse(jsonMatch[0]) as string[];

    res.json({
      success: true,
      data: {
        suggestions,
        basedOn: {
          feedbackCount: feedbacks.length,
          participantCount: feedbackSummary.totalParticipants
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/feedback/:feedbackId - Delete a specific feedback
feedbackRouter.delete('/:feedbackId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const feedback = await prisma.sheetFeedback.findFirst({
      where: {
        id: req.params.feedbackId,
        userId: req.user!.id
      }
    });

    if (!feedback) {
      throw new AppError('Feedback not found', 404);
    }

    await prisma.sheetFeedback.delete({
      where: { id: req.params.feedbackId }
    });

    res.json({
      success: true,
      message: 'Feedback deleted'
    });
  } catch (error) {
    next(error);
  }
});
