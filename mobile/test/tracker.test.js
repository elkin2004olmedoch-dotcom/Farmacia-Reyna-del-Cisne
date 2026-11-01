import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracker } from '../src/tracker.js';

// Provider, API and clock are explicit synthetic substitutes; no GPS/network is used.
const TIME = Date.parse('2026-11-01T18:00:00Z');
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
const fault = (status, code) => Object.assign(new Error('synthetic-private-server-detail'), { status, code });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixture(handler) {
  let time = TIME, sequence = 0, callback;
  const timers = new Map(), requests = [], events = [], statuses = [];
  const delivery = { id: 'synthetic-delivery', estado: 'en_camino', version: 2, gpsVersion: 4, origenSeguimiento: 'app', destino: { nombre: 'Prueba' } };
  const clock = { now: () => time, setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: time + delay }); return id; }, clearTimeout: id => timers.delete(id) };
  const session = { authenticated: true, async request(path, { method = 'GET', data } = {}) {
    const request = { path, method, data, at: time }; requests.push(request); events.push(method);
    const result = await handler?.(request, delivery);
    if (result !== undefined) return result;
    if (method === 'PUT') return { gpsVersion: ++delivery.gpsVersion, ubicacion: { ...data } };
    return { ...delivery };
  } };
  const gps = {
    async addWatcher(options, listener) { events.push('watch'); gps.options = options; callback = listener; return 'synthetic-watcher'; },
    async removeWatcher({ id }) { assert.equal(id, 'synthetic-watcher'); events.push('unwatch'); },
  };
  const tracker = createTracker({ session, gps, clock, onStatus: s => statuses.push(s) });
  return { tracker, gps, delivery, requests, events, statuses, clock,
    async capture(overrides = {}, error) { callback({ latitude: -0.123, longitude: -78.123, accuracy: 8, time, ...overrides }, error); await flush(); },
    async tick(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); time = next[1].at; next[1].fn(); await flush();
      }
      time = end; await flush();
    },
  };
}

test('start claims the delivery before registering a native watcher with persistent notice', async () => {
  const f = fixture();
  await f.tracker.start(f.delivery);
  assert.deepEqual(f.events.slice(0, 2), ['POST', 'watch']);
  assert.equal(f.requests[0].path, '/entregas/synthetic-delivery/seguimiento-movil');
  assert.equal(f.gps.options.stale, false);
  assert.equal(f.gps.options.distanceFilter, 0);
  assert.ok(f.gps.options.backgroundMessage);
  assert.equal(f.tracker.state.activeId, f.delivery.id);
  await assert.rejects(f.tracker.start({ ...f.delivery, id: 'synthetic-other' }));
  await f.tracker.stop();
});

test('latest-only throttling sends no more than one position per twelve seconds', async () => {
  const f = fixture(); await f.tracker.start(f.delivery);
  await f.capture();
  await f.tick(1000); await f.capture({ latitude: -0.2 });
  await f.tick(1000); await f.capture({ latitude: -0.3 });
  assert.equal(f.requests.filter(r => r.method === 'PUT').length, 1);
  await f.tick(10000);
  const puts = f.requests.filter(r => r.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[1].data.latitud, -0.3);
  assert.equal(puts[1].data.esperadoGpsVersion, 5);
  assert.equal(puts[1].at - puts[0].at, 12000);
  assert.equal(f.tracker.state.lastCapturedAt, TIME + 2000);
  assert.equal(f.tracker.state.lastSentAt, TIME + 12000);
  assert.equal(f.tracker.state.precision, 8);
  await f.tracker.stop();
});

