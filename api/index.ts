import express, { Request, Response } from 'express';
import apiRouter from '../src/server/api.ts';
import { seedDatabase } from '../src/db/seed.ts';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let isSeeded = false;

// Auto-seed database on serverless cold start if empty and DATABASE_URL is provided
app.use(async (req: Request, res: Response, next) => {
  if (!isSeeded) {
    isSeeded = true;
    const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL);
    if (hasDbUrl) {
      try {
        await seedDatabase();
      } catch (err) {
        console.warn('Vercel cold start seed check error:', err);
      }
    }
  }
  next();
});

// Mount API routes for both /api and root serverless routing
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `المسار غير موجود على Vercel: ${req.method} ${req.path}` });
});

export default app;
