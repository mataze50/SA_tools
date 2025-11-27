import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// ============================================
// RÉFÉRENTIEL CEP - CONTEXT STUFFING
// ============================================

const CEP_REFERENTIAL = `
## RÉFÉRENTIEL DES COMPÉTENCES DU CONSEIL EN ÉVOLUTION PROFESSIONNELLE (CEP)

### AXE C1 - ACCUEIL ET ANALYSE DE LA DEMANDE
- **C1.1** Accueillir la personne et créer les conditions favorables à l'expression de sa demande
- **C1.2** Analyser la demande et identifier les besoins explicites et implicites
- **C1.3** Clarifier les attentes et reformuler la demande
- **C1.4** Présenter le dispositif CEP et ses modalités d'accompagnement

### AXE C2 - CONSEIL ET ACCOMPAGNEMENT
- **C2.1** Accompagner l'élaboration du projet professionnel
- **C2.2** Aider à identifier les compétences transférables
- **C2.3** Informer sur les métiers, secteurs et opportunités
- **C2.4** Conseiller sur les parcours de formation adaptés
- **C2.5** Soutenir la prise de décision et le passage à l'action

### AXE C3 - INGÉNIERIE DE PARCOURS
- **C3.1** Co-construire un plan d'action personnalisé
- **C3.2** Identifier et mobiliser les ressources et dispositifs
- **C3.3** Accompagner les démarches administratives et financières
- **C3.4** Assurer le suivi et l'ajustement du parcours

### AXE C4 - VEILLE ET EXPERTISE TERRITORIALE
- **C4.1** Maintenir une veille sur l'emploi et la formation du territoire
- **C4.2** Développer et animer un réseau de partenaires
- **C4.3** Contribuer à l'observation des besoins en compétences

### AXE C5 - POSTURE ET RELATION
- **C5.1** Adopter une posture d'écoute active et bienveillante
- **C5.2** Gérer les situations difficiles et les résistances au changement
- **C5.3** Maintenir la distance professionnelle appropriée
- **C5.4** Travailler en équipe pluridisciplinaire

### AXE C6 - ÉVALUATION ET QUALITÉ
- **C6.1** Évaluer l'atteinte des objectifs d'accompagnement
- **C6.2** Contribuer à l'amélioration continue des pratiques
- **C6.3** Documenter et tracer les accompagnements

### AXE C7 - NUMÉRIQUE ET OUTILS
- **C7.1** Utiliser les outils numériques d'accompagnement
- **C7.2** Accompagner à distance (visio, téléphone)
- **C7.3** Sensibiliser aux usages numériques professionnels
`;

const BLOOM_TAXONOMY = `
## TAXONOMIE DE BLOOM - NIVEAUX COGNITIFS

### Niveau 1 - CONNAISSANCE (Mémoriser)
Verbes: définir, identifier, lister, nommer, reconnaître, rappeler, répéter
Activités adaptées: QCM, exercices de rappel, flashcards

### Niveau 2 - COMPRÉHENSION (Comprendre)
Verbes: expliquer, décrire, interpréter, reformuler, résumer, classifier
Activités adaptées: reformulation, schémas explicatifs, questions ouvertes

### Niveau 3 - APPLICATION (Appliquer)
Verbes: appliquer, démontrer, utiliser, mettre en œuvre, résoudre, illustrer
Activités adaptées: études de cas simples, exercices pratiques guidés

### Niveau 4 - ANALYSE (Analyser)
Verbes: analyser, comparer, différencier, examiner, décomposer, questionner
Activités adaptées: analyses de cas complexes, comparaisons, diagnostics

### Niveau 5 - SYNTHÈSE/ÉVALUATION (Évaluer)
Verbes: évaluer, juger, critiquer, justifier, argumenter, recommander
Activités adaptées: débats, présentations argumentées, évaluations croisées

### Niveau 6 - CRÉATION (Créer)
Verbes: créer, concevoir, élaborer, produire, construire, planifier
Activités adaptées: projets, productions originales, plans d'action
`;

const SMART_CRITERIA = `
## CRITÈRES SMART POUR OBJECTIFS PÉDAGOGIQUES

- **S**pécifique: L'objectif décrit précisément ce que l'apprenant saura faire
- **M**esurable: On peut vérifier objectivement si l'objectif est atteint
- **A**tteignable: L'objectif est réaliste dans le temps et contexte impartis
- **R**éaliste: L'objectif est pertinent par rapport à la compétence visée
- **T**emporel: L'objectif est réalisable dans la durée de l'atelier
`;