test('stop removes the watcher and waits for an in-flight PUT before releasing ownership', async () => {
  const sending = deferred();
  const f = fixture(r => r.method === 'PUT' ? sending.promise : undefined);
  await f.tracker.start(f.delivery); await f.capture();
  await f.tick(50000); await f.capture({ latitude: -0.5 });
  assert.equal(f.requests.filter(r => r.method === 'PUT').length, 1);
  const stopping = f.tracker.stop(); await flush();
  assert.ok(f.events.includes('unwatch'));
  assert.equal(f.requests.some(r => r.method === 'DELETE'), false);
  sending.resolve({ gpsVersion: 5 }); await stopping;
  assert.equal(f.requests.at(-1).method, 'DELETE');
  assert.equal(f.tracker.state.activeId, null);
  await f.tick(60000);
  assert.equal(f.requests.filter(r => r.method === 'PUT').length, 1);
});

test('invalid, future and expired GPS points never become a current server position', async () => {
  const f = fixture(); await f.tracker.start(f.delivery);
  for (const sample of [{ latitude: 91 }, { longitude: NaN }, { accuracy: -1 }, { accuracy: 10001 }, { time: TIME - 120001 }, { time: TIME + 15001 }]) await f.capture(sample);
  assert.equal(f.requests.some(r => r.method === 'PUT'), false);
  assert.equal(f.tracker.state.phase, 'stale');
  await f.tracker.stop();
});

test('offline recovery reconciles first and never replays a point older than two minutes', async () => {
  let offline = true;
  const f = fixture(r => { if (r.method === 'GET' && offline) throw fault(0, 'NETWORK_ERROR'); });
  await f.tracker.start(f.delivery); await f.capture();
  assert.equal(f.tracker.state.phase, 'offline');
  await f.tick(121000); offline = false;
  await f.tracker.reconcile();
  assert.equal(f.requests.some(r => r.method === 'PUT'), false);
  await f.capture({ latitude: -0.8 });
  assert.equal(f.requests.filter(r => r.method === 'PUT').at(-1).data.latitud, -0.8);
  await f.tracker.stop();
});

test('offline retries back off between twelve and sixty seconds without parallel PUTs', async () => {
  const f = fixture(r => { if (r.method === 'PUT') throw fault(0, 'NETWORK_ERROR'); });
  await f.tracker.start(f.delivery); await f.capture(); await f.tick(100000);
  const puts = f.requests.filter(r => r.method === 'PUT');
  assert.ok(puts.length >= 3 && puts.length <= 5);
  for (let i = 1; i < puts.length; i++) assert.ok(puts[i].at - puts[i - 1].at >= 12000 && puts[i].at - puts[i - 1].at <= 60000);
  assert.equal(f.tracker.state.phase, 'offline');
  assert.equal(f.statuses.some(s => s.message.includes('synthetic-private')), false);
  await f.tracker.stop();
});

test('GPS version conflict fetches the current DTO before a rate-limited retry', async () => {
  let conflict = true;
  const f = fixture((r, delivery) => {
    if (r.method === 'PUT' && conflict) { conflict = false; delivery.gpsVersion = 9; throw fault(409, 'GPS_CHANGED'); }
  });
  await f.tracker.start(f.delivery); await f.capture(); await f.tick(12000);
  const puts = f.requests.filter(r => r.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[1].data.esperadoGpsVersion, 9);
  const first = f.requests.indexOf(puts[0]), second = f.requests.indexOf(puts[1]);
  assert.ok(f.requests.slice(first + 1, second).some(r => r.method === 'GET'));
  await f.tracker.stop();
});

for (const terminal of ['entregada', 'cancelada', 403, 404]) test(`reconcile stops capture when the delivery is ${terminal}`, async () => {
  let close = false;
  const f = fixture(r => {
    if (r.method === 'GET' && close) {
      if (typeof terminal === 'number') throw fault(terminal, terminal === 404 ? 'NOT_FOUND' : 'FORBIDDEN');
      return { ...f.delivery, estado: terminal };
    }
  });
  await f.tracker.start(f.delivery); close = true;
  await f.tracker.reconcile(); await flush();
  assert.equal(f.tracker.state.phase, 'closed');
  assert.equal(f.tracker.state.activeId, null);
  assert.ok(f.events.includes('unwatch'));
  await f.capture(); await f.tick(60000);
  assert.equal(f.requests.some(r => r.method === 'PUT'), false);
});

