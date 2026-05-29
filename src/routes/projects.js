const express = require('express');
const {
  createProject,
  listProjects,
  getProjectDetail,
  applyToJoin,
  getApplicants,
  acceptMember,
  rejectApplicant,
  getUserApplications
} = require('../controllers/projectController');
const {
  getProjectTasks,
  generateProjectTasks,
  distributeProjectTasks,
  updateTaskStatus
} = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Discovery and detailed lookups are publicly viewable
router.get('/', listProjects);
router.get('/:id', getProjectDetail);

// Protected routes (require user login)
router.use(authMiddleware);

router.get('/my-applications', getUserApplications);

router.post('/', createProject);
router.post('/:id/apply', applyToJoin);
router.get('/:id/applicants', getApplicants);
router.post('/:id/accept/:userId', acceptMember);
router.post('/:id/reject/:userId', rejectApplicant);

// Tasks routes
router.get('/:id/tasks', getProjectTasks);
router.post('/:id/tasks/generate', generateProjectTasks);
router.post('/:id/tasks/distribute', distributeProjectTasks);
router.put('/:id/tasks/:taskId', updateTaskStatus);

module.exports = router;
