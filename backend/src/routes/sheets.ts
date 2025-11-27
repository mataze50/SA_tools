import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { notifyValidationRequested } from '../services/notification.js';

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

    // Get author info for notification
    const author = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { firstName: true, lastName: true }
    });
    const authorName = author ? `${author.firstName} ${author.lastName}` : 'Un consultant';

    const updated = await prisma.sheet.update({
      where: { id: req.params.id },
      data: { status: 'PENDING_VALIDATION' }
    });

    // Notify all managers
    await notifyValidationRequested(sheet.id, sheet.title, authorName);

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
      take: 20
    });

    // Add current version info
    res.json({
      success: true,
      data: {
        currentVersion: sheet.version,
        versions: versions.map(v => ({
          ...v,
          isCurrent: false
        })),
        canRestore: versions.length > 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sheets/:id/versions/:versionNum - Get specific version details
sheetsRouter.get('/:id/versions/:versionNum', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const versionNum = parseInt(req.params.versionNum);

    // If requesting current version, return sheet data
    if (versionNum === sheet.version) {
      return res.json({
        success: true,
        data: {
          versionNum: sheet.version,
          isCurrent: true,
          content: {
            title: sheet.title,
            objectives: sheet.objectives,
            situations: sheet.situations,
            flow: sheet.flow,
            evaluation: sheet.evaluation,
            resources: sheet.resources
          },
          createdAt: sheet.updatedAt
        }
      });
    }

    // Get historical version
    const version = await prisma.sheetVersion.findUnique({
      where: {
        sheetId_versionNum: {
          sheetId: req.params.id,
          versionNum
        }
      }
    });

    if (!version) {
      throw new AppError('Version not found', 404);
    }

    res.json({
      success: true,
      data: {
        ...version,
        isCurrent: false
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sheets/:id/versions/:versionNum/restore - Restore to specific version
sheetsRouter.post('/:id/versions/:versionNum/restore', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const versionNum = parseInt(req.params.versionNum);

    // Get the version to restore
    const versionToRestore = await prisma.sheetVersion.findUnique({
      where: {
        sheetId_versionNum: {
          sheetId: req.params.id,
          versionNum
        }
      }
    });

    if (!versionToRestore) {
      throw new AppError('Version not found', 404);
    }

    const versionContent = versionToRestore.content as any;

    // Save current state as a new version before restoring
    await prisma.sheetVersion.create({
      data: {
        sheetId: sheet.id,
        versionNum: sheet.version,
        content: {
          title: sheet.title,
          objectives: sheet.objectives,
          situations: sheet.situations,
          flow: sheet.flow,
          evaluation: sheet.evaluation,
          resources: sheet.resources
        },
        changeNote: `Auto-save before restoring to v${versionNum}`
      }
    });

    // Restore the sheet to the selected version
    const restored = await prisma.sheet.update({
      where: { id: sheet.id },
      data: {
        objectives: versionContent.objectives || [],
        situations: versionContent.situations || [],
        flow: versionContent.flow || [],
        evaluation: versionContent.evaluation || {},
        resources: versionContent.resources,
        version: { increment: 1 }
      },
      include: {
        competency: true
      }
    });

    res.json({
      success: true,
      data: restored,
      message: `Restored to version ${versionNum}`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sheets/:id/versions/compare - Compare two versions
sheetsRouter.get('/:id/versions/compare', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { v1, v2 } = req.query;

    if (!v1 || !v2) {
      throw new AppError('Both v1 and v2 query parameters are required', 400);
    }

    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const v1Num = parseInt(v1 as string);
    const v2Num = parseInt(v2 as string);

    // Helper to get version content
    const getVersionContent = async (vNum: number) => {
      if (vNum === sheet.version) {
        return {
          versionNum: sheet.version,
          isCurrent: true,
          content: {
            objectives: sheet.objectives,
            situations: sheet.situations,
            flow: sheet.flow,
            evaluation: sheet.evaluation
          },
          createdAt: sheet.updatedAt
        };
      }

      const version = await prisma.sheetVersion.findUnique({
        where: {
          sheetId_versionNum: {
            sheetId: req.params.id,
            versionNum: vNum
          }
        }
      });

      if (!version) {
        throw new AppError(`Version ${vNum} not found`, 404);
      }

      return {
        versionNum: version.versionNum,
        isCurrent: false,
        content: version.content,
        createdAt: version.createdAt
      };
    };

    const [version1, version2] = await Promise.all([
      getVersionContent(v1Num),
      getVersionContent(v2Num)
    ]);

    // Generate diff summary
    const diff = generateDiffSummary(version1.content as any, version2.content as any);

    res.json({
      success: true,
      data: {
        version1,
        version2,
        diff
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to generate diff summary between versions
function generateDiffSummary(v1Content: any, v2Content: any) {
  const changes: Array<{
    section: string;
    type: 'added' | 'removed' | 'modified';
    details: string;
  }> = [];

  // Compare objectives
  const v1Objectives = v1Content?.objectives || [];
  const v2Objectives = v2Content?.objectives || [];
  if (JSON.stringify(v1Objectives) !== JSON.stringify(v2Objectives)) {
    const diff = v2Objectives.length - v1Objectives.length;
    if (diff > 0) {
      changes.push({ section: 'objectives', type: 'added', details: `${diff} objectif(s) ajoute(s)` });
    } else if (diff < 0) {
      changes.push({ section: 'objectives', type: 'removed', details: `${Math.abs(diff)} objectif(s) supprime(s)` });
    } else {
      changes.push({ section: 'objectives', type: 'modified', details: 'Objectifs modifies' });
    }
  }

  // Compare situations
  const v1Situations = v1Content?.situations || [];
  const v2Situations = v2Content?.situations || [];
  if (JSON.stringify(v1Situations) !== JSON.stringify(v2Situations)) {
    const diff = v2Situations.length - v1Situations.length;
    if (diff > 0) {
      changes.push({ section: 'situations', type: 'added', details: `${diff} situation(s) ajoutee(s)` });
    } else if (diff < 0) {
      changes.push({ section: 'situations', type: 'removed', details: `${Math.abs(diff)} situation(s) supprimee(s)` });
    } else {
      changes.push({ section: 'situations', type: 'modified', details: 'Situations modifiees' });
    }
  }

  // Compare flow
  const v1Flow = v1Content?.flow || [];
  const v2Flow = v2Content?.flow || [];
  if (JSON.stringify(v1Flow) !== JSON.stringify(v2Flow)) {
    const diff = v2Flow.length - v1Flow.length;
    if (diff > 0) {
      changes.push({ section: 'flow', type: 'added', details: `${diff} phase(s) ajoutee(s)` });
    } else if (diff < 0) {
      changes.push({ section: 'flow', type: 'removed', details: `${Math.abs(diff)} phase(s) supprimee(s)` });
    } else {
      changes.push({ section: 'flow', type: 'modified', details: 'Deroule modifie' });
    }
  }

  // Compare evaluation
  const v1Eval = v1Content?.evaluation || {};
  const v2Eval = v2Content?.evaluation || {};
  if (JSON.stringify(v1Eval) !== JSON.stringify(v2Eval)) {
    changes.push({ section: 'evaluation', type: 'modified', details: 'Evaluation modifiee' });
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    summary: changes.length > 0
      ? `${changes.length} section(s) modifiee(s)`
      : 'Aucune modification'
  };
}
