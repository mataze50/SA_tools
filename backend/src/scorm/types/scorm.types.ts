/**
 * SCORM Types for ATELIER FORGE
 * Based on SCORM 1.2 and 2004 specifications
 */

// SCORM Export Configuration
export interface ScormExportConfig {
  version: ScormVersion;
  organization: string;
  language: string;
  masteryScore: number;
  typicalDuration: string;  // ISO 8601 format (PT1H15M)
  maxAttempts?: number;
  outputPath: string;
}

export type ScormVersion = '1.2' | '2004-3rd' | '2004-4th';

// Transformed Module Data
export interface ScormModuleData {
  moduleId: string;
  title: string;
  description: string;
  version: string;

  sections: ModuleSection[];
  quiz: QuizConfig;
  resources: ResourceItem[];

  metadata: ModuleMetadata;
  config: ModuleConfig;
}

export interface ModuleSection {
  id: string;
  type: SectionType;
  title: string;
  content: any;
  order: number;
  duration?: number;
}

export type SectionType =
  | 'intro'
  | 'objectives'
  | 'situations'
  | 'timeline'
  | 'quiz'
  | 'resources'
  | 'completion';

export interface QuizConfig {
  questions: TransformedQuestion[];
  passingScore: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showFeedback: boolean;
  showCorrectAnswers: boolean;
  timeLimit?: number;
}

export interface TransformedQuestion {
  id: string;
  index: number;
  type: 'choice' | 'true-false' | 'multiple';
  question: string;
  options: QuizOption[];
  correctIndices: number[];
  explanation: string;
  points: number;
  objectiveRef?: number;
  difficulty?: 'facile' | 'moyen' | 'difficile';
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ResourceItem {
  id: string;
  type: 'document' | 'video' | 'link' | 'download';
  title: string;
  description?: string;
  url?: string;
  content?: string;
}

export interface ModuleMetadata {
  author: string;
  organization: string;
  createdAt: string;
  competenceCode: string;
  competenceLabel: string;
  confidenceScore: number;
  keywords: string[];
}

export interface ModuleConfig {
  theme: 'harmonia' | 'sensei' | 'myteam' | 'vici';
  primaryColor: string;
  showProgress: boolean;
  allowNavigation: boolean;
  saveProgress: boolean;
  autoComplete: boolean;
}

// SCORM Suspend Data (persisted in LMS)
export interface ScormSuspendData {
  version: string;
  moduleId: string;

  currentSection: string;
  visitedSections: string[];
  completedSections: string[];
  progressPercent: number;

  quizAttempts: number;
  quizAnswers: Record<string, string | string[]>;
  quizScore?: number;
  quizPassed?: boolean;

  totalTimeSpent: number;
  lastAccessedAt: string;

  bookmarks: Record<string, any>;
}

// Export Result
export interface ScormExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
  warnings?: string[];
  manifest?: string;
}

// Interaction Data for quiz tracking
export interface InteractionData {
  id: string;
  type: 'choice' | 'true-false' | 'fill-in' | 'matching' | 'performance' | 'sequencing' | 'likert' | 'numeric' | 'other';
  learnerResponse: string;
  correctResponse: string;
  result: 'correct' | 'incorrect' | 'neutral';
  latency?: number;
  description?: string;
  weighting?: number;
}

export type CompletionStatus =
  | 'completed'
  | 'incomplete'
  | 'not attempted'
  | 'browsed';

export type SuccessStatus =
  | 'passed'
  | 'failed'
  | 'unknown';

export interface ScoreData {
  value: number;
  min?: number;
  max?: number;
  status?: SuccessStatus;
}