const GOLD_STANDARD_EXAMPLE = `
## EXEMPLE DE FICHE "GOLD STANDARD" - C1.2 Analyser la demande

**Titre**: Maîtriser l'analyse de la demande en entretien CEP

**Objectifs pédagogiques**:
1. Être capable d'identifier les besoins explicites et implicites d'un bénéficiaire en utilisant la technique du questionnement en entonnoir (Niveau Bloom: Analyse)
2. Être capable de reformuler une demande complexe en synthèse claire et validée par le bénéficiaire (Niveau Bloom: Synthèse)
3. Être capable de distinguer une demande d'information d'une demande d'accompagnement approfondi (Niveau Bloom: Analyse)

**Situations professionnelles**:
1. "Le bénéficiaire hésitant" - Un salarié de 45 ans vient "pour se renseigner" mais cache une crainte de licenciement
2. "La demande multiple" - Une demandeuse d'emploi exprime 3 projets différents sans hiérarchie
3. "Le projet irréaliste" - Un jeune diplômé veut devenir pilote de ligne sans les prérequis

**Déroulé** (75 min total):
- Accueil (5 min): Présentation, ice-breaker "Mon dernier entretien marquant"
- Découverte (15 min): Vidéo d'un entretien + identification collective des techniques
- Appropriation (20 min): Atelier en binôme - reformulation de cas écrits
- Application (25 min): Jeu de rôle en trinôme avec observateur
- Synthèse (10 min): Fiche mémo personnelle + tour de table

**Évaluation**:
- Critère 1: La reformulation valide les éléments clés en moins de 3 phrases
- Critère 2: L'observateur identifie au moins 3 techniques de questionnement utilisées
- Indicateur de réussite: 80% des participants réussissent l'exercice de reformulation
`;

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
 * Uses Extended Thinking for better reasoning on complex pedagogical design
 */
export async function generateSheet(context: GenerationContext): Promise<GeneratedSheet> {
  const prompt = buildMasterGeneratorPrompt(context);

  // Use Extended Thinking for complex generation tasks
  // Note: Extended thinking provides better reasoning for complex pedagogical design
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 16000,
    // Extended thinking - cast to any for SDK compatibility
    ...(({ thinking: { type: 'enabled', budget_tokens: 10000 } }) as any),
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  // Find the text content (skip thinking blocks)
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Parse the JSON response
  const jsonMatch = textContent.text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('Failed to parse sheet from response');
  }

  const sheet = JSON.parse(jsonMatch[1]) as GeneratedSheet;

  // Post-generation validation: check duration consistency
  const totalDuration = sheet.flow.reduce((sum, phase) => sum + phase.duration, 0);
  if (totalDuration !== context.duration) {
    console.warn(`Duration mismatch: flow total ${totalDuration} vs expected ${context.duration}`);
    // Auto-adjust will be handled by validation step
  }

  return sheet;
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
  return `Tu es un expert en ingénierie pédagogique spécialisé dans la conception de fiches d'ateliers pour le Conseil en Évolution Professionnelle (CEP) au sein d'HARMONIA GROUP.

# BASES DE CONNAISSANCES (CONTEXT STUFFING)

${CEP_REFERENTIAL}

${BLOOM_TAXONOMY}

${SMART_CRITERIA}

${GOLD_STANDARD_EXAMPLE}

---

# DEMANDE DE GÉNÉRATION

## CONTEXTE DE LA DEMANDE

**Compétence visée**: ${context.competencyCode} - ${context.competencyTitle}
**Secteur d'intervention**: ${context.sector}
**Public cible**: ${context.audienceType}
**Format de l'atelier**: ${context.format}
**Durée totale**: ${context.duration} minutes (IMPÉRATIF: le total des phases doit être EXACTEMENT ${context.duration} minutes)
**Contraintes identifiées**: ${context.constraints.join(', ') || 'Aucune'}
**Priorités du formateur**: ${context.priorities.join(', ') || 'Standard'}

${context.enrichmentData ? `
## DONNÉES D'ENRICHISSEMENT (Sources Perplexity - Web-grounded)

