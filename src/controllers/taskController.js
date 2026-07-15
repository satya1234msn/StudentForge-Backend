const prisma = require('../utils/prisma');

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

// Weighted matching and workload distribution engine trigger (via Google Gemini)
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

    // Map database members array format to simple context
    const parsedMembers = members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      skills: m.user.skills.map(s => ({
        skillName: s.skillName,
        category: s.category,
        level: s.level
      })),
      bio: m.user.bio || '',
      availabilityHours: m.user.availabilityHours || 10,
      reliabilityScore: m.user.reliabilityScore || 5.0
    }));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API configuration error: GEMINI_API_KEY is not defined in the environment variables.'
      });
    }

    console.log(`[AI MATCHING] Invoking Gemini to distribute ${tasks.length} tasks across ${parsedMembers.length} members for project "${project.title}"`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an AI workload balancer and smart task matching engine for student projects. You need to assign the following list of tasks to the project's active team members fairly and intelligently.

Tasks to assign:
${JSON.stringify(tasks, null, 2)}

Active Team Members:
${JSON.stringify(parsedMembers, null, 2)}

Please distribute these tasks among the team members based on the following guidelines:
1. Match tasks to members based on their skills (categories and names) and bio.
2. Balance the workload so that the total estimated hours assigned to a member is proportional to their availabilityHours, and does not exceed their capacity.
3. Distribute tasks so that all members are involved (no single-member concentration unless there is only one member).
4. For each member, designate at least one task that stretches their skill stack as a learning goal (set 'isLearningTask' to true).
5. Explain the reasoning behind your assignments.

Return a JSON object with the following fields:
- 'assignments': (object, mapping each member's id to an array of tasks assigned to them. Each task object in the array must contain 'title', 'description', 'category', 'priority', 'estimatedHours', and a boolean 'isLearningTask')
- 'memberLoads': (object, mapping each member's id to their total estimated hours as a number)
- 'matchLogs': (array of objects, where each object has 'taskTitle', 'assignedTo' (member name), and 'rationale' (string explanation of why they were matched))

Ensure the output is valid JSON matching this schema exactly.`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI MATCHING] Gemini API responded with status ${response.status}: ${errorText}`);
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

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('[AI MATCHING] Failed to parse JSON from Gemini response:', text, parseErr);
      return res.status(502).json({
        error: 'Gemini API returned invalid JSON text.',
        details: text
      });
    }

    const { assignments, memberLoads, matchLogs } = parsed;

    if (!assignments || typeof assignments !== 'object' || !memberLoads || typeof memberLoads !== 'object') {
      return res.status(502).json({ error: 'Gemini API response did not match the expected task matching schema.' });
    }

    // Database transaction to save tasks and activate project status
    await prisma.$transaction(async (tx) => {
      // 1. Delete any existing tasks for this project first
      await tx.task.deleteMany({ where: { projectId } });

      // 2. Insert and save all assigned tasks
      for (const [memberId, memberTasks] of Object.entries(assignments)) {
        if (!Array.isArray(memberTasks)) continue;
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
      message: 'Tasks successfully distributed and locked via Gemini AI!',
      memberLoads,
      matchLogs: matchLogs || []
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
