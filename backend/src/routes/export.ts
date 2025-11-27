import { Router, Response, NextFunction } from 'express';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer
} from 'docx';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { exportSheetAsScorm } from '../scorm/services/scormExportService.js';

export const exportRouter = Router();

// GET /api/export/docx/:sheetId - Export sheet as DOCX
exportRouter.get('/docx/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: {
        competency: true,
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const doc = createDocxDocument(sheet);
    const buffer = await Packer.toBuffer(doc);

    const filename = `fiche_${sheet.competency.code}_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// GET /api/export/pdf/:sheetId - Export sheet as PDF
exportRouter.get('/pdf/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: {
        competency: true,
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const pdfBuffer = await generatePdfDocument(sheet);
    const filename = `fiche_${sheet.competency.code}_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// GET /api/export/json/:sheetId - Export sheet as JSON
exportRouter.get('/json/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: {
        competency: true,
        quiz: true
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const filename = `fiche_${sheet.competency.code}_${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(sheet);
  } catch (error) {
    next(error);
  }
});

// GET /api/export/quiz/:sheetId - Export quiz as DOCX
exportRouter.get('/quiz/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: {
        competency: true,
        quiz: true
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    if (!sheet.quiz) {
      throw new AppError('Quiz not found. Generate one first.', 404);
    }

    const doc = createQuizDocx(sheet, sheet.quiz);
    const buffer = await Packer.toBuffer(doc);

    const filename = `quiz_${sheet.competency.code}_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// GET /api/export/html/:sheetId - Export sheet as printable HTML (for PDF)
exportRouter.get('/html/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: {
        competency: true,
        user: { select: { firstName: true, lastName: true } }
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const html = generatePrintableHtml(sheet);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// POST /api/export/share/:sheetId - Generate public share link
exportRouter.post('/share/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // Generate unique share token
    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Update sheet with share token
    await prisma.sheet.update({
      where: { id: sheet.id },
      data: {
        shareToken,
        shareExpiresAt: expiresAt
      }
    });

    res.json({
      success: true,
      data: {
        shareToken,
        shareUrl: `/api/export/public/${shareToken}`,
        expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/export/share/:sheetId - Revoke public share link
exportRouter.delete('/share/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    await prisma.sheet.update({
      where: { id: sheet.id },
      data: {
        shareToken: null,
        shareExpiresAt: null
      }
    });

    res.json({
      success: true,
      message: 'Share link revoked'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/export/public/:token - View shared sheet (no auth required)
exportRouter.get('/public/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { format } = req.query;

    const sheet = await prisma.sheet.findFirst({
      where: {
        shareToken: token,
        shareExpiresAt: { gt: new Date() }
      },
      include: {
        competency: true,
        user: { select: { firstName: true, lastName: true } },
        quiz: true
      }
    });

    if (!sheet) {
      throw new AppError('Share link expired or invalid', 404);
    }

    // Return based on format
    if (format === 'html') {
      const html = generatePrintableHtml(sheet);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    if (format === 'json') {
      // Return sanitized JSON (without sensitive data)
      return res.json({
        success: true,
        data: {
          title: sheet.title,
          competency: sheet.competency,
          sector: sheet.sector,
          audienceType: sheet.audienceType,
          format: sheet.format,
          duration: sheet.duration,
          objectives: sheet.objectives,
          situations: sheet.situations,
          flow: sheet.flow,
          evaluation: sheet.evaluation,
          author: `${sheet.user.firstName} ${sheet.user.lastName}`,
          updatedAt: sheet.updatedAt
        }
      });
    }

    // Default: return view page
    const viewHtml = generatePublicViewHtml(sheet);
    res.setHeader('Content-Type', 'text/html');
    res.send(viewHtml);
  } catch (error) {
    next(error);
  }
});

// GET /api/export/share-status/:sheetId - Get share status
exportRouter.get('/share-status/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      select: {
        shareToken: true,
        shareExpiresAt: true
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const isShared = sheet.shareToken && sheet.shareExpiresAt && sheet.shareExpiresAt > new Date();

    res.json({
      success: true,
      data: {
        isShared,
        shareToken: isShared ? sheet.shareToken : null,
        expiresAt: isShared ? sheet.shareExpiresAt : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SCORM EXPORT (Sprint 8)
// ============================================

// GET /api/export/scorm/:sheetId - Export sheet as SCORM package
exportRouter.get('/scorm/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { version = '1.2', organization, masteryScore } = req.query;

    // Validate SCORM version
    const validVersions = ['1.2', '2004-3rd', '2004-4th'];
    if (!validVersions.includes(version as string)) {
      throw new AppError('Invalid SCORM version. Use: 1.2, 2004-3rd, or 2004-4th', 400);
    }

    const result = await exportSheetAsScorm({
      sheetId: req.params.sheetId,
      userId: req.user!.id,
      version: version as '1.2' | '2004-3rd' | '2004-4th',
      organization: organization as string || 'HARMONIA GROUP',
      masteryScore: masteryScore ? parseInt(masteryScore as string, 10) : 80
    });

    if (!result.result.success) {
      throw new AppError(result.result.error || 'SCORM export failed', 400);
    }

    if (!result.buffer) {
      throw new AppError('Failed to generate SCORM package', 500);
    }

    // Send ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${result.result.fileName}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
});

// GET /api/export/scorm/preview/:sheetId - Preview SCORM module (HTML)
exportRouter.get('/scorm/preview/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: {
        competency: true,
        user: { select: { firstName: true, lastName: true } },
        quiz: true
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    // Check if sheet has quiz
    const content = sheet.content as any || {};
    if (!content.quiz?.questions || content.quiz.questions.length < 5) {
      throw new AppError('Quiz incomplet - minimum 5 questions requises pour export SCORM', 400);
    }

    // Generate preview info
    res.json({
      success: true,
      data: {
        title: sheet.title,
        competency: sheet.competency,
        sectionsCount: 6,
        questionsCount: content.quiz.questions.length,
        estimatedDuration: sheet.duration,
        canExport: true,
        exportFormats: [
          { version: '1.2', label: 'SCORM 1.2 (compatibilite maximale)' },
          { version: '2004-3rd', label: 'SCORM 2004 3rd Edition' },
          { version: '2004-4th', label: 'SCORM 2004 4th Edition' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/export/scorm/validate/:sheetId - Validate sheet for SCORM export
exportRouter.post('/scorm/validate/:sheetId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: {
        id: req.params.sheetId,
        userId: req.user!.id
      },
      include: {
        competency: true
      }
    });

    if (!sheet) {
      throw new AppError('Sheet not found', 404);
    }

    const content = sheet.content as any || {};
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation checks
    if (!sheet.competency?.code) {
      errors.push('Code competence manquant');
    }

    if (!sheet.title) {
      errors.push('Titre manquant');
    }

    const objectives = content.objectives || [];
    if (objectives.length === 0) {
      errors.push('Objectifs pedagogiques manquants');
    } else if (objectives.length < 3) {
      warnings.push('Recommandation: au moins 3 objectifs pedagogiques');
    }

    const quiz = content.quiz || {};
    const questions = quiz.questions || [];
    if (questions.length < 5) {
      errors.push(`Quiz incomplet: ${questions.length}/5 questions minimum`);
    }

    // Validate each question
    questions.forEach((q: any, i: number) => {
      if (!q.text) {
        errors.push(`Question ${i + 1}: enonce manquant`);
      }
      if (!q.choices || q.choices.length < 2) {
        errors.push(`Question ${i + 1}: minimum 2 options requises`);
      }
      if (!q.choices?.some((c: any) => c.isCorrect)) {
        errors.push(`Question ${i + 1}: aucune reponse correcte definie`);
      }
    });

    const situations = content.situations || [];
    if (situations.length === 0) {
      warnings.push('Aucune situation professionnelle definie');
    }

    const flow = content.flow || [];
    if (flow.length === 0) {
      warnings.push('Deroule pedagogique non defini');
    }

    res.json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
          title: sheet.title,
          objectivesCount: objectives.length,
          situationsCount: situations.length,
          phasesCount: flow.length,
          questionsCount: questions.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DOCUMENT GENERATORS
// ============================================

function generatePrintableHtml(sheet: any): string {
  const objectives = sheet.objectives as any[];
  const situations = sheet.situations as any[];
  const flow = sheet.flow as any[];
  const evaluation = sheet.evaluation as any;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${sheet.title} - Fiche pedagogique</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
    h1 { font-size: 24px; color: #1a365d; margin-bottom: 10px; text-align: center; }
    h2 { font-size: 18px; color: #2d3748; margin: 30px 0 15px; padding-bottom: 5px; border-bottom: 2px solid #3182ce; }
    h3 { font-size: 16px; color: #4a5568; margin: 20px 0 10px; }
    p { margin: 8px 0; }
    .header { text-align: center; margin-bottom: 30px; }
    .subtitle { color: #718096; font-size: 14px; }
    .meta { background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .meta-item { display: inline-block; margin-right: 20px; }
    .meta-label { font-weight: 600; color: #4a5568; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      background: #e2e8f0;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 5px;
    }
    .badge-blue { background: #bee3f8; color: #2b6cb0; }
    .badge-green { background: #c6f6d5; color: #276749; }
    .badge-purple { background: #e9d8fd; color: #553c9a; }
    .objective { padding: 10px; margin: 10px 0; background: #f0fff4; border-left: 3px solid #48bb78; }
    .situation { padding: 15px; margin: 15px 0; background: #fffaf0; border-radius: 8px; }
    .phase { padding: 15px; margin: 15px 0; background: #ebf8ff; border-radius: 8px; }
    .phase-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .activity { padding-left: 20px; margin: 10px 0; border-left: 2px solid #90cdf4; }
    .materials { background: #f7fafc; padding: 8px 12px; border-radius: 4px; margin-top: 10px; font-size: 13px; }
    .footer { margin-top: 40px; text-align: center; color: #a0aec0; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #3182ce;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    .print-btn:hover { background: #2c5282; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Imprimer / PDF</button>

  <div class="header">
    <h1>${sheet.title}</h1>
    <p class="subtitle">${sheet.competency.code} - ${sheet.competency.title}</p>
  </div>

  <div class="meta">
    <div class="meta-item"><span class="meta-label">Secteur:</span> ${sheet.sector}</div>
    <div class="meta-item"><span class="meta-label">Public:</span> ${sheet.audienceType}</div>
    <div class="meta-item"><span class="meta-label">Format:</span> ${formatLabel(sheet.format)}</div>
    <div class="meta-item"><span class="meta-label">Duree:</span> ${sheet.duration} min</div>
  </div>

  <h2>Objectifs pedagogiques</h2>
  ${objectives.map((obj, i) => `
    <div class="objective">
      <strong>Objectif ${i + 1}</strong> <span class="badge badge-purple">${obj.bloomLevel}</span>
      <p>${obj.text}</p>
    </div>
  `).join('')}

  <h2>Situations professionnelles</h2>
  ${situations.map((sit, i) => `
    <div class="situation">
      <h3>Situation ${i + 1}: ${sit.title}</h3>
      <p>${sit.description}</p>
      <p><strong>Defi:</strong> ${sit.challenge}</p>
      <p><strong>Comportement attendu:</strong> ${sit.expectedBehavior}</p>
    </div>
  `).join('')}

  <h2>Deroule pedagogique</h2>
  ${flow.map(phase => `
    <div class="phase">
      <div class="phase-header">
        <h3>${phase.name}</h3>
        <span class="badge badge-blue">${phase.duration} min</span>
      </div>
      ${phase.activities?.map((act: any) => `
        <div class="activity">
          <strong>${act.name}</strong>
          <span class="badge">${act.duration} min</span>
          <span class="badge">${activityTypeLabel(act.type)}</span>
          <p>${act.instructions}</p>
        </div>
      `).join('') || ''}
      ${phase.materials?.length ? `
        <div class="materials">
          <strong>Materiel:</strong> ${phase.materials.join(', ')}
        </div>
      ` : ''}
    </div>
  `).join('')}

  <h2>Evaluation</h2>
  ${evaluation?.method ? `<p><strong>Methode:</strong> ${evaluation.method}</p>` : ''}
  ${evaluation?.criteria?.length ? `
    <h3>Criteres</h3>
    <ul>
      ${evaluation.criteria.map((c: any) => `<li><strong>${c.criterion}:</strong> ${c.observable}</li>`).join('')}
    </ul>
  ` : ''}
  ${evaluation?.successIndicators?.length ? `
    <h3>Indicateurs de reussite</h3>
    <ul>
      ${evaluation.successIndicators.map((ind: string) => `<li>${ind}</li>`).join('')}
    </ul>
  ` : ''}

  <div class="footer">
    <p>Genere par ATELIER FORGE - ${new Date().toLocaleDateString('fr-FR')}</p>
    <p>Auteur: ${sheet.user.firstName} ${sheet.user.lastName}</p>
  </div>
</body>
</html>`;
}

function generatePublicViewHtml(sheet: any): string {
  const html = generatePrintableHtml(sheet);
  // Add a notice for public view
  return html.replace(
    '<div class="header">',
    `<div style="background: #fef3cd; color: #856404; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px;">
      Cette fiche est partagee en lecture seule. <a href="?format=html" style="color: #856404;">Version imprimable</a>
    </div>
    <div class="header">`
  );
}

function createDocxDocument(sheet: any): Document {
  const objectives = sheet.objectives as any[];
  const situations = sheet.situations as any[];
  const flow = sheet.flow as any[];
  const evaluation = sheet.evaluation as any;

  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: 'FICHE DE CONCEPTION PÉDAGOGIQUE',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      text: sheet.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({ text: '' })
  );

  // Metadata
  sections.push(
    new Paragraph({
      text: 'INFORMATIONS GÉNÉRALES',
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Compétence : ', bold: true }),
        new TextRun(`${sheet.competency.code} - ${sheet.competency.title}`)
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Secteur : ', bold: true }),
        new TextRun(sheet.sector)
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Public : ', bold: true }),
        new TextRun(sheet.audienceType)
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Format : ', bold: true }),
        new TextRun(formatLabel(sheet.format))
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Durée : ', bold: true }),
        new TextRun(`${sheet.duration} minutes`)
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Score de confiance : ', bold: true }),
        new TextRun(`${sheet.confidenceScore}%`)
      ]
    }),
    new Paragraph({ text: '' })
  );

  // Objectives
  sections.push(
    new Paragraph({
      text: 'OBJECTIFS PÉDAGOGIQUES',
      heading: HeadingLevel.HEADING_2
    })
  );

  objectives.forEach((obj: any, i: number) => {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Objectif ${i + 1} : `, bold: true }),
          new TextRun(obj.text)
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `   Niveau Bloom : ${obj.bloomLevel}`, italics: true })
        ]
      })
    );
  });
  sections.push(new Paragraph({ text: '' }));

  // Situations
  sections.push(
    new Paragraph({
      text: 'SITUATIONS PROFESSIONNELLES',
      heading: HeadingLevel.HEADING_2
    })
  );

  situations.forEach((sit: any, i: number) => {
    sections.push(
      new Paragraph({
        text: `Situation ${i + 1} : ${sit.title}`,
        heading: HeadingLevel.HEADING_3
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Description : ', bold: true }),
          new TextRun(sit.description)
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Défi : ', bold: true }),
          new TextRun(sit.challenge)
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Comportement attendu : ', bold: true }),
          new TextRun(sit.expectedBehavior)
        ]
      }),
      new Paragraph({ text: '' })
    );
  });

  // Flow
  sections.push(
    new Paragraph({
      text: 'DÉROULÉ PÉDAGOGIQUE',
      heading: HeadingLevel.HEADING_2
    })
  );

  flow.forEach((phase: any) => {
    sections.push(
      new Paragraph({
        text: `${phase.name} (${phase.duration} min)`,
        heading: HeadingLevel.HEADING_3
      })
    );

    if (phase.objectives?.length) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Objectifs de la phase : ', bold: true }),
            new TextRun(phase.objectives.join(', '))
          ]
        })
      );
    }

    if (phase.activities?.length) {
      phase.activities.forEach((activity: any) => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `• ${activity.name} `, bold: true }),
              new TextRun(`(${activity.duration} min, ${activityTypeLabel(activity.type)})`)
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `  ${activity.instructions}` })
            ]
          })
        );
      });
    }

    if (phase.materials?.length) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Matériel : ', bold: true }),
            new TextRun(phase.materials.join(', '))
          ]
        })
      );
    }

    sections.push(new Paragraph({ text: '' }));
  });

  // Evaluation
  sections.push(
    new Paragraph({
      text: 'ÉVALUATION',
      heading: HeadingLevel.HEADING_2
    })
  );

  if (evaluation.method) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Méthode : ', bold: true }),
          new TextRun(evaluation.method)
        ]
      })
    );
  }

  if (evaluation.criteria?.length) {
    sections.push(
      new Paragraph({
        text: 'Critères d\'évaluation :',
        heading: HeadingLevel.HEADING_3
      })
    );

    evaluation.criteria.forEach((criterion: any) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `• ${criterion.criterion} : ` }),
            new TextRun({ text: criterion.observable, italics: true })
          ]
        })
      );
    });
  }

  if (evaluation.successIndicators?.length) {
    sections.push(
      new Paragraph({
        text: 'Indicateurs de réussite :',
        heading: HeadingLevel.HEADING_3
      })
    );

    evaluation.successIndicators.forEach((indicator: string) => {
      sections.push(
        new Paragraph({
          children: [new TextRun(`• ${indicator}`)]
        })
      );
    });
  }

  // Footer
  sections.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Généré par ATELIER FORGE — ${new Date().toLocaleDateString('fr-FR')}`,
          italics: true,
          size: 20
        })
      ],
      alignment: AlignmentType.CENTER
    })
  );

  return new Document({
    sections: [{
      properties: {},
      children: sections
    }]
  });
}

function createQuizDocx(sheet: any, quiz: any): Document {
  const questions = quiz.questions as any[];

  const sections: Paragraph[] = [];

  sections.push(
    new Paragraph({
      text: 'QUIZ D\'ÉVALUATION',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      text: sheet.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Compétence : ${sheet.competency.code} - ${sheet.competency.title}`, italics: true })
      ],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({ text: '' })
  );

  questions.forEach((q: any, i: number) => {
    sections.push(
      new Paragraph({
        text: `Question ${i + 1}`,
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({
        text: q.text
      }),
      new Paragraph({ text: '' })
    );

    q.choices.forEach((choice: any) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun(`☐ ${choice.id.toUpperCase()}. ${choice.text}`)
          ]
        })
      );
    });

    sections.push(new Paragraph({ text: '' }));
  });

  // Answer key (new page)
  sections.push(
    new Paragraph({
      text: 'CORRIGÉ',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true
    }),
    new Paragraph({ text: '' })
  );

  questions.forEach((q: any, i: number) => {
    const correctChoice = q.choices.find((c: any) => c.isCorrect);
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Q${i + 1} : `, bold: true }),
          new TextRun(`${correctChoice?.id.toUpperCase() || '?'} — ${q.explanation || ''}`)
        ]
      })
    );
  });

  return new Document({
    sections: [{
      properties: {},
      children: sections
    }]
  });
}

function formatLabel(format: string): string {
  const labels: Record<string, string> = {
    IN_PERSON: 'Présentiel',
    REMOTE_SYNC: 'Distanciel synchrone',
    REMOTE_ASYNC: 'Distanciel asynchrone',
    HYBRID: 'Hybride'
  };
  return labels[format] || format;
}

function activityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    individual: 'travail individuel',
    group: 'travail en groupe',
    plenary: 'plénière',
    practice: 'mise en pratique'
  };
  return labels[type] || type;
}

// ============================================
// PDF GENERATOR
// ============================================

async function generatePdfDocument(sheet: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: sheet.title,
        Author: `${sheet.user.firstName} ${sheet.user.lastName}`,
        Subject: `Fiche pedagogique - ${sheet.competency.code}`,
        Creator: 'ATELIER FORGE v3.0'
      }
    });

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const objectives = sheet.objectives as any[];
    const situations = sheet.situations as any[];
    const flow = sheet.flow as any[];
    const evaluation = sheet.evaluation as any;

    // Colors
    const primaryColor = '#1a365d';
    const secondaryColor = '#2d3748';
    const accentColor = '#3182ce';
    const lightGray = '#f7fafc';

    // Header
    doc.fontSize(24).fillColor(primaryColor).text('FICHE DE CONCEPTION PEDAGOGIQUE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).fillColor(secondaryColor).text(sheet.title, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#718096').text(`${sheet.competency.code} - ${sheet.competency.title}`, { align: 'center' });
    doc.moveDown(1);

    // Metadata box
    const metaY = doc.y;
    doc.rect(50, metaY, 495, 60).fill(lightGray);
    doc.fillColor(secondaryColor).fontSize(10);
    doc.text(`Secteur: ${sheet.sector}`, 60, metaY + 10);
    doc.text(`Public: ${sheet.audienceType}`, 60, metaY + 25);
    doc.text(`Format: ${formatLabel(sheet.format)}`, 300, metaY + 10);
    doc.text(`Duree: ${sheet.duration} min`, 300, metaY + 25);
    doc.text(`Score: ${sheet.confidenceScore}%`, 300, metaY + 40);
    doc.y = metaY + 70;

    // Section: Objectives
    addSectionHeader(doc, 'OBJECTIFS PEDAGOGIQUES', accentColor);
    objectives.forEach((obj: any, i: number) => {
      doc.fontSize(11).fillColor(secondaryColor);
      doc.text(`${i + 1}. ${obj.text}`, { indent: 10 });
      doc.fontSize(9).fillColor('#718096').text(`   Niveau Bloom: ${obj.bloomLevel}`, { indent: 15 });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);

    // Section: Situations
    addSectionHeader(doc, 'SITUATIONS PROFESSIONNELLES', accentColor);
    situations.forEach((sit: any, i: number) => {
      doc.fontSize(12).fillColor(primaryColor).text(`Situation ${i + 1}: ${sit.title}`);
      doc.fontSize(10).fillColor(secondaryColor);
      doc.text(`Description: ${sit.description}`, { indent: 10 });
      doc.text(`Defi: ${sit.challenge}`, { indent: 10 });
      doc.text(`Comportement attendu: ${sit.expectedBehavior}`, { indent: 10 });
      doc.moveDown(0.5);
    });

    // Check if we need a new page
    if (doc.y > 650) {
      doc.addPage();
    }

    // Section: Flow
    addSectionHeader(doc, 'DEROULE PEDAGOGIQUE', accentColor);
    flow.forEach((phase: any) => {
      doc.fontSize(12).fillColor(primaryColor).text(`${phase.name} (${phase.duration} min)`);

      if (phase.activities?.length) {
        phase.activities.forEach((act: any) => {
          doc.fontSize(10).fillColor(secondaryColor);
          doc.text(`• ${act.name} - ${act.duration} min (${activityTypeLabel(act.type)})`, { indent: 15 });
          if (act.instructions) {
            doc.fontSize(9).fillColor('#4a5568').text(act.instructions, { indent: 25 });
          }
        });
      }

      if (phase.materials?.length) {
        doc.fontSize(9).fillColor('#718096').text(`Materiel: ${phase.materials.join(', ')}`, { indent: 15 });
      }
      doc.moveDown(0.5);

      // Page break if needed
      if (doc.y > 700) {
        doc.addPage();
      }
    });

    // Section: Evaluation
    if (doc.y > 600) {
      doc.addPage();
    }
    addSectionHeader(doc, 'EVALUATION', accentColor);

    if (evaluation?.method) {
      doc.fontSize(11).fillColor(secondaryColor).text(`Methode: ${evaluation.method}`);
      doc.moveDown(0.3);
    }

    if (evaluation?.criteria?.length) {
      doc.fontSize(11).fillColor(primaryColor).text('Criteres d\'evaluation:');
      evaluation.criteria.forEach((c: any) => {
        doc.fontSize(10).fillColor(secondaryColor).text(`• ${c.criterion}: ${c.observable}`, { indent: 10 });
      });
      doc.moveDown(0.3);
    }

    if (evaluation?.successIndicators?.length) {
      doc.fontSize(11).fillColor(primaryColor).text('Indicateurs de reussite:');
      evaluation.successIndicators.forEach((ind: string) => {
        doc.fontSize(10).fillColor(secondaryColor).text(`• ${ind}`, { indent: 10 });
      });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#a0aec0');
    doc.text(`Genere par ATELIER FORGE — ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
    doc.text(`Auteur: ${sheet.user.firstName} ${sheet.user.lastName}`, { align: 'center' });

    doc.end();
  });
}

function addSectionHeader(doc: PDFKit.PDFDocument, title: string, color: string) {
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor(color).text(title);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(color);
  doc.moveDown(0.5);
}
