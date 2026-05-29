const express = require('express');
const prisma = require('../utils/prisma');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Require user authentication for all notification actions
router.use(authMiddleware);

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(notifications);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
