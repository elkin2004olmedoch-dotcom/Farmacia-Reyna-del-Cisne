const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const {productionEnvironment, runSetup} = require('../../scripts/setup-production.cjs');

// These values are synthetic. No test connects to PostgreSQL or reads .env.
const valid = () => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://postgres:synthetic-password@localhost:5432/test?sslmode=require',
  RENDER_EXTERNAL_URL: 'https://farmacia-demo.onrender.com',
  JWT_SECRET: 'SyntheticPrivateSecret_12345678901234567890',
  ADMIN_EMAIL: 'admin-test@example.ec',
  ADMIN_PASSWORD: 'Administrador2026!',
  IMAGE_STORAGE: 'supabase',
  SUPABASE_URL: 'https://synthetic-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-key-do-not-use',
  SUPABASE_STORAGE_BUCKET: 'farmaciaproductos'
});

test('producción prepara un entorno independiente con HTTPS y HOST externo sin alterar el original', () => {
  const original = Object.freeze(valid());
  const processBefore = {...process.env};
  const prepared = productionEnvironment(original);
  assert.equal(prepared.HOST, '0.0.0.0');
  assert.equal(prepared.CORS_ORIGIN, 'https://farmacia-demo.onrender.com');
  assert.equal(original.HOST, undefined);
  assert.equal(original.CORS_ORIGIN, undefined);
  assert.deepEqual({...process.env}, processBefore);
  assert.equal(productionEnvironment({...valid(), CORS_ORIGIN: 'https://farmacia.example.ec, https://tienda.example.ec'}).CORS_ORIGIN, 'https://farmacia.example.ec,https://tienda.example.ec');
});

test('producción acepta Secret key sin legacy y prioriza la nueva sin imprimirla', () => {
  const env = {...valid(), SUPABASE_SECRET_KEY: 'sb_secret_synthetic-server-key-never-use'};
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(productionEnvironment(env).SUPABASE_SECRET_KEY, env.SUPABASE_SECRET_KEY);
  assert.equal(productionEnvironment({...env, SUPABASE_SERVICE_ROLE_KEY: '\r\nobsolete-invalid-key'}).SUPABASE_SECRET_KEY, env.SUPABASE_SECRET_KEY);
  const messages = [], calls = [];
  runSetup({env, logger: {info: value => messages.push(value)}, run: (...args) => {
    calls.push(args);
    return {status: 0, stdout: env.SUPABASE_SECRET_KEY, stderr: env.SUPABASE_SECRET_KEY};
  }});
  assert.equal(calls.length, 4);
  assert.equal(calls[0][2].env.SUPABASE_SECRET_KEY, env.SUPABASE_SECRET_KEY);
  assert.ok(!messages.join('\n').includes(env.SUPABASE_SECRET_KEY));
  assert.equal(productionEnvironment({...env, SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: valid().SUPABASE_SERVICE_ROLE_KEY}).SUPABASE_SECRET_KEY, '');
});

