const prisma = require('../utils/prisma');
const { matchTasksToMembers } = require('../services/matchingService');

// Get all tasks for a project
const getProjectTasks = async (req, res, next) => {
  try {
    const { id: projectId } = req.params;

    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(tasks);
  } catch (error) {
    next(error);
  }
};

// AI Task Generation Smart Simulation
const generateProjectTasks = async (req, res, next) => {
  try {
    const { id: projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    console.log(`[AI SIMULATOR] Simulating task package for project: "${project.title}"`);

    // Dynamic Task seed generation depending on project domains
    const domains = project.domainTags.map(d => d.toLowerCase());
    const generatedTasks = [];

    // Helper to generate IDs
    const createMockId = () => Math.random().toString(36).substring(2, 9);

    // 1. Initial design phase (always included)
    generatedTasks.push({
      id: createMockId(),
      title: 'Design High-Fidelity UI Wireframes',
      description: 'Design key responsive UI layout mockups, user flows, and colour palettes in Figma.',
      category: 'design',
      estimatedHours: 6,
      priority: 'high',
      status: 'unassigned'
    });

    // 2. Add domain-specific technical tasks
    if (domains.includes('web dev') || domains.includes('mobile app')) {
      generatedTasks.push({
        id: createMockId(),
        title: 'Initialize Frontend Boilerplate & Components',
        description: 'Scaffold core React page layouts, global Zustand stores, and configure basic stylesheets.',
        category: 'frontend',
        estimatedHours: 10,
        priority: 'high',
        status: 'unassigned'
      });
    }

    if (domains.includes('web dev') || domains.includes('blockchain') || domains.includes('ai/ml')) {
      generatedTasks.push({
        id: createMockId(),
        title: 'Establish Express API Boilerplate & Routing',
        description: 'Set up node.js server controllers, CORS permissions, express-json parsing, and base auth routing.',
        category: 'backend',
        estimatedHours: 8,
        priority: 'high',
        status: 'unassigned'
      });
      generatedTasks.push({
        id: createMockId(),
        title: 'Define Relational Schemas & Prisma Migrations',
        description: 'Write models for users, projects, and tasks in schema.prisma and execute a database sync command.',
        category: 'backend',
        estimatedHours: 6,
        priority: 'medium',
        status: 'unassigned'
      });
    }

    if (domains.includes('ai/ml') || domains.includes('data science') || domains.includes('research')) {
      generatedTasks.push({
        id: createMockId(),
        title: 'Train Crop Diagnosis Model & Clean Dataset',
        description: 'Train deep convolutional networks (CNNs) in Python/Tensorflow and format raw field data directories.',
        category: 'data',
        estimatedHours: 12,
        priority: 'critical',
        status: 'unassigned'
      });
      generatedTasks.push({
        id: createMockId(),
        title: 'Write Technical Crop blight Research Paper',
        description: 'Draft LaTeX documents detailing ML model parameters, accuracy rates, and testing matrices.',
        category: 'research',
        estimatedHours: 10,
        priority: 'low',
        status: 'unassigned'
      });
    }

    // 3. Testing and Integration (always included)
    generatedTasks.push({
      id: createMockId(),
      title: 'Formulate Automated Integration Jest Tests',
      description: 'Write Jest testing scripts to assert frontend client render results and backend controllers.',
      category: 'testing',
      estimatedHours: 5,
      priority: 'medium',
      status: 'unassigned'
    });

    generatedTasks.push({
      id: createMockId(),
      title: 'Integrate APIs & Connect Frontend Client',
      description: 'Connect React forms with the backend server API, storing JWT access tokens safely in localStorage.',
      category: 'frontend',
      estimatedHours: 8,
      priority: 'high',
      status: 'unassigned'
    });

    return res.json({
      message: 'AI Smart Task simulation successfully generated!',
      tasks: generatedTasks
    });
  } catch (error) {
    next(error);
  }
};

// Weighted matching and workload distribution engine trigger
const distributeProjectTasks = async (req, res, next) => {
  try {
    const { id: projectId } = req.params;
    const { tasks } = req.body; // Array of tasks to distribute

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Array of tasks is required for distribution.' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Fetch accepted team members including their skills
    const members = await prisma.projectMember.findMany({
      where: {
        projectId,
        status: 'active'
      },
      include: {
        user: {
          include: { skills: true }
        }
      }
    });

    if (members.length === 0) {
      return res.status(400).json({ error: 'There are no active members in this project to distribute tasks to.' });
    }

    // Map database members array format to simple algorithm context
    const parsedMembers = members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      skills: m.user.skills,
      bio: m.user.bio,
      availabilityHours: m.user.availabilityHours,
      reliabilityScore: m.user.reliabilityScore
    }));

    // Run the matching algorithm
    const matchResults = matchTasksToMembers(tasks, parsedMembers);
    const { assignments, memberLoads, matchLogs } = matchResults;

    // Database transaction to save tasks and activate project status
    await prisma.$transaction(async (tx) => {
      // 1. Delete any existing tasks for this project first
      await tx.task.deleteMany({ where: { projectId } });

      // 2. Insert and save all assigned tasks
      for (const [memberId, memberTasks] of Object.entries(assignments)) {
        for (const task of memberTasks) {
          await tx.task.create({
            data: {
              projectId,
              title: task.title,
              description: task.description,
              category: task.category,
              assignedTo: memberId,
              assignedBy: 'ai',
              status: 'todo',
              isLearningTask: !!task.isLearningTask,
              priority: task.priority || 'medium',
              estimatedHours: task.estimatedHours || 4
            }
          });

          // Create notification for assigned member
          await tx.notification.create({
            data: {
              userId: memberId,
              type: 'task_assigned',
              title: 'New Task Assigned',
              message: `AI has assigned you the task: "${task.title}" in project "${project.title}".`,
              link: `/projects/${projectId}`
            }
          });
        }
      }

      // 3. Mark the project status as active
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'active' }
      });
    });

    // Emit live socket notify signals
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');

    members.forEach(m => {
      const socketId = connectedUsers.get(m.user.id);
      if (io && socketId) {
        io.to(socketId).emit('notification', {
          title: 'Tasks Distributed!',
          message: `Your tasks are now available in project: ${project.title}`
        });
      }
    });

    return res.json({
      message: 'Tasks successfully distributed and locked!',
      memberLoads,
      matchLogs
    });
  } catch (error) {
    next(error);
  }
};

// Update task status (Kanban drag and drop actions)
const updateTaskStatus = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body; // todo, in_progress, review, done

    const validStatuses = ['todo', 'in_progress', 'review', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid task status code provided.' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === 'done' ? new Date() : null
      }
    });

    // Notify project owner when a task is moved to under review
    if (status === 'review' && task.project.ownerId) {
      await prisma.notification.create({
        data: {
          userId: task.project.ownerId,
          type: 'task_review',
          title: 'Task Ready for Review',
          message: `The task "${task.title}" has been moved to review.`,
          link: `/projects/${task.projectId}`
        }
      });

      const io = req.app.get('io');
      const connectedUsers = req.app.get('connectedUsers');
      const ownerSocketId = connectedUsers.get(task.project.ownerId);
      if (io && ownerSocketId) {
        io.to(ownerSocketId).emit('notification', {
          title: 'Task Review Alert',
          message: `"${task.title}" is ready for your review.`
        });
      }
    }

    return res.json({
      message: 'Task status updated successfully!',
      task: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjectTasks,
  generateProjectTasks,
  distributeProjectTasks,
  updateTaskStatus
};
