/**
 * SCORM HTML Module Generator
 * Generates a standalone HTML module with embedded SCORM JavaScript
 */

import { ScormExportConfig, ScormModuleData } from '../types/scorm.types';

/**
 * Generate complete HTML module
 */
export function generateModuleHtml(
  moduleData: ScormModuleData,
  config: ScormExportConfig
): string {
  const scormApiScript = generateScormApiScript(config);
  const moduleScript = generateModuleScript(moduleData, config);
  const moduleHtml = generateModuleBody(moduleData);

  return `<!DOCTYPE html>
<html lang="${config.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(moduleData.title)}</title>
  <link rel="stylesheet" href="assets/styles.css">
  <style>
    .hidden { display: none !important; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
</head>
<body>
  <div class="module-container">
    ${moduleHtml}
  </div>

  <script>
    ${scormApiScript}
  </script>
  <script>
    ${moduleScript}
  </script>
</body>
</html>`;
}

/**
 * Generate SCORM API wrapper script
 */
function generateScormApiScript(config: ScormExportConfig): string {
  const is2004 = config.version.startsWith('2004');

  return `
// SCORM API Wrapper
const ScormAPI = (function() {
  const IS_SCORM_2004 = ${is2004};
  let api = null;
  let initialized = false;
  let terminated = false;

  // Find SCORM API
  function findAPI(win) {
    let attempts = 0;
    const maxAttempts = 500;

    while ((!win.API && !win.API_1484_11) && win.parent && win.parent !== win && attempts < maxAttempts) {
      attempts++;
      win = win.parent;
    }

    if (IS_SCORM_2004) {
      return win.API_1484_11 || null;
    }
    return win.API || null;
  }

  function getAPI() {
    if (api) return api;

    api = findAPI(window);
    if (!api && window.opener) {
      api = findAPI(window.opener);
    }

    return api;
  }

  // SCORM 1.2 API methods
  const scorm12 = {
    initialize: () => api?.LMSInitialize?.('') === 'true',
    terminate: () => api?.LMSFinish?.('') === 'true',
    getValue: (element) => api?.LMSGetValue?.(element) || '',
    setValue: (element, value) => api?.LMSSetValue?.(element, String(value)) === 'true',
    commit: () => api?.LMSCommit?.('') === 'true',
    getLastError: () => api?.LMSGetLastError?.() || '0'
  };

  // SCORM 2004 API methods
  const scorm2004 = {
    initialize: () => api?.Initialize?.('') === 'true',
    terminate: () => api?.Terminate?.('') === 'true',
    getValue: (element) => api?.GetValue?.(element) || '',
    setValue: (element, value) => api?.SetValue?.(element, String(value)) === 'true',
    commit: () => api?.Commit?.('') === 'true',
    getLastError: () => api?.GetLastError?.() || '0'
  };

  const methods = IS_SCORM_2004 ? scorm2004 : scorm12;

  // Element mapping 1.2 <-> 2004
  const elementMap = IS_SCORM_2004 ? {
    'cmi.core.lesson_status': 'cmi.completion_status',
    'cmi.core.score.raw': 'cmi.score.raw',
    'cmi.core.score.min': 'cmi.score.min',
    'cmi.core.score.max': 'cmi.score.max',
    'cmi.core.session_time': 'cmi.session_time',
    'cmi.core.lesson_location': 'cmi.location',
    'cmi.suspend_data': 'cmi.suspend_data',
    'cmi.core.student_name': 'cmi.learner_name'
  } : {};

  function mapElement(element) {
    return elementMap[element] || element;
  }

  return {
    init() {
      if (initialized) return true;
      api = getAPI();

      if (!api) {
        console.warn('SCORM API not found - running in standalone mode');
        return false;
      }

      initialized = methods.initialize();

      if (initialized) {
        console.log('SCORM initialized successfully');
        // Set initial status
        this.setValue('cmi.core.lesson_status', 'incomplete');
      }

      return initialized;
    },

    terminate() {
      if (!initialized || terminated) return true;

      this.commit();
      terminated = methods.terminate();
      return terminated;
    },

    getValue(element) {
      if (!initialized) return '';
      return methods.getValue(mapElement(element));
    },

    setValue(element, value) {
      if (!initialized) return false;
      return methods.setValue(mapElement(element), value);
    },

    commit() {
      if (!initialized) return false;
      return methods.commit();
    },

    setScore(score, min = 0, max = 100) {
      this.setValue('cmi.core.score.raw', score);
      this.setValue('cmi.core.score.min', min);
      this.setValue('cmi.core.score.max', max);

      if (IS_SCORM_2004) {
        this.setValue('cmi.score.scaled', score / max);
      }
    },

    setStatus(status) {
      if (IS_SCORM_2004) {
        // 2004 uses completion_status and success_status
        if (status === 'passed' || status === 'failed') {
          this.setValue('cmi.success_status', status);
          this.setValue('cmi.completion_status', 'completed');
        } else {
          this.setValue('cmi.completion_status', status);
        }
      } else {
        this.setValue('cmi.core.lesson_status', status);
      }
    },

    setLocation(location) {
      this.setValue('cmi.core.lesson_location', location);
    },

    getLocation() {
      return this.getValue('cmi.core.lesson_location');
    },

    setSuspendData(data) {
      try {
        const json = JSON.stringify(data);
        this.setValue('cmi.suspend_data', json);
      } catch (e) {
        console.error('Failed to save suspend data:', e);
      }
    },

    getSuspendData() {
      try {
        const data = this.getValue('cmi.suspend_data');
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    },

    setInteraction(index, data) {
      const prefix = \`cmi.interactions.\${index}\`;

      if (data.id) this.setValue(\`\${prefix}.id\`, data.id);
      if (data.type) this.setValue(\`\${prefix}.type\`, data.type);
      if (data.description) this.setValue(\`\${prefix}.description\`, data.description);
      if (data.learner_response !== undefined) {
        this.setValue(\`\${prefix}.learner_response\`, data.learner_response);
      }
      if (data.correct_responses) {
        data.correct_responses.forEach((resp, i) => {
          this.setValue(\`\${prefix}.correct_responses.\${i}.pattern\`, resp);
        });
      }
      if (data.result) this.setValue(\`\${prefix}.result\`, data.result);
      if (data.latency) this.setValue(\`\${prefix}.latency\`, data.latency);
      if (data.timestamp) this.setValue(\`\${prefix}.timestamp\`, data.timestamp);
    },

    getLearnerName() {
      return this.getValue('cmi.core.student_name');
    },

    isConnected() {
      return initialized;
    }
  };
})();
`;
}

