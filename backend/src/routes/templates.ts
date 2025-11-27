import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const templatesRouter = Router();

// Schema for creating a template
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['DISCOVERY', 'IMPROVEMENT', 'REMEDIATION', 'CUSTOM']),
  isPublic: z.boolean().default(false),
  content: z.object({
    sector: z.string().optional(),
    audienceType: z.string().optional(),
    format: z.string().optional(),
    duration: z.number().optional(),
    constraints: z.array(z.string()).optional(),
    priorities: z.array(z.string()).optional(),
    objectives: z.any().optional(),
    situations: z.any().optional(),
    flow: z.any().optional(),
    evaluation: z.any().optional()
  })
});

// GET /api/templates - List templates
templatesRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, isPublic, limit = '50' } = req.query;

    const where: any = {
      OR: [
        { userId: req.user!.id },
        { isPublic: true }
      ]
    };

    if (type) {
      where.type = type;
    }

    if (isPublic === 'true') {
      where.isPublic = true;
    }

    const templates = await prisma.template.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/templates/my - List user's own templates
templatesRouter.get('/my', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.template.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/templates/:id - Get single template
templatesRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: req.user!.id },
          { isPublic: true }
        ]
      },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/templates - Create template from scratch
templatesRouter.post('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createTemplateSchema.parse(req.body);

    const template = await prisma.template.create({
      data: {
        ...data,
        userId: req.user!.id
      }
    });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/templates/from-sheet/:sheetId - Create template from existing sheet
templatesRouter.post('/from-sheet/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      type: z.enum(['DISCOVERY', 'IMPROVEMENT', 'REMEDIATION', 'CUSTOM']),
      isPublic: z.boolean().default(false),
      includeObjectives: z.boolean().default(true),
      includeSituations: z.boolean().default(true),
      includeFlow: z.boolean().default(true),
      includeEvaluation: z.boolean().default(true)
    });

    const data = schema.parse(req.body);

    // Get the source sheet
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // Build template content based on options
    const content: any = {
      sector: sheet.sector,
      audienceType: sheet.audienceType,
      format: sheet.format,
      duration: sheet.duration,
      constraints: sheet.constraints,
      priorities: sheet.priorities
    };

    if (data.includeObjectives) {
      content.objectives = sheet.objectives;
    }
    if (data.includeSituations) {
      content.situations = sheet.situations;
    }
    if (data.includeFlow) {
      content.flow = sheet.flow;
    }
    if (data.includeEvaluation) {
      content.evaluation = sheet.evaluation;
    }

    const template = await prisma.template.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        isPublic: data.isPublic,
        content,
        userId: req.user!.id
      }
    });

    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/templates/:id/use - Create a sheet from template
templatesRouter.post('/:id/use', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      competencyId: z.string().uuid(),
      title: z.string().min(1),
      sector: z.string().optional(),
      audienceType: z.string().optional(),
      duration: z.number().optional()
    });

    const data = schema.parse(req.body);

    // Get the template
    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: req.user!.id },
          { isPublic: true }
        ]
      }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    const content = template.content as any;

    // Create sheet from template
    const sheet = await prisma.sheet.create({
      data: {
        title: data.title,
        userId: req.user!.id,
        competencyId: data.competencyId,
        sector: data.sector || content.sector || 'Conseil en évolution professionnelle (CEP)',
        audienceType: data.audienceType || content.audienceType || 'Consultants confirmés (2-5 ans)',
        format: content.format || 'IN_PERSON',
        duration: data.duration || content.duration || 75,
        constraints: content.constraints || [],
        priorities: content.priorities || [],
        objectives: content.objectives || [],
        situations: content.situations || [],
        flow: content.flow || [],
        evaluation: content.evaluation || {},
        status: 'DRAFT'
      },
      include: {
        competency: true
      }
    });

    // Increment usage count
    await prisma.template.update({
      where: { id: template.id },
      data: { usageCount: { increment: 1 } }
    });

    res.status(201).json({
      success: true,
      data: sheet
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/templates/:id - Update template
templatesRouter.patch('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    const schema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      type: z.enum(['DISCOVERY', 'IMPROVEMENT', 'REMEDIATION', 'CUSTOM']).optional(),
      isPublic: z.boolean().optional(),
      content: z.any().optional()
    });

    const data = schema.parse(req.body);

    const updated = await prisma.template.update({
      where: { id: req.params.id },
      data
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/templates/:id - Delete template
templatesRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.template.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    await prisma.template.delete({
      where: { id: req.params.id }
    });

    res.json({
      success: true,
      message: 'Template deleted'
    });
  } catch (error) {
    next(error);
  }
});
