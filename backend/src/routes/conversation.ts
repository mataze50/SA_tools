import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import Anthropic from '@anthropic-ai/sdk';

export const conversationRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Conversation state schema
interface ConversationState {
  step: number;
  answers: Record<string, any>;
  competencyId?: string;
  sector?: string;
  audienceType?: string;
  format?: string;
  duration?: number;
  constraints?: string[];
  priorities?: string[];
  additionalContext?: string;
}

// Questions flow
const conversationQuestions = [
  {
    id: 'competency',
    question: "Bonjour ! Je suis ton assistant pour créer une fiche de conception. Quelle compétence veux-tu travailler ? Tu peux me donner le code (ex: C1.1) ou décrire ce que tu veux enseigner.",
    type: 'competency_search',
    required: true
  },
  {
    id: 'sector',
    question: "Super ! Dans quel secteur d'activité interviendras-tu ? (ex: Tech/IT, Santé, Commerce, Industrie...)",
    type: 'text',
    required: true
  },
  {
    id: 'audience',
    question: "Qui sont tes participants ? Décris-moi leur profil (niveau d'expérience, fonction, attentes particulières...)",
    type: 'text',
    required: true
  },
  {
    id: 'format',
    question: "Comment se déroulera l'atelier ?\n• Présentiel\n• Distanciel synchrone (visio)\n• Distanciel asynchrone\n• Hybride",
    type: 'choice',
    options: ['IN_PERSON', 'REMOTE_SYNC', 'REMOTE_ASYNC', 'HYBRID'],
    required: true
  },
  {
    id: 'duration',
    question: "Combien de temps dure l'atelier ? (en minutes, ex: 60, 90, 120...)",
    type: 'number',
    required: true
  },
  {
    id: 'constraints',
    question: "Y a-t-il des contraintes particulières à prendre en compte ? (ex: matériel limité, participants novices, temps restreint...) Tu peux dire 'non' si pas de contraintes.",
    type: 'text',
    required: false
  },
  {
    id: 'priorities',
    question: "Qu'est-ce qui est le plus important pour toi dans cet atelier ? (ex: beaucoup de pratique, théorie solide, cas concrets, interactions...)",
    type: 'text',
    required: false
  },
  {
    id: 'additional',
    question: "Parfait ! Une dernière chose : y a-t-il quelque chose de spécifique que tu voudrais ajouter ou une situation particulière que tu aimerais traiter ?",
    type: 'text',
    required: false
  }
];