test('producción bloquea configuraciones inválidas antes de ejecutar migraciones', () => {
  const invalid = [
    {NODE_ENV: 'development'}, {DATABASE_URL: 'file:./farmacia.db'},
    {DATABASE_URL: 'postgresql://postgres:private@localhost:5432/test'},
    {DATABASE_URL: 'postgresql://localhost:5432/test?sslmode=require'},
    {CORS_ORIGIN: '*'}, {CORS_ORIGIN: 'http://farmacia.example.ec'},
    {CORS_ORIGIN: 'https://farmacia.example.ec/path'},
    {CORS_ORIGIN: 'https://admin:private@farmacia.example.ec'},
    {CORS_ORIGIN: 'https://farmacia.example.ec?private=token'},
    {CORS_ORIGIN: 'https://farmacia.example.ec#fragment'},
    {RENDER_EXTERNAL_URL: 'https://example.ec'}, {HOST: '127.0.0.1'},
    {JWT_SECRET: 'corto'}, {JWT_SECRET: 'REEMPLAZAR' + 'x'.repeat(40)},
    {ADMIN_EMAIL: 'invalid@'}, {ADMIN_PASSWORD: 'SinNumerosValida'},
    {ADMIN_PASSWORD: '123456789012'}, {ADMIN_PASSWORD: 'Á1'.repeat(30)},
    {IMAGE_STORAGE: 'local'}, {SUPABASE_URL: 'https://example.ec'},
    {SUPABASE_URL: 'https://synthetic.supabase.co/storage'},
    {SUPABASE_SERVICE_ROLE_KEY: ''}, {SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_synthetic-key-never-use'},
    {SUPABASE_SERVICE_ROLE_KEY: 'private-key\r\nmalicious-header'},
    {SUPABASE_SECRET_KEY: 'sb_publishable_synthetic-key-never-use'},
    {SUPABASE_SECRET_KEY: 'sb_secret_short'},
    {SUPABASE_SECRET_KEY: valid().SUPABASE_SERVICE_ROLE_KEY},
    {SUPABASE_SECRET_KEY: 'sb_secret_synthetic-server-key\r\nmalicious'},
    {SUPABASE_STORAGE_BUCKET: '../private'},
    {SKIP_INITIAL_SEED: 'yes'}
  ];
  for (const patch of invalid) {
    let commands = 0;
    assert.throws(() => runSetup({env: {...valid(), ...patch}, run: () => {commands++;}, logger: {info() {}}}));
    assert.equal(commands, 0);
  }
});

test('preparación usa el cliente separado, migraciones y seed; no imprime secretos del proceso hijo', () => {
  const calls = [], messages = [];
  const env = valid();
  runSetup({env, logger: {info: value => messages.push(value)}, run: (...args) => {
    calls.push(args);
    return {status: 0, stdout: env.DATABASE_URL + env.ADMIN_PASSWORD, stderr: env.SUPABASE_SERVICE_ROLE_KEY};
  }});
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[0][1], ['node_modules/prisma/build/index.js', 'generate', '--schema', 'server/prisma/postgresql/schema.prisma']);
  assert.deepEqual(calls[1][1].slice(1, 3), ['migrate', 'deploy']);
  assert.deepEqual(calls[2][1], ['server/prisma/seed.cjs']);
  assert.deepEqual(calls[3][1], ['scripts/build-frontend.cjs']);
  assert.equal(calls[0][2].env.HOST, '0.0.0.0');
  assert.equal(calls[0][2].stdio, 'pipe');
  const output = messages.join('\n');
  for (const value of [env.DATABASE_URL, env.JWT_SECRET, env.ADMIN_PASSWORD, env.SUPABASE_SERVICE_ROLE_KEY]) assert.ok(!output.includes(value));
});

test('SKIP_INITIAL_SEED permite migrar una base vacía antes de importar datos privados', () => {
  const calls = [];
  runSetup({env: {...valid(), SKIP_INITIAL_SEED: 'true'}, logger: {info() {}}, run: (command, args) => {calls.push(args); return {status: 0};}});
  assert.equal(calls.length, 3);
  assert.ok(!calls.some(args => args[0] === 'server/prisma/seed.cjs'));
});

test('fallo de migración detiene seed y frontend sin exponer stderr ni cadenas privadas', () => {
  let calls = 0;
  const secret = valid().DATABASE_URL;
  assert.throws(() => runSetup({env: valid(), logger: {info() {}}, run: () => {
    calls++;
    return calls === 1 ? {status: 0} : {status: 1, stderr: secret};
  }}), error => /Aplicar migraciones PostgreSQL/.test(error.message) && !error.message.includes(secret));
  assert.equal(calls, 2);
  assert.throws(() => runSetup({env: valid(), logger: {info() {}}, run: () => {throw new Error(secret);}}), error => !error.message.includes(secret));
});

