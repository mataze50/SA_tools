/**
 * SCORM Package Builder
 * Generates a complete SCORM package (ZIP) from sheet data
 */

import archiver from 'archiver';
import { Writable } from 'stream';
import { ScormExportConfig, ScormExportResult, ScormModuleData } from '../types/scorm.types';
import { SheetForScorm } from '../types/fiche.types';
import { sheetToScormData, validateSheetForScorm } from './sheetToScormData';
import { generateManifest } from './manifestGenerator';
import { generateModuleHtml } from './htmlGenerator';

/**
 * Build a complete SCORM package
 */
export async function buildScormPackage(
  sheet: SheetForScorm,
  config: ScormExportConfig
): Promise<{ result: ScormExportResult; buffer?: Buffer }> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    // 1. Validate sheet
    const validation = validateSheetForScorm(sheet);
    if (!validation.valid) {
      return {
        result: {
          success: false,
          error: `Fiche invalide: ${validation.errors.join(', ')}`
        }
      };
    }

    // 2. Transform sheet to SCORM module data
    const moduleData = sheetToScormData(sheet);

    // 3. Generate HTML module
    const htmlContent = generateModuleHtml(moduleData, config);

    // 4. Generate file list and manifest
    const files = [
      'index.html',
      'assets/styles.css'
    ];

    const manifest = generateManifest(moduleData, files, config);

    // 5. Generate CSS
    const cssContent = generateModuleCss();

    // 6. Create ZIP in memory
    const buffer = await createZipBuffer(
      manifest,
      htmlContent,
      cssContent,
      moduleData
    );

    const fileName = sanitizeFileName(
      `${sheet.competency.code}_${sheet.title}_SCORM${config.version.replace(/[.-]/g, '')}`
    ) + '.zip';

    const buildTime = Date.now() - startTime;
    console.log(`SCORM package built in ${buildTime}ms`);

    return {
      result: {
        success: true,
        fileName,
        fileSize: buffer.length,
        warnings: warnings.length > 0 ? warnings : undefined,
        manifest
      },
      buffer
    };

  } catch (error) {
    console.error('SCORM build error:', error);
    return {
      result: {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      }
    };
  }
}

/**
 * Create ZIP buffer in memory
 */
async function createZipBuffer(
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

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    writableStream.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(writableStream);

    // Add files to archive
    archive.append(manifest, { name: 'imsmanifest.xml' });
    archive.append(htmlContent, { name: 'index.html' });
    archive.append(cssContent, { name: 'assets/styles.css' });

    // Add module data as JSON (for debugging/reference)
    archive.append(
      JSON.stringify(moduleData, null, 2),
      { name: 'assets/module-data.json' }
    );

    archive.finalize();
  });
}

/**
 * Generate module CSS
 */
