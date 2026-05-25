const express = require('express');
const { register, login, refresh, logout } = require('../controllers/authController');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// Apply rate limiting to authentication routes
router.use(rateLimiter);

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
