import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import Anthropic from '@anthropic-ai/sdk';

export const remixRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Schema for remix request
const remixSchema = z.object({
  sourceSheetId: z.string().uuid(),
  changes: z.object({
    sector: z.string().optional(),
    audienceType: z.string().optional(),
    format: z.enum(['IN_PERSON', 'REMOTE_SYNC', 'REMOTE_ASYNC', 'HYBRID']).optional(),
    duration: z.number().min(15).max(480).optional(),
    keepObjectives: z.boolean().default(true),
    keepSituations: z.boolean().default(false),
    keepFlow: z.boolean().default(true),
    additionalInstructions: z.string().optional()
  })
});

// POST /api/remix/preview - Preview what will change
remixRouter.post('/preview', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sourceSheetId, changes } = remixSchema.parse(req.body);

    // Get source sheet
    const sourceSheet = await prisma.sheet.findFirst({
      where: {
        id: sourceSheetId,
        OR: [
          { userId: req.user!.id },
          { status: 'VALIDATED' } // Allow remixing validated public sheets
        ]
      },
      include: { competency: true }
    });

    if (!sourceSheet) {
      throw new AppError('Source sheet not found', 404);
    }

    // Calculate what will change
    const preview = {
      originalContext: {
        sector: sourceSheet.sector,
        audienceType: sourceSheet.audienceType,
        format: sourceSheet.format,
        duration: sourceSheet.duration
      },
      newContext: {
        sector: changes.sector || sourceSheet.sector,
        audienceType: changes.audienceType || sourceSheet.audienceType,
        format: changes.format || sourceSheet.format,
        duration: changes.duration || sourceSheet.duration
      },
      sectionsToAdapt: [] as string[],
      sectionsToKeep: [] as string[],
      estimatedChanges: ''
    };

    // Determine what sections need adaptation
    if (!changes.keepObjectives) {
      preview.sectionsToAdapt.push('objectives');
    } else {
      preview.sectionsToKeep.push('objectives');
    }

    if (!changes.keepSituations || changes.sector !== sourceSheet.sector) {
      preview.sectionsToAdapt.push('situations');
    } else {
      preview.sectionsToKeep.push('situations');
    }

    if (!changes.keepFlow || changes.duration !== sourceSheet.duration || changes.format !== sourceSheet.format) {
      preview.sectionsToAdapt.push('flow');
    } else {
      preview.sectionsToKeep.push('flow');
    }

    // Always adapt evaluation if objectives change
    if (preview.sectionsToAdapt.includes('objectives')) {
      preview.sectionsToAdapt.push('evaluation');
    } else {
      preview.sectionsToKeep.push('evaluation');
    }

    // Generate estimated changes description
    const changesDescription = [];
    if (changes.sector && changes.sector !== sourceSheet.sector) {
      changesDescription.push(`Secteur: ${sourceSheet.sector} → ${changes.sector}`);
    }
    if (changes.audienceType && changes.audienceType !== sourceSheet.audienceType) {
      changesDescription.push(`Public: ${sourceSheet.audienceType} → ${changes.audienceType}`);
    }
    if (changes.format && changes.format !== sourceSheet.format) {
      changesDescription.push(`Format: ${sourceSheet.format} → ${changes.format}`);
    }
    if (changes.duration && changes.duration !== sourceSheet.duration) {
      changesDescription.push(`Durée: ${sourceSheet.duration}min → ${changes.duration}min`);
    }
    preview.estimatedChanges = changesDescription.join('\n');

    res.json({
      success: true,
      data: {
        sourceSheet: {
          id: sourceSheet.id,
          title: sourceSheet.title,
          competency: sourceSheet.competency
        },
        preview
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/remix/create - Create remixed sheet
remixRouter.post('/create', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sourceSheetId, changes } = remixSchema.parse(req.body);

    // Get source sheet
    const sourceSheet = await prisma.sheet.findFirst({
      where: {
        id: sourceSheetId,
        OR: [
          { userId: req.user!.id },
          { status: 'VALIDATED' }
        ]
      },
      include: { competency: true }
    });

    if (!sourceSheet) {
      throw new AppError('Source sheet not found', 404);
    }

    // Create generation session for tracking
    const session = await prisma.generationSession.create({
      data: {
        status: 'PENDING',
        inputContext: {
          mode: 'remix',
          sourceSheetId,
          changes
        }
      }
    });

    // Start remix process in background
    remixSheet(session.id, sourceSheet, changes, req.user!.id);

    res.status(202).json({
      success: true,
      data: {
        sessionId: session.id,
        message: 'Remix started'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Background remix processing
async function remixSheet(
  sessionId: string,
  sourceSheet: any,
  changes: any,
  userId: string
) {
  try {
    await updateSession(sessionId, { status: 'GENERATING' });

    // Build the remix prompt
    const prompt = buildRemixPrompt(sourceSheet, changes);

    // Call Claude to adapt the content
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse the response
    const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Failed to parse remixed content');
    }

    const remixedContent = JSON.parse(jsonMatch[1]);

    // Merge with kept sections
    const finalContent = {
      title: `${sourceSheet.title} (Remix)`,
      objectives: changes.keepObjectives ? sourceSheet.objectives : remixedContent.objectives,
      situations: changes.keepSituations && !changes.sector ? sourceSheet.situations : remixedContent.situations,
      flow: changes.keepFlow && !changes.duration && !changes.format ? sourceSheet.flow : remixedContent.flow,
      evaluation: changes.keepObjectives ? sourceSheet.evaluation : remixedContent.evaluation,
      confidenceScore: remixedContent.confidenceScore || 80
    };

    // Create the new sheet
    const newSheet = await prisma.sheet.create({
      data: {
        title: finalContent.title,
        userId,
        competencyId: sourceSheet.competencyId,
        sector: changes.sector || sourceSheet.sector,
        audienceType: changes.audienceType || sourceSheet.audienceType,
        format: changes.format || sourceSheet.format,
        duration: changes.duration || sourceSheet.duration,
        constraints: sourceSheet.constraints,
        priorities: sourceSheet.priorities,
        objectives: finalContent.objectives,
        situations: finalContent.situations,
        flow: finalContent.flow,
        evaluation: finalContent.evaluation,
        confidenceScore: finalContent.confidenceScore,
        aiGenerationId: sessionId,
        aiModel: 'claude-sonnet-4-5-20250929',
        claudeCalls: 1
      },
      include: { competency: true }
    });

    // Update session with success
    await updateSession(sessionId, {
      status: 'COMPLETED',
      finalContent: {
        ...finalContent,
        sheetId: newSheet.id
      },
      completedAt: new Date()
    });

  } catch (error) {
    console.error('Remix error:', error);
    await updateSession(sessionId, {
      status: 'FAILED',
      completedAt: new Date()
    });
  }
}

function buildRemixPrompt(sourceSheet: any, changes: any): string {
  const newSector = changes.sector || sourceSheet.sector;
  const newAudience = changes.audienceType || sourceSheet.audienceType;
  const newFormat = changes.format || sourceSheet.format;
  const newDuration = changes.duration || sourceSheet.duration;

  return `Tu es un expert en ingénierie pédagogique. Tu dois adapter une fiche d'atelier existante à un nouveau contexte.

## FICHE SOURCE

**Titre**: ${sourceSheet.title}
**Compétence**: ${sourceSheet.competency?.code} - ${sourceSheet.competency?.title}

**Contexte original**:
- Secteur: ${sourceSheet.sector}
- Public: ${sourceSheet.audienceType}
- Format: ${sourceSheet.format}
- Durée: ${sourceSheet.duration} minutes

**Objectifs actuels**:
${JSON.stringify(sourceSheet.objectives, null, 2)}

**Situations actuelles**:
${JSON.stringify(sourceSheet.situations, null, 2)}

**Déroulé actuel**:
${JSON.stringify(sourceSheet.flow, null, 2)}

**Évaluation actuelle**:
${JSON.stringify(sourceSheet.evaluation, null, 2)}

## NOUVEAU CONTEXTE

- Secteur: ${newSector}
- Public: ${newAudience}
- Format: ${newFormat}
- Durée: ${newDuration} minutes

${changes.additionalInstructions ? `
**Instructions supplémentaires**: ${changes.additionalInstructions}
` : ''}

## TÂCHE

Adapte cette fiche au nouveau contexte:
${!changes.keepObjectives ? '- Adapte les objectifs au nouveau public' : ''}
${!changes.keepSituations || changes.sector !== sourceSheet.sector ? '- Crée de nouvelles situations adaptées au secteur ' + newSector : ''}
${!changes.keepFlow || changes.duration !== sourceSheet.duration ? '- Adapte le déroulé à la durée de ' + newDuration + ' minutes' : ''}
${changes.format !== sourceSheet.format ? '- Adapte les activités au format ' + newFormat : ''}

## FORMAT DE SORTIE

Réponds UNIQUEMENT avec un bloc JSON:

\`\`\`json
{
  "objectives": [...],
  "situations": [...],
  "flow": [...],
  "evaluation": {...},
  "confidenceScore": 85
}
\`\`\``;
}

async function updateSession(sessionId: string, data: any) {
  await prisma.generationSession.update({
    where: { id: sessionId },
    data
  });
}

// GET /api/remix/:sessionId/status - Check remix status
remixRouter.get('/:sessionId/status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = await prisma.generationSession.findUnique({
      where: { id: req.params.sessionId }
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    const finalContent = session.finalContent as any;

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        sheetId: finalContent?.sheetId || null
      }
    });
  } catch (error) {
    next(error);
  }
});
