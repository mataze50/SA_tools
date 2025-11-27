import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  validateSheet,
  improveSheet,
  preValidateSheet,
  validateDuration,
  validateBloomAlignment,
  validateEvaluationCompleteness,
  GeneratedSheet,
  GenerationContext,
  ValidationResult
} from '../services/ai/claude.js';

export const validationRouter = Router();

// Helper to build GeneratedSheet from prisma sheet
function buildSheetContent(sheet: any): GeneratedSheet {
  return {
    title: sheet.title,
    objectives: sheet.objectives as any[],
    situations: sheet.situations as any[],
    flow: sheet.flow as any[],
    evaluation: sheet.evaluation as any,
    confidenceScore: sheet.confidenceScore
  };
}

// Helper to build GenerationContext from prisma sheet
function buildContext(sheet: any): GenerationContext {
  return {
    competencyCode: sheet.competency.code,
    competencyTitle: sheet.competency.title,
    sector: sheet.sector,
    audienceType: sheet.audienceType,
    format: sheet.format,
    constraints: sheet.constraints || [],
    priorities: sheet.priorities || [],
    duration: sheet.duration
  };
}

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

    const sheetContent = buildSheetContent(sheet);
    const context = buildContext(sheet);

    // Run programmatic pre-validation (fast)
    const preValidation = preValidateSheet(sheetContent, context);

    // Get detailed breakdowns
    const durationCheck = validateDuration(sheetContent, context.duration);
    const bloomCheck = validateBloomAlignment(sheetContent);
    const evalCheck = validateEvaluationCompleteness(sheetContent);

    // Build score breakdown
    const scoreBreakdown = {
      timing: durationCheck.isValid ? 25 : 0,
      bloomAlignment: bloomCheck.isValid ? 30 : Math.max(0, 30 - bloomCheck.issues.length * 10),
      smartCriteria: 20, // Would need more analysis
      evaluationCoherence: evalCheck.isValid ? 15 : Math.max(0, 15 - evalCheck.missingCriteria.length * 5),
      situationsQuality: sheetContent.situations.length >= 3 ? 10 : 5
    };

    // If pre-validation passes with high score, skip AI validation
    if (preValidation.isValid && preValidation.score >= 85) {
      res.json({
        success: true,
        data: {
          sheetId: sheet.id,
          confidenceScore: preValidation.score,
          validation: {
            isValid: true,
            overallScore: preValidation.score,
            scoreBreakdown,
            issues: preValidation.issues,
            suggestions: [],
            durationCheck,
            bloomCheck: {
              isValid: bloomCheck.isValid,
              issuesCount: bloomCheck.issues.length
            },
            evalCheck: {
              isValid: evalCheck.isValid,
              missingCount: evalCheck.missingCriteria.length
            }
          }
        }
      });
      return;
    }

    // Run AI validation for deeper analysis
    const validationResult = await validateSheet(sheetContent, context);

    // Merge pre-validation issues with AI validation
    const mergedIssues = [
      ...preValidation.issues,
      ...validationResult.issues.filter(i =>
        !preValidation.issues.some(p => p.category === i.category && p.description === i.description)
      )
    ];

    const finalScore = Math.min(preValidation.score, validationResult.overallScore);

    res.json({
      success: true,
      data: {
        sheetId: sheet.id,
        confidenceScore: finalScore,
        validation: {
          isValid: finalScore >= 70 && mergedIssues.filter(i => i.type === 'error').length === 0,
          overallScore: finalScore,
          scoreBreakdown,
          issues: mergedIssues,
          suggestions: validationResult.suggestions,
          durationCheck,
          bloomCheck: {
            isValid: bloomCheck.isValid,
            issuesCount: bloomCheck.issues.length,
            details: bloomCheck.issues
          },
          evalCheck: {
            isValid: evalCheck.isValid,
            missingCount: evalCheck.missingCriteria.length,
            missing: evalCheck.missingCriteria
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/validation/:sheetId/quick - Quick programmatic validation only (no AI)
validationRouter.get('/:sheetId/quick', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const sheetContent = buildSheetContent(sheet);
    const context = buildContext(sheet);

    // Run programmatic validation only (fast, no AI calls)
    const preValidation = preValidateSheet(sheetContent, context);
    const durationCheck = validateDuration(sheetContent, context.duration);
    const bloomCheck = validateBloomAlignment(sheetContent);
    const evalCheck = validateEvaluationCompleteness(sheetContent);

    res.json({
      success: true,
      data: {
        sheetId: sheet.id,
        score: preValidation.score,
        isValid: preValidation.isValid,
        issues: preValidation.issues,
        checks: {
          duration: {
            valid: durationCheck.isValid,
            expected: context.duration,
            actual: durationCheck.actualTotal,
            difference: durationCheck.difference,
            phases: durationCheck.phaseBreakdown
          },
          bloom: {
            valid: bloomCheck.isValid,
            issues: bloomCheck.issues
          },
          evaluation: {
            valid: evalCheck.isValid,
            missing: evalCheck.missingCriteria,
            extra: evalCheck.extraCriteria
          },
          situations: {
            count: sheetContent.situations.length,
            minimum: 3,
            valid: sheetContent.situations.length >= 3
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/validation/:sheetId/calculate-score - Calculate score based on pending decisions
validationRouter.post('/:sheetId/calculate-score', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      decisions: z.array(z.object({
        suggestionId: z.string(),
        action: z.enum(['accept', 'modify', 'ignore']),
        customValue: z.string().optional()
      }))
    });

    const { decisions } = schema.parse(req.body);

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

    const sheetContent = buildSheetContent(sheet);
    const context = buildContext(sheet);

    // Get current validation
    const currentValidation = preValidateSheet(sheetContent, context);

    // Simulate score improvement based on decisions
    let projectedScore = currentValidation.score;
    let fixedIssues = 0;

    for (const decision of decisions) {
      if (decision.action === 'accept' || decision.action === 'modify') {
        // Find the issue this decision addresses
        const issue = currentValidation.issues.find(i => i.id === decision.suggestionId);
        if (issue) {
          fixedIssues++;
          // Add back the penalty that was subtracted
          if (issue.category === 'Timing') projectedScore += 25;
          else if (issue.category === 'Cohérence Bloom') projectedScore += 10;
          else if (issue.category === 'Évaluation') projectedScore += 5;
          else if (issue.category === 'Situations') projectedScore += 10;
        }
      }
    }

    // Cap at 100
    projectedScore = Math.min(100, projectedScore);

    res.json({
      success: true,
      data: {
        currentScore: currentValidation.score,
        projectedScore,
        improvement: projectedScore - currentValidation.score,
        fixedIssues,
        remainingIssues: currentValidation.issues.length - fixedIssues
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
          objectives: improvedContent.objectives as any,
          situations: improvedContent.situations as any,
          flow: improvedContent.flow as any,
          evaluation: improvedContent.evaluation as any,
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
