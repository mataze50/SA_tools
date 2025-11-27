/**
 * Workshop SCORM Export Service
 * Handles SCORM package generation from workshop data
 */

import archiver from 'archiver';
import { Writable } from 'stream';
import { prisma } from '../../lib/prisma';
import { ScormExportConfig, ScormExportResult, ScormModuleData, ModuleSection, QuizConfig } from '../types/scorm.types';

export interface WorkshopScormExportOptions {
  workshopId: string;
  userId: string;
  version?: '1.2' | '2004-3rd' | '2004-4th';
  organization?: string;
  masteryScore?: number;
}

interface WorkshopForScorm {
  id: string;
  title: string;
  description: string;
  duration: number;
  format: string;
  confidenceScore: number;
  status: string;
  introduction: any;
  timeline: any[];
  activities: any[];
  materials: any[];
  evaluation: any;
  trainerNotes: any;
  synthesis: any;
  competencies: Array<{
    competency: {
      id: string;
      code: string;
      title: string;
      axis?: string;
    };
    isPrimary: boolean;
  }>;
  user: {
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
}

/**
 * Export a workshop as SCORM package
 */
export async function exportWorkshopAsScorm(
  options: WorkshopScormExportOptions
): Promise<{ result: ScormExportResult; buffer?: Buffer }> {
  const {
    workshopId,
    userId,
    version = '1.2',
    organization = 'HARMONIA GROUP',
    masteryScore = 80
  } = options;

  // 1. Fetch workshop with all related data
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      competencies: {
        include: {
          competency: true
        }
      }
    }
  });

  if (!workshop) {
    return {
      result: {
        success: false,
        error: 'Atelier non trouve'
      }
    };
  }

  // Verify access
  if (workshop.userId !== userId && workshop.status !== 'VALIDATED') {
    return {
      result: {
        success: false,
        error: 'Acces non autorise'
      }
    };
  }

  // 2. Transform to SCORM-compatible format
  const workshopForScorm = mapWorkshopToScormFormat(workshop);

  // 3. Validate workshop
  const validation = validateWorkshopForScorm(workshopForScorm);
  if (!validation.valid) {
    return {
      result: {
        success: false,
        error: `Atelier invalide: ${validation.errors.join(', ')}`
      }
    };
  }

  // 4. Build export config
  const config: ScormExportConfig = {
    version,
    organization,
    language: 'fr',
    masteryScore,
    typicalDuration: `PT${workshop.duration || 120}M`,
    maxAttempts: 3,
    outputPath: ''
  };

  // 5. Generate SCORM package
  try {
    const moduleData = workshopToScormData(workshopForScorm);
    const htmlContent = generateWorkshopHtml(moduleData, config, workshopForScorm);
    const manifest = generateWorkshopManifest(moduleData, config);
    const cssContent = generateWorkshopCss();

    const buffer = await createWorkshopZipBuffer(manifest, htmlContent, cssContent, moduleData);

    const primaryCompetency = workshopForScorm.competencies.find(c => c.isPrimary);
    const fileName = sanitizeFileName(
      `ATELIER_${primaryCompetency?.competency.code || 'WS'}_${workshop.title}_SCORM${version.replace(/[.-]/g, '')}`
    ) + '.zip';

    // Log export
    await logWorkshopScormExport(workshopId, userId, version, true);

    return {
      result: {
        success: true,
        fileName,
        fileSize: buffer.length,
        manifest
      },
      buffer
    };
  } catch (error) {
    console.error('Workshop SCORM build error:', error);
    await logWorkshopScormExport(workshopId, userId, version, false);
    return {
      result: {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    };
  }
}

/**
 * Map Prisma workshop to WorkshopForScorm type
 */
