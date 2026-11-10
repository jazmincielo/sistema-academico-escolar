import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { openapi } from './docs/openapi.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false })); // CSP desactivada solo para que cargue Swagger UI
  app.use(cors({ origin: env.clientUrl.split(','), credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  if (!env.isTest) app.use(morgan('dev'));

  app.get('/api-docs.json', (_req, res) => res.json(openapi));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'SAE - API Docs' }));
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
