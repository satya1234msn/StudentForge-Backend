const prisma = require('../utils/prisma');

// Get current user profile
const getMe = async (req, res, next) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Omit sensitive password hash
    const { passwordHash, ...safeUserData } = user;
    return res.json(safeUserData);
  } catch (error) {
    next(error);
  }
};

// Update current user profile
const updateMe = async (req, res, next) => {
  try {
    const userId = req.userId;
    const {
      college,
      course,
      year,
      bio,
      avatarUrl,
      githubUrl,
      behanceUrl,
      linkedinUrl,
      portfolioUrl,
      availabilityHours,
      workStyle
    } = req.body;

    const updateData = {};

    if (college !== undefined) updateData.college = college;
    if (course !== undefined) updateData.course = course;
    if (year !== undefined) updateData.year = year ? parseInt(year, 10) : null;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (githubUrl !== undefined) updateData.githubUrl = githubUrl;
    if (behanceUrl !== undefined) updateData.behanceUrl = behanceUrl;
    if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl;
    if (portfolioUrl !== undefined) updateData.portfolioUrl = portfolioUrl;
    if (availabilityHours !== undefined) {
      updateData.availabilityHours = availabilityHours ? parseInt(availabilityHours, 10) : 10;
    }
    if (workStyle !== undefined) updateData.workStyle = workStyle;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        skills: true
      }
    });

    const { passwordHash, ...safeUserData } = updatedUser;
    return res.json({
      message: 'Profile updated successfully!',
      user: safeUserData
    });
  } catch (error) {
    next(error);
  }
};

// Get public profile of a user by username or ID
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        skills: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { passwordHash, email, ...publicUserData } = user;
    return res.json(publicUserData);
  } catch (error) {
    next(error);
  }
};

// Add or update skills in bulk for a user
const addOrUpdateSkills = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { skills } = req.body; // Expecting Array of: { skillName, category, level }

    if (!skills || !Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills array is required.' });
    }

    const results = [];

    for (const item of skills) {
      const { skillName, category, level } = item;

      if (!skillName || !category || !level) {
        continue;
      }

      // Check if skill already declared manually
      const existingSkill = await prisma.skill.findFirst({
        where: {
          userId,
          skillName: { equals: skillName, mode: 'insensitive' }
        }
      });

      if (existingSkill) {
        // Update level of existing skill
        const updated = await prisma.skill.update({
          where: { id: existingSkill.id },
          data: { level, category }
        });
        results.push(updated);
      } else {
        // Create new skill declaration
        const created = await prisma.skill.create({
          data: {
            userId,
            skillName,
            category,
            level,
            source: 'manual'
          }
        });
        results.push(created);
      }
    }

    return res.json({
      message: 'Skills updated successfully!',
      skills: results
    });
  } catch (error) {
    next(error);
  }
};

// Remove a skill
const removeSkill = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const skill = await prisma.skill.findUnique({
      where: { id }
    });

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found.' });
    }

    if (skill.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this skill.' });
    }

    await prisma.skill.delete({
      where: { id }
    });

    return res.json({ message: 'Skill deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  updateMe,
  getUserById,
  addOrUpdateSkills,
  removeSkill
};
