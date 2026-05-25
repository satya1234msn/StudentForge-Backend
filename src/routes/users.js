const express = require('express');
const {
  getMe,
  updateMe,
  getUserById,
  addOrUpdateSkills,
  removeSkill
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Public route to view details of any student
router.get('/:id', getUserById);

// Protected routes (require user login)
router.use(authMiddleware);

router.get('/me', getMe);
router.put('/me', updateMe);
router.post('/me/skills', addOrUpdateSkills);
router.delete('/me/skills/:id', removeSkill);

module.exports = router;
