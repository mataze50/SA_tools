import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const competenciesRouter = Router();

// GET /api/competencies - List all competencies
competenciesRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, axis } = req.query;

    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { keywords: { hasSome: [search.toLowerCase()] } }
      ];
    }

    if (axis && typeof axis === 'string') {
      where.axis = axis;
    }

    const competencies = await prisma.competency.findMany({
      where,
      orderBy: { order: 'asc' }
    });

    // Group by axis for easier frontend rendering
    const byAxis = competencies.reduce((acc, comp) => {
      if (!acc[comp.axis]) {
        acc[comp.axis] = {
          axis: comp.axis,
          axisName: comp.axisName,
          competencies: []
        };
      }
      acc[comp.axis].competencies.push(comp);
      return acc;
    }, {} as Record<string, { axis: string; axisName: string; competencies: typeof competencies }>);

    res.json({
      success: true,
      data: {
        all: competencies,
        byAxis: Object.values(byAxis)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/competencies/:id - Get single competency
competenciesRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competency = await prisma.competency.findUnique({
      where: { id: req.params.id }
    });

    if (!competency) {
      return res.status(404).json({
        success: false,
        error: 'Competency not found'
      });
    }

    res.json({
      success: true,
      data: competency
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/competencies/code/:code - Get by code (e.g., C5.4)
competenciesRouter.get('/code/:code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const competency = await prisma.competency.findUnique({
      where: { code: req.params.code }
    });

    if (!competency) {
      return res.status(404).json({
        success: false,
        error: 'Competency not found'
      });
    }

    res.json({
      success: true,
      data: competency
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/competencies/axes - List all axes
competenciesRouter.get('/meta/axes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const axes = await prisma.competency.findMany({
      select: {
        axis: true,
        axisName: true
      },
      distinct: ['axis'],
      orderBy: { axis: 'asc' }
    });

    res.json({
      success: true,
      data: axes
    });
  } catch (error) {
    next(error);
  }
});
