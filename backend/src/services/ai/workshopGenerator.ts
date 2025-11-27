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

const WORKSHOP_STRUCTURE_TEMPLATE = `
## STRUCTURE FIXE D'UN ATELIER DE 75 MINUTES

L'atelier suit une structure FIXE de 75 minutes répartie en 5 phases obligatoires.

### Phase 1 - ACCUEIL (10 minutes)
- Présentation du formateur (2 min)
- Ice-breaker rapide pour créer la dynamique (5 min)
- Présentation des objectifs et du déroulé (3 min)

### Phase 2 - DÉCOUVERTE (15 minutes)
- Apport théorique synthétique (max 10 min continu)
- Exemple concret ou démonstration (5 min)
- Premier questionnement collectif

### Phase 3 - APPROPRIATION (20 minutes)
- Exercice en sous-groupes ou binômes (12-15 min)
- Debriefing collectif (5-8 min)

### Phase 4 - APPLICATION (20 minutes)
- Mise en situation réaliste ou jeu de rôle (12-15 min)
- Feedback et analyse (5-8 min)

### Phase 5 - SYNTHÈSE (10 minutes)
- Points clés à retenir (3 min)
- Plan d'action personnel (4 min)
- Clôture et évaluation rapide (3 min)

**RÈGLE IMPORTANTE**: La durée totale DOIT être exactement 75 minutes (10+15+20+20+10).
`;

// ============================================
// TYPES
// ============================================

export interface WorkshopGenerationContext {
  subject: string;
  competencies: {
    id: string;
    code: string;
    title: string;
    isPrimary: boolean;
  }[];
  sector: string;
  audienceType: string;
  format: 'IN_PERSON' | 'REMOTE_SYNC' | 'REMOTE_ASYNC' | 'HYBRID';
  duration: number;
  participantMin: number;
  participantMax: number;
  enrichmentData?: {
    situations: string[];
    resources: string[];
    trends: string[];
  };
}

export interface GeneratedWorkshop {
  title: string;
  description: string;
  introduction: WorkshopIntroduction;
  timeline: TimelinePhase[];
  activities: WorkshopActivity[];
  materials: MaterialItem[];
  trainerNotes: TrainerNotes;
  evaluation: WorkshopEvaluation;
  synthesis: WorkshopSynthesis;
  confidenceScore: number;
  competencyCoverage: CompetencyCoverage[];
}

export interface WorkshopIntroduction {
  welcomeScript: string;
  iceBreaker: {
    name: string;
    duration: number;
    instructions: string;
    materials?: string[];
  };
  objectivesPresentation: string;
  agendaOverview: string;
}

export interface TimelinePhase {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  type: 'accueil' | 'decouverte' | 'appropriation' | 'application' | 'synthese';
  activityIds: string[];
  objectives: string[];
}

export interface WorkshopActivity {
  id: string;
  name: string;
  type: 'individual' | 'group' | 'plenary' | 'practice' | 'presentation' | 'debrief';
  duration: number;
  phaseId: string;
  competenciesTargeted: string[];
  bloomLevel: number;
  objectives: string[];
  instructions: {
    trainer: string;
    participants: string;
  };
  materials: string[];
  setup?: string;
  debrief?: string;
  variants?: {
    remote?: string;
    largeGroup?: string;
  };
}

export interface MaterialItem {
  name: string;
  quantity: string;
  type: 'document' | 'materiel' | 'digital' | 'preparation';
  forActivity?: string;
  notes?: string;
}

export interface TrainerNotes {
  preparation: string[];
  keyMessages: string[];
  commonPitfalls: string[];
  adaptationTips: {
    timing: string;
    engagement: string;
    difficulties: string;
  };
  followUp: string;
}

export interface WorkshopEvaluation {
  strategy: string;
  formativeAssessments: {
    activityId: string;
    method: string;
    criteria: string;
  }[];
  summativeAssessment: {
    method: string;
    criteria: EvaluationCriterion[];
    successThreshold: string;
  };
  selfAssessment: {
    questions: string[];
    scale: string;
  };
}

export interface EvaluationCriterion {
  competencyCode: string;
  criterion: string;
  observable: string;
  level: 'acquis' | 'en_cours' | 'non_acquis';
}

export interface WorkshopSynthesis {
  keyTakeaways: string[];
  actionPlanTemplate: string;
  resources: {
    name: string;
    type: string;
    url?: string;
  }[];
  nextSteps: string;
  closingScript: string;
}

