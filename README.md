# 🏭 ATELIER FORGE v3.0

> **Le co-pilote IA de conception pédagogique**

Une fiche exploitable en moins de 45 minutes, validée par l'IA, que ton manager n'a plus qu'à signer.

## 📋 Description

ATELIER FORGE est un outil d'aide à la conception pédagogique destiné aux consultants-formateurs. Il utilise l'IA (Claude + Perplexity) pour automatiser la création de fiches de conception d'ateliers, tout en garantissant la conformité au référentiel de compétences.

### Bénéfices clés

| Métrique | Avant | Après |
|----------|-------|-------|
| Temps par fiche | 4h | 30-45 min |
| Fiches par mois | ~5 | ~15 |
| Retours manager | ~30% de modifs | <15% de modifs |
| Coût par fiche | — | ~0.50€ |

## 🚀 Installation

### Prérequis

- Node.js 18+
- PostgreSQL 14+
- Clés API : Anthropic (Claude) et Perplexity (optionnel)

### Configuration

1. **Cloner le projet**
```bash
git clone <repo-url>
cd SA_tools
```

2. **Installer les dépendances**
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

3. **Configurer l'environnement**
```bash
cp backend/.env.example backend/.env
# Éditer backend/.env avec vos clés API
```

4. **Initialiser la base de données**
```bash
cd backend
npx prisma migrate dev
npx prisma db seed
cd ..
```

5. **Lancer l'application**
```bash
npm run dev
```

L'application sera accessible sur :
- Frontend : http://localhost:5173
- Backend API : http://localhost:3001

### Compte démo

- Email : `demo@harmonia.fr`
- Mot de passe : `demo123`

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ATELIER FORGE                             │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND          │  BACKEND           │  DATABASE             │
│  React 18          │  Node.js + Express │  PostgreSQL           │
│  TypeScript        │  TypeScript        │  Prisma ORM           │
│  TailwindCSS       │  SSE for streaming │                       │
│  React Query       │                    │                       │
├─────────────────────────────────────────────────────────────────┤
│                        AI SERVICES                               │
│  Claude (Anthropic)         │  Perplexity                       │
│  - Master Generator         │  - Situation Hunter               │
│  - Coherence Validator      │  - Bibliography Builder           │
│  - Iterative Improver       │                                   │
│  - Quiz Generator           │                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Structure du projet

```
SA_tools/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Schéma de base de données
│   │   └── seed.ts            # Données initiales
│   ├── src/
│   │   ├── routes/            # Routes API
│   │   ├── services/ai/       # Services IA (Claude, Perplexity)
│   │   ├── middleware/        # Auth, erreurs
│   │   └── lib/               # Utilitaires (Prisma)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/             # Pages React
│   │   ├── components/        # Composants réutilisables
│   │   ├── stores/            # État global (Zustand)
│   │   └── lib/               # API client
│   └── package.json
└── package.json               # Scripts racine
```

## 🔧 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `GET /api/auth/me` - Profil utilisateur

### Fiches
- `GET /api/sheets` - Liste des fiches
- `GET /api/sheets/:id` - Détail d'une fiche
- `POST /api/sheets` - Créer une fiche
- `PATCH /api/sheets/:id` - Modifier une fiche
- `DELETE /api/sheets/:id` - Supprimer une fiche

### Génération IA
- `POST /api/generation/start` - Démarrer la génération
- `GET /api/generation/:sessionId/status` - Statut de génération
- `POST /api/generation/:sessionId/create-sheet` - Créer la fiche depuis la génération

### Export
- `GET /api/export/docx/:sheetId` - Export Word
- `GET /api/export/json/:sheetId` - Export JSON
- `GET /api/export/quiz/:sheetId` - Export du quiz

## 🎨 Fonctionnalités

### MVP (v1.0)
- ✅ Sélection de compétence avec recherche
- ✅ Formulaire de contexte structuré
- ✅ Génération IA avec pipeline 6 étapes
- ✅ Éditeur avec 5 onglets thématiques
- ✅ Score de confiance
- ✅ Export DOCX

### À venir (v2.0)
- 🔄 Mode conversationnel (questions guidées)
- 🔄 Aperçus en temps réel pendant la génération
- 🔄 Mode Remix (adapter une fiche existante)
- 🔄 Workflow de validation manager
- 🔄 Feedback post-atelier

## 📊 Référentiel de compétences

L'outil intègre le référentiel CEP avec 5 axes :

| Axe | Nom | Compétences |
|-----|-----|-------------|
| C1 | Diagnostic | 3 compétences |
| C2 | Projet | 3 compétences |
| C3 | Changement | 3 compétences |
| C4 | Ingénierie | 3 compétences |
| C5 | Relationnel | 4 compétences |

## 🔐 Sécurité

- Authentification JWT
- Mots de passe hashés
- Validation des entrées avec Zod
- CORS configuré
- Helmet pour les en-têtes HTTP

## 📝 Licence

Propriétaire - HARMONIA GROUP © 2025

---

Développé avec ❤️ par HARMONIA GROUP