**Situations réelles trouvées sur le web**:
${context.enrichmentData.situations.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Bibliographie récente (2023-2025)**:
${context.enrichmentData.bibliography.map((b, i) => `${i + 1}. ${b}`).join('\n')}

**Tendances actuelles du secteur**:
${context.enrichmentData.trends.map((t, i) => `${i + 1}. ${t}`).join('\n')}
` : ''}

## INSTRUCTIONS DE GÉNÉRATION

Tu dois générer une fiche de conception pédagogique complète en respectant STRICTEMENT les règles suivantes:

### 1. OBJECTIFS PÉDAGOGIQUES (2-4 objectifs)
- Utilise UNIQUEMENT les verbes de la taxonomie de Bloom fournie ci-dessus
- Privilégie les niveaux 3 à 6 (Application, Analyse, Évaluation, Création)
- Format OBLIGATOIRE: "Être capable de [VERBE ACTION] + [OBJET] + [CONTEXTE]"
- Vérifie que chaque objectif respecte les critères SMART
- Le verbe doit correspondre au niveau Bloom déclaré

### 2. SITUATIONS PROFESSIONNELLES (3-5 situations)
- RÉALISTES et ancrées dans le secteur "${context.sector}"
- Adaptées au public "${context.audienceType}"
- Si des situations web-grounded sont disponibles, UTILISE-LES en priorité
- Chaque situation doit inclure: titre accrocheur, description contextualisée, défi concret, comportement attendu observable

### 3. DÉROULÉ PÉDAGOGIQUE
- **CONTRAINTE ABSOLUE**: Total des durées = ${context.duration} minutes EXACTEMENT
- Structure recommandée (adaptable):
  * Accueil: 5-10% du temps
  * Découverte: 15-20% du temps
  * Appropriation: 25-30% du temps
  * Application: 30-35% du temps
  * Synthèse: 10-15% du temps
- Variété des modalités: au moins 2 types parmi (individuel, groupe, plénière, pratique)
- Chaque activité doit être rattachée à un objectif pédagogique
- Les activités doivent progresser selon Bloom (du simple vers le complexe)

### 4. ÉVALUATION
- UN critère d'évaluation par objectif pédagogique
- Indicateurs OBSERVABLES et MESURABLES
- Méthode adaptée au format ${context.format}

### 5. SCORE DE CONFIANCE
- Calcule un score de confiance (0-100) basé sur:
  * Alignement Bloom objectifs/activités: 30%
  * Cohérence timing: 25%
  * Réalisme des situations: 25%
  * Complétude de l'évaluation: 20%

## FORMAT DE SORTIE

Réponds UNIQUEMENT avec un bloc JSON valide (pas de texte avant ou après):

\`\`\`json
{
  "title": "Titre de l'atelier (accrocheur et descriptif)",
  "objectives": [
    {
      "id": "obj1",
      "text": "Être capable de [verbe Bloom] [objet] [contexte]",
      "bloomLevel": "Application|Analyse|Évaluation|Création",
      "verb": "verbe utilisé",
      "isConform": true,
      "notes": "Justification SMART si pertinent"
    }
  ],
  "situations": [
    {
      "id": "sit1",
      "title": "Titre accrocheur de la situation",
      "description": "Description contextualisée détaillée...",
      "challenge": "Le défi concret à relever...",
      "expectedBehavior": "Comportement observable attendu...",
      "source": "web-grounded|expert|generated"
    }
  ],
  "flow": [
    {
      "id": "phase1",
      "name": "Nom de la phase",
      "duration": 5,
      "objectives": ["Objectif de cette phase"],
      "activities": [
        {
          "name": "Nom de l'activité",
          "type": "individual|group|plenary|practice",
          "duration": 5,
          "instructions": "Instructions détaillées pour le formateur...",
          "linkedObjective": "obj1"
        }
      ],
      "materials": ["Liste du matériel nécessaire"],
      "trainerNotes": "Notes pour le formateur (tips, points de vigilance)"
    }
  ],
  "evaluation": {
    "criteria": [
      {
        "objectiveId": "obj1",
        "criterion": "Capacité observable à...",
        "observable": "Le participant démontre que..."
      }
    ],
    "method": "Méthode d'évaluation adaptée",
    "successIndicators": ["Indicateur mesurable de réussite"]
  },
  "confidenceScore": 85,
  "metadata": {
    "totalDuration": ${context.duration},
    "bloomLevelsUsed": ["Liste des niveaux Bloom utilisés"],
    "activityTypes": ["Liste des types d'activités"]
  }
}
\`\`\``;
}

