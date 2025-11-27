/**
 * Transforms a Sheet (Fiche) from ATELIER FORGE into SCORM module data
 */

import {
  SheetForScorm,
  SheetObjective,
  SheetSituation,
  SheetPhase,
  SheetQuizQuestion,
  FORMAT_LABELS,
  ACTIVITY_LABELS
} from '../types/fiche.types';

import {
  ScormModuleData,
  ModuleSection,
  QuizConfig,
  TransformedQuestion,
  QuizOption,
  ResourceItem,
  ModuleMetadata,
  ModuleConfig
} from '../types/scorm.types';

/**
 * Main transformation function
 */
export function sheetToScormData(sheet: SheetForScorm): ScormModuleData {
  const moduleId = `module_${sheet.competency.code}_${Date.now()}`;

  return {
    moduleId,
    title: sheet.title,
    description: buildDescription(sheet),
    version: '1.0',

    sections: buildSections(sheet),
    quiz: buildQuizConfig(sheet),
    resources: buildResources(sheet),

    metadata: buildMetadata(sheet),
    config: buildConfig()
  };
}

/**
 * Build module description from sheet data
 */
function buildDescription(sheet: SheetForScorm): string {
  const parts = [
    `Formation: ${sheet.title}`,
    `Competence: ${sheet.competency.code} - ${sheet.competency.title}`,
    `Duree: ${sheet.duration} minutes`,
    `Format: ${FORMAT_LABELS[sheet.format] || sheet.format}`
  ];

  if (sheet.objectives && sheet.objectives.length > 0) {
    parts.push(`${sheet.objectives.length} objectifs pedagogiques`);
  }

  return parts.join(' | ');
}

/**
 * Build module sections from sheet content
 */
function buildSections(sheet: SheetForScorm): ModuleSection[] {
  return [
    {
      id: 'intro',
      type: 'intro',
      title: 'Introduction',
      order: 0,
      content: {
        title: sheet.title,
        competenceCode: sheet.competency.code,
        competenceLabel: sheet.competency.title,
        sector: sheet.sector,
        audienceType: sheet.audienceType,
        format: FORMAT_LABELS[sheet.format] || sheet.format,
        duration: sheet.duration,
        objectivesCount: sheet.objectives?.length || 0,
        situationsCount: sheet.situations?.length || 0
      }
    },
    {
      id: 'objectives',
      type: 'objectives',
      title: 'Objectifs pedagogiques',
      order: 1,
      content: transformObjectives(sheet.objectives || [])
    },
    {
      id: 'situations',
      type: 'situations',
      title: 'Situations professionnelles',
      order: 2,
      content: transformSituations(sheet.situations || [])
    },
    {
      id: 'timeline',
      type: 'timeline',
      title: 'Deroule de l\'atelier',
      order: 3,
      content: transformTimeline(sheet.flow || [])
    },
    {
      id: 'quiz',
      type: 'quiz',
      title: 'Quiz de validation',
      order: 4,
      content: null // Quiz handled separately
    },
    {
      id: 'resources',
      type: 'resources',
      title: 'Ressources',
      order: 5,
      content: {
        evaluation: sheet.evaluation,
        materials: extractMaterials(sheet.flow || [])
      }
    }
  ];
}

/**
 * Transform objectives for SCORM module
 */
function transformObjectives(objectives: SheetObjective[]): any[] {
  return objectives.map((obj, index) => ({
    numero: index + 1,
    formulation: obj.text,
    niveau_bloom: obj.bloomLevel,
    isConform: obj.isConform !== false
  }));
}

/**
 * Transform situations for SCORM module
 */
function transformSituations(situations: SheetSituation[]): any[] {
  return situations.map((sit, index) => ({
    numero: `S${index + 1}`,
    titre: sit.title,
    situation: sit.description,
    defi: sit.challenge,
    comportement_attendu: sit.expectedBehavior
  }));
}

/**
 * Transform flow/timeline for SCORM module
 */
function transformTimeline(phases: SheetPhase[]): any[] {
  let cumulativeTime = 0;

  return phases.map((phase, index) => {
    const startTime = cumulativeTime;
    cumulativeTime += phase.duration;

    return {
      phase: index + 1,
      intitule: phase.name,
      duree_minutes: phase.duration,
      startTime,
      endTime: cumulativeTime,
      objectifs: phase.objectives || [],
      activities: (phase.activities || []).map(act => ({
        name: act.name,
        duration: act.duration,
        type: act.type,
        typeLabel: ACTIVITY_LABELS[act.type] || act.type,
        instructions: act.instructions
      })),
      materials: phase.materials || [],
      trainerNotes: phase.trainerNotes
    };
  });
}

