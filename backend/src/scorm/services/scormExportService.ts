/**
 * SCORM Export Service
 * Handles SCORM package generation from sheet data
 */

import { prisma } from '../../lib/prisma';
import { ScormExportConfig, ScormExportResult } from '../types/scorm.types';
import { SheetForScorm } from '../types/fiche.types';
import { buildScormPackage } from '../utils/packageBuilder';

export interface ScormExportOptions {
  sheetId: string;
  userId: string;
  version?: '1.2' | '2004-3rd' | '2004-4th';
  organization?: string;
  masteryScore?: number;
}

/**
 * Export a sheet as SCORM package
 */
export async function exportSheetAsScorm(
  options: ScormExportOptions
): Promise<{ result: ScormExportResult; buffer?: Buffer }> {
  const {
    sheetId,
    userId,
    version = '1.2',
    organization = 'HARMONIA GROUP',
    masteryScore = 80
  } = options;

  // 1. Fetch sheet with all related data
  const sheet = await prisma.sheet.findUnique({
    where: { id: sheetId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      competency: true
    }
  });

  if (!sheet) {
    return {
      result: {
        success: false,
        error: 'Fiche non trouvee'
      }
    };
  }

  // Verify access - allow owner or validated sheets
  if (sheet.userId !== userId && sheet.status !== 'VALIDATED') {
    return {
      result: {
        success: false,
        error: 'Acces non autorise'
      }
    };
  }

  // 2. Transform to SCORM-compatible format
  const sheetForScorm = mapSheetToScormFormat(sheet);

  // 3. Build export config
  const config: ScormExportConfig = {
    version,
    organization,
    language: 'fr',
    masteryScore,
    typicalDuration: `PT${sheet.duration || 60}M`,
    maxAttempts: 3,
    outputPath: ''
  };

  // 4. Generate SCORM package
  const result = await buildScormPackage(sheetForScorm, config);

  // 5. Log export
  await logScormExport(sheetId, userId, version, result.result.success);

  return result;
}

/**
 * Map Prisma sheet to SheetForScorm type
 */
function mapSheetToScormFormat(sheet: any): SheetForScorm {
  const content = sheet.content as any || {};

  return {
    id: sheet.id,
    title: sheet.title,
    sector: sheet.sector || '',
    duration: sheet.duration || 60,
    format: (content.format || sheet.format || 'IN_PERSON') as any,
    audienceType: content.audienceType || sheet.audienceType || 'collaborateurs',
    confidenceScore: sheet.confidenceScore || 0,
    status: sheet.status,

    competency: {
      id: sheet.competency?.id || '',
      code: sheet.competency?.code || 'COMP',
      title: sheet.competency?.title || 'Competence',
      axis: sheet.competency?.axis
    },

    user: {
      firstName: sheet.user?.firstName || 'Auteur',
      lastName: sheet.user?.lastName || ''
    },

    objectives: mapObjectives(content.objectives || (sheet.objectives as any)),
    situations: mapSituations(content.situations || (sheet.situations as any)),
    flow: mapFlow(content.flow || content.phases || (sheet.flow as any)),
    evaluation: mapEvaluation(content.evaluation || (sheet.evaluation as any)),
    quiz: mapQuiz(content.quiz),

    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt
  };
}

/**
 * Map objectives from sheet content
 */
function mapObjectives(objectives: any[] | undefined): SheetForScorm['objectives'] {
  if (!objectives || !Array.isArray(objectives)) return [];

  return objectives.map((obj, index) => ({
    id: obj.id || `obj_${index}`,
    text: obj.text || obj.formulation || '',
    bloomLevel: obj.bloomLevel || obj.niveau_bloom || 'comprendre',
    isConform: obj.isConform !== false
  }));
}

/**
 * Map situations from sheet content
 */
function mapSituations(situations: any[] | undefined): SheetForScorm['situations'] {
  if (!situations || !Array.isArray(situations)) return [];

  return situations.map((sit, index) => ({
    id: sit.id || `sit_${index}`,
    title: sit.title || sit.titre || `Situation ${index + 1}`,
    description: sit.description || sit.situation || '',
    challenge: sit.challenge || sit.defi || '',
    expectedBehavior: sit.expectedBehavior || sit.comportement_attendu || ''
  }));
}

/**
 * Map flow/phases from sheet content
 */
function mapFlow(flow: any[] | undefined): SheetForScorm['flow'] {
  if (!flow || !Array.isArray(flow)) return [];

  return flow.map((phase, index) => ({
    id: phase.id || `phase_${index}`,
    name: phase.name || phase.intitule || `Phase ${index + 1}`,
    duration: phase.duration || phase.duree_minutes || 0,
    objectives: phase.objectives || phase.objectifs || [],
    activities: mapActivities(phase.activities || phase.activites),
    materials: phase.materials || phase.materiel || [],
    trainerNotes: phase.trainerNotes || phase.notes_formateur || ''
  }));
}

/**
 * Map activities from phase
 */
function mapActivities(activities: any[] | undefined): SheetForScorm['flow'][0]['activities'] {
  if (!activities || !Array.isArray(activities)) return [];

  return activities.map((act, index) => ({
    id: act.id || `act_${index}`,
    name: act.name || act.nom || '',
    duration: act.duration || act.duree || 0,
    type: act.type || 'presentation',
    instructions: act.instructions || ''
  }));
}

/**
 * Map evaluation from sheet content
 */
function mapEvaluation(evaluation: any | undefined): SheetForScorm['evaluation'] {
  if (!evaluation) {
    return {
      method: '',
      successIndicators: []
    };
  }

  return {
    method: evaluation.method || evaluation.methode || '',
    successIndicators: evaluation.successIndicators || evaluation.indicateurs || []
  };
}

/**
 * Map quiz from sheet content
 */
function mapQuiz(quiz: any | undefined): SheetForScorm['quiz'] {
  if (!quiz || !quiz.questions || !Array.isArray(quiz.questions)) {
    return { questions: [] };
  }

  return {
    questions: quiz.questions.map((q: any, index: number) => ({
      id: q.id || `q_${index}`,
      type: q.type || 'single',
      text: q.text || q.question || '',
      choices: mapChoices(q.choices || q.options),
      explanation: q.explanation || q.explication || '',
      objectiveIndex: q.objectiveIndex
    }))
  };
}

/**
 * Map quiz choices
 */
function mapChoices(choices: any[] | undefined): NonNullable<SheetForScorm['quiz']>['questions'][0]['choices'] {
  if (!choices || !Array.isArray(choices)) return [];

  return choices.map((choice, index) => ({
    id: choice.id || `choice_${index}`,
    text: choice.text || '',
    isCorrect: choice.isCorrect === true || choice.correct === true
  }));
}

/**
 * Log SCORM export for analytics
 */
async function logScormExport(
  sheetId: string,
  userId: string,
  version: string,
  success: boolean
): Promise<void> {
  try {
    await prisma.exportLog.create({
      data: {
        sheetId,
        userId,
        exportType: 'SCORM',
        format: version,
        success,
        exportedAt: new Date()
      }
    });
  } catch (error) {
    // Log error but don't fail the export
    console.error('Failed to log SCORM export:', error);
  }
}

/**
 * Get SCORM export history for a sheet
 */
export async function getScormExportHistory(sheetId: string): Promise<any[]> {
  return prisma.exportLog.findMany({
    where: {
      sheetId,
      exportType: 'SCORM'
    },
    orderBy: {
      exportedAt: 'desc'
    },
    take: 10
  });
}