function buildValidatorPrompt(sheet: GeneratedSheet, context: GenerationContext): string {
  // Calculate actual duration for validation
  const actualTotalDuration = sheet.flow.reduce((sum, phase) => sum + phase.duration, 0);
  const durationDiff = actualTotalDuration - context.duration;

  return `Tu es un expert qualité en ingénierie pédagogique CEP. Analyse cette fiche de conception selon des règles métier strictes.

# BASES DE RÉFÉRENCE

${BLOOM_TAXONOMY}

${SMART_CRITERIA}

# FICHE À VALIDER

${JSON.stringify(sheet, null, 2)}

# CONTEXTE DE LA DEMANDE

**Compétence**: ${context.competencyCode} - ${context.competencyTitle}
**Durée déclarée**: ${context.duration} minutes
**Durée réelle calculée**: ${actualTotalDuration} minutes (${durationDiff === 0 ? '✓ OK' : `⚠️ Écart de ${durationDiff} min`})
**Format**: ${context.format}
**Public**: ${context.audienceType}

# RÈGLES DE VALIDATION MÉTIER (STRICTES)

## 1. COHÉRENCE TEMPORELLE (Poids: 25%)
- **RÈGLE ABSOLUE**: Total des phases DOIT = ${context.duration} minutes
- Tolérance: 0 minute (pas d'écart accepté)
- Vérifier que chaque activité a une durée >= 5 minutes (sauf ice-breakers)
- Vérifier que la somme des durées des activités d'une phase = durée de la phase

## 2. ALIGNEMENT BLOOM (Poids: 30%)
- Le verbe de l'objectif DOIT correspondre au niveau Bloom déclaré
- Les activités DOIVENT utiliser des verbes du même niveau ou supérieur
- Progression recommandée: du niveau 3 (Application) vers 6 (Création)
- Table de correspondance verbes/niveaux:
  * Niveau 3: appliquer, démontrer, utiliser, mettre en œuvre
  * Niveau 4: analyser, comparer, différencier, examiner
  * Niveau 5: évaluer, juger, critiquer, argumenter
  * Niveau 6: créer, concevoir, élaborer, produire

## 3. CRITÈRES SMART (Poids: 20%)
Pour chaque objectif, vérifier:
- **S**pécifique: Verbe d'action + objet + contexte présents
- **M**esurable: Comportement observable défini
- **A**tteignable: Réalisable dans le temps imparti
- **R**éaliste: Adapté au niveau du public
- **T**emporel: Correspond à la durée de l'atelier

## 4. COHÉRENCE ÉVALUATION (Poids: 15%)
- UN critère d'évaluation par objectif (pas plus, pas moins)
- Chaque critère doit être OBSERVABLE
- Les indicateurs de réussite doivent être MESURABLES (%, nombre, etc.)

## 5. QUALITÉ DES SITUATIONS (Poids: 10%)
- Minimum 3 situations
- Chaque situation doit avoir: titre, description, défi, comportement attendu
- Les situations doivent être réalistes pour le secteur "${context.sector}"

# CALCUL DU SCORE

Score = 100 - (somme des pénalités)

Pénalités:
- Erreur de timing: -25 points (si total ≠ durée déclarée)
- Incohérence Bloom: -10 points par objectif mal aligné
- Objectif non-SMART: -5 points par critère manquant
- Évaluation incomplète: -5 points par objectif sans critère
- Situation incomplète: -3 points par champ manquant

# FORMAT DE SORTIE

\`\`\`json
{
  "isValid": true,
  "overallScore": 85,
  "scoreBreakdown": {
    "timing": 25,
    "bloomAlignment": 28,
    "smartCriteria": 18,
    "evaluationCoherence": 14,
    "situationsQuality": 10
  },
  "issues": [
    {
      "id": "issue1",
      "type": "error|warning|info",
      "category": "Timing|Bloom|SMART|Évaluation|Situations",
      "severity": 1-10,
      "description": "Description précise du problème",
      "location": "flow[0]|objectives[1]|etc",
      "suggestion": "Correction suggérée",
      "autoFixable": true
    }
  ],
  "suggestions": [
    {
      "id": "sug1",
      "type": "timing|bloom|smart|evaluation|situation",
      "original": "Valeur originale",
      "suggested": "Valeur corrigée",
      "reason": "Justification de la correction",
      "autoApply": true,
      "priority": 1-5
    }
  ],
  "summary": {
    "errorsCount": 0,
    "warningsCount": 2,
    "autoFixableCount": 1,
    "recommendation": "Texte de recommandation globale"
  }
}
\`\`\``;
}

