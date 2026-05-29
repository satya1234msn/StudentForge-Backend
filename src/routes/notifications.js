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

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const notif = await prisma.notification.findFirst({
      where: { id, userId: req.userId }
    });

    if (!notif) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    await prisma.notification.delete({
      where: { id }
    });

    return res.json({ success: true, message: 'Notification cleared successfully.' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notifications (Clear all)
router.delete('/', async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.userId }
    });
    return res.json({ success: true, message: 'All notifications cleared.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