function mapWorkshopToScormFormat(workshop: any): WorkshopForScorm {
  return {
    id: workshop.id,
    title: workshop.title,
    description: workshop.description || '',
    duration: workshop.duration || 120,
    format: workshop.format || 'IN_PERSON',
    confidenceScore: workshop.confidenceScore || 0,
    status: workshop.status,
    introduction: workshop.introduction || {},
    timeline: workshop.timeline || [],
    activities: workshop.activities || [],
    materials: workshop.materials || [],
    evaluation: workshop.evaluation || {},
    trainerNotes: workshop.trainerNotes || {},
    synthesis: workshop.synthesis || {},
    competencies: workshop.competencies.map((wc: any) => ({
      competency: {
        id: wc.competency.id,
        code: wc.competency.code,
        title: wc.competency.title,
        axis: wc.competency.axis
      },
      isPrimary: wc.isPrimary
    })),
    user: {
      firstName: workshop.user?.firstName || 'Auteur',
      lastName: workshop.user?.lastName || ''
    },
    createdAt: workshop.createdAt
  };
}

/**
 * Validate workshop for SCORM export
 */
function validateWorkshopForScorm(workshop: WorkshopForScorm): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!workshop.title || workshop.title.length < 3) {
    errors.push('Titre manquant ou trop court');
  }

  if (!workshop.timeline || workshop.timeline.length === 0) {
    errors.push('Deroulé manquant');
  }

  if (!workshop.activities || workshop.activities.length === 0) {
    errors.push('Activites manquantes');
  }

  if (!workshop.competencies || workshop.competencies.length === 0) {
    errors.push('Competences manquantes');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Transform workshop to SCORM module data
 */
function workshopToScormData(workshop: WorkshopForScorm): ScormModuleData {
  const sections: ModuleSection[] = [];
  let order = 0;

  // Intro section
  sections.push({
    id: 'intro',
    type: 'intro',
    title: 'Bienvenue',
    content: {
      workshopTitle: workshop.title,
      description: workshop.description,
      duration: workshop.duration,
      objectives: workshop.introduction?.objectives || [],
      hook: workshop.introduction?.hook || '',
      competencies: workshop.competencies.map(c => ({
        code: c.competency.code,
        title: c.competency.title,
        isPrimary: c.isPrimary
      }))
    },
    order: order++
  });

  // Objectives section
  if (workshop.introduction?.objectives?.length > 0) {
    sections.push({
      id: 'objectives',
      type: 'objectives',
      title: 'Objectifs pedagogiques',
      content: {
        objectives: workshop.introduction.objectives
      },
      order: order++
    });
  }

  // Timeline/Phases section
  sections.push({
    id: 'timeline',
    type: 'timeline',
    title: 'Deroulé de l\'atelier',
    content: {
      phases: workshop.timeline,
      totalDuration: workshop.duration
    },
    order: order++
  });

  // Activities sections (one per activity for detailed exploration)
  workshop.activities.forEach((activity, idx) => {
    sections.push({
      id: `activity_${idx}`,
      type: 'situations' as any, // Reusing situations type for activities
      title: activity.title,
      content: {
        activity,
        index: idx + 1,
        total: workshop.activities.length
      },
      order: order++,
      duration: activity.duration
    });
  });

  // Evaluation section
  if (workshop.evaluation?.criteria?.length > 0) {
    sections.push({
      id: 'evaluation',
      type: 'resources' as any,
      title: 'Evaluation',
      content: {
        criteria: workshop.evaluation.criteria,
        methods: workshop.evaluation.methods || []
      },
      order: order++
    });
  }

  // Synthesis section
  sections.push({
    id: 'synthesis',
    type: 'completion',
    title: 'Synthese',
    content: {
      keyTakeaways: workshop.synthesis?.keyTakeaways || [],
      nextSteps: workshop.synthesis?.nextSteps || [],
      resources: workshop.synthesis?.resources || []
    },
    order: order++
  });

  const primaryCompetency = workshop.competencies.find(c => c.isPrimary) || workshop.competencies[0];

  return {
    moduleId: workshop.id,
    title: workshop.title,
    description: workshop.description,
    version: '1.0',
    sections,
    quiz: {
      questions: [],
      passingScore: 80,
      maxAttempts: 3,
      shuffleQuestions: false,
      shuffleOptions: false,
      showFeedback: true,
      showCorrectAnswers: true
    },
    resources: workshop.materials.map((mat: any, idx: number) => ({
      id: `mat_${idx}`,
      type: 'document' as const,
      title: typeof mat === 'string' ? mat : mat.name,
      description: typeof mat === 'object' ? mat.description : undefined
    })),
    metadata: {
      author: `${workshop.user.firstName} ${workshop.user.lastName}`,
      organization: 'HARMONIA GROUP',
      createdAt: workshop.createdAt.toISOString(),
      competenceCode: primaryCompetency?.competency.code || 'ATELIER',
      competenceLabel: primaryCompetency?.competency.title || workshop.title,
      confidenceScore: workshop.confidenceScore,
      keywords: workshop.competencies.map(c => c.competency.code)
    },
    config: {
      theme: 'harmonia',
      primaryColor: '#7c3aed',
      showProgress: true,
      allowNavigation: true,
      saveProgress: true,
      autoComplete: false
    }
  };
}

/**
 * Generate workshop SCORM manifest
 */
function generateWorkshopManifest(moduleData: ScormModuleData, config: ScormExportConfig): string {
  const identifier = `ATELIER_${moduleData.moduleId.replace(/-/g, '_')}`;

  if (config.version === '1.2') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="ORG_${identifier}">
    <organization identifier="ORG_${identifier}">
      <title>${escapeXml(moduleData.title)}</title>
      <item identifier="ITEM_${identifier}" identifierref="RES_${identifier}">
        <title>${escapeXml(moduleData.title)}</title>
        <adlcp:masteryscore>${config.masteryScore}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RES_${identifier}" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="assets/styles.css"/>
    </resource>
  </resources>
</manifest>`;
  }

  // SCORM 2004
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="1.0"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 ${config.version === '2004-4th' ? '4th' : '3rd'} Edition</schemaversion>
  </metadata>

  <organizations default="ORG_${identifier}">
    <organization identifier="ORG_${identifier}">
      <title>${escapeXml(moduleData.title)}</title>
      <item identifier="ITEM_${identifier}" identifierref="RES_${identifier}">
        <title>${escapeXml(moduleData.title)}</title>
        <imsss:sequencing>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RES_${identifier}" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html"/>
      <file href="assets/styles.css"/>
    </resource>
  </resources>
</manifest>`;
}

/**
 * Generate workshop HTML content
 */
function generateWorkshopHtml(moduleData: ScormModuleData, config: ScormExportConfig, workshop: WorkshopForScorm): string {
  const sectionsJson = JSON.stringify(moduleData.sections);
  const configJson = JSON.stringify({
    masteryScore: config.masteryScore,
    maxAttempts: config.maxAttempts,
    version: config.version
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(moduleData.title)}</title>
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <div class="module-container" id="app">
    <!-- Header -->
    <header class="module-header">
      <div class="competence-badges">
        ${workshop.competencies.map(c => `
          <span class="competence-badge ${c.isPrimary ? 'primary' : ''}">
            ${c.isPrimary ? '★ ' : ''}${escapeHtml(c.competency.code)}
          </span>
        `).join('')}
      </div>
      <h1 class="module-title">${escapeHtml(moduleData.title)}</h1>
      <div class="module-meta">
        <span>⏱ ${moduleData.metadata.competenceLabel}</span>
        <span>📍 ${workshop.format === 'IN_PERSON' ? 'Presentiel' : workshop.format === 'REMOTE_SYNC' ? 'Distanciel synchrone' : 'Hybride'}</span>
        <span>⏰ ${workshop.duration} min</span>
      </div>
      <div class="learner-welcome" id="learnerWelcome"></div>
    </header>

    <!-- Progress -->
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill" style="width: 0%"></div>
      </div>
      <div class="progress-steps" id="progressSteps"></div>
    </div>

    <!-- Content -->
    <main class="module-content" id="moduleContent">
      <div id="sectionContent"></div>
    </main>

    <!-- Navigation -->
    <nav class="module-nav">
      <button class="nav-btn secondary" id="prevBtn" onclick="navigate(-1)">Precedent</button>
      <div class="nav-info">
        <span id="sectionInfo">1 / ${moduleData.sections.length}</span>
      </div>
      <button class="nav-btn primary" id="nextBtn" onclick="navigate(1)">Suivant</button>
    </nav>
  </div>

  <script>
    // SCORM API Wrapper
    var API = null;
    var API_1484_11 = null;
    var scormVersion = '${config.version}';
    var isScormInitialized = false;

    function findAPI(win) {
      var attempts = 0;
      while ((win.API == null && win.API_1484_11 == null) && win.parent != null && win.parent != win) {
        attempts++;
        if (attempts > 10) return null;
        win = win.parent;
      }
      return win.API || win.API_1484_11;
    }

    function initScorm() {
      API = findAPI(window);
      if (!API) API = findAPI(window.opener);

      if (API) {
        var result = scormVersion.startsWith('2004')
          ? API.Initialize("")
          : (API.LMSInitialize ? API.LMSInitialize("") : "true");
        isScormInitialized = result === "true" || result === true;

        if (isScormInitialized) {
          var learnerName = getValue('cmi.core.student_name') || getValue('cmi.learner_name') || 'Apprenant';
          document.getElementById('learnerWelcome').textContent = 'Bienvenue, ' + learnerName.split(',').reverse().join(' ').trim();
          loadProgress();
        }
      }
      return isScormInitialized;
    }

    function getValue(element) {
      if (!API) return '';
      try {
        return scormVersion.startsWith('2004') ? API.GetValue(element) : API.LMSGetValue(element);
      } catch(e) { return ''; }
    }

    function setValue(element, value) {
      if (!API) return;
      try {
        if (scormVersion.startsWith('2004')) {
          API.SetValue(element, value);
        } else {
          API.LMSSetValue(element, value);
        }
      } catch(e) {}
    }

    function commit() {
      if (!API) return;
      try {
        scormVersion.startsWith('2004') ? API.Commit("") : API.LMSCommit("");
      } catch(e) {}
    }

    // Module State
    var sections = ${sectionsJson};
    var config = ${configJson};
    var currentIndex = 0;
    var visitedSections = new Set([0]);
    var completedSections = new Set();

    function loadProgress() {
      var suspendData = getValue(scormVersion.startsWith('2004') ? 'cmi.suspend_data' : 'cmi.core.suspend_data');
      if (suspendData) {
        try {
          var data = JSON.parse(suspendData);
          currentIndex = data.currentIndex || 0;
          visitedSections = new Set(data.visited || [0]);
          completedSections = new Set(data.completed || []);
        } catch(e) {}
      }
      renderSection();
    }

    function saveProgress() {
      var suspendData = JSON.stringify({
        currentIndex: currentIndex,
        visited: Array.from(visitedSections),
        completed: Array.from(completedSections)
      });
      setValue(scormVersion.startsWith('2004') ? 'cmi.suspend_data' : 'cmi.core.suspend_data', suspendData);

      var progress = Math.round((completedSections.size / sections.length) * 100);
      if (scormVersion.startsWith('2004')) {
        setValue('cmi.progress_measure', (progress / 100).toFixed(2));
      }
      commit();
    }

    function navigate(direction) {
      var newIndex = currentIndex + direction;
      if (newIndex >= 0 && newIndex < sections.length) {
        completedSections.add(currentIndex);
        currentIndex = newIndex;
        visitedSections.add(currentIndex);
        renderSection();
        saveProgress();

        if (currentIndex === sections.length - 1 && completedSections.size >= sections.length - 1) {
          completeModule();
        }
      }
    }

    function goToSection(index) {
      if (visitedSections.has(index) || index <= Math.max(...visitedSections) + 1) {
        completedSections.add(currentIndex);
        currentIndex = index;
        visitedSections.add(currentIndex);
        renderSection();
        saveProgress();
      }
    }

    function completeModule() {
      if (scormVersion.startsWith('2004')) {
        setValue('cmi.completion_status', 'completed');
        setValue('cmi.success_status', 'passed');
        setValue('cmi.score.scaled', '1');
        setValue('cmi.score.raw', '100');
      } else {
        setValue('cmi.core.lesson_status', 'completed');
        setValue('cmi.core.score.raw', '100');
      }
      commit();
    }

    function renderSection() {
      var section = sections[currentIndex];
      var content = '';

      switch(section.type) {
        case 'intro':
          content = renderIntro(section);
          break;
        case 'objectives':
          content = renderObjectives(section);
          break;
        case 'timeline':
          content = renderTimeline(section);
          break;
        case 'situations':
          content = renderActivity(section);
          break;
        case 'resources':
          content = renderEvaluation(section);
          break;
        case 'completion':
          content = renderSynthesis(section);
          break;
        default:
          content = '<p>' + section.title + '</p>';
      }

      document.getElementById('sectionContent').innerHTML = content;
      document.getElementById('sectionInfo').textContent = (currentIndex + 1) + ' / ' + sections.length;

      // Update progress
      var progress = Math.round(((currentIndex + 1) / sections.length) * 100);
      document.getElementById('progressFill').style.width = progress + '%';

      // Update navigation
      document.getElementById('prevBtn').disabled = currentIndex === 0;
      document.getElementById('nextBtn').textContent = currentIndex === sections.length - 1 ? 'Terminer' : 'Suivant';

      renderProgressSteps();
    }

    function renderProgressSteps() {
      var stepsHtml = sections.map(function(s, i) {
        var status = completedSections.has(i) ? 'completed' : (i === currentIndex ? 'current' : (visitedSections.has(i) ? 'visited' : ''));
        return '<div class="progress-step" onclick="goToSection(' + i + ')">' +
          '<div class="step-dot ' + status + '"></div>' +
          '<span class="step-label">' + (i + 1) + '</span>' +
        '</div>';
      }).join('');
      document.getElementById('progressSteps').innerHTML = stepsHtml;
    }

    function renderIntro(section) {
      var c = section.content;
      return '<div class="intro-content">' +
        '<div class="intro-icon">🎯</div>' +
        '<h2 class="section-title">Bienvenue dans cet atelier</h2>' +
        '<p class="intro-description">' + escapeHtml(c.description || c.hook || '') + '</p>' +
        '<div class="intro-stats">' +
          '<div class="stat-item"><div class="stat-value">' + c.duration + '</div><div class="stat-label">minutes</div></div>' +
          '<div class="stat-item"><div class="stat-value">' + (c.objectives?.length || 0) + '</div><div class="stat-label">objectifs</div></div>' +
          '<div class="stat-item"><div class="stat-value">' + c.competencies.length + '</div><div class="stat-label">competences</div></div>' +
        '</div>' +
        '<div class="competencies-list">' +
          c.competencies.map(function(comp) {
            return '<span class="competency-tag ' + (comp.isPrimary ? 'primary' : '') + '">' +
              (comp.isPrimary ? '★ ' : '') + escapeHtml(comp.code) + ' - ' + escapeHtml(comp.title) + '</span>';
          }).join('') +
        '</div>' +
      '</div>';
    }

    function renderObjectives(section) {
      var objectives = section.content.objectives || [];
      return '<h2 class="section-title">Objectifs pedagogiques</h2>' +
        '<div class="objectives-list">' +
        objectives.map(function(obj, i) {
          return '<div class="objective-card">' +
            '<div class="objective-header">' +
              '<span class="objective-number">Objectif ' + (i + 1) + '</span>' +
            '</div>' +
            '<p class="objective-text">' + escapeHtml(obj) + '</p>' +
          '</div>';
        }).join('') +
        '</div>';
    }

    function renderTimeline(section) {
      var phases = section.content.phases || [];
      var totalDuration = phases.reduce(function(acc, p) { return acc + (p.duration || 0); }, 0);

      return '<h2 class="section-title">Deroulé de l\\'atelier</h2>' +
        '<div class="timeline-bar">' +
        phases.map(function(phase) {
          var width = ((phase.duration || 0) / totalDuration * 100).toFixed(1);
          return '<div class="timeline-segment" style="width: ' + width + '%" title="' + escapeHtml(phase.name) + '">' +
            phase.duration + 'min</div>';
        }).join('') +
        '</div>' +
        '<div class="phases-list">' +
        phases.map(function(phase, i) {
          return '<div class="phase-card" onclick="this.classList.toggle(\\'expanded\\')">' +
            '<div class="phase-header">' +
              '<span class="phase-title">' + escapeHtml(phase.name) + '</span>' +
              '<span class="phase-duration">' + phase.duration + ' min</span>' +
            '</div>' +
            '<div class="phase-details">' +
              '<p>' + escapeHtml(phase.description || '') + '</p>' +
            '</div>' +
          '</div>';
        }).join('') +
        '</div>';
    }

    function renderActivity(section) {
      var activity = section.content.activity;
      var index = section.content.index;
      var total = section.content.total;

      return '<h2 class="section-title">Activite ' + index + '/' + total + ': ' + escapeHtml(activity.title) + '</h2>' +
        '<div class="activity-detail">' +
          '<div class="activity-meta">' +
            '<span class="duration-badge">⏱ ' + activity.duration + ' min</span>' +
            '<span class="type-badge">' + escapeHtml(activity.type || 'Activite') + '</span>' +
            (activity.bloomLevel ? '<span class="bloom-badge">Bloom: ' + activity.bloomLevel + '</span>' : '') +
          '</div>' +
          '<div class="activity-description">' +
            '<h3>Description</h3>' +
            '<p>' + escapeHtml(activity.description || '') + '</p>' +
          '</div>' +
          (activity.instructions?.length ?
            '<div class="activity-instructions">' +
              '<h3>Deroulement</h3>' +
              '<ol>' + activity.instructions.map(function(inst) {
                return '<li>' + escapeHtml(inst) + '</li>';
              }).join('') + '</ol>' +
            '</div>' : '') +
          (activity.materials?.length ?
            '<div class="activity-materials">' +
              '<h3>Materiels necessaires</h3>' +
              '<ul>' + activity.materials.map(function(mat) {
                return '<li>' + escapeHtml(mat) + '</li>';
              }).join('') + '</ul>' +
            '</div>' : '') +
        '</div>';
    }

    function renderEvaluation(section) {
      var criteria = section.content.criteria || [];
      var methods = section.content.methods || [];

      return '<h2 class="section-title">Evaluation</h2>' +
        '<div class="evaluation-content">' +
          '<h3>Criteres d\\'evaluation</h3>' +
          '<div class="criteria-list">' +
          criteria.map(function(crit, i) {
            var name = typeof crit === 'string' ? crit : crit.name;
            return '<div class="criterion-card">' +
              '<span class="criterion-number">' + (i + 1) + '</span>' +
              '<span class="criterion-text">' + escapeHtml(name) + '</span>' +
            '</div>';
          }).join('') +
          '</div>' +
          (methods.length ?
            '<h3>Methodes d\\'evaluation</h3>' +
            '<div class="methods-list">' +
            methods.map(function(method) {
              return '<div class="method-card">' +
                '<strong>' + escapeHtml(method.name) + '</strong>' +
                '<p>' + escapeHtml(method.description || '') + '</p>' +
              '</div>';
            }).join('') +
            '</div>' : '') +
        '</div>';
    }

    function renderSynthesis(section) {
      var takeaways = section.content.keyTakeaways || [];
      var nextSteps = section.content.nextSteps || [];

      return '<div class="synthesis-content">' +
        '<div class="completion-icon">🎉</div>' +
        '<h2 class="section-title">Synthese</h2>' +
        '<p class="synthesis-intro">Felicitations ! Vous avez termine cet atelier.</p>' +
        (takeaways.length ?
          '<div class="takeaways-section">' +
            '<h3>Points cles a retenir</h3>' +
            '<ul class="takeaways-list">' +
            takeaways.map(function(t) {
              return '<li>✓ ' + escapeHtml(t) + '</li>';
            }).join('') +
            '</ul>' +
          '</div>' : '') +
        (nextSteps.length ?
          '<div class="next-steps-section">' +
            '<h3>Prochaines etapes</h3>' +
            '<ul class="next-steps-list">' +
            nextSteps.map(function(s) {
              return '<li>→ ' + escapeHtml(s) + '</li>';
            }).join('') +
            '</ul>' +
          '</div>' : '') +
      '</div>';
    }

    function escapeHtml(text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Initialize
    window.onload = function() {
      initScorm();
      renderSection();
    };

    window.onunload = function() {
      if (API) {
        saveProgress();
        try {
          scormVersion.startsWith('2004') ? API.Terminate("") : API.LMSFinish("");
        } catch(e) {}
      }
    };
  </script>
</body>
</html>`;
}

/**
 * Generate workshop CSS
 */
function generateWorkshopCss(): string {
  return `/* Workshop SCORM Styles - ATELIER FORGE */
:root {
  --primary: #7c3aed;
  --primary-light: #ede9fe;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-500: #6b7280;
  --gray-700: #374151;
  --gray-900: #111827;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: var(--gray-900);
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
}

.module-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.module-header {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}

.competence-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }

.competence-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.competence-badge.primary {
  background: var(--primary);
  color: white;
}

.module-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: 8px;
}

.module-meta {
  display: flex;
  gap: 20px;
  color: var(--gray-500);
  font-size: 14px;
}

.learner-welcome {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--gray-200);
  color: var(--gray-700);
}

.progress-container {
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.progress-bar {
  height: 8px;
  background: var(--gray-200);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #a78bfa);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-steps { display: flex; justify-content: space-between; }

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.step-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--gray-300);
  transition: all 0.2s;
}

.step-dot.visited { background: var(--primary-light); border: 2px solid var(--primary); }
.step-dot.completed { background: var(--success); }
.step-dot.current { background: var(--primary); transform: scale(1.3); }

.step-label { font-size: 11px; color: var(--gray-500); }

.module-content {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}

.section-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 3px solid var(--primary);
}

