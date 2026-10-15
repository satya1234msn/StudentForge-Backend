const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany();
  console.log('--- USERS ---');
  users.forEach(u => console.log(`User: ${u.name} | Email: ${u.email} | ID: ${u.id}`));

  const projects = await prisma.project.findMany();
  console.log('\n--- PROJECTS ---');
  projects.forEach(p => console.log(`Project: ${p.title} | Status: ${p.status} | ID: ${p.id}`));

  const tasks = await prisma.task.findMany();
  console.log('\n--- TASKS ---');
  tasks.forEach(t => console.log(`Task: ${t.title} | Status: ${t.status} | AssignedTo: ${t.assignedTo} | ID: ${t.id}`));
}

run().finally(() => prisma.$disconnect());