// POST /api/conversation/start - Start a new conversation
conversationRouter.post('/start', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Create new conversation session
    const session = await prisma.generationSession.create({
      data: {
        status: 'PENDING',
        inputContext: {
          mode: 'conversational',
          step: 0,
          answers: {},
          messages: []
        }
      }
    });

    // Return first question
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        currentStep: 0,
        totalSteps: conversationQuestions.length,
        question: conversationQuestions[0],
        canGenerate: false
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversation/:sessionId/answer - Submit an answer
conversationRouter.post('/:sessionId/answer', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { answer } = z.object({ answer: z.string() }).parse(req.body);
    const { sessionId } = req.params;

    const session = await prisma.generationSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const context = session.inputContext as any;
    const currentStep = context.step || 0;
    const currentQuestion = conversationQuestions[currentStep];

    // Process answer based on question type
    let processedAnswer: any = answer;
    let competencyMatch = null;

    if (currentQuestion.id === 'competency') {
      // Try to find competency by code or search
      const competencies = await prisma.competency.findMany({
        where: {
          OR: [
            { code: { contains: answer.toUpperCase() } },
            { title: { contains: answer, mode: 'insensitive' } },
            { description: { contains: answer, mode: 'insensitive' } }
          ]
        },
        take: 5
      });

      if (competencies.length > 0) {
        competencyMatch = competencies[0];
        processedAnswer = {
          competencyId: competencyMatch.id,
          competencyCode: competencyMatch.code,
          competencyTitle: competencyMatch.title,
          searchResults: competencies
        };
      }
    } else if (currentQuestion.id === 'format') {
      // Map format answer
      const formatMap: Record<string, string> = {
        'présentiel': 'IN_PERSON',
        'presentiel': 'IN_PERSON',
        'in_person': 'IN_PERSON',
        'distanciel': 'REMOTE_SYNC',
        'visio': 'REMOTE_SYNC',
        'remote_sync': 'REMOTE_SYNC',
        'asynchrone': 'REMOTE_ASYNC',
        'async': 'REMOTE_ASYNC',
        'remote_async': 'REMOTE_ASYNC',
        'hybride': 'HYBRID',
        'hybrid': 'HYBRID'
      };
      processedAnswer = formatMap[answer.toLowerCase()] || 'IN_PERSON';
    } else if (currentQuestion.id === 'duration') {
      processedAnswer = parseInt(answer) || 75;
    }

    // Update answers
    const updatedAnswers = {
      ...context.answers,
      [currentQuestion.id]: processedAnswer
    };

    // Add to message history
    const messages = context.messages || [];
    messages.push(
      { role: 'assistant', content: currentQuestion.question },
      { role: 'user', content: answer }
    );

    // Get AI follow-up if needed
    let followUp = null;
    if (currentQuestion.id === 'competency' && competencyMatch) {
      followUp = `J'ai trouvé la compétence ${competencyMatch.code} - "${competencyMatch.title}". C'est bien celle-ci ?`;
    }

    // Move to next step
    const nextStep = currentStep + 1;
    const isComplete = nextStep >= conversationQuestions.length;

    // Update session
    await prisma.generationSession.update({
      where: { id: sessionId },
      data: {
        inputContext: {
          mode: 'conversational',
          step: nextStep,
          answers: updatedAnswers,
          messages
        }
      }
    });

    // Return next question or completion status
    res.json({
      success: true,
      data: {
        sessionId,
        currentStep: nextStep,
        totalSteps: conversationQuestions.length,
        processedAnswer,
        followUp,
        question: isComplete ? null : conversationQuestions[nextStep],
        canGenerate: isComplete,
        summary: isComplete ? buildSummary(updatedAnswers) : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversation/:sessionId/generate - Generate sheet from conversation
conversationRouter.post('/:sessionId/generate', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.generationSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const context = session.inputContext as any;
    const answers = context.answers;

    // Build generation input from conversation
    const generationInput = {
      competencyId: answers.competency?.competencyId,
      sector: answers.sector,
      audienceType: answers.audience,
      format: answers.format || 'IN_PERSON',
      duration: answers.duration || 75,
      constraints: answers.constraints ? [answers.constraints] : [],
      priorities: answers.priorities ? [answers.priorities] : [],
      additionalContext: answers.additional
    };

    // Update session with structured input
    await prisma.generationSession.update({
      where: { id: sessionId },
      data: {
        inputContext: {
          ...context,
          generationInput
        },
        status: 'ENRICHING'
      }
    });

    // Return session ID for generation tracking
    res.json({
      success: true,
      data: {
        sessionId,
        generationInput,
        message: 'Generation started from conversation'
      }
    });

    // Start generation pipeline in background (same as regular generation)
    // This would trigger the same pipeline as the regular generation
  } catch (error) {
    next(error);
  }
});

// GET /api/conversation/:sessionId - Get conversation state
conversationRouter.get('/:sessionId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.generationSession.findUnique({
      where: { id: req.params.sessionId }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const context = session.inputContext as any;

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        currentStep: context.step || 0,
        totalSteps: conversationQuestions.length,
        answers: context.answers || {},
        messages: context.messages || [],
        question: context.step < conversationQuestions.length
          ? conversationQuestions[context.step]
          : null,
        canGenerate: context.step >= conversationQuestions.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/conversation/:sessionId/ai-assist - Get AI assistance for current question
conversationRouter.post('/:sessionId/ai-assist', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const { userMessage } = z.object({ userMessage: z.string() }).parse(req.body);

    const session = await prisma.generationSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const context = session.inputContext as any;
    const currentQuestion = conversationQuestions[context.step || 0];

    // Use Claude to help with the current question
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      system: `Tu es un assistant pédagogique qui aide les formateurs à créer des fiches d'atelier.
Tu es en train d'aider l'utilisateur à répondre à cette question: "${currentQuestion.question}"
Sois concis, amical et aide-le à formuler une bonne réponse.`,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    const aiResponse = response.content[0];
    if (aiResponse.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    res.json({
      success: true,
      data: {
        assistance: aiResponse.text
      }
    });
  } catch (error) {
    next(error);
  }
});

function buildSummary(answers: Record<string, any>): string {
  const parts = [];

  if (answers.competency?.competencyTitle) {
    parts.push(`**Compétence:** ${answers.competency.competencyCode} - ${answers.competency.competencyTitle}`);
  }
  if (answers.sector) {
    parts.push(`**Secteur:** ${answers.sector}`);
  }
  if (answers.audience) {
    parts.push(`**Public:** ${answers.audience}`);
  }
  if (answers.format) {
    const formatLabels: Record<string, string> = {
      IN_PERSON: 'Présentiel',
      REMOTE_SYNC: 'Distanciel synchrone',
      REMOTE_ASYNC: 'Distanciel asynchrone',
      HYBRID: 'Hybride'
    };
    parts.push(`**Format:** ${formatLabels[answers.format] || answers.format}`);
  }
  if (answers.duration) {
    parts.push(`**Durée:** ${answers.duration} minutes`);
  }
  if (answers.constraints && answers.constraints !== 'non') {
    parts.push(`**Contraintes:** ${answers.constraints}`);
  }
  if (answers.priorities) {
    parts.push(`**Priorités:** ${answers.priorities}`);
  }

  return parts.join('\n');
}