function buildImproverPrompt(sheet: GeneratedSheet, validation: ValidationResult, context?: GenerationContext): string {
  // Calculate target duration if context available
  const targetDuration = context?.duration || sheet.flow.reduce((sum, p) => sum + p.duration, 0);

  return `Tu es un expert en ingénierie pédagogique CEP. Corrige cette fiche selon les problèmes identifiés.

# BASES DE RÉFÉRENCE

${BLOOM_TAXONOMY}

# FICHE À CORRIGER

${JSON.stringify(sheet, null, 2)}

# PROBLÈMES IDENTIFIÉS (par priorité)

## Erreurs (à corriger obligatoirement):
${JSON.stringify(validation.issues.filter(i => i.type === 'error'), null, 2)}

## Avertissements (à corriger si possible):
${JSON.stringify(validation.issues.filter(i => i.type === 'warning'), null, 2)}

# SUGGESTIONS AUTO-APPLICABLES

${JSON.stringify(validation.suggestions.filter(s => s.autoApply), null, 2)}

# INSTRUCTIONS DE CORRECTION

1. **TIMING**: Si le total des durées ≠ ${targetDuration} min, AJUSTE les phases pour atteindre EXACTEMENT ${targetDuration} min
2. **BLOOM**: Corrige les verbes des objectifs pour qu'ils correspondent au niveau déclaré
3. **SMART**: Reformule les objectifs incomplets selon le format "Être capable de [VERBE] [OBJET] [CONTEXTE]"
4. **ÉVALUATION**: Ajoute les critères manquants pour chaque objectif
5. **SITUATIONS**: Complète les champs manquants

# RÈGLES DE CORRECTION TIMING

Si le total est > ${targetDuration}:
- Réduis d'abord les phases "Accueil" et "Synthèse" (min 5 min chacune)
- Puis réduis "Découverte" si nécessaire
- Ne réduis "Application" qu'en dernier recours

Si le total est < ${targetDuration}:
- Augmente d'abord "Application" (pratique)
- Puis "Appropriation"
- Ajoute des activités bonus si nécessaire

# FORMAT DE SORTIE

Retourne la fiche corrigée au format JSON (STRICTEMENT identique à la structure originale):

\`\`\`json
{
  "title": "Titre (peut être ajusté)",
  "objectives": [...],
  "situations": [...],
  "flow": [...],
  "evaluation": {...},
  "confidenceScore": 92,
  "corrections": {
    "appliedFixes": ["Liste des corrections appliquées"],
    "totalDurationAfter": ${targetDuration}
  }
}
\`\`\``;
}

// ============================================
// VALIDATION HELPERS (Programmatic)
// ============================================

/**
 * Validates sheet duration consistency
 */
export function validateDuration(sheet: GeneratedSheet, expectedDuration: number): {
  isValid: boolean;
  actualTotal: number;
  difference: number;
  phaseBreakdown: { name: string; duration: number }[];
} {
  const phaseBreakdown = sheet.flow.map(phase => ({
    name: phase.name,
    duration: phase.duration
  }));

  const actualTotal = phaseBreakdown.reduce((sum, p) => sum + p.duration, 0);
  const difference = actualTotal - expectedDuration;

  return {
    isValid: difference === 0,
    actualTotal,
    difference,
    phaseBreakdown
  };
}

/**
 * Validates Bloom alignment between objectives and activities
 */
