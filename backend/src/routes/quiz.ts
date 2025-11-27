import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateQuiz } from '../services/ai/claude.js';

export const quizRouter = Router();

// POST /api/quiz/generate/:sheetId - Generate quiz for a sheet
quizRouter.post('/generate/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // Check if quiz already exists
    const existingQuiz = await prisma.quiz.findUnique({
      where: { sheetId: sheet.id }
    });

    if (existingQuiz) {
      return res.json({
        success: true,
        data: existingQuiz,
        message: 'Quiz already exists'
      });
    }

    // Generate quiz using Claude
    const sheetContent = {
      title: sheet.title,
      objectives: sheet.objectives as any[],
      situations: sheet.situations as any[],
      flow: sheet.flow as any[],
      evaluation: sheet.evaluation,
      confidenceScore: sheet.confidenceScore
    };

    const quizData = await generateQuiz(sheetContent);

    // Save quiz
    const quiz = await prisma.quiz.create({
      data: {
        sheetId: sheet.id,
        questions: quizData.questions
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

// GET /api/quiz/:sheetId - Get quiz for a sheet
quizRouter.get('/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const quiz = await prisma.quiz.findUnique({
      where: { sheetId: sheet.id }
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

// PATCH /api/quiz/:sheetId - Update quiz questions
quizRouter.patch('/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { questions } = z.object({
      questions: z.array(z.any())
    }).parse(req.body);

    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const quiz = await prisma.quiz.update({
      where: { sheetId: sheet.id },
      data: { questions }
    });

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/quiz/:sheetId - Delete quiz
quizRouter.delete('/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    await prisma.quiz.delete({
      where: { sheetId: sheet.id }
    });

    res.json({
      success: true,
      message: 'Quiz deleted'
    });
  } catch (error) {
    next(error);
  }
});
