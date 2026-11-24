const path=require('node:path');
process.env.PORT='3443';process.env.CORS_ORIGIN='https://localhost:3443';
process.env.TLS_CERT_PATH=path.resolve(__dirname,'../backend/certificates/localhost.crt');
process.env.TLS_KEY_PATH=path.resolve(__dirname,'../backend/certificates/localhost.key');
require('../backend/index.cjs');
