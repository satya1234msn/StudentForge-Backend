const express = require('express');
const {
  createProject,
  listProjects,
  getProjectDetail,
  applyToJoin,
  getApplicants,
  acceptMember,
  rejectApplicant
} = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Discovery and detailed lookups are publicly viewable
router.get('/', listProjects);
router.get('/:id', getProjectDetail);

// Protected routes (require user login)
router.use(authMiddleware);

router.post('/', createProject);
router.post('/:id/apply', applyToJoin);
router.get('/:id/applicants', getApplicants);
router.post('/:id/accept/:userId', acceptMember);
router.post('/:id/reject/:userId', rejectApplicant);

module.exports = router;
