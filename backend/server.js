const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const aiRoutes = require('./routes/ai.routes');
const shopRoutes = require('./routes/shop.routes');

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
    project: 'FitLife Health & MMA API (projectMMA)',
    version: '1.0.0',
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/users'],
      health: ['GET /api/health/summary', 'POST /api/health/water', 'POST /api/health/workout'],
      ai: ['POST /api/ai/chat'],
      shop: ['GET /api/shop/items', 'POST /api/shop/buy'],
    },
  });
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/shop', shopRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint không tồn tại!' });
});

// Start Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 FitLife Backend API Server is running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📋 Database: Schema DDL ready at backend/database/schema.sql`);
  console.log('====================================================');
});
