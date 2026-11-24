// Export the namespace and client from the same generated provider. Production
// generates only PostgreSQL; the default @prisma/client may still be a stub.
const postgresql = /^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || '');
module.exports = require(postgresql ? '../../node_modules/.prisma-farmacia-postgresql' : '@prisma/client');
