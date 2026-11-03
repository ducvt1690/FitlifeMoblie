const path = require('path');
const Module = require('module');

// Cho phép các module tại thư mục gốc (/api, /database) sử dụng dependencies từ backend/node_modules
process.env.NODE_PATH = path.join(__dirname, 'node_modules');
Module._initPaths();

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const {
  authRoutes,
  healthRoutes,
  aiRoutes,
  shopRoutes,
} = require('../api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    project: 'FitLife Pro Health & MMA API (projectMMA)',
    version: '1.0.0',
    architecture: {
      frontend: '/frontend',
      backend: '/backend',
      api: '/api',
      database: '/database',
    },
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/reset-password',
        'GET /api/auth/users',
      ],
      health: [
        'GET /api/health/summary',
        'POST /api/health/water',
        'POST /api/health/workout',
        'POST /api/health/meal',
        'GET /api/health/exercises',
      ],
      ai: ['POST /api/ai/chat'],
      shop: ['GET /api/shop/items', 'POST /api/shop/buy'],
    },
  });
});

// Register API Routes from /api module
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shop', shopRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint không tồn tại trên FitLife API Server' });
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 FitLife Backend Server is running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log('🌐 API Module: /api');
  console.log('🗄️  Database Module: /database (schema.sql & fitlife_db.json)');
  console.log('====================================================');
});
