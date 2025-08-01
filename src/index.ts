// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

// Import routes
import zonesRouter from './routes/zones';
import systemRouter from './routes/system';


// Import types
import type { ApiRootResponse } from './types/api';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins for assessment purposes
  credentials: true,
}));

// Utility middleware
// Compress the responses
app.use(compression());
// Log the http requests
app.use(morgan('combined'));
// Parses JSON request body
app.use(express.json({ limit: '10mb' }));
// Parses form data
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/zones', zonesRouter);
app.use('/api/system', systemRouter);

// API root endpoint
app.get('/api', (_req, res: Response<ApiRootResponse>) => {
  const response: ApiRootResponse = {
    message: 'Dinopark Maintenance API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      zones: {
        grid: 'GET /api/zones/grid', 
        single: 'GET /api/zones/:id'
      },
      system: {
        status: 'GET /api/system/status',
        health: 'GET /api/system/health'
      }
    },
    grid: {
      description: 'Use /api/zones/grid for frontend grid visualization',
      format: '26 columns (A-Z) × 16 rows (0-15)'
    }
  };

  res.json(response);
});

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  // Start server
  app.listen(PORT, () => {
    console.log(`🦕 Dinopark API running on port ${PORT}`);
    console.log(`📚 Health check: http://localhost:${PORT}/health`);
    console.log(`🏠 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌱 To seed NUDLS data: npm run seed`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
  });
}

export default app;