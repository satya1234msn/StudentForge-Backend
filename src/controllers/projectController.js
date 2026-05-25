const prisma = require('../utils/prisma');

// Create new project and define roles slots
const createProject = async (req, res, next) => {
  try {
    const ownerId = req.userId;
    const {
      title,
      description,
      domainTags,
      complexity,
      teamSize,
      deadline,
      collegeOnly,
      collegeName,
      isOpenContribution,
      roles // Expecting array: [ { roleTitle, skillsRequired, levelRequired } ]
    } = req.body;

    if (!title || !description || !teamSize || !deadline) {
      return res.status(400).json({ error: 'Title, description, team size, and deadline are required.' });
    }

    const parsedDeadline = new Date(deadline);
    const parsedTeamSize = parseInt(teamSize, 10);

    // Create project using transaction
    const project = await prisma.$transaction(async (tx) => {
      // 1. Create the project
      const newProject = await tx.project.create({
        data: {
          ownerId,
          title,
          description,
          domainTags: domainTags || [],
          complexity: complexity || 'intermediate',
          teamSize: parsedTeamSize,
          deadline: parsedDeadline,
          collegeOnly: !!collegeOnly,
          collegeName: collegeOnly ? collegeName : null,
          isOpenContribution: !!isOpenContribution,
          status: 'forming'
        }
      });

      // 2. Create the roles if provided
      if (roles && Array.isArray(roles)) {
        for (const role of roles) {
          await tx.projectRole.create({
            data: {
              projectId: newProject.id,
              roleTitle: role.roleTitle,
              skillsRequired: role.skillsRequired || [],
              levelRequired: role.levelRequired || 'intermediate'
            }
          });
        }
      }

      // 3. Add owner as active project member immediately
      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: ownerId,
          role: 'Project Owner',
          status: 'active'
        }
      });

      return newProject;
    });

    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        roles: true,
        members: {
          include: {
            user: {
              select: { name: true, avatarUrl: true }
            }
          }
        }
      }
    });

    return res.status(201).json({
      message: 'Project created successfully!',
      project: fullProject
    });
  } catch (error) {
    next(error);
  }
};

// List/search all active/forming projects with optional filters
const listProjects = async (req, res, next) => {
  try {
    const { search, domain, complexity } = req.query;

    const whereClause = {
      status: 'forming'
    };

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (domain) {
      whereClause.domainTags = {
        has: domain
      };
    }

    if (complexity) {
      whereClause.complexity = complexity;
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, name: true, college: true, avatarUrl: true }
        },
        roles: true,
        members: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(projects);
  } catch (error) {
    next(error);
  }
};

// Get single project detailed info
const getProjectDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, college: true, avatarUrl: true, reliabilityScore: true }
        },
        roles: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, college: true, avatarUrl: true, reliabilityScore: true }
            }
          }
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true }
            }
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    return res.json(project);
  } catch (error) {
    next(error);
  }
};

// Apply to join a project (creates a pending member entry)
const applyToJoin = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id: projectId } = req.params;
    const { roleTitle, note } = req.body;

    if (!roleTitle) {
      return res.status(400).json({ error: 'Role title you are applying for is required.' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.ownerId === userId) {
      return res.status(400).json({ error: 'You are the project owner.' });
    }

    // Check if already a member or applicant
    const existingMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId
      }
    });

    if (existingMember) {
      return res.status(400).json({
        error: existingMember.status === 'pending'
          ? 'You have already applied to this project.'
          : 'You are already a member of this project.'
      });
    }

    // Create the pending applicant
    const applicant = await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: roleTitle,
        status: 'pending'
      }
    });

    // Notify project owner
    const applyingUser = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.notification.create({
      data: {
        userId: project.ownerId,
        type: 'project_application',
        title: 'New Project Application',
        message: `${applyingUser.name} applied for the ${roleTitle} role in your project "${project.title}".`,
        link: `/projects/${projectId}/manage`
      }
    });

    // Emit live socket event if socket connected
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const ownerSocketId = connectedUsers.get(project.ownerId);
    if (io && ownerSocketId) {
      io.to(ownerSocketId).emit('notification', {
        title: 'New Project Application',
        message: `${applyingUser.name} applied for ${roleTitle}`
      });
    }

    return res.status(201).json({
      message: 'Application submitted successfully!',
      applicant
    });
  } catch (error) {
    next(error);
  }
};

// Get list of applicants (Project Owner only)
const getApplicants = async (req, res, next) => {
  try {
    const ownerId = req.userId;
    const { id: projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.ownerId !== ownerId) {
      return res.status(403).json({ error: 'Unauthorized. Only project owners can view applicants.' });
    }

    const applicants = await prisma.projectMember.findMany({
      where: {
        projectId,
        status: 'pending'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            college: true,
            avatarUrl: true,
            reliabilityScore: true,
            skills: true
          }
        }
      }
    });

    return res.json(applicants);
  } catch (error) {
    next(error);
  }
};

// Accept an applicant (Project Owner only)
const acceptMember = async (req, res, next) => {
  try {
    const ownerId = req.userId;
    const { id: projectId, userId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { roles: true }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.ownerId !== ownerId) {
      return res.status(403).json({ error: 'Unauthorized. Only project owners can accept members.' });
    }

    // Find the membership application
    const application = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        status: 'pending'
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Pending application not found.' });
    }

    // Run in Prisma transaction
    await prisma.$transaction(async (tx) => {
      // 1. Accept the member (set status: 'active')
      await tx.projectMember.update({
        where: { id: application.id },
        data: { status: 'active' }
      });

      // 2. Try to fill the corresponding role slot
      const matchedRole = project.roles.find(
        (r) => !r.filled && r.roleTitle.toLowerCase() === application.role.toLowerCase()
      );

      if (matchedRole) {
        await tx.projectRole.update({
          where: { id: matchedRole.id },
          data: {
            filled: true,
            filledBy: userId
          }
        });
      }
    });

    // Notify applicant
    await prisma.notification.create({
      data: {
        userId,
        type: 'project_accepted',
        title: 'Application Accepted!',
        message: `Congratulations! You have been accepted for the "${application.role}" role in project "${project.title}".`,
        link: `/projects/${projectId}/manage`
      }
    });

    // Emit live socket alert
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');
    const applicantSocketId = connectedUsers.get(userId);
    if (io && applicantSocketId) {
      io.to(applicantSocketId).emit('notification', {
        title: 'Application Accepted!',
        message: `You were accepted into "${project.title}"`
      });
    }

    return res.json({ message: 'Applicant accepted successfully!' });
  } catch (error) {
    next(error);
  }
};

// Reject an applicant (Project Owner only)
const rejectApplicant = async (req, res, next) => {
  try {
    const ownerId = req.userId;
    const { id: projectId, userId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.ownerId !== ownerId) {
      return res.status(403).json({ error: 'Unauthorized. Only project owners can reject applicants.' });
    }

    const application = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
        status: 'pending'
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Pending application not found.' });
    }

    // Delete application
    await prisma.projectMember.delete({
      where: { id: application.id }
    });

    // Notify applicant
    await prisma.notification.create({
      data: {
        userId,
        type: 'project_rejected',
        title: 'Application Update',
        message: `Your application for "${application.role}" in project "${project.title}" was not selected.`,
        link: `/discover`
      }
    });

    return res.json({ message: 'Applicant rejected successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  listProjects,
  getProjectDetail,
  applyToJoin,
  getApplicants,
  acceptMember,
  rejectApplicant
};
