import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateSheet, improveSheet, GeneratedSheet, ValidationResult } from '../services/ai/claude.js';

export const validationRouter = Router();

// GET /api/validation/:sheetId - Get validation issues for a sheet
validationRouter.get('/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // Build the sheet content for validation
    const sheetContent: GeneratedSheet = {
      title: sheet.title,
      objectives: sheet.objectives as any[],
      situations: sheet.situations as any[],
      flow: sheet.flow as any[],
      evaluation: sheet.evaluation as any,
      confidenceScore: sheet.confidenceScore
    };

    // Build context
    const context = {
      competencyCode: sheet.competency.code,
      competencyTitle: sheet.competency.title,
      sector: sheet.sector,
      audienceType: sheet.audienceType,
      format: sheet.format,
      constraints: sheet.constraints,
      priorities: sheet.priorities,
      duration: sheet.duration
    };

    // Run validation
    const validationResult = await validateSheet(sheetContent, context);

    res.json({
      success: true,
      data: {
        sheetId: sheet.id,
        confidenceScore: sheet.confidenceScore,
        validation: validationResult
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/validation/:sheetId/apply - Apply a specific suggestion
validationRouter.post('/:sheetId/apply', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      suggestionId: z.string(),
      action: z.enum(['accept', 'modify', 'ignore']),
      customValue: z.string().optional()
    });

    const { suggestionId, action, customValue } = schema.parse(req.body);

    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // For now, we'll handle this on the frontend side
    // In a more sophisticated implementation, we'd track which suggestions were applied

    res.json({
      success: true,
      data: {
        suggestionId,
        action,
        applied: action === 'accept' || action === 'modify'
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/validation/:sheetId/apply-all - Apply all auto-applicable suggestions
validationRouter.post('/:sheetId/apply-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // Build the sheet content
    const sheetContent: GeneratedSheet = {
      title: sheet.title,
      objectives: sheet.objectives as any[],
      situations: sheet.situations as any[],
      flow: sheet.flow as any[],
      evaluation: sheet.evaluation as any,
      confidenceScore: sheet.confidenceScore
    };

    // Build context
    const context = {
      competencyCode: sheet.competency.code,
      competencyTitle: sheet.competency.title,
      sector: sheet.sector,
      audienceType: sheet.audienceType,
      format: sheet.format,
      constraints: sheet.constraints,
      priorities: sheet.priorities,
      duration: sheet.duration
    };

    // Run validation
    const validationResult = await validateSheet(sheetContent, context);

    // If there are issues, run improvement
    if (!validationResult.isValid && validationResult.suggestions.length > 0) {
      const improvedContent = await improveSheet(sheetContent, validationResult);

      // Update the sheet with improved content
      const updated = await prisma.sheet.update({
        where: { id: sheet.id },
        data: {
          objectives: improvedContent.objectives,
          situations: improvedContent.situations,
          flow: improvedContent.flow,
          evaluation: improvedContent.evaluation,
          confidenceScore: improvedContent.confidenceScore,
          version: { increment: 1 }
        }
      });

      res.json({
        success: true,
        data: {
          applied: true,
          suggestionsApplied: validationResult.suggestions.filter(s => s.autoApply).length,
          newConfidenceScore: improvedContent.confidenceScore,
          sheet: updated
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          applied: false,
          message: 'No suggestions to apply',
          sheet
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/validation/:sheetId/revalidate - Re-run validation after changes
validationRouter.post('/:sheetId/revalidate', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // Build the sheet content for validation
    const sheetContent: GeneratedSheet = {
      title: sheet.title,
      objectives: sheet.objectives as any[],
      situations: sheet.situations as any[],
      flow: sheet.flow as any[],
      evaluation: sheet.evaluation as any,
      confidenceScore: sheet.confidenceScore
    };

    // Build context
    const context = {
      competencyCode: sheet.competency.code,
      competencyTitle: sheet.competency.title,
      sector: sheet.sector,
      audienceType: sheet.audienceType,
      format: sheet.format,
      constraints: sheet.constraints,
      priorities: sheet.priorities,
      duration: sheet.duration
    };

    // Run validation
    const validationResult = await validateSheet(sheetContent, context);

    // Update confidence score
    await prisma.sheet.update({
      where: { id: sheet.id },
      data: { confidenceScore: validationResult.overallScore }
    });

    res.json({
      success: true,
      data: {
        sheetId: sheet.id,
        confidenceScore: validationResult.overallScore,
        validation: validationResult
      }
    });
  } catch (error) {
    next(error);
  }
});