/**
 * Generate module controller script
 */
function generateModuleScript(
  moduleData: ScormModuleData,
  config: ScormExportConfig
): string {
  const quizDataJson = JSON.stringify(moduleData.quiz.questions);
  const sectionsJson = JSON.stringify(moduleData.sections.map(s => ({ id: s.id, title: s.title, type: s.type })));
  const passingScore = moduleData.quiz.passingScore;
  const maxAttempts = moduleData.quiz.maxAttempts;

  return `
// Module Controller
const ModuleController = (function() {
  const SECTIONS = ${sectionsJson};
  const QUIZ_DATA = ${quizDataJson};
  const PASSING_SCORE = ${passingScore};
  const MAX_ATTEMPTS = ${maxAttempts};

  let currentSectionIndex = 0;
  let visitedSections = new Set(['intro']);
  let quizState = {
    started: false,
    currentQuestion: 0,
    answers: {},
    score: 0,
    attempts: 0,
    completed: false
  };
  let startTime = Date.now();
  let interactionCount = 0;

  // DOM Elements
  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  // Initialize module
  function init() {
    ScormAPI.init();

    // Restore progress if available
    const suspendData = ScormAPI.getSuspendData();
    if (suspendData) {
      restoreProgress(suspendData);
    }

    // Update learner name
    const learnerName = ScormAPI.getLearnerName();
    const welcomeEl = $('#learner-name');
    if (welcomeEl && learnerName) {
      welcomeEl.textContent = learnerName;
    }

    // Setup navigation
    setupNavigation();

    // Show intro section
    showSection(0);

    // Handle page unload
    window.addEventListener('beforeunload', saveAndTerminate);
  }

  function setupNavigation() {
    // Progress step clicks
    $$('.progress-step').forEach((step, index) => {
      step.addEventListener('click', () => {
        if (canNavigateTo(index)) {
          showSection(index);
        }
      });
    });

    // Nav buttons
    $('#btn-prev')?.addEventListener('click', () => navigateSection(-1));
    $('#btn-next')?.addEventListener('click', () => navigateSection(1));
  }

  function canNavigateTo(index) {
    // Can always go back
    if (index < currentSectionIndex) return true;
    // Can go to next if current is visited
    if (index === currentSectionIndex + 1 && visitedSections.has(SECTIONS[currentSectionIndex].id)) {
      return true;
    }
    // Can go anywhere already visited
    return visitedSections.has(SECTIONS[index]?.id);
  }

  function showSection(index) {
    if (index < 0 || index >= SECTIONS.length) return;

    currentSectionIndex = index;
    const section = SECTIONS[index];
    visitedSections.add(section.id);

    // Hide all sections, show current
    $$('.section-content').forEach(el => el.classList.add('hidden'));
    $(\`#section-\${section.id}\`)?.classList.remove('hidden');

    // Update progress
    updateProgress();

    // Update nav buttons
    updateNavButtons();

    // Save location
    ScormAPI.setLocation(section.id);
    ScormAPI.commit();

    // Initialize quiz section if needed
    if (section.type === 'quiz' && !quizState.started) {
      showQuizIntro();
    }
  }

  function navigateSection(delta) {
    showSection(currentSectionIndex + delta);
  }

  function updateProgress() {
    const progress = ((visitedSections.size) / SECTIONS.length) * 100;
    const progressFill = $('.progress-fill');
    if (progressFill) {
      progressFill.style.width = progress + '%';
    }

    // Update step dots
    $$('.step-dot').forEach((dot, index) => {
      const section = SECTIONS[index];
      dot.classList.remove('visited', 'completed', 'current');

      if (index === currentSectionIndex) {
        dot.classList.add('current');
      } else if (visitedSections.has(section.id)) {
        dot.classList.add('visited');
      }
    });
  }

  function updateNavButtons() {
    const btnPrev = $('#btn-prev');
    const btnNext = $('#btn-next');

    if (btnPrev) {
      btnPrev.disabled = currentSectionIndex === 0;
    }

    if (btnNext) {
      const isLast = currentSectionIndex === SECTIONS.length - 1;
      const isQuiz = SECTIONS[currentSectionIndex].type === 'quiz';

      btnNext.disabled = isLast || (isQuiz && !quizState.completed);
      btnNext.textContent = isLast ? 'Terminer' : 'Suivant';
    }
  }

  // Quiz Functions
  function showQuizIntro() {
    const quizContent = $('#quiz-content');
    if (!quizContent) return;

    quizContent.innerHTML = \`
      <div class="quiz-intro">
        <div class="intro-icon">📝</div>
        <h3>Quiz de validation</h3>
        <p>\${QUIZ_DATA.length} questions pour valider vos acquis</p>
        <ul class="quiz-rules">
          <li>Score minimum requis: \${PASSING_SCORE}%</li>
          <li>Nombre de tentatives: \${MAX_ATTEMPTS}</li>
          <li>Tentatives restantes: \${MAX_ATTEMPTS - quizState.attempts}</li>
        </ul>
        <button class="nav-btn primary" id="btn-start-quiz">Commencer le quiz</button>
      </div>
    \`;

    $('#btn-start-quiz')?.addEventListener('click', startQuiz);
  }

  function startQuiz() {
    if (quizState.attempts >= MAX_ATTEMPTS) {
      alert('Vous avez atteint le nombre maximum de tentatives.');
      return;
    }

    quizState.started = true;
    quizState.currentQuestion = 0;
    quizState.answers = {};
    quizState.attempts++;

    showQuestion(0);
  }

  function showQuestion(index) {
    if (index >= QUIZ_DATA.length) {
      finishQuiz();
      return;
    }

    quizState.currentQuestion = index;
    const question = QUIZ_DATA[index];
    const quizContent = $('#quiz-content');
    if (!quizContent) return;

    const optionsHtml = question.options.map((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      const selected = quizState.answers[question.id] === i ? 'selected' : '';
      return \`
        <button class="option-btn \${selected}" data-index="\${i}">
          <span class="option-letter">\${letter}</span>
          <span class="option-text">\${escapeHtml(opt.text)}</span>
        </button>
      \`;
    }).join('');

    quizContent.innerHTML = \`
      <div class="question-card fade-in">
        <div class="question-header">
          <span class="question-number">Question \${index + 1}/\${QUIZ_DATA.length}</span>
          <span class="question-points">\${question.points} pts</span>
        </div>
        <p class="question-text">\${escapeHtml(question.question)}</p>
        <div class="options-list">
          \${optionsHtml}
        </div>
        <div class="question-nav" style="display: flex; justify-content: space-between; margin-top: 20px;">
          <button class="nav-btn secondary" id="btn-prev-q" \${index === 0 ? 'disabled' : ''}>Precedent</button>
          <button class="nav-btn primary" id="btn-next-q" \${quizState.answers[question.id] === undefined ? 'disabled' : ''}>
            \${index === QUIZ_DATA.length - 1 ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    \`;

    // Option click handlers
    $$('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => selectOption(question.id, parseInt(btn.dataset.index)));
    });

    $('#btn-prev-q')?.addEventListener('click', () => showQuestion(index - 1));
    $('#btn-next-q')?.addEventListener('click', () => showQuestion(index + 1));
  }

  function selectOption(questionId, optionIndex) {
    quizState.answers[questionId] = optionIndex;

    // Update UI
    $$('.option-btn').forEach((btn, i) => {
      btn.classList.toggle('selected', i === optionIndex);
    });

    // Enable next button
    const btnNext = $('#btn-next-q');
    if (btnNext) btnNext.disabled = false;

    // Record interaction
    const question = QUIZ_DATA.find(q => q.id === questionId);
    if (question) {
      const isCorrect = question.correctIndices.includes(optionIndex);
      ScormAPI.setInteraction(interactionCount++, {
        id: questionId,
        type: 'choice',
        description: question.question.substring(0, 255),
        learner_response: String.fromCharCode(65 + optionIndex),
        correct_responses: question.correctIndices.map(i => String.fromCharCode(65 + i)),
        result: isCorrect ? 'correct' : 'incorrect',
        timestamp: new Date().toISOString()
      });
    }
  }

  function finishQuiz() {
    // Calculate score
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    QUIZ_DATA.forEach(question => {
      totalPoints += question.points;
      const answer = quizState.answers[question.id];
      if (answer !== undefined && question.correctIndices.includes(answer)) {
        correctCount++;
        earnedPoints += question.points;
      }
    });

    const scorePercent = Math.round((earnedPoints / totalPoints) * 100);
    quizState.score = scorePercent;
    const passed = scorePercent >= PASSING_SCORE;

    if (passed) {
      quizState.completed = true;
    }

    // Update SCORM
    ScormAPI.setScore(scorePercent, 0, 100);
    ScormAPI.setStatus(passed ? 'passed' : 'failed');
    ScormAPI.commit();

    // Show results
    showQuizResults(scorePercent, correctCount, passed);
  }

  function showQuizResults(score, correctCount, passed) {
    const quizContent = $('#quiz-content');
    if (!quizContent) return;

    const attemptsRemaining = MAX_ATTEMPTS - quizState.attempts;

    quizContent.innerHTML = \`
      <div class="results-header \${passed ? 'passed' : 'failed'}">
        <div class="results-icon">\${passed ? '🎉' : '😔'}</div>
        <h3>\${passed ? 'Felicitations!' : 'Dommage...'}</h3>
        <p>\${passed ? 'Vous avez reussi le quiz!' : 'Le score minimum n\\'est pas atteint.'}</p>

        <div class="score-display">
          <div class="score-value">\${score}%</div>
          <div class="score-bar">
            <div class="score-fill" style="width: \${score}%"></div>
            <div class="passing-marker" style="left: \${PASSING_SCORE}%">\${PASSING_SCORE}%</div>
          </div>
          <p>\${correctCount}/\${QUIZ_DATA.length} bonnes reponses</p>
        </div>

        \${!passed && attemptsRemaining > 0 ? \`
          <p>Tentatives restantes: \${attemptsRemaining}</p>
          <button class="nav-btn primary" id="btn-retry-quiz">Reessayer</button>
        \` : ''}

        \${passed ? \`
          <button class="nav-btn primary" id="btn-continue">Continuer</button>
        \` : ''}
      </div>

      <div style="margin-top: 24px;">
        <h4>Detail des reponses</h4>
        \${generateResultsDetail()}
      </div>
    \`;

    $('#btn-retry-quiz')?.addEventListener('click', () => {
      quizState.started = false;
      showQuizIntro();
    });

    $('#btn-continue')?.addEventListener('click', () => {
      updateNavButtons();
      navigateSection(1);
    });
  }

  function generateResultsDetail() {
    return QUIZ_DATA.map((question, index) => {
      const userAnswer = quizState.answers[question.id];
      const isCorrect = userAnswer !== undefined && question.correctIndices.includes(userAnswer);

      return \`
        <div class="objective-card" style="border-left-color: \${isCorrect ? 'var(--success)' : 'var(--danger)'}">
          <div class="objective-header">
            <span class="objective-number">Q\${index + 1}</span>
            <span style="color: \${isCorrect ? 'var(--success)' : 'var(--danger)'}">
              \${isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </span>
          </div>
          <p style="margin: 8px 0;">\${escapeHtml(question.question)}</p>
          <p style="font-size: 13px; color: var(--gray-500);">
            Votre reponse: \${userAnswer !== undefined ? String.fromCharCode(65 + userAnswer) : '-'}
            | Reponse correcte: \${question.correctIndices.map(i => String.fromCharCode(65 + i)).join(', ')}
          </p>
          \${question.explanation ? \`<p style="font-size: 13px; color: var(--gray-700); margin-top: 8px;"><strong>Explication:</strong> \${escapeHtml(question.explanation)}</p>\` : ''}
        </div>
      \`;
    }).join('');
  }

  // Timeline interactions
  function initTimeline() {
    $$('.phase-card').forEach((card, index) => {
      card.addEventListener('click', () => {
        $$('.phase-card').forEach(c => c.classList.remove('expanded'));
        card.classList.toggle('expanded');

        const details = card.querySelector('.phase-details');
        if (details) {
          details.classList.toggle('hidden');
        }
      });
    });

    $$('.timeline-segment').forEach((segment, index) => {
      segment.addEventListener('click', () => {
        const phaseCards = $$('.phase-card');
        if (phaseCards[index]) {
          phaseCards[index].click();
          phaseCards[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }

  // Situation navigation
  function initSituations() {
    $$('.situation-btn').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        $$('.situation-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        btn.classList.add('viewed');

        $$('.situation-card').forEach((card, i) => {
          card.classList.toggle('hidden', i !== index);
        });
      });
    });
  }

  // Progress save/restore
  function saveProgress() {
    const data = {
      sectionIndex: currentSectionIndex,
      visitedSections: Array.from(visitedSections),
      quizState: quizState,
      timestamp: Date.now()
    };
    ScormAPI.setSuspendData(data);
  }

  function restoreProgress(data) {
    if (data.visitedSections) {
      visitedSections = new Set(data.visitedSections);
    }
    if (data.quizState) {
      quizState = data.quizState;
    }
    if (data.sectionIndex !== undefined) {
      currentSectionIndex = data.sectionIndex;
    }
  }

  function saveAndTerminate() {
    // Calculate session time
    const sessionSeconds = Math.round((Date.now() - startTime) / 1000);
    const hours = Math.floor(sessionSeconds / 3600);
    const minutes = Math.floor((sessionSeconds % 3600) / 60);
    const seconds = sessionSeconds % 60;
    const timeString = \`\${String(hours).padStart(2, '0')}:\${String(minutes).padStart(2, '0')}:\${String(seconds).padStart(2, '0')}\`;

    ScormAPI.setValue('cmi.core.session_time', timeString);
    saveProgress();
    ScormAPI.terminate();
  }

  // Utility
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  return {
    init,
    showSection,
    startQuiz,
    initTimeline,
    initSituations
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  ModuleController.init();
  ModuleController.initTimeline();
  ModuleController.initSituations();
});
`;
}

