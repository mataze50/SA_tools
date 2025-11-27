import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

export interface GenerationContext {
  competencyCode: string;
  competencyTitle: string;
  sector: string;
  audienceType: string;
  format: string;
  constraints: string[];
  priorities: string[];
  duration: number;
  enrichmentData?: {
    situations: string[];
    bibliography: string[];
    trends: string[];
  };
}

export interface GeneratedSheet {
  title: string;
  objectives: Objective[];
  situations: Situation[];
  flow: FlowPhase[];
  evaluation: Evaluation;
  confidenceScore: number;
}

export interface Objective {
  id: string;
  text: string;
  bloomLevel: string;
  verb: string;
  isConform: boolean;
  notes?: string;
}

export interface Situation {
  id: string;
  title: string;
  description: string;
  challenge: string;
  expectedBehavior: string;
  source?: string;
  rating?: 'top' | 'bof' | 'review';
}

export interface FlowPhase {
  id: string;
  name: string;
  duration: number;
  objectives: string[];
  activities: Activity[];
  materials: string[];
  trainerNotes?: string;
}

export interface Activity {
  name: string;
  type: 'individual' | 'group' | 'plenary' | 'practice';
  duration: number;
  instructions: string;
}

export interface Evaluation {
  criteria: EvaluationCriterion[];
  method: string;
  successIndicators: string[];
}

export interface EvaluationCriterion {
  objectiveId: string;
  criterion: string;
  observable: string;
}

export interface ValidationResult {
  isValid: boolean;
  overallScore: number;
  issues: ValidationIssue[];
  suggestions: Suggestion[];
}

export interface ValidationIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  location: string;
  suggestion?: string;
}

export interface Suggestion {
  id: string;
  type: string;
  original: string;
  suggested: string;
  reason: string;
  autoApply: boolean;
}

/**
 * Master Generator - Creates complete sheet from context
 */
export async function generateSheet(context: GenerationContext): Promise<GeneratedSheet> {
  const prompt = buildMasterGeneratorPrompt(context);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Parse the JSON response
  const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('Failed to parse sheet from response');
  }

  return JSON.parse(jsonMatch[1]);
}

/**
 * Coherence Validator - Validates sheet coherence
 */
export async function validateSheet(sheet: GeneratedSheet, context: GenerationContext): Promise<ValidationResult> {
  const prompt = buildValidatorPrompt(sheet, context);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('Failed to parse validation from response');
  }

  return JSON.parse(jsonMatch[1]);
}

/**
 * Iterative Improver - Applies fixes based on validation
 */
export async function improveSheet(
  sheet: GeneratedSheet,
  validation: ValidationResult
): Promise<GeneratedSheet> {
  const prompt = buildImproverPrompt(sheet, validation);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('Failed to parse improved sheet from response');
  }

  return JSON.parse(jsonMatch[1]);
}

/**
 * Quiz Generator - Creates 10 aligned questions
 */
export async function generateQuiz(sheet: GeneratedSheet): Promise<any> {
  const prompt = buildQuizPrompt(sheet);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('Failed to parse quiz from response');
  }

  return JSON.parse(jsonMatch[1]);
}

// ============================================
// PROMPT BUILDERS
// ============================================

