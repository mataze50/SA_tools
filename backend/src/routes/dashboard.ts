import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const dashboardRouter = Router();

// GET /api/dashboard/stats - Get user's dashboard stats
dashboardRouter.get('/stats', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Get date range (current month by default)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalSheets,
      sheetsThisMonth,
      byStatus,
      avgConfidenceScore,
      totalFeedbacks,
      avgFeedbackRating
    ] = await Promise.all([
      // Total sheets
      prisma.sheet.count({
        where: { userId }
      }),

      // Sheets created this month
      prisma.sheet.count({
        where: {
          userId,
          createdAt: { gte: startOfMonth }
        }
      }),

      // Sheets by status
      prisma.sheet.groupBy({
        by: ['status'],
        where: { userId },
        _count: true
      }),

      // Average confidence score
      prisma.sheet.aggregate({
        where: { userId },
        _avg: { confidenceScore: true }
      }),

      // Total feedbacks
      prisma.sheetFeedback.count({
        where: {
          sheet: { userId }
        }
      }),

      // Average feedback rating
      prisma.sheetFeedback.aggregate({
        where: {
          sheet: { userId }
        },
        _avg: { overallRating: true }
      })
    ]);

    // Calculate time saved (assuming 4h per sheet before, 45min after = 3h15 saved)
    const timeSavedMinutes = sheetsThisMonth * 195; // 3h15 = 195 minutes

    // Calculate total AI cost
    const totalCost = await prisma.sheet.aggregate({
      where: { userId },
      _sum: { totalCost: true }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalSheets,
          sheetsThisMonth,
          timeSavedMinutes,
          timeSavedFormatted: formatDuration(timeSavedMinutes),
          avgConfidenceScore: Math.round(avgConfidenceScore._avg.confidenceScore || 0),
          totalFeedbacks,
          avgFeedbackRating: avgFeedbackRating._avg.overallRating?.toFixed(1) || null
        },
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        costs: {
          totalCost: totalCost._sum.totalCost?.toFixed(2) || '0.00',
          avgCostPerSheet: totalSheets > 0
            ? ((totalCost._sum.totalCost || 0) / totalSheets).toFixed(2)
            : '0.00'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/activity - Get recent activity
dashboardRouter.get('/activity', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = '10' } = req.query;
    const userId = req.user!.id;

    const recentSheets = await prisma.sheet.findMany({
      where: { userId },
      include: {
        competency: {
          select: { code: true, title: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit as string)
    });

    const recentValidations = await prisma.sheetValidation.findMany({
      where: {
        sheet: { userId }
      },
      include: {
        sheet: {
          select: { title: true }
        },
        validator: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      data: {
        recentSheets,
        recentValidations
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/competency-distribution - Sheets by competency
dashboardRouter.get('/competency-distribution', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const distribution = await prisma.sheet.groupBy({
      by: ['competencyId'],
      where: { userId },
      _count: true
    });

    // Get competency details
    const competencyIds = distribution.map(d => d.competencyId);
    const competencies = await prisma.competency.findMany({
      where: { id: { in: competencyIds } }
    });

    const result = distribution.map(d => {
      const comp = competencies.find(c => c.id === d.competencyId);
      return {
        competencyId: d.competencyId,
        code: comp?.code || 'Unknown',
        title: comp?.title || 'Unknown',
        axis: comp?.axis || '',
        count: d._count
      };
    });

    res.json({
      success: true,
      data: result.sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dashboard/feedback - Submit post-workshop feedback
dashboardRouter.post('/feedback', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      sheetId: z.string().uuid(),
      workshopDate: z.string().transform(s => new Date(s)),
      participantCount: z.number().min(1),
      overallRating: z.number().min(1).max(5),
      situationRatings: z.record(z.enum(['top', 'bof', 'review'])),
      timingFeedback: z.enum(['short', 'perfect', 'long']),
      timingNote: z.string().optional(),
      comments: z.string().optional()
    });

    const data = schema.parse(req.body);

    // Verify sheet ownership
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: data.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const feedback = await prisma.sheetFeedback.create({
      data: {
        sheetId: data.sheetId,
        userId: req.user!.id,
        workshopDate: data.workshopDate,
        participantCount: data.participantCount,
        overallRating: data.overallRating,
        situationRatings: data.situationRatings,
        timingFeedback: data.timingFeedback,
        timingNote: data.timingNote,
        comments: data.comments
      }
    });

    res.status(201).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/pending-validations - For managers
dashboardRouter.get('/pending-validations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'MANAGER' && req.user!.role !== 'ADMIN') {
      throw new AppError('Managers only', 403);
    }

    const pendingSheets = await prisma.sheet.findMany({
      where: {
        status: 'PENDING_VALIDATION'
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        competency: {
          select: { code: true, title: true }
        }
      },
      orderBy: { updatedAt: 'asc' }
    });

    res.json({
      success: true,
      data: pendingSheets
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/dashboard/validate/:sheetId - Manager validates a sheet
dashboardRouter.post('/validate/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'MANAGER' && req.user!.role !== 'ADMIN') {
      throw new AppError('Managers only', 403);
    }

    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_CHANGES']),
      comments: z.string().optional()
    });

    const { status, comments } = schema.parse(req.body);

    const sheet = await prisma.sheet.findUnique({
      where: { id: req.params.sheetId }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    if (sheet.status !== 'PENDING_VALIDATION') {
      throw new AppError('Sheet is not pending validation', 400);
    }

    // Create validation record
    await prisma.sheetValidation.create({
      data: {
        sheetId: sheet.id,
        validatorId: req.user!.id,
        status,
        comments
      }
    });

    // Update sheet status
    const newStatus = status === 'APPROVED' ? 'VALIDATED' : 'DRAFT';
    await prisma.sheet.update({
      where: { id: sheet.id },
      data: {
        status: newStatus,
        ...(status === 'APPROVED' && { validatedAt: new Date() })
      }
    });

    res.json({
      success: true,
      message: `Sheet ${status.toLowerCase()}`
    });
  } catch (error) {
    next(error);
  }
});

// Helper function
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}min`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h${mins}min`;
  }
}