.intro-content { text-align: center; padding: 20px; }
.intro-icon { font-size: 56px; margin-bottom: 20px; }
.intro-description { color: var(--gray-600); max-width: 600px; margin: 0 auto 24px; }

.intro-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin: 32px 0;
}

.stat-item { text-align: center; }
.stat-value { font-size: 32px; font-weight: 700; color: var(--primary); }
.stat-label { font-size: 13px; color: var(--gray-500); }

.competencies-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 24px; }

.competency-tag {
  padding: 8px 16px;
  background: var(--gray-100);
  border-radius: 8px;
  font-size: 14px;
  color: var(--gray-700);
}

.competency-tag.primary {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 600;
}

.objective-card {
  background: var(--gray-50);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  border-left: 4px solid var(--primary);
}

.objective-header { margin-bottom: 8px; }
.objective-number { font-weight: 600; color: var(--primary); }
.objective-text { color: var(--gray-700); }

.timeline-bar {
  display: flex;
  height: 32px;
  background: var(--gray-100);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 24px;
}

.timeline-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  opacity: 0.7;
  font-size: 11px;
  color: white;
  font-weight: 500;
  transition: all 0.2s;
}

.timeline-segment:hover { opacity: 1; }

.phase-card {
  background: var(--gray-50);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.phase-card:hover { background: var(--primary-light); }

.phase-header { display: flex; justify-content: space-between; align-items: center; }
.phase-title { font-weight: 600; color: var(--gray-900); }

.phase-duration {
  background: var(--primary);
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
}

.phase-details {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s;
}

.phase-card.expanded .phase-details {
  max-height: 200px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--gray-200);
}