function buildMasterGeneratorPrompt(context: GenerationContext): string {
  return `Tu es un expert en ingénierie pédagogique spécialisé dans la conception de fiches d'ateliers pour le Conseil en Évolution Professionnelle (CEP).

## CONTEXTE DE LA DEMANDE

**Compétence visée**: ${context.competencyCode} - ${context.competencyTitle}
**Secteur**: ${context.sector}
**Public cible**: ${context.audienceType}
**Format**: ${context.format}
**Durée**: ${context.duration} minutes
**Contraintes**: ${context.constraints.join(', ') || 'Aucune'}
**Priorités**: ${context.priorities.join(', ') || 'Standard'}

${context.enrichmentData ? `
## DONNÉES D'ENRICHISSEMENT (Perplexity)

**Situations réelles trouvées**:
${context.enrichmentData.situations.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Bibliographie récente**:
${context.enrichmentData.bibliography.map((b, i) => `${i + 1}. ${b}`).join('\n')}

**Tendances du secteur**:
${context.enrichmentData.trends.map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''}

## INSTRUCTIONS

Génère une fiche de conception complète avec:

1. **OBJECTIFS PÉDAGOGIQUES** (2-4 objectifs)
   - Utilise la taxonomie de Bloom (niveaux 3-6 recommandés)
   - Format: "Être capable de [VERBE ACTION] + [OBJET] + [CONTEXTE]"
   - Critères SMART appliqués
   - Indique le niveau Bloom pour chaque objectif

2. **SITUATIONS PROFESSIONNELLES** (3-5 situations)
   - Réalistes et ancrées dans le secteur cible
   - Chaque situation avec: titre, description, défi à relever, comportement attendu
   - Si disponibles, utilise les situations réelles trouvées

3. **DÉROULÉ PÉDAGOGIQUE** (phases détaillées)
   - Total = ${context.duration} minutes exactement
   - Phases: Accueil, Découverte, Appropriation, Application, Synthèse
   - Pour chaque phase: durée, objectifs, activités, matériel
   - Variété de modalités (individuel, groupe, plénière)

4. **ÉVALUATION**
   - Critères d'évaluation alignés sur chaque objectif
   - Indicateurs observables
   - Méthode d'évaluation adaptée au format

## FORMAT DE SORTIE

Réponds UNIQUEMENT avec un bloc JSON valide:

\`\`\`json
{
  "title": "Titre de l'atelier",
  "objectives": [
    {
      "id": "obj1",
      "text": "Être capable de...",
      "bloomLevel": "Analyse",
      "verb": "analyser",
      "isConform": true
    }
  ],
  "situations": [
    {
      "id": "sit1",
      "title": "Titre de la situation",
      "description": "Description détaillée...",
      "challenge": "Le défi à relever...",
      "expectedBehavior": "Comportement attendu..."
    }
  ],
  "flow": [
    {
      "id": "phase1",
      "name": "Accueil",
      "duration": 5,
      "objectives": ["Créer un climat de confiance"],
      "activities": [
        {
          "name": "Tour de table",
          "type": "plenary",
          "duration": 5,
          "instructions": "..."
        }
      ],
      "materials": ["Paperboard", "Post-its"]
    }
  ],
  "evaluation": {
    "criteria": [
      {
        "objectiveId": "obj1",
        "criterion": "Capacité à...",
        "observable": "Le participant..."
      }
    ],
    "method": "Observation + Auto-évaluation",
    "successIndicators": ["80% des participants..."]
  },
  "confidenceScore": 85
}
\`\`\``;
}

function buildValidatorPrompt(sheet: GeneratedSheet, context: GenerationContext): string {
  return `Tu es un expert qualité en ingénierie pédagogique. Analyse cette fiche de conception et identifie les problèmes potentiels.

## FICHE À ANALYSER

${JSON.stringify(sheet, null, 2)}

## CONTEXTE

**Compétence**: ${context.competencyCode} - ${context.competencyTitle}
**Durée prévue**: ${context.duration} minutes

## CRITÈRES DE VALIDATION

1. **Cohérence Bloom**: Les verbes des objectifs correspondent-ils aux activités?
2. **Alignement**: Objectifs → Activités → Évaluation sont cohérents?
3. **Timing**: Le total des phases = ${context.duration} minutes?
4. **Réalisme**: Les situations sont-elles réalistes pour le public cible?
5. **Critères SMART**: Les objectifs sont-ils Spécifiques, Mesurables, Atteignables, Réalistes, Temporels?
6. **Complétude**: Toutes les sections sont-elles remplies de manière satisfaisante?

## FORMAT DE SORTIE

\`\`\`json
{
  "isValid": true,
  "overallScore": 85,
  "issues": [
    {
      "id": "issue1",
      "type": "warning",
      "category": "Cohérence Bloom",
      "description": "L'objectif 2 utilise 'identifier' (Analyse) mais l'activité demande de 'créer' (Création)",
      "location": "objectives[1]",
      "suggestion": "Remplacer 'identifier' par 'concevoir'"
    }
  ],
  "suggestions": [
    {
      "id": "sug1",
      "type": "improvement",
      "original": "Être capable d'identifier...",
      "suggested": "Être capable de concevoir...",
      "reason": "Alignement avec le niveau Bloom de l'activité",
      "autoApply": true
    }
  ]
}
\`\`\``;
}

function buildImproverPrompt(sheet: GeneratedSheet, validation: ValidationResult): string {
  return `Tu es un expert en ingénierie pédagogique. Corrige cette fiche selon les problèmes identifiés.

## FICHE ORIGINALE

${JSON.stringify(sheet, null, 2)}

## PROBLÈMES À CORRIGER

${JSON.stringify(validation.issues, null, 2)}

## SUGGESTIONS À APPLIQUER

${JSON.stringify(validation.suggestions.filter(s => s.autoApply), null, 2)}

## INSTRUCTIONS

1. Applique TOUTES les suggestions marquées autoApply
2. Corrige les issues de type "error" en priorité
3. Améliore les issues de type "warning" si possible
4. Recalcule le confidenceScore après corrections

## FORMAT DE SORTIE

Retourne la fiche corrigée au format JSON identique à l'original:

\`\`\`json
{
  "title": "...",
  "objectives": [...],
  "situations": [...],
  "flow": [...],
  "evaluation": {...},
  "confidenceScore": 92
}
\`\`\``;
}

function buildQuizPrompt(sheet: GeneratedSheet): string {
  return `Tu es un expert en évaluation pédagogique. Crée un quiz de 10 questions aligné sur cette fiche d'atelier.

## FICHE DE RÉFÉRENCE

**Objectifs**:
${sheet.objectives.map(o => `- ${o.text} (${o.bloomLevel})`).join('\n')}

**Situations**:
${sheet.situations.map(s => `- ${s.title}: ${s.description}`).join('\n')}

## INSTRUCTIONS

Crée 10 questions:
- 3-4 questions de niveau Connaissance/Compréhension
- 3-4 questions de niveau Application/Analyse
- 2-3 questions de niveau Évaluation/Création
- Chaque question liée à un objectif spécifique
- Format QCM avec 4 choix dont 1 correct

## FORMAT DE SORTIE

\`\`\`json
{
  "questions": [
    {
      "id": "q1",
      "text": "Question...",
      "objectiveId": "obj1",
      "bloomLevel": "Compréhension",
      "choices": [
        { "id": "a", "text": "Choix A", "isCorrect": false },
        { "id": "b", "text": "Choix B", "isCorrect": true },
        { "id": "c", "text": "Choix C", "isCorrect": false },
        { "id": "d", "text": "Choix D", "isCorrect": false }
      ],
      "explanation": "Explication de la bonne réponse..."
    }
  ]
}
\`\`\``;
}

/**
 * Section Regenerator - Regenerates a specific section with custom instructions
 */
export async function regenerateSection(
  sheet: GeneratedSheet,
  section: 'objectives' | 'situations' | 'flow' | 'evaluation',
  context: GenerationContext,
  instructions?: string
): Promise<Partial<GeneratedSheet>> {
  const prompt = buildSectionRegeneratorPrompt(sheet, section, context, instructions);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const jsonMatch = content.text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('Failed to parse regenerated section from response');
  }

  return JSON.parse(jsonMatch[1]);
}

