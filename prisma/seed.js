const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting StudentForge Database Seeding...');

  // 1. Clear existing database entries in reverse order
  console.log('Clearing database tables...');
  await prisma.notification.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.projectRole.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.memberSkillsSnapshot.deleteMany({});
  await prisma.skill.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Generating password hashes...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 2. Generate Indian Student Users
  console.log('Creating demo student profiles...');
  
  const satya = await prisma.user.create({
    data: {
      name: 'Satya Prasad',
      email: 'satya@nit.edu',
      passwordHash,
      college: 'National Institute of Technology, Trichy',
      course: 'B.Tech Computer Science',
      year: 4,
      bio: 'Full-stack developer focused on creating reliable distributed systems and low-latency APIs. Proficient in React, Node, and Postgres.',
      availabilityHours: 20,
      workStyle: 'both',
      reliabilityScore: 5.0,
      projectsCompleted: 3
    }
  });

  const priya = await prisma.user.create({
    data: {
      name: 'Priya Patel',
      email: 'priya@bits.edu',
      passwordHash,
      college: 'BITS Pilani',
      course: 'B.E. Electronics & Communication',
      year: 4,
      bio: 'Machine learning engineer interested in edge computing and neural networks. Passionate about leveraging AI for social impact.',
      availabilityHours: 15,
      workStyle: 'async',
      reliabilityScore: 4.8,
      projectsCompleted: 2
    }
  });

  const aarav = await prisma.user.create({
    data: {
      name: 'Aarav Sharma',
      email: 'aarav@iit.edu',
      passwordHash,
      college: 'Indian Institute of Technology, Bombay',
      course: 'B.Tech Computer Science',
      year: 3,
      bio: 'Frontend enthusiast obsessed with high-fidelity micro-interactions, CSS layouts, and performance benchmarking.',
      availabilityHours: 12,
      workStyle: 'sync',
      reliabilityScore: 4.9,
      projectsCompleted: 4
    }
  });

  const meera = await prisma.user.create({
    data: {
      name: 'Meera Nair',
      email: 'meera@vit.edu',
      passwordHash,
      college: 'Vellore Institute of Technology',
      course: 'B.Tech Software Engineering',
      year: 3,
      bio: 'UI/UX Designer who loves crafting gorgeous dark modes and interactive user personas. Experienced in Figma and Spline.',
      availabilityHours: 10,
      workStyle: 'both',
      reliabilityScore: 4.7,
      projectsCompleted: 1
    }
  });

  const kabir = await prisma.user.create({
    data: {
      name: 'Kabir Mehta',
      email: 'kabir@dtu.edu',
      passwordHash,
      college: 'Delhi Technological University',
      course: 'B.Tech Information Technology',
      year: 2,
      bio: 'Backend enthusiast and database explorer. Loves optimizing SQL indexes, writing clean Express code, and testing.',
      availabilityHours: 18,
      workStyle: 'both',
      reliabilityScore: 5.0,
      projectsCompleted: 2
    }
  });

  const ananya = await prisma.user.create({
    data: {
      name: 'Ananya Iyer',
      email: 'ananya@rvce.edu',
      passwordHash,
      college: 'RV College of Engineering',
      course: 'B.E. Computer Science',
      year: 3,
      bio: 'QA Engineer and Python scripter. Believes that code without automated testing is only halfway finished.',
      availabilityHours: 15,
      workStyle: 'async',
      reliabilityScore: 4.6,
      projectsCompleted: 1
    }
  });

  console.log('Student profiles successfully generated.');

  // 3. Populate student skills
  console.log('Declaring skills lists...');
  const skillsData = [
    // Satya's skills
    { userId: satya.id, skillName: 'React', category: 'frontend', level: 'advanced', source: 'manual' },
    { userId: satya.id, skillName: 'Node.js', category: 'backend', level: 'advanced', source: 'manual' },
    { userId: satya.id, skillName: 'PostgreSQL', category: 'backend', level: 'intermediate', source: 'manual' },
    // Priya's skills
    { userId: priya.id, skillName: 'Python', category: 'data', level: 'advanced', source: 'manual' },
    { userId: priya.id, skillName: 'TensorFlow', category: 'data', level: 'intermediate', source: 'manual' },
    { userId: priya.id, skillName: 'Data Analytics', category: 'data', level: 'advanced', source: 'manual' },
    // Aarav's skills
    { userId: aarav.id, skillName: 'Tailwind CSS', category: 'frontend', level: 'advanced', source: 'manual' },
    { userId: aarav.id, skillName: 'HTML/CSS', category: 'frontend', level: 'advanced', source: 'manual' },
    { userId: aarav.id, skillName: 'JavaScript', category: 'frontend', level: 'advanced', source: 'manual' },
    // Meera's skills
    { userId: meera.id, skillName: 'Figma', category: 'design', level: 'advanced', source: 'manual' },
    { userId: meera.id, skillName: 'UI Design', category: 'design', level: 'advanced', source: 'manual' },
    { userId: meera.id, skillName: 'Spline', category: 'design', level: 'beginner', source: 'manual' },
    // Kabir's skills
    { userId: kabir.id, skillName: 'Express', category: 'backend', level: 'advanced', source: 'manual' },
    { userId: kabir.id, skillName: 'MongoDB', category: 'backend', level: 'intermediate', source: 'manual' },
    { userId: kabir.id, skillName: 'Redis', category: 'backend', level: 'beginner', source: 'manual' },
    // Ananya's skills
    { userId: ananya.id, skillName: 'Jest', category: 'testing', level: 'intermediate', source: 'manual' },
    { userId: ananya.id, skillName: 'Python', category: 'testing', level: 'intermediate', source: 'manual' }
  ];

  for (const skill of skillsData) {
    await prisma.skill.create({ data: skill });
  }
  console.log('Student skills registered.');

  // 4. Create Active forming Projects
  console.log('Spawning open projects and vacancy role slots...');

  // Project 1 - Satya's Smart Campus Navigation
  const campusProject = await prisma.project.create({
    data: {
      ownerId: satya.id,
      title: 'Smart Campus Navigation System',
      description: 'A responsive PWA designed to help freshmen and campus visitors navigate basement corridors, laboratories, and lecture complexes utilizing bluetooth beacon scanning and SVG-based floor maps.',
      domainTags: ['Web Dev', 'Design UI/UX', 'Social Impact'],
      complexity: 'intermediate',
      teamSize: 4,
      deadline: new Date('2026-09-15'),
      status: 'forming',
      collegeOnly: true,
      collegeName: satya.college,
      isOpenContribution: false
    }
  });

  await prisma.projectRole.createMany({
    data: [
      { projectId: campusProject.id, roleTitle: 'Lead UI/UX Designer', skillsRequired: ['Figma', 'UI Design'], levelRequired: 'intermediate', filled: false },
      { projectId: campusProject.id, roleTitle: 'PWA Frontend Specialist', skillsRequired: ['React', 'JavaScript'], levelRequired: 'intermediate', filled: false },
      { projectId: campusProject.id, roleTitle: 'Backend API Engineer', skillsRequired: ['Express', 'Node.js'], levelRequired: 'intermediate', filled: false }
    ]
  });

  // Project 2 - Priya's ML Crops Diagnosis
  const cropsProject = await prisma.project.create({
    data: {
      ownerId: priya.id,
      title: 'AI Crop Disease Diagnostics Tool',
      description: 'A mobile-friendly system enabling small-scale farmers to take leaf photographs and classify fungal rust, rot, or blight instantly on-field. Includes recommendations based on regional weather databases.',
      domainTags: ['AI/ML', 'Mobile App', 'Research'],
      complexity: 'advanced',
      teamSize: 3,
      deadline: new Date('2026-10-30'),
      status: 'forming',
      collegeOnly: false,
      isOpenContribution: true
    }
  });

  await prisma.projectRole.createMany({
    data: [
      { projectId: cropsProject.id, roleTitle: 'TensorFlow ML Architect', skillsRequired: ['Python', 'TensorFlow'], levelRequired: 'advanced', filled: false },
      { projectId: cropsProject.id, roleTitle: 'React Native Developer', skillsRequired: ['JavaScript', 'HTML/CSS'], levelRequired: 'intermediate', filled: false }
    ]
  });

  // Project 3 - Aarav's High Perf Code Sandbox
  const sandboxProject = await prisma.project.create({
    data: {
      ownerId: aarav.id,
      title: 'Real-time Monospace Code Editor',
      description: 'An interactive browser-based code playground providing real-time multi-peer document sync via WebSocket buffers. Includes syntax compilers for Python and JavaScript.',
      domainTags: ['Web Dev', 'Research'],
      complexity: 'advanced',
      teamSize: 3,
      deadline: new Date('2026-08-01'),
      status: 'forming',
      collegeOnly: false,
      isOpenContribution: false
    }
  });

  await prisma.projectRole.createMany({
    data: [
      { projectId: sandboxProject.id, roleTitle: 'Socket Backend Systems Developer', skillsRequired: ['Node.js', 'Express'], levelRequired: 'advanced', filled: false },
      { projectId: sandboxProject.id, roleTitle: 'Monaco Editor Customizer', skillsRequired: ['React', 'JavaScript'], levelRequired: 'intermediate', filled: false }
    ]
  });

  // 5. Register active owner memberships
  console.log('Setting up owner memberships...');
  await prisma.projectMember.createMany({
    data: [
      { projectId: campusProject.id, userId: satya.id, role: 'Project Owner', status: 'active' },
      { projectId: cropsProject.id, userId: priya.id, role: 'Project Owner', status: 'active' },
      { projectId: sandboxProject.id, userId: aarav.id, role: 'Project Owner', status: 'active' }
    ]
  });

  // 6. Simulate some pending applications
  console.log('Simulating mock applications...');
  await prisma.projectMember.createMany({
    data: [
      // Meera and Aarav apply for Satya's Smart Campus Navigation
      { projectId: campusProject.id, userId: meera.id, role: 'Lead UI/UX Designer', status: 'pending' },
      { projectId: campusProject.id, userId: aarav.id, role: 'PWA Frontend Specialist', status: 'pending' }
    ]
  });

  // Emit corresponding notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: satya.id,
        type: 'project_application',
        title: 'New Application Received',
        message: 'Meera Nair has submitted an application for the Lead UI/UX Designer role.',
        link: `/projects/${campusProject.id}/manage`
      },
      {
        userId: satya.id,
        type: 'project_application',
        title: 'New Application Received',
        message: 'Aarav Sharma has submitted an application for the PWA Frontend Specialist role.',
        link: `/projects/${campusProject.id}/manage`
      }
    ]
  });

  console.log('----------------------------------------------------');
  console.log('StudentForge Seeding Completed Successfully!');
  console.log('Created Users   : 6 (Indian names, password: "password123")');
  console.log('Created Projects: 3 (Campus Nav, ML Crops, Code Sandbox)');
  console.log('Created Roles   : 7 vacancies defined');
  console.log('Pending Applications: 2 simulated triggers');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