test('lost location permission removes native capture and ownership with a precise status', async () => {
  const f = fixture(); await f.tracker.start(f.delivery);
  await f.capture({}, { code: 'NOT_AUTHORIZED', message: 'synthetic-provider-detail' });
  assert.equal(f.tracker.state.phase, 'permission-denied');
  assert.equal(f.tracker.state.activeId, null);
  assert.ok(f.events.includes('unwatch'));
  assert.equal(f.requests.at(-1).method, 'DELETE');
  assert.match(f.tracker.state.message, /permiso/i);
});

test('watcher setup failure releases the claim instead of leaving a phantom tracker', async () => {
  const f = fixture(); f.gps.addWatcher = async () => { throw { code: 'NOT_AUTHORIZED' }; };
  await assert.rejects(f.tracker.start(f.delivery));
  assert.equal(f.requests.at(-1).method, 'DELETE');
  assert.equal(f.tracker.state.activeId, null);
  assert.equal(f.tracker.state.phase, 'permission-denied');
});

test('an offline stop retains pending release until reconciliation succeeds', async () => {
  let offline = true;
  const f = fixture(r => { if (r.method === 'DELETE' && offline) throw fault(0, 'NETWORK_ERROR'); });
  await f.tracker.start(f.delivery);
  await assert.rejects(f.tracker.stop());
  assert.ok(f.events.includes('unwatch'));
  assert.equal(f.tracker.state.phase, 'offline');
  offline = false; await f.tracker.reconcile();
  assert.equal(f.tracker.state.activeId, null);
  assert.equal(f.tracker.state.phase, 'idle');
});

test('a missing sensor update marks the last captured position stale after two minutes', async () => {
  const f = fixture(); await f.tracker.start(f.delivery); await f.capture();
  await f.tick(120001);
  assert.equal(f.tracker.state.phase, 'stale');
  assert.equal(f.tracker.state.lastCapturedAt, TIME);
  assert.equal(f.requests.filter(r => r.method === 'PUT').length, 1);
  await f.tracker.stop();
});

for (const offset of [0, 0.5]) test(`a successful PUT with a lost response is reconciled without resending that captured point (${offset} ms)`, async () => {
  let lose = true;
  const f = fixture((r, delivery) => {
    if (r.method === 'PUT' && lose) {
      lose = false; delivery.gpsVersion++; delivery.ubicacion = { latitud: r.data.latitud, longitud: r.data.longitud, precision: r.data.precision, registradaAt: r.data.registradaAt };
      throw fault(0, 'NETWORK_ERROR');
    }
  });
  await f.tracker.start(f.delivery); await f.capture({time:TIME+offset}); await f.tick(12000);
  assert.equal(f.requests.filter(r => r.method === 'PUT').length, 1);
  assert.equal(f.tracker.state.phase, 'sharing');
  await f.tracker.stop();
});

test('stop during a pending claim prevents a watcher from starting afterwards', async () => {
  const claiming = deferred();
  const f = fixture(r => r.method === 'POST' ? claiming.promise : undefined);
  const starting = f.tracker.start(f.delivery);
  const stopping = f.tracker.stop();
  claiming.resolve({ ...f.delivery });
  await Promise.all([starting, stopping]);
  assert.equal(f.events.includes('watch'), false);
  assert.equal(f.tracker.state.activeId, null);
  assert.equal(f.requests.filter(r => r.method === 'DELETE').length, 1);
});

test('a native watcher removal failure still withdraws ownership and can be retried', async () => {
  const f = fixture(); await f.tracker.start(f.delivery);
  let fail = true;
  f.gps.removeWatcher = async () => { if (fail) throw { code: 'synthetic-sensitive-plugin-error' }; };
  await assert.rejects(f.tracker.stop(), e => !JSON.stringify(e).includes('synthetic-sensitive'));
  assert.equal(f.requests.at(-1).method, 'DELETE');
  assert.equal(f.tracker.state.phase, 'error');
  fail = false; await f.tracker.reconcile();
  assert.equal(f.tracker.state.activeId, null);
});
