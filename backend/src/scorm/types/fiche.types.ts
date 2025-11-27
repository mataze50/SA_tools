/**
 * Types for Sheet (Fiche) data from ATELIER FORGE
 * Used for transformation to SCORM module
 */

export interface SheetForScorm {
  id: string;
  title: string;
  sector: string;
  audienceType: string;
  format: SheetFormat;
  duration: number;
  confidenceScore: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;

  // Related data
  competency: {
    id: string;
    code: string;
    title: string;
    axis?: string;
  };

  user: {
    firstName: string;
    lastName: string;
  };

  // Content
  objectives: SheetObjective[];
  situations: SheetSituation[];
  flow: SheetPhase[];
  evaluation: SheetEvaluation;

  // Optional quiz
  quiz?: {
    questions: SheetQuizQuestion[];
  };
}

export type SheetFormat = 'IN_PERSON' | 'REMOTE_SYNC' | 'REMOTE_ASYNC' | 'HYBRID';

export interface SheetObjective {
  id?: string;
  text: string;
  bloomLevel: BloomLevel;
  isConform?: boolean;
}

export type BloomLevel =
  | 'Connaissance'
  | 'Comprehension'
  | 'Application'
  | 'Analyse'
  | 'Evaluation'
  | 'Creation';

export interface SheetSituation {
  id?: string;
  title: string;
  description: string;
  challenge: string;
  expectedBehavior: string;
}

export interface SheetPhase {
  id?: string;
  name: string;
  duration: number;
  objectives?: string[];
  activities?: SheetActivity[];
  materials?: string[];
  trainerNotes?: string;
}

export interface SheetActivity {
  name: string;
  duration: number;
  type: 'individual' | 'group' | 'plenary' | 'practice';
  instructions: string;
}

export interface SheetEvaluation {
  method?: string;
  criteria?: {
    criterion: string;
    observable: string;
  }[];
  successIndicators?: string[];
}

export interface SheetQuizQuestion {
  id: string;
  text: string;
  type: 'choice' | 'true-false' | 'multiple';
  choices: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation?: string;
  objectiveIndex?: number;
}

// Mapping helpers
export const FORMAT_LABELS: Record<SheetFormat, string> = {
  IN_PERSON: 'Presentiel',
  REMOTE_SYNC: 'Distanciel synchrone',
  REMOTE_ASYNC: 'Distanciel asynchrone',
  HYBRID: 'Hybride'
};

export const ACTIVITY_LABELS: Record<string, string> = {
  individual: 'Travail individuel',
  group: 'Travail en groupe',
  plenary: 'Pleniere',
  practice: 'Mise en pratique'
};

export const BLOOM_DESCRIPTIONS: Record<BloomLevel, string> = {
  Connaissance: 'Memoriser et restituer des informations',
  Comprehension: 'Expliquer et interpreter des concepts',
  Application: 'Utiliser des connaissances dans des situations nouvelles',
  Analyse: 'Decomposer et examiner les relations entre elements',
  Evaluation: 'Porter un jugement critique et argumente',
  Creation: 'Produire quelque chose de nouveau et original'
};
