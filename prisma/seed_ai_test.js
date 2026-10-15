const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data for AI testing...');

  const testEmails = ['ai_owner@nit.edu', 'ai_member1@nit.edu', 'ai_member2@nit.edu'];

  // Cleanup existing test data if any
  console.log('Cleaning up previous AI test data...');
  
  // Find users
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: testEmails } }
  });
  const userIds = existingUsers.map(u => u.id);

  if (userIds.length > 0) {
    // Delete tasks associated with the project first
    const projects = await prisma.project.findMany({
      where: { ownerId: { in: userIds } }
    });
    const projectIds = projects.map(p => p.id);

    if (projectIds.length > 0) {
      await prisma.task.deleteMany({
        where: { projectId: { in: projectIds } }
      });
      await prisma.projectRole.deleteMany({
        where: { projectId: { in: projectIds } }
      });
      await prisma.projectMember.deleteMany({
        where: { projectId: { in: projectIds } }
      });
    }

    // Delete memberships first
    await prisma.projectMember.deleteMany({
      where: { userId: { in: userIds } }
    });
    // Delete skills
    await prisma.skill.deleteMany({
      where: { userId: { in: userIds } }
    });
    // Delete projects owned by owner
    const owner = existingUsers.find(u => u.email === 'ai_owner@nit.edu');
    if (owner) {
      await prisma.project.deleteMany({
        where: { ownerId: owner.id }
      });
    }
    // Delete users
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 1. Create users
  console.log('Creating AI test users...');
  const owner = await prisma.user.create({
    data: {
      name: 'AI Owner Satya',
      email: 'ai_owner@nit.edu',
      passwordHash,
      college: 'National Institute of Technology, Trichy',
      course: 'B.Tech Computer Science',
      year: 4,
      bio: 'Owner of the AI test project. Full-stack developer.',
      availabilityHours: 20,
      workStyle: 'both',
      reliabilityScore: 5.0,
      projectsCompleted: 3
    }
  });

  const member1 = await prisma.user.create({
    data: {
      name: 'AI Member Frontend',
      email: 'ai_member1@nit.edu',
      passwordHash,
      college: 'National Institute of Technology, Trichy',
      course: 'B.Tech Computer Science',
      year: 3,
      bio: 'Frontend specialist. Passionate about React, Tailwind, and high-fidelity UI design.',
      availabilityHours: 15,
      workStyle: 'sync',
      reliabilityScore: 4.8,
      projectsCompleted: 2
    }
  });

  const member2 = await prisma.user.create({
    data: {
      name: 'AI Member Backend',
      email: 'ai_member2@nit.edu',
      passwordHash,
      college: 'National Institute of Technology, Trichy',
      course: 'B.Tech Computer Science',
      year: 3,
      bio: 'Backend specialist. Experienced with Node.js, Express, PostgreSQL, and API design.',
      availabilityHours: 18,
      workStyle: 'async',
      reliabilityScore: 4.9,
      projectsCompleted: 2
    }
  });

  // 2. Create skills
  console.log('Adding user skills...');
  await prisma.skill.createMany({
    data: [
      { userId: member1.id, skillName: 'React', category: 'frontend', level: 'advanced', source: 'manual' },
      { userId: member1.id, skillName: 'Tailwind CSS', category: 'frontend', level: 'advanced', source: 'manual' },
      { userId: member1.id, skillName: 'UI Design', category: 'design', level: 'intermediate', source: 'manual' },
      
      { userId: member2.id, skillName: 'Node.js', category: 'backend', level: 'advanced', source: 'manual' },
      { userId: member2.id, skillName: 'Express', category: 'backend', level: 'advanced', source: 'manual' },
      { userId: member2.id, skillName: 'PostgreSQL', category: 'backend', level: 'intermediate', source: 'manual' },
    ]
  });

  // 3. Create project
  console.log('Creating project...');
  const project = await prisma.project.create({
    data: {
      ownerId: owner.id,
      title: 'AI Smart Project Organizer',
      description: 'A platform to test automated task assignment and matching using LLMs. It features full-stack components, automated API generation, and beautiful designs.',
      domainTags: ['Web Dev', 'AI/ML', 'Collaborative Tool'],
      complexity: 'intermediate',
      teamSize: 3,
      deadline: new Date('2026-12-31'),
      status: 'forming',
      collegeOnly: false,
      isOpenContribution: true
    }
  });

  // 4. Create project roles
  console.log('Creating project roles...');
  await prisma.projectRole.createMany({
    data: [
      { projectId: project.id, roleTitle: 'Project Lead / Owner', skillsRequired: ['Node.js', 'React'], levelRequired: 'advanced', filled: true, filledBy: owner.id },
      { projectId: project.id, roleTitle: 'Frontend Engineer', skillsRequired: ['React', 'Tailwind CSS'], levelRequired: 'advanced', filled: true, filledBy: member1.id },
      { projectId: project.id, roleTitle: 'Backend Engineer', skillsRequired: ['Node.js', 'Express'], levelRequired: 'advanced', filled: true, filledBy: member2.id },
    ]
  });

  // 5. Add memberships
  console.log('Adding memberships...');
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: owner.id, role: 'Project Owner', status: 'active' },
      { projectId: project.id, userId: member1.id, role: 'Frontend Engineer', status: 'active' },
      { projectId: project.id, userId: member2.id, role: 'Backend Engineer', status: 'active' },
    ]
  });

  console.log('\n-----------------------------------------');
  console.log('AI Test Seeding Successful!');
  console.log(`Project Created: "${project.title}" (ID: ${project.id})`);
  console.log(`Owner: ${owner.name} (${owner.email})`);
  console.log(`Member 1: ${member1.name} (${member1.email})`);
  console.log(`Member 2: ${member2.name} (${member2.email})`);
  console.log('-----------------------------------------\n');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