export interface CompetencyCoverage {
  competencyCode: string;
  coverageLevel: number;
  activitiesCount: number;
  mainActivities: string[];
}

// ============================================
// WORKSHOP GENERATION
// ============================================

function buildWorkshopGeneratorPrompt(context: WorkshopGenerationContext): string {
  const primaryComp = context.competencies.find(c => c.isPrimary);
  const secondaryComps = context.competencies.filter(c => !c.isPrimary);

  const formatLabel = {
    'IN_PERSON': 'Présentiel en salle',
    'REMOTE_SYNC': 'Distanciel synchrone (visioconférence)',
    'REMOTE_ASYNC': 'Distanciel asynchrone (e-learning)',
    'HYBRID': 'Hybride (mix présentiel et distanciel)'
  }[context.format];

  return `Tu es un expert en ingénierie pédagogique spécialisé dans la création d'ateliers de formation professionnelle pour les conseillers en évolution professionnelle (CEP).

${CEP_REFERENTIAL}

${BLOOM_TAXONOMY}

${WORKSHOP_STRUCTURE_TEMPLATE}

---

## CONTEXTE DE L'ATELIER À CRÉER

**SUJET DE L'ATELIER**: ${context.subject}

**COMPÉTENCE PRINCIPALE CIBLÉE**:
- Code: ${primaryComp?.code}
- Intitulé: ${primaryComp?.title}

**COMPÉTENCES SECONDAIRES** (à intégrer dans l'atelier):
${secondaryComps.length > 0
  ? secondaryComps.map(c => `- ${c.code}: ${c.title}`).join('\n')
  : '- Aucune compétence secondaire'}

**CONTEXTE**:
- Secteur: ${context.sector}
- Public cible: ${context.audienceType}
- Format: ${formatLabel}
- Durée totale: ${context.duration} minutes
- Nombre de participants: ${context.participantMin} à ${context.participantMax}

${context.enrichmentData ? `
**ÉLÉMENTS DE CONTEXTE ENRICHIS**:
- Situations terrain: ${context.enrichmentData.situations.join(', ')}
- Ressources identifiées: ${context.enrichmentData.resources.join(', ')}
- Tendances actuelles: ${context.enrichmentData.trends.join(', ')}
` : ''}

---

## INSTRUCTIONS DE GÉNÉRATION

Génère un atelier de formation COMPLET et OPÉRATIONNEL au format JSON.

**RÈGLES IMPÉRATIVES**:

1. **ALIGNEMENT PÉDAGOGIQUE**
   - Chaque activité DOIT cibler au moins une compétence du référentiel
   - Les objectifs utilisent les verbes de Bloom (niveaux 3 à 6 prioritaires)
   - Progression pédagogique: du simple au complexe

2. **COHÉRENCE TEMPORELLE - STRUCTURE FIXE 75 MINUTES**
   - La durée totale DOIT être exactement 75 minutes
   - Structure OBLIGATOIRE:
     * Accueil: 10 minutes
     * Découverte: 15 minutes
     * Appropriation: 20 minutes
     * Application: 20 minutes
     * Synthèse: 10 minutes
   - Alterner théorie (max 10 min continu) et pratique
   - IGNORER le paramètre duration reçu, utiliser 75 min

3. **OPÉRATIONNALITÉ**
   - Instructions formateur précises et actionnables
   - Consignes participants claires
   - Matériel listée exhaustivement
   - Variantes pour adaptation (si format le permet)

4. **ÉVALUATION INTÉGRÉE**
   - Au moins 1 évaluation formative par phase
   - Critères d'évaluation liés aux compétences ciblées
   - Auto-évaluation des participants

5. **FORMAT ${context.format}**
${context.format === 'IN_PERSON' ? `
   - Privilégier les interactions physiques (sous-groupes, déplacements)
   - Utiliser l'espace (paper-board, affichage mural)
   - Prévoir du matériel tangible` : ''}
${context.format === 'REMOTE_SYNC' ? `
   - Utiliser les fonctionnalités visio (breakout rooms, sondages, chat)
   - Activités plus courtes (attention réduite)
   - Documents numériques partageables` : ''}
${context.format === 'REMOTE_ASYNC' ? `
   - Modules autonomes avec consignes détaillées
   - Activités auto-correctives ou avec feedback automatisé
   - Ressources téléchargeables` : ''}
${context.format === 'HYBRID' ? `
   - Synchroniser les activités présentiel/distanciel
   - Prévoir des alternatives pour les 2 modes
   - Outils collaboratifs accessibles à tous` : ''}

---

## FORMAT DE SORTIE JSON

Génère UNIQUEMENT le JSON suivant (pas de texte avant ou après):

{
  "title": "Titre accrocheur de l'atelier",
  "description": "Description en 2-3 phrases",
  "introduction": {
    "welcomeScript": "Script d'accueil du formateur (ce qu'il dit mot pour mot)",
    "iceBreaker": {
      "name": "Nom de l'ice-breaker",
      "duration": 5,
      "instructions": "Instructions détaillées",
      "materials": ["matériel nécessaire"]
    },
    "objectivesPresentation": "Script de présentation des objectifs",
    "agendaOverview": "Présentation du déroulé"
  },
  "timeline": [
    {
      "id": "P1",
      "name": "Accueil",
      "startTime": 0,
      "duration": 10,
      "type": "accueil",
      "activityIds": ["A1", "A2"],
      "objectives": ["Créer un climat de confiance", "Cadrer l'atelier"]
    },
    {
      "id": "P2",
      "name": "Découverte",
      "startTime": 10,
      "duration": 15,
      "type": "decouverte",
      "activityIds": ["A3"],
      "objectives": ["Comprendre les concepts clés"]
    },
    {
      "id": "P3",
      "name": "Appropriation",
      "startTime": 25,
      "duration": 20,
      "type": "appropriation",
      "activityIds": ["A4", "A5"],
      "objectives": ["Pratiquer en sous-groupe"]
    },
    {
      "id": "P4",
      "name": "Application",
      "startTime": 45,
      "duration": 20,
      "type": "application",
      "activityIds": ["A6", "A7"],
      "objectives": ["Mettre en situation réelle"]
    },
    {
      "id": "P5",
      "name": "Synthèse",
      "startTime": 65,
      "duration": 10,
      "type": "synthese",
      "activityIds": ["A8"],
      "objectives": ["Ancrer les apprentissages"]
    }
  ],
  "activities": [
    {
      "id": "A1",
      "name": "Nom de l'activité",
      "type": "plenary",
      "duration": 10,
      "phaseId": "P1",
      "competenciesTargeted": ["C5.1"],
      "bloomLevel": 3,
      "objectives": ["Objectif spécifique de l'activité"],
      "instructions": {
        "trainer": "Ce que fait le formateur étape par étape",
        "participants": "Consignes données aux participants"
      },
      "materials": ["liste du matériel"],
      "setup": "Préparation nécessaire avant",
      "debrief": "Points clés à faire ressortir après"
    }
  ],
  "materials": [
    {
      "name": "Nom du matériel",
      "quantity": "1 par participant",
      "type": "document",
      "forActivity": "A1",
      "notes": "Notes de préparation"
    }
  ],
  "trainerNotes": {
    "preparation": ["Liste des choses à préparer avant l'atelier"],
    "keyMessages": ["Messages clés à faire passer"],
    "commonPitfalls": ["Erreurs fréquentes à éviter"],
    "adaptationTips": {
      "timing": "Comment gérer si en avance ou en retard",
      "engagement": "Comment relancer si le groupe décroche",
      "difficulties": "Comment gérer les difficultés"
    },
    "followUp": "Suggestions de suivi post-atelier"
  },
  "evaluation": {
    "strategy": "Description de la stratégie d'évaluation globale",
    "formativeAssessments": [
      {
        "activityId": "A3",
        "method": "Observation + grille",
        "criteria": "Critères observés"
      }
    ],
    "summativeAssessment": {
      "method": "Description de l'évaluation finale",
      "criteria": [
        {
          "competencyCode": "C5.1",
          "criterion": "Critère observable",
          "observable": "Ce que l'on observe concrètement",
          "level": "acquis"
        }
      ],
      "successThreshold": "80% des critères validés"
    },
    "selfAssessment": {
      "questions": ["Questions d'auto-évaluation pour les participants"],
      "scale": "1 à 5 (1=pas du tout, 5=tout à fait)"
    }
  },
  "synthesis": {
    "keyTakeaways": ["Les 3-5 points essentiels à retenir"],
    "actionPlanTemplate": "Template de plan d'action personnel",
    "resources": [
      {
        "name": "Nom de la ressource",
        "type": "article/vidéo/outil",
        "url": "lien si disponible"
      }
    ],
    "nextSteps": "Suggestions pour aller plus loin",
    "closingScript": "Script de clôture de l'atelier"
  },
  "confidenceScore": 85,
  "competencyCoverage": [
    {
      "competencyCode": "C5.1",
      "coverageLevel": 80,
      "activitiesCount": 3,
      "mainActivities": ["A2", "A4", "A6"]
    }
  ]
}`;
}

