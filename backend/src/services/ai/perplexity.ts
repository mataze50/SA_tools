/**
 * Perplexity AI Service
 * Uses Perplexity Sonar Pro for web-grounded enrichment
 */

export interface EnrichmentData {
  situations: string[];
  bibliography: string[];
  trends: string[];
}

export interface EnrichmentContext {
  competencyCode: string;
  competencyTitle: string;
  sector: string;
  audienceType: string;
}

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

async function callPerplexity(prompt: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.warn('Perplexity API key not configured, using mock data');
    return '';
  }

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Situation Hunter - Find real-world professional situations
 */
export async function findSituations(context: EnrichmentContext): Promise<string[]> {
  const prompt = `Recherche des cas réels et actuels (2023-2025) de situations professionnelles liées à:

**Compétence**: ${context.competencyCode} - ${context.competencyTitle}
**Secteur**: ${context.sector}
**Public**: ${context.audienceType}

Je cherche 4-5 situations réelles et vérifiables:
- Des cas concrets d'entreprises ou de professionnels
- Des défis typiques rencontrés dans ce domaine
- Des exemples qui illustrent les enjeux de cette compétence

Format: Liste numérotée avec titre et description courte (2-3 phrases max par situation).
Sources: Cite tes sources (articles, études, témoignages) quand possible.`;

  const response = await callPerplexity(prompt);

  if (!response) {
    // Return default situations if API not available
    return getDefaultSituations(context);
  }

  // Parse response into array
  const lines = response.split('\n').filter(l => l.trim());
  const situations: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
    if (cleaned.length > 20) {
      situations.push(cleaned);
    }
  }

  return situations.slice(0, 5);
}

/**
 * Bibliography Builder - Find recent sources and references
 */
export async function findBibliography(context: EnrichmentContext): Promise<string[]> {
  const prompt = `Recherche des sources bibliographiques récentes (2022-2025) sur:

**Compétence**: ${context.competencyCode} - ${context.competencyTitle}
**Secteur**: ${context.sector}

Je cherche:
- Articles académiques ou professionnels
- Rapports d'études ou d'organismes
- Ouvrages de référence récents
- Ressources en ligne de qualité

Format: Liste de 5-7 références avec auteur, titre, année et type de source.`;

  const response = await callPerplexity(prompt);

  if (!response) {
    return getDefaultBibliography(context);
  }

  const lines = response.split('\n').filter(l => l.trim());
  const bibliography: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim();
    if (cleaned.length > 10) {
      bibliography.push(cleaned);
    }
  }

  return bibliography.slice(0, 7);
}

/**
 * Trend Spotter - Identify current trends in the field
 */
export async function findTrends(context: EnrichmentContext): Promise<string[]> {
  const prompt = `Quelles sont les tendances actuelles (2024-2025) dans le domaine de:

**Secteur**: ${context.sector}
**Thématique**: ${context.competencyTitle}

Je cherche:
- Évolutions récentes des pratiques
- Nouvelles approches ou méthodologies
- Enjeux émergents pour les professionnels
- Impact des nouvelles technologies (IA, digital, etc.)

Format: Liste de 4-5 tendances clés avec explication courte.`;

  const response = await callPerplexity(prompt);

  if (!response) {
    return getDefaultTrends(context);
  }

  const lines = response.split('\n').filter(l => l.trim());
  const trends: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, '').trim();
    if (cleaned.length > 15) {
      trends.push(cleaned);
    }
  }

  return trends.slice(0, 5);
}

/**
 * Full enrichment - calls all three agents in parallel
 */
export async function enrichContext(context: EnrichmentContext): Promise<EnrichmentData> {
  const [situations, bibliography, trends] = await Promise.all([
    findSituations(context).catch(() => getDefaultSituations(context)),
    findBibliography(context).catch(() => getDefaultBibliography(context)),
    findTrends(context).catch(() => getDefaultTrends(context))
  ]);

  return {
    situations,
    bibliography,
    trends
  };
}

// ============================================
// DEFAULT DATA (fallback when API unavailable)
// ============================================

function getDefaultSituations(context: EnrichmentContext): string[] {
  return [
    `Un professionnel du secteur ${context.sector} fait face à une situation de changement organisationnel nécessitant d'adapter ses compétences en ${context.competencyTitle.toLowerCase()}.`,
    `Une équipe rencontre des difficultés de communication interne, impactant la mise en œuvre de la compétence visée.`,
    `Un consultant accompagne un bénéficiaire dans une transition professionnelle complexe liée à cette thématique.`,
    `Un manager doit gérer un conflit d'équipe en lien avec les pratiques professionnelles de son secteur.`
  ];
}

function getDefaultBibliography(context: EnrichmentContext): string[] {
  return [
    `Guide des bonnes pratiques en ${context.sector} - France Compétences (2024)`,
    `Référentiel des compétences du CEP - DGEFP (2023)`,
    `L'accompagnement professionnel à l'ère du numérique - Éditions Eyrolles (2024)`,
    `Études sur l'évolution des pratiques d'accompagnement - CEREQ (2024)`
  ];
}

function getDefaultTrends(context: EnrichmentContext): string[] {
  return [
    `Digitalisation des pratiques d'accompagnement et usage de l'IA dans le ${context.sector}`,
    `Montée en compétences sur les soft skills et l'intelligence émotionnelle`,
    `Approches personnalisées et centrées sur le bénéficiaire`,
    `Importance croissante de l'éco-responsabilité dans les transitions professionnelles`
  ];
}
