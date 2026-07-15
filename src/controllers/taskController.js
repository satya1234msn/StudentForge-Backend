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

    // Try generating tasks using the live Google Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API configuration error: GEMINI_API_KEY is not defined in the environment variables.'
      });
    }

    console.log(`[AI ORCHESTRATION] Using Gemini API to generate tasks for project: "${project.title}"`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a JSON list of tasks for a student team project with the title "${project.title}" and description "${project.description}", having technical domains: ${project.domainTags.join(', ')}. Return a JSON object with a single field 'tasks' containing an array of objects, where each object has:
- 'title': (string, name of the task)
- 'description': (string, brief task explanation)
- 'category': (string, one of: design, frontend, backend, data, research, testing)
- 'estimatedHours': (number, hours between 3 and 16)
- 'priority': (string, one of: low, medium, high, critical)
- 'status': (must be 'unassigned')

Make sure to generate between 5 to 8 relevant tasks that perfectly fit the project's title, description, and technical domains. Return valid JSON only matching the schema exactly.`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI ORCHESTRATION] Gemini API responded with status ${response.status}: ${errorText}`);
      return res.status(response.status).json({
        error: `Gemini API call failed with status ${response.status}.`,
        details: errorText
      });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: 'Gemini API returned an empty or invalid response.' });
    }

    try {
      const parsed = JSON.parse(text);
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        const generatedTasks = parsed.tasks.map(t => ({
          id: Math.random().toString(36).substring(2, 9),
          title: t.title || 'Untitled Task',
          description: t.description || '',
          category: t.category || 'frontend',
          estimatedHours: t.estimatedHours || 6,
          priority: t.priority || 'medium',
          status: 'unassigned'
        }));
        
        return res.json({
          message: 'AI Smart Task generation successfully processed via Google Gemini!',
          tasks: generatedTasks
        });
      } else {
        return res.status(502).json({ error: 'Gemini API response did not match the expected task list schema.' });
      }
    } catch (parseErr) {
      console.error('[AI ORCHESTRATION] Failed to parse JSON from Gemini response:', text, parseErr);
      return res.status(502).json({
        error: 'Gemini API returned invalid JSON text.',
        details: text
      });
    }
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
