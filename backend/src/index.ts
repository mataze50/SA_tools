import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { sheetsRouter } from './routes/sheets.js';
import { competenciesRouter } from './routes/competencies.js';
import { generationRouter } from './routes/generation.js';
import { quizRouter } from './routes/quiz.js';
import { exportRouter } from './routes/export.js';
import { dashboardRouter } from './routes/dashboard.js';
import { validationRouter } from './routes/validation.js';
import { conversationRouter } from './routes/conversation.js';
import { remixRouter } from './routes/remix.js';
import { notificationsRouter } from './routes/notifications.js';
import { feedbackRouter } from './routes/feedback.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/sheets', sheetsRouter);
app.use('/api/competencies', competenciesRouter);
app.use('/api/generation', generationRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/export', exportRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/validation', validationRouter);
app.use('/api/conversation', conversationRouter);
app.use('/api/remix', remixRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/feedback', feedbackRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🏭 Atelier Forge API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
