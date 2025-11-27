import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateSheet, validateSheet, improveSheet, GenerationContext } from '../services/ai/claude.js';
import { enrichContext } from '../services/ai/perplexity.js';

export const generationRouter = Router();

// Validation schema
const generationInputSchema = z.object({
  competencyId: z.string().uuid(),
  sector: z.string(),
  audienceType: z.string(),
  format: z.enum(['IN_PERSON', 'REMOTE_SYNC', 'REMOTE_ASYNC', 'HYBRID']),
  constraints: z.array(z.string()).default([]),
  priorities: z.array(z.string()).default([]),
  duration: z.number().min(15).max(480).default(75),
  skipEnrichment: z.boolean().default(false),
  skipValidation: z.boolean().default(false)
});

// POST /api/generation/start - Start sheet generation
generationRouter.post('/start', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = generationInputSchema.parse(req.body);

    // Get competency details
    const competency = await prisma.competency.findUnique({
      where: { id: input.competencyId }
    });

    if (!competency) {
      throw new AppError('Competency not found', 404);
    }

    // Create generation session
    const session = await prisma.generationSession.create({
      data: {
        status: 'PENDING',
        inputContext: input
      }
    });

    // Start async generation pipeline
    runGenerationPipeline(session.id, competency, input, req.user!.id);

    res.status(202).json({
      success: true,
      data: {
        sessionId: session.id,
        message: 'Generation started',
        estimatedTime: '45 seconds'
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/generation/:sessionId/status - Check generation status
generationRouter.get('/:sessionId/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.generationSession.findUnique({
      where: { id: req.params.sessionId }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const progress = getProgressInfo(session.status);

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        progress,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        enrichmentData: session.enrichmentData,
        generatedContent: session.status === 'COMPLETED' ? session.finalContent : session.generatedContent
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/generation/:sessionId/create-sheet - Create sheet from completed generation
generationRouter.post('/:sessionId/create-sheet', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title } = z.object({ title: z.string().optional() }).parse(req.body);

    const session = await prisma.generationSession.findUnique({
      where: { id: req.params.sessionId }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.status !== 'COMPLETED') {
      throw new AppError('Generation not yet complete', 400);
    }

    const content = session.finalContent as any;
    const inputContext = session.inputContext as any;

    const sheet = await prisma.sheet.create({
      data: {
        title: title || content.title || 'Nouvelle fiche',
        userId: req.user!.id,
        competencyId: inputContext.competencyId,
        sector: inputContext.sector,
        audienceType: inputContext.audienceType,
        format: inputContext.format,
        constraints: inputContext.constraints || [],
        priorities: inputContext.priorities || [],
        duration: inputContext.duration || 75,
        objectives: content.objectives || [],
        situations: content.situations || [],
        flow: content.flow || [],
        evaluation: content.evaluation || {},
        confidenceScore: content.confidenceScore || 0,
        aiGenerationId: session.id,
        aiModel: 'claude-sonnet-4-5-20250929',
        perplexityCalls: session.perplexityCalls,
        claudeCalls: session.claudeCalls,
        totalCost: session.estimatedCost
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

// POST /api/generation/regenerate-section - Regenerate a specific section
generationRouter.post('/regenerate-section', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      sheetId: z.string().uuid(),
      section: z.enum(['objectives', 'situations', 'flow', 'evaluation']),
      instructions: z.string().optional()
    });

    const { sheetId, section, instructions } = schema.parse(req.body);

    const sheet = await prisma.sheet.findFirst({
      where: {
        id: sheetId,
        userId: req.user!.id
      },
      include: { competency: true }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // TODO: Implement section-specific regeneration
    // For now, return the existing section
    res.json({
      success: true,
      data: {
        section,
        content: (sheet as any)[section],
        message: 'Section regeneration not yet implemented'
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ASYNC PIPELINE RUNNER
// ============================================

async function runGenerationPipeline(
  sessionId: string,
  competency: any,
  input: any,
  userId: string
) {
  try {
    // Step 1: Enrichment
    await updateSession(sessionId, { status: 'ENRICHING' });

    let enrichmentData = null;
    if (!input.skipEnrichment) {
      enrichmentData = await enrichContext({
        competencyCode: competency.code,
        competencyTitle: competency.title,
        sector: input.sector,
        audienceType: input.audienceType
      });

      await updateSession(sessionId, {
        enrichmentData,
        perplexityCalls: 3
      });
    }

    // Step 2: Generation
    await updateSession(sessionId, { status: 'GENERATING' });

    const context: GenerationContext = {
      competencyCode: competency.code,
      competencyTitle: competency.title,
      sector: input.sector,
      audienceType: input.audienceType,
      format: input.format,
      constraints: input.constraints,
      priorities: input.priorities,
      duration: input.duration,
      enrichmentData: enrichmentData || undefined
    };

    const generatedContent = await generateSheet(context);

    await updateSession(sessionId, {
      generatedContent,
      claudeCalls: 1
    });

    // Step 3: Validation
    let validationResult = null;
    if (!input.skipValidation) {
      await updateSession(sessionId, { status: 'VALIDATING' });

      validationResult = await validateSheet(generatedContent, context);

      await updateSession(sessionId, {
        validationResult,
        claudeCalls: 2
      });
    }

    // Step 4: Improvement (if needed)
    let finalContent = generatedContent;
    if (validationResult && !validationResult.isValid) {
      await updateSession(sessionId, { status: 'IMPROVING' });

      finalContent = await improveSheet(generatedContent, validationResult);

      await updateSession(sessionId, {
        claudeCalls: 3
      });
    }

    // Step 5: Complete
    const endTime = new Date();
    const startTime = (await prisma.generationSession.findUnique({
      where: { id: sessionId }
    }))?.startedAt;

    await updateSession(sessionId, {
      status: 'COMPLETED',
      finalContent,
      completedAt: endTime,
      totalDuration: startTime ? endTime.getTime() - startTime.getTime() : 0,
      estimatedCost: calculateCost(3, input.skipEnrichment ? 0 : 3)
    });

  } catch (error) {
    console.error('Generation pipeline error:', error);
    await updateSession(sessionId, {
      status: 'FAILED',
      completedAt: new Date()
    });
  }
}

async function updateSession(sessionId: string, data: any) {
  await prisma.generationSession.update({
    where: { id: sessionId },
    data
  });
}

function getProgressInfo(status: string): {
  step: number;
  totalSteps: number;
  label: string;
  estimatedTimeRemaining: string;
} {
  const steps: Record<string, { step: number; label: string; time: string }> = {
    PENDING: { step: 0, label: 'En attente', time: '~45s' },
    ENRICHING: { step: 1, label: 'Recherche de situations réelles', time: '~35s' },
    GENERATING: { step: 2, label: 'Rédaction de la fiche', time: '~25s' },
    VALIDATING: { step: 3, label: 'Contrôle de cohérence', time: '~15s' },
    IMPROVING: { step: 4, label: 'Améliorations automatiques', time: '~10s' },
    COMPLETED: { step: 5, label: 'Terminé', time: '0s' },
    FAILED: { step: -1, label: 'Échec', time: '-' }
  };

  const info = steps[status] || steps.PENDING;

  return {
    step: info.step,
    totalSteps: 5,
    label: info.label,
    estimatedTimeRemaining: info.time
  };
}

function calculateCost(claudeCalls: number, perplexityCalls: number): number {
  // Estimated costs per call
  const claudeCost = 0.10; // ~$0.10 per call average
  const perplexityCost = 0.02; // ~$0.02 per call

  return claudeCalls * claudeCost + perplexityCalls * perplexityCost;
}
