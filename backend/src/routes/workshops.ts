import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

export const workshopsRouter = Router();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createWorkshopSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  sector: z.string().min(2),
  audienceType: z.string().min(2),
  format: z.enum(['IN_PERSON', 'REMOTE_SYNC', 'REMOTE_ASYNC', 'HYBRID']).default('IN_PERSON'),
  duration: z.number().min(30).max(480).default(120),
  participantMin: z.number().min(1).max(50).default(6),
  participantMax: z.number().min(1).max(100).default(12),
  competencyIds: z.array(z.string().uuid()).min(1).max(5)
});

const updateWorkshopSchema = createWorkshopSchema.partial();

// ============================================
// LIST WORKSHOPS
// ============================================

workshopsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { status, limit = '20', offset = '0' } = req.query;

    const where: any = { userId };
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const [workshops, total] = await Promise.all([
      prisma.workshop.findMany({
        where,
        include: {
          competencies: {
            include: {
              competency: {
                select: { id: true, code: true, title: true, axis: true, axisName: true }
              }
            }
          },
          _count: {
            select: { sheets: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.workshop.count({ where })
    ]);

    res.json({
      success: true,
      data: workshops.map(w => ({
        ...w,
        competencies: w.competencies.map(wc => ({
          ...wc.competency,
          isPrimary: wc.isPrimary,
          coverageLevel: wc.coverageLevel
        })),
        sheetsCount: w._count.sheets
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET WORKSHOP BY ID
// ============================================

workshopsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: {
        competencies: {
          include: {
            competency: true
          }
        },
        sheets: {
          select: {
            id: true,
            title: true,
            status: true,
            confidenceScore: true,
            duration: true
          }
        },
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }

    res.json({
      success: true,
      data: {
        ...workshop,
        competencies: workshop.competencies.map(wc => ({
          ...wc.competency,
          isPrimary: wc.isPrimary,
          coverageLevel: wc.coverageLevel
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE WORKSHOP (DRAFT)
// ============================================

workshopsRouter.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validated = createWorkshopSchema.parse(req.body);

    // Verify all competencies exist
    const competencies = await prisma.competency.findMany({
      where: { id: { in: validated.competencyIds } }
    });

    if (competencies.length !== validated.competencyIds.length) {
      throw new AppError('One or more competencies not found', 400);
    }

    // Create workshop with competency links
    const workshop = await prisma.workshop.create({
      data: {
        title: validated.title,
        description: validated.description,
        sector: validated.sector,
        audienceType: validated.audienceType,
        format: validated.format as any,
        duration: validated.duration,
        participantMin: validated.participantMin,
        participantMax: validated.participantMax,
        userId: req.user!.id,
        competencies: {
          create: validated.competencyIds.map((compId, index) => ({
            competencyId: compId,
            isPrimary: index === 0 // First competency is primary
          }))
        }
      },
      include: {
        competencies: {
          include: { competency: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...workshop,
        competencies: workshop.competencies.map(wc => ({
          ...wc.competency,
          isPrimary: wc.isPrimary,
          coverageLevel: wc.coverageLevel
        }))
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    next(error);
  }
});

// ============================================
// UPDATE WORKSHOP
// ============================================

workshopsRouter.patch('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validated = updateWorkshopSchema.parse(req.body);

    // Verify ownership
    const existing = await prisma.workshop.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });

    if (!existing) {
      throw new AppError('Workshop not found', 404);
    }

    const { competencyIds, ...updateData } = validated;

    // Update workshop
    const workshop = await prisma.workshop.update({
      where: { id: req.params.id },
      data: updateData as any
    });

    // Update competencies if provided
    if (competencyIds && competencyIds.length > 0) {
      // Delete existing links
      await prisma.workshopCompetency.deleteMany({
        where: { workshopId: workshop.id }
      });

      // Create new links
      await prisma.workshopCompetency.createMany({
        data: competencyIds.map((compId, index) => ({
          workshopId: workshop.id,
          competencyId: compId,
          isPrimary: index === 0
        }))
      });
    }

    // Fetch updated workshop with relations
    const updated = await prisma.workshop.findUnique({
      where: { id: workshop.id },
      include: {
        competencies: {
          include: { competency: true }
        }
      }
    });

    res.json({
      success: true,
      data: {
        ...updated,
        competencies: updated?.competencies.map(wc => ({
          ...wc.competency,
          isPrimary: wc.isPrimary,
          coverageLevel: wc.coverageLevel
        }))
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    next(error);
  }
});

// ============================================
// UPDATE WORKSHOP CONTENT
// ============================================

workshopsRouter.patch('/:id/content', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { section, content } = req.body;

    const validSections = ['introduction', 'timeline', 'activities', 'materials', 'trainerNotes', 'evaluation', 'synthesis'];
    if (!validSections.includes(section)) {
      throw new AppError(`Invalid section: ${section}`, 400);
    }

    // Verify ownership
    const existing = await prisma.workshop.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });

    if (!existing) {
      throw new AppError('Workshop not found', 404);
    }

    const updated = await prisma.workshop.update({
      where: { id: req.params.id },
      data: {
        [section]: content,
        version: { increment: 1 }
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE WORKSHOP
// ============================================

workshopsRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workshop = await prisma.workshop.findFirst({
      where: { id: req.params.id, userId: req.user!.id }
    });

    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }

    // Delete associated sheets first (optional - could just unlink)
    await prisma.sheet.updateMany({
      where: { workshopId: workshop.id },
      data: { workshopId: null }
    });

    await prisma.workshop.delete({
      where: { id: workshop.id }
    });

    res.json({ success: true, message: 'Workshop deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DUPLICATE WORKSHOP
// ============================================

workshopsRouter.post('/:id/duplicate', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const original = await prisma.workshop.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        competencies: true
      }
    });

    if (!original) {
      throw new AppError('Workshop not found', 404);
    }

    const duplicate = await prisma.workshop.create({
      data: {
        title: `${original.title} (copie)`,
        description: original.description,
        sector: original.sector,
        audienceType: original.audienceType,
        format: original.format,
        duration: original.duration,
        participantMin: original.participantMin,
        participantMax: original.participantMax,
        introduction: original.introduction,
        timeline: original.timeline,
        activities: original.activities,
        materials: original.materials,
        trainerNotes: original.trainerNotes,
        evaluation: original.evaluation,
        synthesis: original.synthesis,
        userId: req.user!.id,
        competencies: {
          create: original.competencies.map(wc => ({
            competencyId: wc.competencyId,
            isPrimary: wc.isPrimary,
            coverageLevel: wc.coverageLevel
          }))
        }
      },
      include: {
        competencies: {
          include: { competency: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...duplicate,
        competencies: duplicate.competencies.map(wc => ({
          ...wc.competency,
          isPrimary: wc.isPrimary,
          coverageLevel: wc.coverageLevel
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET RECENT WORKSHOPS
// ============================================

workshopsRouter.get('/recent', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workshops = await prisma.workshop.findMany({
      where: { userId: req.user!.id },
      include: {
        competencies: {
          include: {
            competency: {
              select: { code: true, title: true }
            }
          },
          where: { isPrimary: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      data: workshops.map(w => ({
        id: w.id,
        title: w.title,
        status: w.status,
        confidenceScore: w.confidenceScore,
        duration: w.duration,
        primaryCompetency: w.competencies[0]?.competency,
        updatedAt: w.updatedAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

export default workshopsRouter;