export async function generateWorkshop(context: WorkshopGenerationContext): Promise<GeneratedWorkshop> {
  const prompt = buildWorkshopGeneratorPrompt(context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      // Extended Thinking for deep pedagogical reasoning
      ...({ thinking: { type: 'enabled', budget_tokens: 15000 } } as any),
      messages: [{ role: 'user', content: prompt }]
    });

    // Extract text content
    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textContent = block.text;
        break;
      }
    }

    // Parse JSON from response
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const workshop = JSON.parse(jsonMatch[0]) as GeneratedWorkshop;

    // Validate and adjust confidence score
    workshop.confidenceScore = calculateWorkshopConfidence(workshop, context);

    return workshop;
  } catch (error) {
    console.error('Workshop generation error:', error);
    throw error;
  }
}

function calculateWorkshopConfidence(workshop: GeneratedWorkshop, context: WorkshopGenerationContext): number {
  let score = 100;
  const issues: string[] = [];

  // Check timeline total duration (must be exactly 75 minutes)
  const totalDuration = workshop.timeline.reduce((sum, phase) => sum + phase.duration, 0);
  if (totalDuration !== 75) {
    score -= 20;
    issues.push(`Duration mismatch: ${totalDuration} vs 75 minutes (required)`);
  }

  // Check 5 phases structure
  const requiredPhases = ['accueil', 'decouverte', 'appropriation', 'application', 'synthese'];
  const actualPhases = workshop.timeline.map(p => p.type);
  for (const phase of requiredPhases) {
    if (!actualPhases.includes(phase)) {
      score -= 10;
      issues.push(`Missing phase: ${phase}`);
    }
  }

  // Check all competencies are covered
  const coveredCompetencies = new Set(workshop.competencyCoverage.map(c => c.competencyCode));
  for (const comp of context.competencies) {
    if (!coveredCompetencies.has(comp.code)) {
      score -= 10;
      issues.push(`Competency ${comp.code} not covered`);
    }
  }

  // Check activities have proper bloom levels (3-6 preferred)
  const lowBloomActivities = workshop.activities.filter(a => a.bloomLevel < 3).length;
  if (lowBloomActivities > workshop.activities.length * 0.3) {
    score -= 10;
    issues.push('Too many low-level Bloom activities');
  }

  // Check evaluation criteria exist for all targeted competencies
  const evaluatedCompetencies = new Set(
    workshop.evaluation.summativeAssessment.criteria.map(c => c.competencyCode)
  );
  for (const comp of context.competencies) {
    if (!evaluatedCompetencies.has(comp.code)) {
      score -= 5;
      issues.push(`No evaluation criteria for ${comp.code}`);
    }
  }

  // Check materials are complete
  const activitiesWithMaterials = workshop.activities.filter(a => a.materials.length > 0).length;
  if (activitiesWithMaterials < workshop.activities.length * 0.5) {
    score -= 5;
    issues.push('Many activities missing materials');
  }

  if (issues.length > 0) {
    console.log('Workshop confidence issues:', issues);
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// WORKSHOP VALIDATION
// ============================================

export interface WorkshopValidationResult {
  isValid: boolean;
  overallScore: number;
  issues: WorkshopIssue[];
  suggestions: WorkshopSuggestion[];
}

export interface WorkshopIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'timing' | 'competency' | 'pedagogy' | 'evaluation' | 'materials';
  message: string;
  location?: string;
}

export interface WorkshopSuggestion {
  id: string;
  type: 'improvement' | 'alternative' | 'addition';
  target: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
}

export async function validateWorkshop(
  workshop: GeneratedWorkshop,
  context: WorkshopGenerationContext
): Promise<WorkshopValidationResult> {
  const issues: WorkshopIssue[] = [];
  const suggestions: WorkshopSuggestion[] = [];
  let score = 100;

  // 1. Timing validation - FIXED 75 MINUTES STRUCTURE
  const totalDuration = workshop.timeline.reduce((sum, phase) => sum + phase.duration, 0);
  if (totalDuration !== 75) {
    issues.push({
      id: 'T1',
      type: 'error',
      category: 'timing',
      message: `Durée totale (${totalDuration} min) doit être exactement 75 minutes`
    });
    score -= 20;
  }

  // Check 5 phases structure
  const requiredPhases: { type: string; duration: number; name: string }[] = [
    { type: 'accueil', duration: 10, name: 'Accueil' },
    { type: 'decouverte', duration: 15, name: 'Découverte' },
    { type: 'appropriation', duration: 20, name: 'Appropriation' },
    { type: 'application', duration: 20, name: 'Application' },
    { type: 'synthese', duration: 10, name: 'Synthèse' }
  ];

  for (const req of requiredPhases) {
    const phase = workshop.timeline.find(p => p.type === req.type);
    if (!phase) {
      issues.push({
        id: `T_${req.type}`,
        type: 'error',
        category: 'timing',
        message: `Phase ${req.name} manquante`
      });
      score -= 10;
    } else if (phase.duration !== req.duration) {
      issues.push({
        id: `T_${req.type}_dur`,
        type: 'warning',
        category: 'timing',
        message: `Phase ${req.name}: ${phase.duration} min au lieu de ${req.duration} min`
      });
      score -= 5;
    }
  }

  // 2. Competency coverage validation
  const targetedCompetencies = new Set<string>();
  workshop.activities.forEach(a => {
    a.competenciesTargeted.forEach(c => targetedCompetencies.add(c));
  });

  for (const comp of context.competencies) {
    if (!targetedCompetencies.has(comp.code)) {
      issues.push({
        id: `C_${comp.code}`,
        type: 'error',
        category: 'competency',
        message: `La compétence ${comp.code} n'est ciblée par aucune activité`
      });
      score -= 15;
    }
  }

  // Check primary competency has sufficient coverage
  const primaryComp = context.competencies.find(c => c.isPrimary);
  if (primaryComp) {
    const primaryCoverage = workshop.competencyCoverage.find(c => c.competencyCode === primaryComp.code);
    if (!primaryCoverage || primaryCoverage.coverageLevel < 60) {
      issues.push({
        id: 'CP1',
        type: 'warning',
        category: 'competency',
        message: `La compétence principale ${primaryComp.code} a une couverture insuffisante`
      });
      suggestions.push({
        id: 'S_CP1',
        type: 'improvement',
        target: primaryComp.code,
        suggestion: 'Ajouter une activité pratique supplémentaire ciblant cette compétence',
        impact: 'high'
      });
      score -= 10;
    }
  }

  // 3. Pedagogical validation
  const bloomDistribution = workshop.activities.reduce((acc, a) => {
    acc[a.bloomLevel] = (acc[a.bloomLevel] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const highLevelActivities = (bloomDistribution[4] || 0) + (bloomDistribution[5] || 0) + (bloomDistribution[6] || 0);
  if (highLevelActivities < workshop.activities.length * 0.4) {
    issues.push({
      id: 'P1',
      type: 'warning',
      category: 'pedagogy',
      message: 'Peu d\'activités de niveau cognitif élevé (analyse, évaluation, création)'
    });
    suggestions.push({
      id: 'S_P1',
      type: 'improvement',
      target: 'activities',
      suggestion: 'Transformer certaines activités de compréhension en activités d\'analyse ou de création',
      impact: 'medium'
    });
    score -= 8;
  }

  // 4. Evaluation validation
  const evaluatedCompetencies = new Set(
    workshop.evaluation.summativeAssessment.criteria.map(c => c.competencyCode)
  );

  for (const comp of context.competencies) {
    if (!evaluatedCompetencies.has(comp.code)) {
      issues.push({
        id: `E_${comp.code}`,
        type: 'warning',
        category: 'evaluation',
        message: `Pas de critère d'évaluation pour la compétence ${comp.code}`
      });
      score -= 5;
    }
  }

  if (workshop.evaluation.formativeAssessments.length < 2) {
    issues.push({
      id: 'E1',
      type: 'info',
      category: 'evaluation',
      message: 'Peu d\'évaluations formatives prévues'
    });
    suggestions.push({
      id: 'S_E1',
      type: 'addition',
      target: 'evaluation',
      suggestion: 'Ajouter des points de vérification intermédiaires (quiz rapide, tour de table)',
      impact: 'medium'
    });
  }

  // 5. Materials validation
  const activitiesWithoutMaterials = workshop.activities.filter(a => a.materials.length === 0);
  if (activitiesWithoutMaterials.length > workshop.activities.length * 0.5) {
    issues.push({
      id: 'M1',
      type: 'info',
      category: 'materials',
      message: 'Plusieurs activités sans matériel spécifié'
    });
  }

  const isValid = !issues.some(i => i.type === 'error') && score >= 70;

  return {
    isValid,
    overallScore: Math.max(0, Math.min(100, score)),
    issues,
    suggestions
  };
}

// ============================================
// WORKSHOP IMPROVEMENT
// ============================================

export async function improveWorkshop(
  workshop: GeneratedWorkshop,
  validationResult: WorkshopValidationResult,
  context: WorkshopGenerationContext
): Promise<GeneratedWorkshop> {
  if (validationResult.isValid && validationResult.overallScore >= 85) {
    return workshop;
  }

  const prompt = `Tu es un expert en ingénierie pédagogique. Voici un atelier de formation qui nécessite des améliorations.

## ATELIER ACTUEL
${JSON.stringify(workshop, null, 2)}

## PROBLÈMES IDENTIFIÉS
${validationResult.issues.map(i => `- [${i.type.toUpperCase()}] ${i.category}: ${i.message}`).join('\n')}

## SUGGESTIONS D'AMÉLIORATION
${validationResult.suggestions.map(s => `- [${s.impact}] ${s.target}: ${s.suggestion}`).join('\n')}

## CONTEXTE
- Durée cible: ${context.duration} minutes
- Compétences ciblées: ${context.competencies.map(c => c.code).join(', ')}
- Format: ${context.format}

## INSTRUCTIONS
Corrige les problèmes identifiés et applique les suggestions pertinentes.
Retourne l'atelier amélioré au format JSON, en conservant la structure existante.
Ne modifie que ce qui est nécessaire pour résoudre les problèmes.

Retourne UNIQUEMENT le JSON amélioré.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textContent = block.text;
        break;
      }
    }

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return workshop; // Return original if can't parse improvement
    }

    const improvedWorkshop = JSON.parse(jsonMatch[0]) as GeneratedWorkshop;
    improvedWorkshop.confidenceScore = calculateWorkshopConfidence(improvedWorkshop, context);

    return improvedWorkshop;
  } catch (error) {
    console.error('Workshop improvement error:', error);
    return workshop;
  }
}

// ============================================
// WORKSHOP QUIZ GENERATION
// ============================================

export interface WorkshopQuiz {
  questions: WorkshopQuizQuestion[];
  metadata: {
    totalQuestions: number;
    qcmCount: number;
    trueFalseCount: number;
    situationCount: number;
    passingScore: number;
    maxAttempts: number;
  };
}

export interface WorkshopQuizQuestion {
  id: string;
  type: 'qcm' | 'true-false' | 'situation';
  text: string;
  objectiveRef: number; // 1-5
  competencyCode: string;
  bloomLevel: number;
  difficulty: 'facile' | 'moyen' | 'difficile';
  choices: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation: string;
  points: number;
  context?: string; // For situation questions
}

function buildWorkshopQuizPrompt(workshop: GeneratedWorkshop, context: WorkshopGenerationContext): string {
  const primaryComp = context.competencies.find(c => c.isPrimary);

  // Extract objectives from activities
  const objectives = workshop.activities
    .filter(a => a.objectives && a.objectives.length > 0)
    .flatMap(a => a.objectives)
    .filter((v, i, arr) => arr.indexOf(v) === i) // Unique
    .slice(0, 5); // Max 5 objectives

  return `Tu es un expert en évaluation pédagogique. Crée un quiz de 10 questions aligné sur cet atelier de formation.

## ATELIER DE RÉFÉRENCE

**Titre**: ${workshop.title}
**Description**: ${workshop.description}
**Compétence principale**: ${primaryComp?.code} - ${primaryComp?.title}
**Durée**: ${context.duration} minutes

**Objectifs d'apprentissage**:
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

**Activités clés**:
${workshop.activities.map(a => `- ${a.name} (Bloom niveau ${a.bloomLevel}): ${a.objectives.join(', ')}`).join('\n')}

**Points clés à retenir**:
${workshop.synthesis.keyTakeaways.map(t => `- ${t}`).join('\n')}

---

## RÈGLES DE GÉNÉRATION DU QUIZ

### Distribution des questions (OBLIGATOIRE):
- **6 QCM** (Questions à Choix Multiple): 4 options, 1 seule correcte
- **2 Vrai/Faux**: Affirmations à valider ou invalider
- **2 Mises en situation**: Scénarios contextualisés avec analyse

### Alignement pédagogique:
- **2 questions par objectif** (si 5 objectifs)
- Progression des niveaux de Bloom dans les questions
- Questions faciles (2), moyennes (5), difficiles (3)

### Format JSON attendu:

\`\`\`json
{
  "questions": [
    {
      "id": "Q1",
      "type": "qcm",
      "text": "Question claire et précise...",
      "objectiveRef": 1,
      "competencyCode": "${primaryComp?.code}",
      "bloomLevel": 3,
      "difficulty": "facile",
      "choices": [
        { "id": "A", "text": "Option A", "isCorrect": false },
        { "id": "B", "text": "Option B", "isCorrect": true },
        { "id": "C", "text": "Option C", "isCorrect": false },
        { "id": "D", "text": "Option D", "isCorrect": false }
      ],
      "explanation": "Explication pédagogique de la bonne réponse...",
      "points": 1
    },
    {
      "id": "Q7",
      "type": "true-false",
      "text": "Affirmation à évaluer...",
      "objectiveRef": 3,
      "competencyCode": "${primaryComp?.code}",
      "bloomLevel": 4,
      "difficulty": "moyen",
      "choices": [
        { "id": "V", "text": "Vrai", "isCorrect": true },
        { "id": "F", "text": "Faux", "isCorrect": false }
      ],
      "explanation": "Justification de la réponse...",
      "points": 1
    },
    {
      "id": "Q9",
      "type": "situation",
      "text": "Question d'analyse...",
      "context": "Vous êtes conseiller CEP et un bénéficiaire vous présente la situation suivante...",
      "objectiveRef": 5,
      "competencyCode": "${primaryComp?.code}",
      "bloomLevel": 5,
      "difficulty": "difficile",
      "choices": [
        { "id": "A", "text": "Approche A", "isCorrect": false },
        { "id": "B", "text": "Approche B", "isCorrect": false },
        { "id": "C", "text": "Approche C", "isCorrect": true },
        { "id": "D", "text": "Approche D", "isCorrect": false }
      ],
      "explanation": "Analyse de la situation et justification de la meilleure approche...",
      "points": 2
    }
  ],
  "metadata": {
    "totalQuestions": 10,
    "qcmCount": 6,
    "trueFalseCount": 2,
    "situationCount": 2,
    "passingScore": 70,
    "maxAttempts": 3
  }
}
\`\`\`

IMPORTANT:
- Génère exactement 10 questions
- Respecte la distribution: 6 QCM + 2 V/F + 2 situations
- Chaque question doit avoir un lien clair avec le contenu de l'atelier
- Les questions situation doivent inclure un contexte réaliste

Retourne UNIQUEMENT le JSON, sans texte avant ou après.`;
}

export async function generateWorkshopQuiz(
  workshop: GeneratedWorkshop,
  context: WorkshopGenerationContext
): Promise<WorkshopQuiz> {
  const prompt = buildWorkshopQuizPrompt(workshop, context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let textContent = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textContent = block.text;
        break;
      }
    }

    // Parse JSON from response
    const jsonMatch = textContent.match(/```json\n?([\s\S]*?)\n?```/) ||
                      textContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No valid JSON found in quiz response');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const quiz = JSON.parse(jsonStr) as WorkshopQuiz;

    // Validate quiz structure
    if (!quiz.questions || !Array.isArray(quiz.questions)) {
      throw new Error('Invalid quiz structure: missing questions array');
    }

    // Ensure metadata exists
    if (!quiz.metadata) {
      quiz.metadata = {
        totalQuestions: quiz.questions.length,
        qcmCount: quiz.questions.filter(q => q.type === 'qcm').length,
        trueFalseCount: quiz.questions.filter(q => q.type === 'true-false').length,
        situationCount: quiz.questions.filter(q => q.type === 'situation').length,
        passingScore: 70,
        maxAttempts: 3
      };
    }

    return quiz;
  } catch (error) {
    console.error('Workshop quiz generation error:', error);
    throw error;
  }
}

export default {
  generateWorkshop,
  validateWorkshop,
  improveWorkshop,
  generateWorkshopQuiz
};
