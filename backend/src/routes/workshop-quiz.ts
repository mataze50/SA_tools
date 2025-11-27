import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  generateWorkshopQuiz,
  WorkshopGenerationContext,
  GeneratedWorkshop
} from '../services/ai/workshopGenerator.js';

export const workshopQuizRouter = Router();

// ============================================
// POST /api/workshop-quiz/generate/:workshopId
// Generate quiz for a workshop
// ============================================

workshopQuizRouter.post('/generate/:workshopId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: req.params.workshopId,
        userId: req.user!.id
      },
      include: {
        competencies: {
          include: { competency: true }
        }
      }
    });

    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }

    // Check if quiz already exists
    const existingQuiz = await prisma.workshopQuiz.findUnique({
      where: { workshopId: workshop.id }
    });

    if (existingQuiz) {
      return res.json({
        success: true,
        data: existingQuiz,
        message: 'Quiz already exists'
      });
    }

    // Build generation context
    const context: WorkshopGenerationContext = {
      subject: workshop.title,
      competencies: workshop.competencies.map((wc, i) => ({
        id: wc.competency.id,
        code: wc.competency.code,
        title: wc.competency.title,
        isPrimary: wc.isPrimary
      })),
      sector: workshop.sector,
      audienceType: workshop.audienceType,
      format: workshop.format as any,
      duration: workshop.duration,
      participantMin: workshop.participantMin,
      participantMax: workshop.participantMax
    };

    // Build workshop content for quiz generation
    const workshopContent: GeneratedWorkshop = {
      title: workshop.title,
      description: workshop.description || '',
      introduction: workshop.introduction as any || {},
      timeline: (workshop.timeline as any[]) || [],
      activities: (workshop.activities as any[]) || [],
      materials: (workshop.materials as any[]) || [],
      trainerNotes: workshop.trainerNotes as any || {},
      evaluation: workshop.evaluation as any || {},
      synthesis: workshop.synthesis as any || { keyTakeaways: [], resources: [] },
      confidenceScore: workshop.confidenceScore,
      competencyCoverage: []
    };

    // Generate quiz using Claude
    const quizData = await generateWorkshopQuiz(workshopContent, context);

    // Save quiz
    const quiz = await prisma.workshopQuiz.create({
      data: {
        workshopId: workshop.id,
        questions: quizData.questions as any,
        metadata: quizData.metadata as any
      }
    });

    res.status(201).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /api/workshop-quiz/:workshopId
// Get quiz for a workshop
// ============================================

workshopQuizRouter.get('/:workshopId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: req.params.workshopId,
        userId: req.user!.id
      }
    });

    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }

    const quiz = await prisma.workshopQuiz.findUnique({
      where: { workshopId: workshop.id }
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found. Generate one first.'
      });
    }

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PATCH /api/workshop-quiz/:workshopId
// Update quiz questions
// ============================================

workshopQuizRouter.patch('/:workshopId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { questions, metadata } = z.object({
      questions: z.array(z.any()),
      metadata: z.any().optional()
    }).parse(req.body);

    const workshop = await prisma.workshop.findFirst({
      where: {
        id: req.params.workshopId,
        userId: req.user!.id
      }
    });

    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }

    const quiz = await prisma.workshopQuiz.update({
      where: { workshopId: workshop.id },
      data: {
        questions,
        ...(metadata && { metadata })
      }
    });

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE /api/workshop-quiz/:workshopId
// Delete quiz
// ============================================

workshopQuizRouter.delete('/:workshopId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: req.params.workshopId,
        userId: req.user!.id
      }
    });

    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }

    await prisma.workshopQuiz.delete({
      where: { workshopId: workshop.id }
    });

    res.json({
      success: true,
      message: 'Quiz deleted'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /api/workshop-quiz/regenerate/:workshopId
// Regenerate quiz (delete existing and create new)
// ============================================

workshopQuizRouter.post('/regenerate/:workshopId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: req.params.workshopId,
        userId: req.user!.id
      },
      include: {
        competencies: {
          include: { competency: true }
        }
      }
    });

    if (!workshop) {
      throw new AppError('Workshop not found', 404);
    }

    // Delete existing quiz if exists
    await prisma.workshopQuiz.deleteMany({
      where: { workshopId: workshop.id }
    });

    // Build generation context
    const context: WorkshopGenerationContext = {
      subject: workshop.title,
      competencies: workshop.competencies.map((wc) => ({
        id: wc.competency.id,
        code: wc.competency.code,
        title: wc.competency.title,
        isPrimary: wc.isPrimary
      })),
      sector: workshop.sector,
      audienceType: workshop.audienceType,
      format: workshop.format as any,
      duration: workshop.duration,
      participantMin: workshop.participantMin,
      participantMax: workshop.participantMax
    };

    // Build workshop content for quiz generation
    const workshopContent: GeneratedWorkshop = {
      title: workshop.title,
      description: workshop.description || '',
      introduction: workshop.introduction as any || {},
      timeline: (workshop.timeline as any[]) || [],
      activities: (workshop.activities as any[]) || [],
      materials: (workshop.materials as any[]) || [],
      trainerNotes: workshop.trainerNotes as any || {},
      evaluation: workshop.evaluation as any || {},
      synthesis: workshop.synthesis as any || { keyTakeaways: [], resources: [] },
      confidenceScore: workshop.confidenceScore,
      competencyCoverage: []
    };

    // Generate new quiz
    const quizData = await generateWorkshopQuiz(workshopContent, context);

    // Save quiz
    const quiz = await prisma.workshopQuiz.create({
      data: {
        workshopId: workshop.id,
        questions: quizData.questions as any,
        metadata: quizData.metadata as any
      }
    });

    res.status(201).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    next(error);
  }
});

export default workshopQuizRouter;