/**
 * Generate module HTML body structure
 */
function generateModuleBody(moduleData: ScormModuleData): string {
  const intro = moduleData.sections.find(s => s.type === 'intro');
  const objectives = moduleData.sections.find(s => s.type === 'objectives');
  const situations = moduleData.sections.find(s => s.type === 'situations');
  const timeline = moduleData.sections.find(s => s.type === 'timeline');
  const resources = moduleData.sections.find(s => s.type === 'resources');

  return `
    <!-- Header -->
    <header class="module-header">
      <div class="competence-badge">
        <span>📚</span>
        <span>${escapeHtml(moduleData.metadata.competenceCode)} - ${escapeHtml(moduleData.metadata.competenceLabel)}</span>
      </div>
      <h1 class="module-title">${escapeHtml(moduleData.title)}</h1>
      <div class="module-meta">
        <span>⏱️ ${intro?.content?.duration || 0} min</span>
        <span>📋 ${intro?.content?.format || ''}</span>
        <span>👥 ${intro?.content?.audienceType || ''}</span>
      </div>
      <div class="learner-welcome">
        Bienvenue, <span id="learner-name">Apprenant</span>
      </div>
    </header>

    <!-- Progress -->
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="progress-steps">
        ${moduleData.sections.map((section, i) => `
          <div class="progress-step" data-section="${section.id}">
            <div class="step-dot ${i === 0 ? 'current' : ''}"></div>
            <span class="step-label">${getSectionIcon(section.type)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Content Sections -->
    <main class="module-content">
      <!-- Intro Section -->
      <div id="section-intro" class="section-content">
        <h2 class="section-title">Introduction</h2>
        <div class="intro-content">
          <div class="intro-icon">🎯</div>
          <h3>${escapeHtml(moduleData.title)}</h3>
          <p>${escapeHtml(moduleData.description)}</p>

          <div class="intro-stats">
            <div class="stat-item">
              <div class="stat-value">${objectives?.content?.length || 0}</div>
              <div class="stat-label">Objectifs</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${situations?.content?.length || 0}</div>
              <div class="stat-label">Situations</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${moduleData.quiz.questions.length}</div>
              <div class="stat-label">Questions</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Objectives Section -->
      <div id="section-objectives" class="section-content hidden">
        <h2 class="section-title">Objectifs pedagogiques</h2>
        ${generateObjectivesHtml(objectives?.content || [])}
      </div>

      <!-- Situations Section -->
      <div id="section-situations" class="section-content hidden">
        <h2 class="section-title">Situations professionnelles</h2>
        ${generateSituationsHtml(situations?.content || [])}
      </div>

      <!-- Timeline Section -->
      <div id="section-timeline" class="section-content hidden">
        <h2 class="section-title">Deroule de l'atelier</h2>
        ${generateTimelineHtml(timeline?.content || [])}
      </div>

      <!-- Quiz Section -->
      <div id="section-quiz" class="section-content hidden">
        <h2 class="section-title">Quiz de validation</h2>
        <div id="quiz-content">
          <!-- Quiz content dynamically loaded -->
        </div>
      </div>

      <!-- Resources Section -->
      <div id="section-resources" class="section-content hidden">
        <h2 class="section-title">Ressources</h2>
        ${generateResourcesHtml(resources?.content || {})}
      </div>
    </main>

    <!-- Navigation -->
    <nav class="module-nav">
      <button class="nav-btn secondary" id="btn-prev" disabled>Precedent</button>
      <button class="nav-btn primary" id="btn-next">Suivant</button>
    </nav>
  `;
}

/**
 * Generate objectives HTML
 */
function generateObjectivesHtml(objectives: any[]): string {
  if (!objectives || objectives.length === 0) {
    return '<p>Aucun objectif defini.</p>';
  }

  return objectives.map(obj => `
    <div class="objective-card">
      <div class="objective-header">
        <span class="objective-number">Objectif ${obj.numero}</span>
        <span class="bloom-badge">${obj.niveau_bloom || ''}</span>
      </div>
      <p class="objective-text">${escapeHtml(obj.formulation)}</p>
    </div>
  `).join('');
}

/**
 * Generate situations HTML
 */
function generateSituationsHtml(situations: any[]): string {
  if (!situations || situations.length === 0) {
    return '<p>Aucune situation definie.</p>';
  }

  const navButtons = situations.map((sit, i) => `
    <button class="situation-btn ${i === 0 ? 'active' : ''}">${sit.numero}</button>
  `).join('');

  const cards = situations.map((sit, i) => `
    <div class="situation-card ${i !== 0 ? 'hidden' : ''}">
      <h3 class="situation-title">${escapeHtml(sit.titre)}</h3>

      <div class="situation-block">
        <h4>Situation</h4>
        <p>${escapeHtml(sit.situation)}</p>
      </div>

      ${sit.defi ? `
        <div class="situation-block">
          <h4>Defi</h4>
          <p>${escapeHtml(sit.defi)}</p>
        </div>
      ` : ''}

      ${sit.comportement_attendu ? `
        <div class="situation-block">
          <h4>Comportement attendu</h4>
          <p>${escapeHtml(sit.comportement_attendu)}</p>
        </div>
      ` : ''}
    </div>
  `).join('');

  return `
    <div class="situation-nav">${navButtons}</div>
    ${cards}
  `;
}

/**
 * Generate timeline HTML
 */
function generateTimelineHtml(phases: any[]): string {
  if (!phases || phases.length === 0) {
    return '<p>Aucun deroule defini.</p>';
  }

  const totalDuration = phases.reduce((sum, p) => sum + (p.duree_minutes || 0), 0);

  const timelineBar = phases.map(phase => {
    const width = totalDuration > 0 ? ((phase.duree_minutes || 0) / totalDuration) * 100 : 0;
    return `<div class="timeline-segment" style="width: ${width}%">${phase.duree_minutes}min</div>`;
  }).join('');

  const phaseCards = phases.map(phase => `
    <div class="phase-card">
      <div class="phase-header">
        <span class="phase-title">${escapeHtml(phase.intitule)}</span>
        <span class="phase-duration">${phase.duree_minutes} min</span>
      </div>
      <div class="phase-details hidden">
        ${phase.objectifs && phase.objectifs.length > 0 ? `
          <div style="margin-bottom: 12px;">
            <strong>Objectifs:</strong>
            <ul style="margin-left: 20px;">
              ${phase.objectifs.map((o: string) => `<li>${escapeHtml(o)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${phase.activities && phase.activities.length > 0 ? `
          <div>
            <strong>Activites:</strong>
            ${phase.activities.map((act: any) => `
              <div class="activity-item">
                <strong>${escapeHtml(act.name)}</strong> (${act.duration} min)
                ${act.instructions ? `<p style="font-size: 13px; margin-top: 4px;">${escapeHtml(act.instructions)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${phase.materials && phase.materials.length > 0 ? `
          <div style="margin-top: 12px;">
            <strong>Materiel:</strong> ${phase.materials.map((m: string) => escapeHtml(m)).join(', ')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  return `
    <div class="timeline-bar">${timelineBar}</div>
    ${phaseCards}
  `;
}

/**
 * Generate resources HTML
 */
function generateResourcesHtml(content: any): string {
  const parts: string[] = [];

  if (content.evaluation) {
    parts.push(`
      <div class="objective-card">
        <div class="objective-header">
          <span class="objective-number">Evaluation</span>
        </div>
        <p>${escapeHtml(content.evaluation.method || '')}</p>
        ${content.evaluation.successIndicators ? `
          <ul style="margin-top: 12px; margin-left: 20px;">
            ${content.evaluation.successIndicators.map((i: string) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `);
  }

  if (content.materials && content.materials.length > 0) {
    parts.push(`
      <div class="objective-card">
        <div class="objective-header">
          <span class="objective-number">Materiel necessaire</span>
        </div>
        <ul style="margin-left: 20px;">
          ${content.materials.map((m: string) => `<li>${escapeHtml(m)}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  return parts.length > 0 ? parts.join('') : '<p>Aucune ressource disponible.</p>';
}

/**
 * Get section icon
 */
function getSectionIcon(type: string): string {
  const icons: Record<string, string> = {
    intro: '🏠',
    objectives: '🎯',
    situations: '💼',
    timeline: '⏱️',
    quiz: '📝',
    resources: '📚'
  };
  return icons[type] || '📄';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