function generateModuleCss(): string {
  return `/* SCORM Module Styles - ATELIER FORGE */
:root {
  --primary: #0066cc;
  --primary-light: #e6f0ff;
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

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: var(--gray-900);
  background: var(--gray-50);
}

.module-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.module-header {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.competence-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--primary-light);
  color: var(--primary);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.module-title {
  font-size: 24px;
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

/* Progress Bar */
.progress-container {
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.progress-bar {
  height: 8px;
  background: var(--gray-200);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
}

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
.step-dot.current { background: var(--primary); transform: scale(1.2); }

.step-label {
  font-size: 11px;
  color: var(--gray-500);
}

/* Content Area */
.module-content {
  flex: 1;
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary);
}

/* Intro Section */
.intro-content {
  text-align: center;
  padding: 40px 20px;
}

.intro-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.intro-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin: 30px 0;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 13px;
  color: var(--gray-500);
}

/* Objectives */
.objective-card {
  background: var(--gray-50);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid var(--primary);
  cursor: pointer;
  transition: all 0.2s;
}

.objective-card:hover {
  background: var(--primary-light);
}

.objective-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.objective-number {
  font-weight: 600;
  color: var(--primary);
}

.bloom-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--gray-200);
  color: var(--gray-700);
}

.objective-text {
  color: var(--gray-700);
}

/* Situations */
.situation-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.situation-btn {
  padding: 8px 16px;
  border: 2px solid var(--gray-200);
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.situation-btn:hover { border-color: var(--primary); }
.situation-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
.situation-btn.viewed { border-color: var(--success); }

.situation-card {
  background: linear-gradient(135deg, #fff9e6 0%, #fff5cc 100%);
  border-radius: 12px;
  padding: 24px;
}

.situation-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 16px;
}

.situation-block {
  margin-bottom: 16px;
}

.situation-block h4 {
  font-size: 14px;
  color: var(--gray-500);
  margin-bottom: 4px;
}

.situation-block p {
  color: var(--gray-700);
}

/* Timeline */
.timeline-bar {
  display: flex;
  height: 24px;
  background: var(--gray-100);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 24px;
}

.timeline-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  opacity: 0.7;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 11px;
  color: white;
  font-weight: 500;
}

.timeline-segment:hover, .timeline-segment.active {
  opacity: 1;
}

.phase-card {
  background: var(--gray-50);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
}

.phase-card.expanded {
  background: var(--primary-light);
}

.phase-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.phase-title {
  font-weight: 600;
  color: var(--gray-900);
}

.phase-duration {
  background: var(--primary);
  color: white;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.phase-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--gray-200);
}

.activity-item {
  padding: 8px 12px;
  margin: 8px 0;
  border-left: 3px solid var(--primary);
  background: white;
}

/* Quiz */
.quiz-intro {
  text-align: center;
  padding: 40px;
}

.quiz-rules {
  text-align: left;
  max-width: 400px;
  margin: 20px auto;
  background: var(--gray-50);
  padding: 20px;
  border-radius: 8px;
}

.quiz-rules li {
  margin: 8px 0;
  color: var(--gray-700);
}

.question-card {
  background: var(--gray-50);
  border-radius: 12px;
  padding: 24px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.question-number {
  font-weight: 600;
  color: var(--primary);
}

.question-text {
  font-size: 18px;
  color: var(--gray-900);
  margin-bottom: 20px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border: 2px solid var(--gray-200);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.option-btn:hover {
  border-color: var(--primary);
  background: var(--primary-light);
}

.option-btn.selected {
  border-color: var(--primary);
  background: var(--primary-light);
}

.option-letter {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-200);
  border-radius: 50%;
  font-weight: 600;
}

.option-btn.selected .option-letter {
  background: var(--primary);
  color: white;
}

/* Quiz Results */
.results-header {
  text-align: center;
  padding: 40px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.results-header.passed {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
}

.results-header.failed {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
}

.results-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.score-display {
  margin: 24px 0;
}

.score-value {
  font-size: 48px;
  font-weight: 700;
  color: var(--gray-900);
}

.score-bar {
  height: 12px;
  background: var(--gray-200);
  border-radius: 6px;
  overflow: hidden;
  margin: 16px auto;
  max-width: 300px;
  position: relative;
}

.score-fill {
  height: 100%;
  background: var(--success);
  border-radius: 6px;
}

.passing-marker {
  position: absolute;
  top: -20px;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--gray-500);
}

/* Navigation */
.module-nav {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.nav-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn.secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.nav-btn.secondary:hover:not(:disabled) {
  background: var(--gray-200);
}

.nav-btn.primary {
  background: var(--primary);
  color: white;
}

.nav-btn.primary:hover:not(:disabled) {
  background: #0052a3;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 600px) {
  .module-container { padding: 12px; }
  .module-content { padding: 16px; }
  .intro-stats { flex-direction: column; gap: 20px; }
  .module-meta { flex-direction: column; gap: 8px; }
}
`;
}

/**
 * Sanitize filename
 */
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 60);
}
