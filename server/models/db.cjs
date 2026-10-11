const { PrismaClient } = require('./prisma-client.cjs');
const prisma = new PrismaClient();
module.exports = prisma;