.activity-detail { padding: 20px 0; }

.activity-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.duration-badge, .type-badge, .bloom-badge {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.duration-badge { background: var(--primary-light); color: var(--primary); }
.type-badge { background: var(--gray-100); color: var(--gray-700); }
.bloom-badge { background: #fef3c7; color: #92400e; }

.activity-description, .activity-instructions, .activity-materials {
  margin-bottom: 24px;
}

.activity-description h3, .activity-instructions h3, .activity-materials h3 {
  font-size: 16px;
  color: var(--gray-700);
  margin-bottom: 12px;
}

.activity-instructions ol, .activity-materials ul {
  padding-left: 24px;
}

.activity-instructions li, .activity-materials li {
  margin: 8px 0;
  color: var(--gray-600);
}

.evaluation-content h3 {
  font-size: 16px;
  color: var(--gray-700);
  margin: 24px 0 16px;
}

.criteria-list { display: flex; flex-direction: column; gap: 12px; }

.criterion-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--gray-50);
  border-radius: 12px;
}

.criterion-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  font-weight: 600;
}

.method-card {
  padding: 16px;
  background: var(--gray-50);
  border-radius: 12px;
  margin-bottom: 12px;
}

.method-card strong { color: var(--gray-900); }
.method-card p { color: var(--gray-600); margin-top: 8px; }

