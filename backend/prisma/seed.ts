import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed competencies (Référentiel CEP)
  const competencies = [
    // Axe C1 - Diagnostic
    {
      code: 'C1.1',
      axis: 'C1',
      axisName: 'Diagnostic',
      title: 'Analyser la demande et le contexte du bénéficiaire',
      description: 'Capacité à comprendre et analyser la situation initiale du bénéficiaire.',
      keywords: ['analyse', 'demande', 'contexte', 'diagnostic', 'situation'],
      order: 1
    },
    {
      code: 'C1.2',
      axis: 'C1',
      axisName: 'Diagnostic',
      title: 'Identifier les compétences et les potentiels',
      description: 'Capacité à repérer les compétences acquises et le potentiel de développement.',
      keywords: ['compétences', 'potentiel', 'identification', 'évaluation'],
      order: 2
    },
    {
      code: 'C1.3',
      axis: 'C1',
      axisName: 'Diagnostic',
      title: 'Établir un diagnostic partagé',
      description: 'Capacité à construire un diagnostic en co-construction avec le bénéficiaire.',
      keywords: ['diagnostic', 'partagé', 'co-construction', 'bilan'],
      order: 3
    },

    // Axe C2 - Projet
    {
      code: 'C2.1',
      axis: 'C2',
      axisName: 'Projet',
      title: 'Accompagner l\'émergence du projet professionnel',
      description: 'Capacité à faire émerger un projet professionnel cohérent et réaliste.',
      keywords: ['projet', 'émergence', 'accompagnement', 'professionnel'],
      order: 4
    },
    {
      code: 'C2.2',
      axis: 'C2',
      axisName: 'Projet',
      title: 'Aider à la formalisation du projet',
      description: 'Capacité à structurer et formaliser le projet professionnel.',
      keywords: ['formalisation', 'projet', 'structuration', 'plan'],
      order: 5
    },
    {
      code: 'C2.3',
      axis: 'C2',
      axisName: 'Projet',
      title: 'Accompagner la prise de décision',
      description: 'Capacité à aider le bénéficiaire dans ses choix d\'orientation.',
      keywords: ['décision', 'choix', 'orientation', 'arbitrage'],
      order: 6
    },

    // Axe C3 - Changement
    {
      code: 'C3.1',
      axis: 'C3',
      axisName: 'Changement',
      title: 'Accompagner les transitions professionnelles',
      description: 'Capacité à soutenir les personnes dans leurs transitions de carrière.',
      keywords: ['transition', 'changement', 'carrière', 'mobilité'],
      order: 7
    },
    {
      code: 'C3.2',
      axis: 'C3',
      axisName: 'Changement',
      title: 'Identifier et réguler les tensions relationnelles',
      description: 'Capacité à gérer les situations conflictuelles ou tendues.',
      keywords: ['tensions', 'conflit', 'régulation', 'relationnel'],
      order: 8
    },
    {
      code: 'C3.3',
      axis: 'C3',
      axisName: 'Changement',
      title: 'Renforcer la confiance et l\'autonomie',
      description: 'Capacité à développer la confiance en soi et l\'autonomie du bénéficiaire.',
      keywords: ['confiance', 'autonomie', 'estime', 'empowerment'],
      order: 9
    },

    // Axe C4 - Ingénierie
    {
      code: 'C4.1',
      axis: 'C4',
      axisName: 'Ingénierie',
      title: 'Concevoir des actions d\'accompagnement',
      description: 'Capacité à créer des parcours et dispositifs d\'accompagnement adaptés.',
      keywords: ['conception', 'ingénierie', 'dispositif', 'parcours'],
      order: 10
    },
    {
      code: 'C4.2',
      axis: 'C4',
      axisName: 'Ingénierie',
      title: 'Animer des ateliers collectifs',
      description: 'Capacité à concevoir et animer des sessions de groupe.',
      keywords: ['animation', 'atelier', 'collectif', 'groupe'],
      order: 11
    },
    {
      code: 'C4.3',
      axis: 'C4',
      axisName: 'Ingénierie',
      title: 'Évaluer les acquis et les progressions',
      description: 'Capacité à mesurer les apprentissages et les évolutions.',
      keywords: ['évaluation', 'acquis', 'progression', 'mesure'],
      order: 12
    },

    // Axe C5 - Relationnel
    {
      code: 'C5.1',
      axis: 'C5',
      axisName: 'Relationnel',
      title: 'Établir une relation de confiance',
      description: 'Capacité à créer un cadre relationnel sécurisant et bienveillant.',
      keywords: ['relation', 'confiance', 'alliance', 'bienveillance'],
      order: 13
    },
    {
      code: 'C5.2',
      axis: 'C5',
      axisName: 'Relationnel',
      title: 'Pratiquer l\'écoute active et le questionnement',
      description: 'Capacité à utiliser les techniques d\'entretien professionnel.',
      keywords: ['écoute', 'questionnement', 'entretien', 'communication'],
      order: 14
    },
    {
      code: 'C5.3',
      axis: 'C5',
      axisName: 'Relationnel',
      title: 'Adapter sa posture professionnelle',
      description: 'Capacité à ajuster son positionnement selon les situations.',
      keywords: ['posture', 'adaptation', 'flexibilité', 'positionnement'],
      order: 15
    },
    {
      code: 'C5.4',
      axis: 'C5',
      axisName: 'Relationnel',
      title: 'Évaluer la qualité de la relation et ajuster sa posture',
      description: 'Capacité à analyser les feedbacks et à améliorer sa pratique.',
      keywords: ['feedback', 'qualité', 'amélioration', 'réflexivité', 'posture'],
      order: 16
    }
  ];

  for (const comp of competencies) {
    await prisma.competency.upsert({
      where: { code: comp.code },
      update: comp,
      create: comp
    });
  }

  console.log(`✅ Created ${competencies.length} competencies`);

  // Create a demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@harmonia.fr' },
    update: {},
    create: {
      email: 'demo@harmonia.fr',
      passwordHash: Buffer.from('demo123').toString('base64'), // Simple encoding for demo
      firstName: 'Sarah',
      lastName: 'Demo',
      role: 'CONSULTANT',
      experienceLevel: 'CONFIRMED',
      sector: 'Conseil en évolution professionnelle (CEP)'
    }
  });

  console.log(`✅ Created demo user: ${demoUser.email}`);

  // Create a demo manager
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@harmonia.fr' },
    update: {},
    create: {
      email: 'manager@harmonia.fr',
      passwordHash: Buffer.from('manager123').toString('base64'),
      firstName: 'Marc',
      lastName: 'Manager',
      role: 'MANAGER',
      experienceLevel: 'EXPERT',
      sector: 'Conseil en évolution professionnelle (CEP)'
    }
  });

  console.log(`✅ Created manager user: ${managerUser.email}`);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