function buildSectionRegeneratorPrompt(
  sheet: GeneratedSheet,
  section: 'objectives' | 'situations' | 'flow' | 'evaluation',
  context: GenerationContext,
  instructions?: string
): string {
  const sectionConfigs = {
    objectives: {
      name: 'OBJECTIFS PÉDAGOGIQUES',
      description: 'Régénère les objectifs pédagogiques selon la taxonomie de Bloom',
      format: `{
  "objectives": [
    {
      "id": "obj1",
      "text": "Être capable de...",
      "bloomLevel": "Analyse",
      "verb": "analyser",
      "isConform": true
    }
  ]
}`
    },
    situations: {
      name: 'SITUATIONS PROFESSIONNELLES',
      description: 'Régénère les situations professionnelles réalistes et ancrées dans le secteur',
      format: `{
  "situations": [
    {
      "id": "sit1",
      "title": "Titre de la situation",
      "description": "Description détaillée...",
      "challenge": "Le défi à relever...",
      "expectedBehavior": "Comportement attendu..."
    }
  ]
}`
    },
    flow: {
      name: 'DÉROULÉ PÉDAGOGIQUE',
      description: 'Régénère le déroulé pédagogique avec phases et activités',
      format: `{
  "flow": [
    {
      "id": "phase1",
      "name": "Accueil",
      "duration": 5,
      "objectives": ["Créer un climat de confiance"],
      "activities": [
        {
          "name": "Tour de table",
          "type": "plenary",
          "duration": 5,
          "instructions": "..."
        }
      ],
      "materials": ["Paperboard", "Post-its"]
    }
  ]
}`
    },
    evaluation: {
      name: 'ÉVALUATION',
      description: 'Régénère les critères et méthodes d\'évaluation',
      format: `{
  "evaluation": {
    "criteria": [
      {
        "objectiveId": "obj1",
        "criterion": "Capacité à...",
        "observable": "Le participant..."
      }
    ],
    "method": "Observation + Auto-évaluation",
    "successIndicators": ["80% des participants..."]
  }
}`
    }
  };

  const config = sectionConfigs[section];

  return `Tu es un expert en ingénierie pédagogique. Régénère UNIQUEMENT la section "${config.name}" de cette fiche d'atelier.

## CONTEXTE DE LA FICHE

**Compétence visée**: ${context.competencyCode} - ${context.competencyTitle}
**Secteur**: ${context.sector}
**Public cible**: ${context.audienceType}
**Format**: ${context.format}
**Durée**: ${context.duration} minutes

## FICHE ACTUELLE (pour référence)

**Objectifs actuels**:
${sheet.objectives.map(o => `- ${o.text} (${o.bloomLevel})`).join('\n')}

**Situations actuelles**:
${sheet.situations.map(s => `- ${s.title}: ${s.description.substring(0, 100)}...`).join('\n')}

**Déroulé actuel**:
${sheet.flow.map(p => `- ${p.name} (${p.duration} min)`).join('\n')}

## TÂCHE

${config.description}

${instructions ? `
## INSTRUCTIONS SPÉCIFIQUES DE L'UTILISATEUR

"${instructions}"

IMPORTANT: Respecte ces instructions pour la régénération.
` : ''}

## CONTRAINTES

${section === 'objectives' ? `
- 2-4 objectifs maximum
- Utilise la taxonomie de Bloom (niveaux 3-6 recommandés)
- Format: "Être capable de [VERBE ACTION] + [OBJET] + [CONTEXTE]"
- Critères SMART appliqués
` : ''}
${section === 'situations' ? `
- 3-5 situations professionnelles
- Réalistes et ancrées dans le secteur "${context.sector}"
- Adaptées au public "${context.audienceType}"
- Chaque situation avec titre, description, défi, comportement attendu
` : ''}
${section === 'flow' ? `
- Total = ${context.duration} minutes EXACTEMENT
- Phases classiques: Accueil, Découverte, Appropriation, Application, Synthèse
- Variété de modalités (individuel, groupe, plénière)
- Aligné avec les objectifs existants
` : ''}
${section === 'evaluation' ? `
- Critères alignés sur chaque objectif de la fiche
- Indicateurs observables et mesurables
- Méthode adaptée au format "${context.format}"
` : ''}

## FORMAT DE SORTIE

Réponds UNIQUEMENT avec un bloc JSON valide contenant la section régénérée:

\`\`\`json
${config.format}
\`\`\``;
}

export { anthropic };
