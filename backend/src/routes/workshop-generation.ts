import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  generateWorkshop,
  validateWorkshop,
  improveWorkshop,
  WorkshopGenerationContext,
  GeneratedWorkshop
} from '../services/ai/workshopGenerator.js';
import { z } from 'zod';

export const workshopGenerationRouter = Router();

// Active generation sessions (in-memory for SSE)
const activeSessions = new Map<string, {
  status: string;
  progress: number;
  currentStep: string;
  startTime: number;
  error?: string;
}>();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const startGenerationSchema = z.object({
  subject: z.string().min(5).max(500),
  competencyIds: z.array(z.string().uuid()).min(1).max(5),
  sector: z.string().min(2),
  audienceType: z.string().min(2),
  format: z.enum(['IN_PERSON', 'REMOTE_SYNC', 'REMOTE_ASYNC', 'HYBRID']).default('IN_PERSON'),
  duration: z.number().min(30).max(480).default(120),
  participantMin: z.number().min(1).max(50).default(6),
  participantMax: z.number().min(1).max(100).default(12)
});

// ============================================
// START GENERATION
// ============================================

workshopGenerationRouter.post('/start', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const validated = startGenerationSchema.parse(req.body);

    // Fetch competencies
    const competencies = await prisma.competency.findMany({
      where: { id: { in: validated.competencyIds } }
    });

    if (competencies.length !== validated.competencyIds.length) {
      throw new AppError('One or more competencies not found', 400);
    }

    // Create generation session
    const session = await prisma.workshopGenerationSession.create({
      data: {
        status: 'PENDING',
        subject: validated.subject,
        competencyIds: validated.competencyIds,
        inputContext: {
          ...validated,
          competencies: competencies.map((c, i) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            isPrimary: i === 0
          }))
        },
        userId: req.user!.id
      }
    });

    // Initialize in-memory session tracking
    activeSessions.set(session.id, {
      status: 'PENDING',
      progress: 0,
      currentStep: 'Initialisation...',
      startTime: Date.now()
    });

    // Start async generation pipeline
    runGenerationPipeline(session.id, req.user!.id).catch(err => {
      console.error('Generation pipeline error:', err);
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        status: 'PENDING'
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
// GET STATUS
// ============================================

workshopGenerationRouter.get('/:sessionId/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.workshopGenerationSession.findFirst({
      where: {
        id: req.params.sessionId,
        userId: req.user!.id
      }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const activeSession = activeSessions.get(session.id);

    res.json({
      success: true,
      data: {
        id: session.id,
        status: session.status,
        progress: activeSession?.progress || 0,
        currentStep: activeSession?.currentStep || '',
        subject: session.subject,
        competencyIds: session.competencyIds,
        finalContent: session.finalContent,
        validationResult: session.validationResult,
        estimatedCost: session.estimatedCost,
        claudeCalls: session.claudeCalls,
        error: activeSession?.error,
        startedAt: session.startedAt,
        completedAt: session.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SSE STREAM
// ============================================

workshopGenerationRouter.get('/:sessionId/stream', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.workshopGenerationSession.findFirst({
      where: {
        id: req.params.sessionId,
        userId: req.user!.id
      }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial status
    const activeSession = activeSessions.get(session.id);
    sendEvent({
      type: 'status',
      status: session.status,
      progress: activeSession?.progress || 0,
      currentStep: activeSession?.currentStep || ''
    });

    // Poll for updates
    const interval = setInterval(async () => {
      const updated = activeSessions.get(session.id);
      const dbSession = await prisma.workshopGenerationSession.findUnique({
        where: { id: session.id }
      });

      if (dbSession) {
        sendEvent({
          type: 'status',
          status: dbSession.status,
          progress: updated?.progress || 0,
          currentStep: updated?.currentStep || '',
          error: updated?.error
        });

        if (dbSession.status === 'COMPLETED' || dbSession.status === 'FAILED') {
          sendEvent({
            type: 'complete',
            status: dbSession.status,
            finalContent: dbSession.finalContent,
            validationResult: dbSession.validationResult
          });
          clearInterval(interval);
          res.end();
        }
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(interval);
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE WORKSHOP FROM SESSION
// ============================================

workshopGenerationRouter.post('/:sessionId/create-workshop', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title } = req.body;

    const session = await prisma.workshopGenerationSession.findFirst({
      where: {
        id: req.params.sessionId,
        userId: req.user!.id,
        status: 'COMPLETED'
      }
    });

    if (!session) {
      throw new AppError('Completed session not found', 404);
    }

    const finalContent = session.finalContent as any;
    const inputContext = session.inputContext as any;

    // Create workshop
    const workshop = await prisma.workshop.create({
      data: {
        title: title || finalContent.title,
        description: finalContent.description,
        sector: inputContext.sector,
        audienceType: inputContext.audienceType,
        format: inputContext.format,
        duration: inputContext.duration,
        participantMin: inputContext.participantMin,
        participantMax: inputContext.participantMax,
        confidenceScore: finalContent.confidenceScore || 0,
        introduction: finalContent.introduction,
        timeline: finalContent.timeline,
        activities: finalContent.activities,
        materials: finalContent.materials,
        trainerNotes: finalContent.trainerNotes,
        evaluation: finalContent.evaluation,
        synthesis: finalContent.synthesis,
        aiGenerationId: session.id,
        aiModel: 'claude-sonnet-4-5-20250929',
        claudeCalls: session.claudeCalls,
        perplexityCalls: session.perplexityCalls,
        totalCost: session.estimatedCost,
        userId: req.user!.id,
        competencies: {
          create: inputContext.competencies.map((c: any, i: number) => ({
            competencyId: c.id,
            isPrimary: i === 0,
            coverageLevel: finalContent.competencyCoverage?.find((cc: any) => cc.competencyCode === c.code)?.coverageLevel || 50
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
      data: workshop
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GENERATION PIPELINE
// ============================================

async function runGenerationPipeline(sessionId: string, userId: string) {
  const updateProgress = (status: string, progress: number, currentStep: string) => {
    activeSessions.set(sessionId, {
      status,
      progress,
      currentStep,
      startTime: activeSessions.get(sessionId)?.startTime || Date.now()
    });
  };

  const startTime = Date.now();
  let claudeCalls = 0;
  let perplexityCalls = 0;

  try {
    // Fetch session
    const session = await prisma.workshopGenerationSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const inputContext = session.inputContext as any;

    // =====================
    // STEP 1: ANALYZING
    // =====================
    updateProgress('ANALYZING', 10, 'Analyse du sujet et des competences...');
    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: { status: 'ANALYZING' }
    });

    // Build generation context
    const generationContext: WorkshopGenerationContext = {
      subject: session.subject,
      competencies: inputContext.competencies,
      sector: inputContext.sector,
      audienceType: inputContext.audienceType,
      format: inputContext.format,
      duration: inputContext.duration,
      participantMin: inputContext.participantMin,
      participantMax: inputContext.participantMax
    };

    // =====================
    // STEP 2: STRUCTURING
    // =====================
    updateProgress('STRUCTURING', 20, 'Structuration de l\'atelier...');
    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: { status: 'STRUCTURING' }
    });

    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 1000));

    // =====================
    // STEP 3: GENERATING
    // =====================
    updateProgress('GENERATING_INTRO', 30, 'Generation de l\'introduction...');
    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: { status: 'GENERATING_INTRO' }
    });

    // Generate workshop (this is the main AI call)
    updateProgress('GENERATING_ACTIVITIES', 50, 'Generation des activites pedagogiques...');
    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: { status: 'GENERATING_ACTIVITIES' }
    });

    const generatedWorkshop = await generateWorkshop(generationContext);
    claudeCalls += 1;

    updateProgress('GENERATING_EVALUATION', 70, 'Generation de l\'evaluation...');
    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: {
        status: 'GENERATING_EVALUATION',
        activitiesData: generatedWorkshop as any
      }
    });

    // =====================
    // STEP 4: VALIDATING
    // =====================
    updateProgress('VALIDATING', 80, 'Validation pedagogique...');
    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: { status: 'VALIDATING' }
    });

    const validationResult = await validateWorkshop(generatedWorkshop, generationContext);

    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: { validationResult: validationResult as any }
    });

    // =====================
    // STEP 5: IMPROVING (if needed)
    // =====================
    let finalWorkshop = generatedWorkshop;

    if (!validationResult.isValid || validationResult.overallScore < 80) {
      updateProgress('IMPROVING', 90, 'Amelioration de l\'atelier...');
      await prisma.workshopGenerationSession.update({
        where: { id: sessionId },
        data: { status: 'IMPROVING' }
      });

      finalWorkshop = await improveWorkshop(generatedWorkshop, validationResult, generationContext);
      claudeCalls += 1;
    }

    // =====================
    // STEP 6: COMPLETION
    // =====================
    const totalDuration = Date.now() - startTime;
    const estimatedCost = claudeCalls * 0.15 + perplexityCalls * 0.02;

    updateProgress('COMPLETED', 100, 'Atelier genere avec succes !');

    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: {
        status: 'COMPLETED',
        finalContent: finalWorkshop as any,
        totalDuration,
        claudeCalls,
        perplexityCalls,
        estimatedCost,
        completedAt: new Date()
      }
    });

    // Clean up active session after a delay
    setTimeout(() => {
      activeSessions.delete(sessionId);
    }, 60000);

  } catch (error: any) {
    console.error('Generation pipeline error:', error);

    activeSessions.set(sessionId, {
      status: 'FAILED',
      progress: 0,
      currentStep: 'Erreur lors de la generation',
      startTime: startTime,
      error: error.message
    });

    await prisma.workshopGenerationSession.update({
      where: { id: sessionId },
      data: {
        status: 'FAILED',
        totalDuration: Date.now() - startTime,
        claudeCalls,
        perplexityCalls
      }
    });
  }
}

export default workshopGenerationRouter;
