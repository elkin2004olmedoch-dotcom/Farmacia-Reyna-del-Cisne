import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSession } from '../src/session.js';

// All credentials, users, network responses and files here are synthetic.
const KEY = 'farmacia.reparto.session.v1';
const TIME = Date.parse('2026-11-01T18:00:00Z');
const SECRET = 'A'.repeat(43);
const PROFILE = { id: 'synthetic-driver', nombre: 'Repartidor de prueba', role: 'repartidor' };
const credentials = (token = 'synthetic-access', refreshToken = `synthetic-session.${SECRET}`) => ({
  usuario: PROFILE, token, refreshToken,
  expiresAt: new Date(TIME + 15 * 60000).toISOString(),
  refreshExpiresAt: new Date(TIME + 30 * 86400000).toISOString(),
});
const ok = data => ({ status: 200, body: { ok: true, data } });
const denied = (status = 401, code = 'INVALID_TOKEN') => ({ status, body: { ok: false, error: { code, message: 'synthetic-secret-must-not-leak' } } });

async function fixture(t, handler) {
  const directory = await mkdtemp(join(tmpdir(), 'farmacia-mobile-session-synthetic-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'secure-store-test-double.json');
  const storage = {
    async get(key) { assert.equal(key, KEY); try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } },
    async set(key, value) { assert.equal(key, KEY); await writeFile(path, JSON.stringify(value)); },
    async remove(key) { assert.equal(key, KEY); await rm(path, { force: true }); },
  };
  let time = TIME;
  const calls = [];
  const session = createSession({ storage, now: () => time, randomBytes: n => new Uint8Array(n).fill(1),
    transport: async (route, options) => { calls.push({ route, ...options }); return handler(route, options, storage); },
  });
  return { session, storage, calls, advance: ms => { time += ms; } };
}

test('login persists only refresh credentials and a safe repartidor profile', async t => {
  const f = await fixture(t, () => ok({ ...credentials(), usuario: { ...PROFILE, passwordHash: 'synthetic-hash' } }));
  assert.deepEqual(await f.session.login('synthetic@example.invalid', 'synthetic-password'), PROFILE);
  assert.equal(f.session.authenticated, true);
  assert.deepEqual(f.session.user, PROFILE);
  const saved = await f.storage.get(KEY);
  assert.equal(saved.refreshToken, `synthetic-session.${SECRET}`);
  assert.equal(saved.pendingNextSecret, null);
  assert.equal(JSON.stringify(saved).includes('synthetic-access'), false);
  assert.equal(JSON.stringify(saved).includes('password'), false);
});

test('delivery code rejection retains session and uses a safe actionable message',async t=>{
 const f=await fixture(t,(route)=>route==='/auth/mobile/login'?ok(credentials()):denied(422,'DELIVERY_CODE_INVALID'));
 await f.session.login('synthetic@example.invalid','synthetic-password');
 await assert.rejects(()=>f.session.request('/entregas/synthetic/estado',{method:'PUT',data:{estado:'entregada',codigoEntrega:'000000',esperadoVersion:1}}),error=>error.code==='DELIVERY_CODE_INVALID'&&/no coincide/.test(error.message)&&!error.message.includes('synthetic-secret'));
 assert.equal(f.session.authenticated,true);
});

test('restore without secure credentials returns null without contacting the API', async t => {
  const f = await fixture(t, () => assert.fail('unexpected network call'));
  assert.equal(await f.session.restore(), null);
  assert.equal(f.session.authenticated, false);
});

test('restore persists a 32-byte next secret before renew and never persists the JWT', async t => {
  const f = await fixture(t, async (route, options, storage) => {
    assert.equal(route, '/auth/mobile/renew');
    const saved = await storage.get(KEY);
    assert.deepEqual(options.data, { refreshToken: `synthetic-session.${SECRET}`, nextSecret: saved.pendingNextSecret });
    assert.equal(options.data.nextSecret, 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE');
    return ok(credentials('synthetic-renewed', `synthetic-session.${options.data.nextSecret}`));
  });
  await f.storage.set(KEY, { refreshToken: `synthetic-session.${SECRET}`, pendingNextSecret: null, usuario: PROFILE, refreshExpiresAt: credentials().refreshExpiresAt });
  assert.deepEqual(await f.session.restore(), PROFILE);
  assert.equal((await f.storage.get(KEY)).pendingNextSecret, null);
  assert.equal(JSON.stringify(await f.storage.get(KEY)).includes('synthetic-renewed'), false);
});

test('a lost renew response preserves the exact durable pair for restart retry', async t => {
  let lost = true;
  const pairs = [];
  const f = await fixture(t, (route, options) => {
    pairs.push(options.data);
    if (lost) { lost = false; throw new Error('network with synthetic-secret-must-not-leak'); }
    return ok(credentials('synthetic-recovered', `synthetic-session.${options.data.nextSecret}`));
  });
  await f.storage.set(KEY, { refreshToken: `synthetic-session.${SECRET}`, pendingNextSecret: null, usuario: PROFILE, refreshExpiresAt: credentials().refreshExpiresAt });
  await assert.rejects(f.session.restore(), e => e.code === 'NETWORK_ERROR' && !JSON.stringify(e).includes('synthetic-secret'));
  const pending = await f.storage.get(KEY);
  assert.equal(pending.refreshToken, `synthetic-session.${SECRET}`);
  assert.equal(pending.pendingNextSecret.length, 43);
  await f.session.restore();
  assert.deepEqual(pairs[1], pairs[0]);
  assert.equal(f.session.authenticated, true);
});

test('concurrent requests share one refresh and use the new access token', async t => {
  let renewals = 0;
  const f = await fixture(t, async (route, options) => {
    if (route === '/auth/mobile/login') return ok(credentials());
    if (route === '/auth/mobile/renew') { renewals++; await new Promise(resolve => setImmediate(resolve)); return ok({ ...credentials('synthetic-fresh'), expiresAt: new Date(TIME + 60 * 60000).toISOString() }); }
    assert.equal(options.token, 'synthetic-fresh');
    return ok({ items: [] });
  });
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  f.advance(14 * 60000 + 1);
  assert.deepEqual(await Promise.all([f.session.request('/entregas'), f.session.request('/entregas')]), [{ items: [] }, { items: [] }]);
  assert.equal(renewals, 1);
});

test('an access 401 renews and retries once, then clears definitively invalid credentials', async t => {
  const f = await fixture(t, route => {
    if (route === '/auth/mobile/login' || route === '/auth/mobile/renew') return ok(credentials());
    return denied();
  });
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await assert.rejects(f.session.request('/entregas'), e => e.status === 401 && e.code === 'INVALID_TOKEN' && !e.message.includes('synthetic-secret'));
  assert.equal(f.calls.filter(c => c.route === '/entregas').length, 2);
  assert.equal(await f.storage.get(KEY), null);
  assert.equal(f.session.authenticated, false);
});

test('a network failure during automatic renewal preserves credentials for a later request', async t => {
  let online = false;
  const f = await fixture(t, route => {
    if (route === '/auth/mobile/login') return ok(credentials());
    if (route === '/auth/mobile/renew') { if (!online) throw new Error('synthetic-offline'); return ok({ ...credentials(), expiresAt: new Date(TIME + 60 * 60000).toISOString() }); }
    return ok({ items: [] });
  });
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  f.advance(15 * 60000);
  await assert.rejects(f.session.request('/entregas'), e => e.code === 'NETWORK_ERROR');
  assert.ok((await f.storage.get(KEY)).pendingNextSecret);
  online = true;
  assert.deepEqual(await f.session.request('/entregas'), { items: [] });
});

test('expired refresh credentials and non-repartidor logins are removed', async t => {
  const f = await fixture(t, () => ok({ ...credentials(), usuario: { ...PROFILE, role: 'admin' } }));
  await f.storage.set(KEY, { refreshToken: `synthetic-session.${SECRET}`, pendingNextSecret: null, usuario: PROFILE, refreshExpiresAt: new Date(TIME - 1).toISOString() });
  assert.equal(await f.session.restore(), null);
  await assert.rejects(f.session.login('synthetic@example.invalid', 'synthetic-password'), e => e.status === 403);
  assert.equal(await f.storage.get(KEY), null);
});

test('secure storage failure prevents renewal from sending an undurable secret', async t => {
  const storage = { get: async () => ({ refreshToken: `synthetic-session.${SECRET}`, pendingNextSecret: null, usuario: PROFILE, refreshExpiresAt: credentials().refreshExpiresAt }), set: async () => { throw new Error('synthetic-sensitive-storage-message'); }, remove: async () => {} };
  const session = createSession({ storage, now: () => TIME, randomBytes: n => new Uint8Array(n), transport: async () => assert.fail('must not send before persistence') });
  await assert.rejects(session.restore(), e => e.code === 'SECURE_STORAGE_ERROR' && !e.message.includes('synthetic-sensitive'));
});

test('offline logout hides access and retains an encrypted pending revocation for cleanup', async t => {
  const f = await fixture(t, route => route === '/auth/mobile/login' ? ok(credentials()) : Promise.reject(new Error('synthetic-offline')));
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await assert.rejects(f.session.logout(), e => e.code === 'NETWORK_ERROR');
  assert.equal(f.calls.at(-1).route, '/auth/mobile/logout');
  assert.equal((await f.storage.get(KEY)).pendingRevocation, true);
  assert.equal((await f.storage.get(KEY)).refreshToken, `synthetic-session.${SECRET}`);
  assert.equal(f.session.user, null);
  assert.equal(f.session.authenticated, false);
  const calls = f.calls.length;
  await assert.rejects(f.session.request('/entregas'), e => e.status === 401);
  assert.equal(f.calls.length, calls);
});

test('request refuses external URLs before exposing access credentials', async t => {
  const f = await fixture(t, () => ok(credentials()));
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await assert.rejects(f.session.request('//untrusted.invalid/entregas'), e => e.code === 'INVALID_PATH');
  assert.equal(f.calls.length, 1);
});

test('successful logout accepts the backend empty 204 response', async t => {
  const f = await fixture(t, route => route === '/auth/mobile/login' ? ok(credentials()) : { status: 204, body: null });
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await f.session.logout();
  assert.equal(f.session.authenticated, false);
  assert.equal(await f.storage.get(KEY), null);
});

test('tracking ownership conflicts retain their safe public error code', async t => {
  const f = await fixture(t, route => route === '/auth/mobile/login' ? ok(credentials()) : denied(409, 'GPS_OWNED'));
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await assert.rejects(f.session.request('/entregas/synthetic-delivery/seguimiento-movil', { method: 'POST' }), e => e.status === 409 && e.code === 'GPS_OWNED' && !e.message.includes('synthetic-secret'));
});

test('a delayed parallel 401 uses the completed refresh even if the JWT string is unchanged', async t => {
  let releaseDelayed, renewals = 0;
  const delayed = new Promise(resolve => { releaseDelayed = resolve; });
  const attempts = new Map();
  const f = await fixture(t, async route => {
    if (route === '/auth/mobile/login') return ok(credentials());
    if (route === '/auth/mobile/renew') { renewals++; return ok(credentials()); }
    const count = (attempts.get(route) || 0) + 1; attempts.set(route, count);
    if (count === 1) { if (route === '/entregas?second') await delayed; return denied(); }
    return ok({ items: [] });
  });
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  const first = f.session.request('/entregas?first'), second = f.session.request('/entregas?second');
  await first; releaseDelayed(); await second;
  assert.equal(renewals, 1);
});

test('restart with a pending logout retries the durable refresh pair only to revoke, never to restore the user', async t => {
  let online = false, restarted;
  const handler = (route, options) => {
    if (route === '/auth/mobile/login') return ok(credentials());
    if (!online) throw new Error('synthetic-offline');
    assert.equal(restarted.user, null);
    assert.equal(restarted.authenticated, false);
    if (route === '/auth/mobile/renew') {
      assert.deepEqual(options.data, pendingPair);
      return ok(credentials('synthetic-revocation-only', `synthetic-session.${options.data.nextSecret}`));
    }
    assert.equal(route, '/auth/mobile/logout');
    return { status: 204, body: null };
  };
  const f = await fixture(t, handler);
  await f.session.login('synthetic@example.invalid', 'synthetic-password'); f.advance(15 * 60000);
  await assert.rejects(f.session.logout());
  const saved = await f.storage.get(KEY);
  const pendingPair = { refreshToken: saved.refreshToken, nextSecret: saved.pendingNextSecret };
  assert.equal(saved.pendingRevocation, true);
  online = true;
  restarted = createSession({ storage: f.storage, transport: handler, now: () => TIME + 15 * 60000, randomBytes: n => new Uint8Array(n).fill(2) });
  assert.equal(await restarted.restore(), null);
  assert.equal(restarted.user, null);
  assert.equal(await f.storage.get(KEY), null);
});

test('a new login revokes a pending prior session before creating another session', async t => {
  let online = false;
  const f = await fixture(t, route => {
    if (route === '/auth/mobile/login' || route === '/auth/mobile/renew') return ok(credentials());
    if (!online) throw new Error('synthetic-offline');
    return { status: 204, body: null };
  });
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await assert.rejects(f.session.logout()); online = true;
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  assert.deepEqual(f.calls.map(c => c.route), ['/auth/mobile/login', '/auth/mobile/logout', '/auth/mobile/renew', '/auth/mobile/logout', '/auth/mobile/login']);
  assert.equal(f.session.authenticated, true);
  assert.equal((await f.storage.get(KEY)).pendingRevocation, undefined);
});

test('a pending logout cannot be replaced by a new login while revocation is offline', async t => {
  const f = await fixture(t, route => route === '/auth/mobile/login' ? ok(credentials()) : Promise.reject(new Error('synthetic-offline')));
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await assert.rejects(f.session.logout());
  await assert.rejects(f.session.login('synthetic@example.invalid', 'synthetic-password'), e => e.code === 'NETWORK_ERROR');
  assert.equal(f.calls.filter(c => c.route === '/auth/mobile/login').length, 1);
  assert.equal(f.session.user, null);
  assert.equal((await f.storage.get(KEY)).pendingRevocation, true);
});

test('logout treats an already invalid server session as revoked and removes its secure record', async t => {
  const f = await fixture(t, route => route === '/auth/mobile/login' ? ok(credentials()) : denied());
  await f.session.login('synthetic@example.invalid', 'synthetic-password');
  await f.session.logout();
  assert.equal(await f.storage.get(KEY), null);
  assert.equal(f.session.authenticated, false);
});

test('password login after offline restoration revokes the previous owner before replacing credentials', async t => {
  let online=false;
  const f=await fixture(t,(route,options)=>{
    if(!online)throw new Error('synthetic-offline');
    if(route==='/auth/mobile/renew')return ok(credentials('synthetic-recovered',`synthetic-session.${options.data.nextSecret}`));
    if(route==='/auth/mobile/logout')return {status:204,body:null};
    return ok(credentials('synthetic-new','synthetic-new-session.'+SECRET));
  });
  await f.storage.set(KEY,{refreshToken:`synthetic-session.${SECRET}`,pendingNextSecret:null,usuario:PROFILE,refreshExpiresAt:credentials().refreshExpiresAt});
  await assert.rejects(f.session.restore());online=true;
  await f.session.login('synthetic@example.invalid','synthetic-password');
  const routes=f.calls.map(call=>call.route);
  assert(routes.includes('/auth/mobile/logout'));
  assert(routes.indexOf('/auth/mobile/logout')<routes.indexOf('/auth/mobile/login'));
  assert.equal((await f.storage.get(KEY)).refreshToken,'synthetic-new-session.'+SECRET);
});

test('logout still revokes remotely when writing the local pending marker fails', async t => {
  const f=await fixture(t,route=>route==='/auth/mobile/login'?ok(credentials()):{status:204,body:null});
  await f.session.login('synthetic@example.invalid','synthetic-password');
  f.storage.set=async()=>{throw new Error('synthetic-store-failure');};
  await f.session.logout();
  assert(f.calls.some(call=>call.route==='/auth/mobile/logout'));
  assert.equal(await f.storage.get(KEY),null);
  assert.equal(f.session.user,null);
});

test('logout reports an unconfirmed local close when secure writes and remote revocation both fail', async t => {
  const f=await fixture(t,route=>route==='/auth/mobile/login'?ok(credentials()):Promise.reject(new Error('synthetic-offline')));
  await f.session.login('synthetic@example.invalid','synthetic-password');
  f.storage.set=async()=>{throw new Error('synthetic-store-failure');};
  await assert.rejects(f.session.logout(),error=>error.code==='LOCAL_LOGOUT_FAILED');
  assert(f.calls.some(call=>call.route==='/auth/mobile/logout'));
  assert.equal(f.session.user,null);assert.equal(f.session.authenticated,false);
});
