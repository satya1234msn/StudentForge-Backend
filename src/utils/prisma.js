const { PrismaClient } = require('@prisma/client');

// Instantiate global Prisma Client for database queries
const prisma = new PrismaClient();

module.exports = prisma;