test('PostgreSQL conserva todos los modelos locales y habilita RLS sin políticas públicas', () => {
  const prisma = path.resolve(__dirname, '../../server/prisma');
  const sqlite = fs.readFileSync(path.join(prisma, 'schema.prisma'), 'utf8');
  const postgres = fs.readFileSync(path.join(prisma, 'postgresql/schema.prisma'), 'utf8');
  assert.equal(postgres.slice(postgres.indexOf('model Producto')).replaceAll('\r\n','\n').trim(), sqlite.slice(sqlite.indexOf('model Producto')).replaceAll('\r\n','\n').trim());
  assert.match(postgres, /output\s*=\s*"\.\.\/\.\.\/\.\.\/node_modules\/\.prisma-farmacia-postgresql"/);
  const migrations=path.join(prisma,'postgresql/migrations');
  const sql=fs.readdirSync(migrations,{withFileTypes:true}).filter(entry=>entry.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)).map(entry=>fs.readFileSync(path.join(migrations,entry.name,'migration.sql'),'utf8')).join('\n');
  const models = [...sqlite.matchAll(/^model (\w+) \{/gm)].map(match => match[1]);
  for (const table of [...models, '_prisma_migrations']) assert.ok(sql.includes(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`));
  assert.ok(!/CREATE\s+POLICY/i.test(sql));
});

test('selección del cliente mantiene SQLite local y usa el cliente PostgreSQL solo para URL remota', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../server/models/prisma-client.cjs'), 'utf8');
  for (const [url, expected] of [['file:./local.db', '@prisma/client'], ['postgresql://test.invalid/database', '../../node_modules/.prisma-farmacia-postgresql'], ['postgres://test.invalid/database', '../../node_modules/.prisma-farmacia-postgresql']]) {
    let selected;
    const context = {process: {env: {DATABASE_URL: url}}, module: {exports: {}}, require: requested => {selected = requested; return {PrismaClient: class {}};}};
    vm.runInNewContext(source, context);
    assert.equal(selected, expected);
  }
});

test('precios, cliente y seed usan PostgreSQL aunque el cliente SQLite predeterminado sea un stub', async () => {
  const {Decimal} = require('@prisma/client/runtime/library');
  const pg = {Prisma: {Decimal, TransactionIsolationLevel: {Serializable: 'Serializable'}}, PrismaClient: class {constructor() {this.provider = 'postgresql';}}};
  const stub = {Prisma: {}, PrismaClient: class {constructor() {throw new Error('Default client not generated');}}};
  const directory = path.resolve(__dirname, '../../server/models');
  const selector = {process: {env: {DATABASE_URL: 'postgresql://synthetic.invalid/test'}}, module: {exports: {}}, require: requested => requested === '@prisma/client' ? stub : pg};
  vm.runInNewContext(fs.readFileSync(path.join(directory, 'prisma-client.cjs'), 'utf8'), selector);
  const selected = selector.module.exports;
  assert.equal(selected, pg);
  const prices = {module: {exports: {}}, require: requested => {
    if(requested==='./prisma-client.cjs')return selected;
    // This test isolates provider selection; fiscal and FEFO behavior are covered
    // against the real isolated database in fiscal-inventory.test.cjs.
    if(requested==='./fiscal.cjs')return {inclusiveTax:()=>({})};
    if(requested==='./inventario.cjs')return {sellableStock:()=>0};
    if(requested==='../../frontend/models/pharmacy-policy.js')return require('../../frontend/models/pharmacy-policy.js');
    return stub;
  }};
  vm.runInNewContext(fs.readFileSync(path.join(directory, 'prices.cjs'), 'utf8'), prices);
  const discounted = prices.module.exports.effectivePrice({id: 'p', precio: '4.50', activo: true}, [{id: 'promo', activa: true, vistaPrevia: false, descuentoPorcentaje: 20, orden: 0}]);
  assert.equal(discounted.precio.toFixed(2), '3.60');
  assert.equal(discounted.precioOriginal.toFixed(2), '4.50');
  const db = {module: {exports: {}}, require: requested => requested === '../diagnostics.cjs' ? require('../../server/diagnostics.cjs') : requested === './prisma-client.cjs' ? selected : stub};
  vm.runInNewContext(fs.readFileSync(path.join(directory, 'db.cjs'), 'utf8'), db);
  assert.equal(db.module.exports.provider, 'postgresql');
  let isolation;
  const fakeDb = {
    usuario: {findUnique: async () => ({role: 'admin'})},
    $transaction: async (callback, options) => {
      isolation = options.isolationLevel;
      return callback({semilla: {findUnique: async () => ({id: 'catalogo-inicial-v1'})}, usuario: {findUnique: async () => ({role: 'admin'})}});
    }
  };
  const seedSource = fs.readFileSync(path.join(directory, '../prisma/seed.cjs'), 'utf8').replace(/\nseed\(\)\.catch[\s\S]*$/, '\nmodule.exports = seed;');
  const seed = {
    __dirname: path.join(directory, '../prisma'), module: {exports: {}},
    process: {env: {ADMIN_EMAIL: 'admin-test@example.ec', ADMIN_PASSWORD: 'Administrador2026!'}},
    Buffer, console: {info() {}}, require: requested => {
      if (requested === '../config.cjs') return () => ({});
      if (requested === 'node:fs') return {readFileSync: () => '[]'};
      if (requested === 'node:path') return path;
      if (requested === 'bcrypt') return {hash: async () => {throw new Error('Existing admin must preserve its password');}};
      if (requested === '../models/prisma-client.cjs') return selected;
      if (requested === '@prisma/client') return stub;
      if (requested === '../models/db.cjs') return fakeDb;
      if (requested === '../../frontend/models/ecuador.js') return {validEmail: () => true};
      throw new Error('Unexpected test dependency');
    }
  };
  vm.runInNewContext(seedSource, seed);
  await seed.module.exports();
  assert.equal(isolation, 'Serializable');
});

test('arranque remoto omite respaldos SQLite y el arranque local los conserva', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../server/index.cjs'), 'utf8');
  for (const [url, expectedBackups] of [['file:./local.db', 1], ['postgresql://test.invalid/database', 0]]) {
    let backupImports = 0, backups = 0, stopped = 0, disconnected = 0, listens = 0, deliveryImports = 0, purges = 0;
    const signals = new Map(), exits = [], errors = [], timers = [];
    const server = new EventEmitter();
    server.listen = function() {listens++; queueMicrotask(() => this.emit('listening')); return this;};
    server.close = function(callback) {queueMicrotask(() => {callback?.(); this.emit('close');}); return this;};
    server.closeAllConnections = () => {};
    const schedule = (callback, delay) => {const timer = {callback, delay, detached: false, cleared: false, unref() {this.detached = true;}}; timers.push(timer); return timer;};
    const context = {
      process: {env: {DATABASE_URL: url}, on: (signal, callback) => signals.set(signal, callback), exit: code => exits.push(code)},
      console: {info() {}, error: message => errors.push(message)},
      setTimeout: schedule, setInterval: schedule,
      clearTimeout: timer => {if(timer)timer.cleared = true;}, clearInterval: timer => {if(timer)timer.cleared = true;},
      require: requested => {
        if (requested === './diagnostics.cjs') return require('../../server/diagnostics.cjs');
        if (requested === 'node:fs') return {};
        if (requested === 'node:http' || requested === 'node:https') return {createServer: () => server};
        if (requested === './lifecycle.cjs') return require('../../server/lifecycle.cjs');
        if (requested === './config.cjs') return () => ({port: 3000, host: '0.0.0.0'});
        if (requested === './app.cjs') return () => ({});
        if (requested === './models/backups.cjs') {backupImports++; return {startAutomaticBackups: async () => {backups++; return {stop: async () => {stopped++;}};}};}
        if (requested === './models/db.cjs') return {$disconnect: async () => {disconnected++;}};
        if (requested === './models/entregas.cjs') {deliveryImports++; return {purgeExpiredLocations: async () => {purges++;}};}
        throw new Error('Unexpected test dependency: ' + requested);
      }
    };
    vm.runInNewContext(source, context);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(errors, []);
    assert.deepEqual(exits, []);
    assert.equal(backupImports, expectedBackups);
    assert.equal(backups, expectedBackups);
    assert.equal(listens, 1);
    assert.equal(deliveryImports, 0, 'la limpieza no debe consultar la base durante el arranque HTTP');
    assert.equal(purges, 0);
    assert.deepEqual(timers.map(timer => timer.delay), [1000, 60000]);
    assert.ok(timers.every(timer => timer.detached));
    timers[0].callback();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(purges, 1);
    signals.get('SIGTERM')();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stopped, expectedBackups);
    assert.equal(disconnected, 1);
    assert.ok(timers.every(timer => timer.cleared));
    assert.deepEqual(exits, [0]);
    assert.deepEqual(errors, []);
  }
});
