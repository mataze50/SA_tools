import { Router, Response, NextFunction } from 'express';
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

// ============================================
// DOCUMENT GENERATORS
// ============================================

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