/**
 * Extract all materials from phases
 */
function extractMaterials(phases: SheetPhase[]): string[] {
  const materials = new Set<string>();

  phases.forEach(phase => {
    if (phase.materials) {
      phase.materials.forEach(m => materials.add(m));
    }
  });

  return Array.from(materials);
}

/**
 * Build quiz configuration
 */
function buildQuizConfig(sheet: SheetForScorm): QuizConfig {
  const questions = sheet.quiz?.questions || [];

  return {
    questions: transformQuestions(questions),
    passingScore: 80,
    maxAttempts: 3,
    shuffleQuestions: false,
    shuffleOptions: true,
    showFeedback: true,
    showCorrectAnswers: true
  };
}

/**
 * Transform quiz questions
 */
function transformQuestions(questions: SheetQuizQuestion[]): TransformedQuestion[] {
  return questions.map((q, index) => {
    const options: QuizOption[] = q.choices.map((choice, i) => ({
      id: choice.id || `${q.id}_opt_${i}`,
      text: choice.text,
      isCorrect: choice.isCorrect
    }));

    const correctIndices = options
      .map((opt, i) => opt.isCorrect ? i : -1)
      .filter(i => i >= 0);

    return {
      id: q.id,
      index,
      type: q.type,
      question: q.text,
      options,
      correctIndices,
      explanation: q.explanation || '',
      points: 10,
      objectiveRef: q.objectiveIndex
    };
  });
}

/**
 * Build resources list
 */
function buildResources(sheet: SheetForScorm): ResourceItem[] {
  const resources: ResourceItem[] = [];

  // Add evaluation method as resource if present
  if (sheet.evaluation?.method) {
    resources.push({
      id: 'eval_method',
      type: 'document',
      title: 'Methode d\'evaluation',
      description: sheet.evaluation.method
    });
  }

  // Add success indicators
  if (sheet.evaluation?.successIndicators && sheet.evaluation.successIndicators.length > 0) {
    resources.push({
      id: 'success_indicators',
      type: 'document',
      title: 'Indicateurs de reussite',
      content: sheet.evaluation.successIndicators.join('\n')
    });
  }

  return resources;
}

/**
 * Build module metadata
 */
function buildMetadata(sheet: SheetForScorm): ModuleMetadata {
  return {
    author: `${sheet.user.firstName} ${sheet.user.lastName}`,
    organization: 'HARMONIA GROUP',
    createdAt: sheet.createdAt.toISOString(),
    competenceCode: sheet.competency.code,
    competenceLabel: sheet.competency.title,
    confidenceScore: sheet.confidenceScore,
    keywords: extractKeywords(sheet)
  };
}

/**
 * Extract keywords from sheet
 */
function extractKeywords(sheet: SheetForScorm): string[] {
  const keywords = new Set<string>();

  // Code and label
  keywords.add(sheet.competency.code);

  // Title words (>4 chars)
  sheet.title
    .split(/\s+/)
    .filter(w => w.length > 4)
    .forEach(w => keywords.add(w.toLowerCase()));

  // Sector
  if (sheet.sector) {
    keywords.add(sheet.sector.toLowerCase());
  }

  // Standard keywords
  keywords.add('formation professionnelle');
  keywords.add('accompagnement');

  return Array.from(keywords).slice(0, 10);
}

/**
 * Build default module configuration
 */
function buildConfig(): ModuleConfig {
  return {
    theme: 'harmonia',
    primaryColor: '#0066cc',
    showProgress: true,
    allowNavigation: true,
    saveProgress: true,
    autoComplete: true
  };
}

/**
 * Validate sheet has required data for SCORM export
 */
export function validateSheetForScorm(sheet: SheetForScorm): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sheet.competency?.code) {
    errors.push('Code competence manquant');
  }

  if (!sheet.title) {
    errors.push('Titre manquant');
  }

  if (!sheet.objectives || sheet.objectives.length === 0) {
    errors.push('Objectifs pedagogiques manquants');
  }

  if (!sheet.quiz?.questions || sheet.quiz.questions.length < 5) {
    errors.push('Quiz incomplet (minimum 5 questions requises)');
  }

  // Validate quiz questions
  if (sheet.quiz?.questions) {
    sheet.quiz.questions.forEach((q, i) => {
      if (!q.text) {
        errors.push(`Question ${i + 1}: enonce manquant`);
      }
      if (!q.choices || q.choices.length < 2) {
        errors.push(`Question ${i + 1}: options insuffisantes`);
      }
      if (!q.choices?.some(c => c.isCorrect)) {
        errors.push(`Question ${i + 1}: aucune reponse correcte definie`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
