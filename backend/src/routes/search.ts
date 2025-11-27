/**
 * Advanced Search API Routes
 * Sprint 10 - ATELIER FORGE
 */

import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

export const searchRouter = Router();

interface SearchFilters {
  query?: string;
  status?: string;
  format?: string;
  sector?: string;
  competencyCode?: string;
  competencyAxis?: string;
  minConfidence?: number;
  maxConfidence?: number;
  dateFrom?: string;
  dateTo?: string;
  hasQuiz?: boolean;
  sortBy?: 'relevance' | 'date' | 'title' | 'confidence';
  sortOrder?: 'asc' | 'desc';
}

// GET /api/search - Advanced search across sheets
searchRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      q: query,
      status,
      format,
      sector,
      competencyCode,
      competencyAxis,
      minConfidence,
      maxConfidence,
      dateFrom,
      dateTo,
      hasQuiz,
      sortBy = 'date',
      sortOrder = 'desc',
      limit = '20',
      offset = '0'
    } = req.query;

    // Build where clause
    const where: any = {
      userId: req.user!.id
    };

    // Text search (title and content)
    if (query && typeof query === 'string' && query.trim()) {
      const searchTerm = query.trim().toLowerCase();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { sector: { contains: searchTerm, mode: 'insensitive' } },
        { audienceType: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Status filter
    if (status && typeof status === 'string') {
      where.status = status;
    }

    // Format filter
    if (format && typeof format === 'string') {
      where.format = format;
    }

    // Sector filter
    if (sector && typeof sector === 'string') {
      where.sector = { contains: sector, mode: 'insensitive' };
    }

    // Competency filters
    if (competencyCode && typeof competencyCode === 'string') {
      where.competency = {
        code: { contains: competencyCode, mode: 'insensitive' }
      };
    }

    if (competencyAxis && typeof competencyAxis === 'string') {
      where.competency = {
        ...where.competency,
        axis: competencyAxis
      };
    }

    // Confidence score range
    if (minConfidence) {
      where.confidenceScore = {
        ...where.confidenceScore,
        gte: parseInt(minConfidence as string)
      };
    }

    if (maxConfidence) {
      where.confidenceScore = {
        ...where.confidenceScore,
        lte: parseInt(maxConfidence as string)
      };
    }

    // Date range
    if (dateFrom) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(dateFrom as string)
      };
    }

    if (dateTo) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(dateTo as string)
      };
    }

    // Has quiz filter
    if (hasQuiz === 'true') {
      where.quiz = { isNot: null };
    } else if (hasQuiz === 'false') {
      where.quiz = null;
    }

    // Build orderBy
    let orderBy: any = { updatedAt: 'desc' };
    switch (sortBy) {
      case 'date':
        orderBy = { [sortOrder === 'asc' ? 'createdAt' : 'updatedAt']: sortOrder };
        break;
      case 'title':
        orderBy = { title: sortOrder };
        break;
      case 'confidence':
        orderBy = { confidenceScore: sortOrder };
        break;
      case 'relevance':
      default:
        orderBy = { updatedAt: 'desc' };
    }

    // Execute search
    const [sheets, total] = await Promise.all([
      prisma.sheet.findMany({
        where,
        include: {
          competency: {
            select: { code: true, title: true, axis: true, axisName: true }
          },
          user: {
            select: { firstName: true, lastName: true }
          },
          quiz: {
            select: { id: true }
          },
          _count: {
            select: { feedbacks: true, versions: true }
          }
        },
        orderBy,
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.sheet.count({ where })
    ]);

    // Get aggregations for filters
    const aggregations = await getSearchAggregations(req.user!.id);

    res.json({
      success: true,
      data: {
        results: sheets.map(sheet => ({
          ...sheet,
          hasQuiz: !!sheet.quiz,
          feedbackCount: sheet._count.feedbacks,
          versionCount: sheet._count.versions
        })),
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + sheets.length < total
        },
        aggregations
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/search/suggestions - Get search suggestions
searchRouter.get('/suggestions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.json({
        success: true,
        data: { suggestions: [] }
      });
    }

    const searchTerm = query.trim().toLowerCase();

    // Get matching sheets
    const sheets = await prisma.sheet.findMany({
      where: {
        userId: req.user!.id,
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { sector: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        title: true,
        sector: true,
        competency: {
          select: { code: true, title: true }
        }
      },
      take: 5
    });

    // Get matching competencies
    const competencies = await prisma.competency.findMany({
      where: {
        OR: [
          { code: { contains: searchTerm, mode: 'insensitive' } },
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { keywords: { has: searchTerm } }
        ]
      },
      select: {
        code: true,
        title: true,
        axis: true
      },
      take: 5
    });

    res.json({
      success: true,
      data: {
        suggestions: [
          ...sheets.map(s => ({
            type: 'sheet' as const,
            id: s.id,
            title: s.title,
            subtitle: `${s.competency.code} - ${s.sector}`
          })),
          ...competencies.map(c => ({
            type: 'competency' as const,
            id: c.code,
            title: c.code,
            subtitle: c.title
          }))
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/search/recent - Get recent searches (from local storage on client)
searchRouter.get('/recent', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get recently viewed sheets
    const recentSheets = await prisma.sheet.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        competency: {
          select: { code: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      data: {
        recentSheets
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get aggregations for filter UI
async function getSearchAggregations(userId: string) {
  const [
    statusCounts,
    formatCounts,
    axisCounts,
    sectors
  ] = await Promise.all([
    // Status distribution
    prisma.sheet.groupBy({
      by: ['status'],
      where: { userId },
      _count: true
    }),

    // Format distribution
    prisma.sheet.groupBy({
      by: ['format'],
      where: { userId },
      _count: true
    }),

    // Competency axis distribution
    prisma.sheet.findMany({
      where: { userId },
      select: {
        competency: {
          select: { axis: true, axisName: true }
        }
      }
    }),

    // Unique sectors
    prisma.sheet.findMany({
      where: { userId },
      select: { sector: true },
      distinct: ['sector']
    })
  ]);

  // Process axis counts
  const axisMap = new Map<string, { name: string; count: number }>();
  axisCounts.forEach(s => {
    const axis = s.competency.axis;
    const existing = axisMap.get(axis);
    if (existing) {
      existing.count++;
    } else {
      axisMap.set(axis, { name: s.competency.axisName, count: 1 });
    }
  });

  return {
    statuses: statusCounts.map(s => ({ value: s.status, count: s._count })),
    formats: formatCounts.map(f => ({ value: f.format, count: f._count })),
    axes: Array.from(axisMap.entries()).map(([axis, data]) => ({
      value: axis,
      name: data.name,
      count: data.count
    })),
    sectors: sectors.map(s => s.sector)
  };
}
