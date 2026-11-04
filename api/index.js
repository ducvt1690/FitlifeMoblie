const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const aiRoutes = require('./ai.routes');
const shopRoutes = require('./shop.routes');

router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/ai', aiRoutes);
router.use('/shop', shopRoutes);

module.exports = {
  router,
  authRoutes,
  healthRoutes,
  aiRoutes,
  shopRoutes,
};
