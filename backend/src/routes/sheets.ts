import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const sheetsRouter = Router();

// Validation schemas
const createSheetSchema = z.object({
  title: z.string().min(1),
  competencyId: z.string().uuid(),
  sector: z.string(),
  audienceType: z.string(),
  format: z.enum(['IN_PERSON', 'REMOTE_SYNC', 'REMOTE_ASYNC', 'HYBRID']),
  constraints: z.array(z.string()).default([]),
  priorities: z.array(z.string()).default([]),
  duration: z.number().min(15).max(480).default(75)
});

const updateSheetSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'ARCHIVED']).optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  objectives: z.any().optional(),
  situations: z.any().optional(),
  flow: z.any().optional(),
  evaluation: z.any().optional(),
  resources: z.any().optional()
});

// GET /api/sheets - List user's sheets
sheetsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, competencyId, limit = '20', offset = '0' } = req.query;

    const where: any = { userId: req.user!.id };

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (competencyId && typeof competencyId === 'string') {
      where.competencyId = competencyId;
    }

    const [sheets, total] = await Promise.all([
      prisma.sheet.findMany({
        where,
        include: {
          competency: {
            select: { code: true, title: true, axis: true }
          },
          _count: {
            select: { feedbacks: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.sheet.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        sheets,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sheets/recent - Get recent sheets (for home screen)
sheetsRouter.get('/recent', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheets = await prisma.sheet.findMany({
      where: { userId: req.user!.id },
      include: {
        competency: {
          select: { code: true, title: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      data: sheets
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sheets/:id - Get single sheet
sheetsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: {
        competency: true,
        validations: {
          include: {
            validator: {
              select: { firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' }
        },
        quiz: true
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    res.json({
      success: true,
      data: sheet
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sheets - Create new sheet
sheetsRouter.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createSheetSchema.parse(req.body);

    // Verify competency exists
    const competency = await prisma.competency.findUnique({
      where: { id: data.competencyId }
    });

    if (!competency) {
      throw new AppError('Competency not found', 404);
    }

    const sheet = await prisma.sheet.create({
      data: {
        ...data,
        userId: req.user!.id,
        objectives: [],
        situations: [],
        flow: [],
        evaluation: {}
      },
      include: {
        competency: true
      }
    });

    res.status(201).json({
      success: true,
      data: sheet
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sheets/:id - Update sheet
sheetsRouter.patch('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateSheetSchema.parse(req.body);

    // Check ownership
    const existing = await prisma.sheet.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!existing) {
      throw new AppError('Sheet not found', 404);
    }

    // Create version snapshot before updating
    if (data.objectives || data.situations || data.flow || data.evaluation) {
      await prisma.sheetVersion.create({
        data: {
          sheetId: existing.id,
          versionNum: existing.version,
          content: {
            objectives: existing.objectives,
            situations: existing.situations,
            flow: existing.flow,
            evaluation: existing.evaluation
          }
        }
      });
    }

    const sheet = await prisma.sheet.update({
      where: { id: req.params.id },
      data: {
        ...data,
        version: { increment: 1 },
        ...(data.status === 'VALIDATED' && { validatedAt: new Date() }),
        ...(data.status === 'ARCHIVED' && { archivedAt: new Date() })
      },
      include: {
        competency: true
      }
    });

    res.json({
      success: true,
      data: sheet
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sheets/:id - Delete sheet
sheetsRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    await prisma.sheet.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Sheet deleted'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sheets/:id/duplicate - Duplicate a sheet
sheetsRouter.post('/:id/duplicate', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const original = await prisma.sheet.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!original) {
      throw new AppError('Sheet not found', 404);
    }

    const duplicate = await prisma.sheet.create({
      data: {
        title: `${original.title} (copie)`,
        userId: req.user!.id,
        competencyId: original.competencyId,
        sector: original.sector,
        audienceType: original.audienceType,
        format: original.format,
        constraints: original.constraints,
        priorities: original.priorities,
        duration: original.duration,
        objectives: original.objectives,
        situations: original.situations,
        flow: original.flow,
        evaluation: original.evaluation,
        resources: original.resources,
        status: 'DRAFT',
        confidenceScore: 0
      },
      include: {
        competency: true
      }
    });

    res.status(201).json({
      success: true,
      data: duplicate
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sheets/:id/submit-validation - Submit for manager validation
sheetsRouter.post('/:id/submit-validation', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    if (sheet.status !== 'DRAFT') {
      throw new AppError('Only draft sheets can be submitted for validation', 400);
    }

    const updated = await prisma.sheet.update({
      where: { id: req.params.id },
      data: { status: 'PENDING_VALIDATION' }
    });

    res.json({
      success: true,
      data: updated,
      message: 'Sheet submitted for validation'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sheets/:id/versions - Get version history
sheetsRouter.get('/:id/versions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const versions = await prisma.sheetVersion.findMany({
      where: { sheetId: req.params.id },
      orderBy: { versionNum: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    next(error);
  }
});