.synthesis-content { text-align: center; padding: 20px; }
.completion-icon { font-size: 64px; margin-bottom: 16px; }
.synthesis-intro { color: var(--gray-600); margin-bottom: 32px; }

.takeaways-section, .next-steps-section {
  text-align: left;
  max-width: 500px;
  margin: 24px auto;
}

.takeaways-section h3, .next-steps-section h3 {
  font-size: 16px;
  color: var(--gray-700);
  margin-bottom: 16px;
}

.takeaways-list, .next-steps-list {
  list-style: none;
}

.takeaways-list li, .next-steps-list li {
  padding: 12px 16px;
  background: var(--gray-50);
  border-radius: 8px;
  margin: 8px 0;
  color: var(--gray-700);
}

.module-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border-radius: 12px;
  padding: 16px 24px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.nav-info { color: var(--gray-500); font-size: 14px; }

.nav-btn {
  padding: 12px 28px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn.secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.nav-btn.secondary:hover:not(:disabled) { background: var(--gray-200); }

.nav-btn.primary {
  background: var(--primary);
  color: white;
}

.nav-btn.primary:hover:not(:disabled) { background: #6d28d9; }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 600px) {
  .module-container { padding: 12px; }
  .module-content { padding: 20px; }
  .intro-stats { flex-direction: column; gap: 16px; }
  .module-meta { flex-direction: column; gap: 8px; }
  .activity-meta { flex-wrap: wrap; }
}`;
}

/**
 * Create ZIP buffer
 */
async function createWorkshopZipBuffer(
  manifest: string,
  htmlContent: string,
  cssContent: string,
  moduleData: ScormModuleData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const writableStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      }
    });

    const archive = archiver('zip', { zlib: { level: 9 } });

    writableStream.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', reject);
    archive.pipe(writableStream);

    archive.append(manifest, { name: 'imsmanifest.xml' });
    archive.append(htmlContent, { name: 'index.html' });
    archive.append(cssContent, { name: 'assets/styles.css' });
    archive.append(JSON.stringify(moduleData, null, 2), { name: 'assets/module-data.json' });

    archive.finalize();
  });
}

/**
 * Log workshop SCORM export
 */
async function logWorkshopScormExport(
  workshopId: string,
  userId: string,
  version: string,
  success: boolean
): Promise<void> {
  try {
    await prisma.exportLog.create({
      data: {
        workshopId,
        userId,
        exportType: 'SCORM',
        format: version,
        success,
        exportedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log workshop SCORM export:', error);
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 60);
}
