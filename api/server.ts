import express, { Request, Response } from 'express';
import apiRouter from '../src/server/api.ts';
import { seedDatabase } from '../src/db/seed.ts';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let isSeeded = false;

// Auto-seed database on serverless cold start in the background without blocking the request
app.use((req: Request, res: Response, next) => {
  if (!isSeeded) {
    isSeeded = true;
    const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.VERCEL_POSTGRES_URL);
    if (hasDbUrl) {
      seedDatabase().catch((err) => {
        console.warn('Vercel cold start background seed check error:', err);
      });
    }
  }
  next();
});

// Lightweight keep-alive / health-check endpoint (for cron-job.org / UptimeRobot to prevent cold start)
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() });
});

// Mount API routes for both /api and root serverless routing
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `المسار غير موجود على Vercel: ${req.method} ${req.path}` });
});

export default (req: any, res: any) => {
  return app(req, res);
};
