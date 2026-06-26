import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

export function createApp() {
  const app = express();

  // ─── Security Headers ───────────────────────────────────────────────────────
  app.use(helmet());

  // ─── CORS ───────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }));

  // ─── Raw Body (needed for webhook signature verification) ───────────────────
  app.use('/api/v1/webhooks', express.raw({ type: '*/*', limit: '10mb' }), (req: Request, _res: Response, next) => {
    req.rawBody = req.body as Buffer;
    // Also parse as JSON for use in route handlers
    if (req.rawBody?.length) {
      try {
        req.body = JSON.parse(req.rawBody.toString('utf8'));
      } catch {
        // Not JSON — leave as raw
      }
    }
    next();
  });

  // ─── Body Parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Logging ────────────────────────────────────────────────────────────────
  if (process.env['NODE_ENV'] !== 'test') {
    app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));
  }

  // ─── Rate Limiting ───────────────────────────────────────────────────────────
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later' },
  });
  app.use('/api', apiLimiter);

  // ─── Health Check ────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api/v1', routes);

  // ─── 404 & Error Handling ────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