export function validateBloomAlignment(sheet: GeneratedSheet): {
  isValid: boolean;
  issues: Array<{ objectiveId: string; verb: string; level: string; issue: string }>;
} {
  const bloomVerbs: Record<string, string[]> = {
    'Connaissance': ['définir', 'identifier', 'lister', 'nommer', 'reconnaître', 'rappeler'],
    'Compréhension': ['expliquer', 'décrire', 'interpréter', 'reformuler', 'résumer', 'classifier'],
    'Application': ['appliquer', 'démontrer', 'utiliser', 'mettre en œuvre', 'résoudre', 'illustrer'],
    'Analyse': ['analyser', 'comparer', 'différencier', 'examiner', 'décomposer', 'questionner'],
    'Évaluation': ['évaluer', 'juger', 'critiquer', 'justifier', 'argumenter', 'recommander'],
    'Création': ['créer', 'concevoir', 'élaborer', 'produire', 'construire', 'planifier']
  };

  const issues: Array<{ objectiveId: string; verb: string; level: string; issue: string }> = [];

  for (const objective of sheet.objectives) {
    const expectedVerbs = bloomVerbs[objective.bloomLevel] || [];
    const verbLower = objective.verb.toLowerCase();

    if (expectedVerbs.length > 0 && !expectedVerbs.some(v => verbLower.includes(v))) {
      issues.push({
        objectiveId: objective.id,
        verb: objective.verb,
        level: objective.bloomLevel,
        issue: `Le verbe "${objective.verb}" ne correspond pas au niveau "${objective.bloomLevel}". Verbes attendus: ${expectedVerbs.join(', ')}`
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Validates evaluation criteria completeness
 */
export function validateEvaluationCompleteness(sheet: GeneratedSheet): {
  isValid: boolean;
  missingCriteria: string[];
  extraCriteria: string[];
} {
  const objectiveIds = new Set(sheet.objectives.map(o => o.id));
  const criteriaObjectiveIds = new Set(sheet.evaluation.criteria.map(c => c.objectiveId));

  const missingCriteria = [...objectiveIds].filter(id => !criteriaObjectiveIds.has(id));
  const extraCriteria = [...criteriaObjectiveIds].filter(id => !objectiveIds.has(id));

  return {
    isValid: missingCriteria.length === 0 && extraCriteria.length === 0,
    missingCriteria,
    extraCriteria
  };
}

/**
 * Full programmatic validation (runs before AI validation)
 */
export function preValidateSheet(sheet: GeneratedSheet, context: GenerationContext): {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  let score = 100;

  // 1. Duration validation
  const durationResult = validateDuration(sheet, context.duration);
  if (!durationResult.isValid) {
    score -= 25;
    issues.push({
      id: 'duration-mismatch',
      type: 'error',
      category: 'Timing',
      description: `Durée totale (${durationResult.actualTotal} min) ≠ durée déclarée (${context.duration} min). Écart: ${durationResult.difference} min`,
      location: 'flow',
      suggestion: `Ajuster les phases pour atteindre exactement ${context.duration} minutes`
    });
  }

  // 2. Bloom alignment
  const bloomResult = validateBloomAlignment(sheet);
  if (!bloomResult.isValid) {
    score -= bloomResult.issues.length * 10;
    for (const issue of bloomResult.issues) {
      issues.push({
        id: `bloom-${issue.objectiveId}`,
        type: 'warning',
        category: 'Cohérence Bloom',
        description: issue.issue,
        location: `objectives[${issue.objectiveId}]`,
        suggestion: `Utiliser un verbe approprié au niveau ${issue.level}`
      });
    }
  }

  // 3. Evaluation completeness
  const evalResult = validateEvaluationCompleteness(sheet);
  if (!evalResult.isValid) {
    score -= evalResult.missingCriteria.length * 5;
    for (const missing of evalResult.missingCriteria) {
      issues.push({
        id: `eval-missing-${missing}`,
        type: 'warning',
        category: 'Évaluation',
        description: `Critère d'évaluation manquant pour l'objectif ${missing}`,
        location: 'evaluation.criteria',
        suggestion: `Ajouter un critère observable pour l'objectif ${missing}`
      });
    }
  }

  // 4. Situations count
  if (sheet.situations.length < 3) {
    score -= 10;
    issues.push({
      id: 'situations-count',
      type: 'warning',
      category: 'Situations',
      description: `Seulement ${sheet.situations.length} situation(s) - minimum recommandé: 3`,
      location: 'situations',
      suggestion: 'Ajouter des situations professionnelles supplémentaires'
    });
  }

  return {
    isValid: issues.filter(i => i.type === 'error').length === 0,
    score: Math.max(0, score),
    issues
  };
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
