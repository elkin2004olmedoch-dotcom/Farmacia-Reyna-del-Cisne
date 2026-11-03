const INTERVAL = 12000, MAX_AGE = 120000;
const shareable = delivery => ['en_camino', 'en_destino'].includes(delivery?.estado);
const problem = (code, message, status = 0) => Object.assign(new Error(message), { code, status });

export function createTracker({ session, gps, clock = { now: Date.now, setTimeout, clearTimeout }, onStatus = () => {} }) {
  let delivery = null, watcher = null, latest = null, timer = null, freshnessTimer = null, flight = null, stopping = null;
  let running = false, starting = false, pendingRelease = false, nextAttempt = 0, putNotBefore = 0, failures = 0;
  let startSettled = null, cancelStart = false;
  let snapshot = { activeId: null, phase: 'idle', lastCapturedAt: null, lastSentAt: null, precision: null, position:null, message: 'Ubicación detenida.' };
  const path = suffix => `/entregas/${encodeURIComponent(delivery.id)}${suffix}`;
  const emit = (phase, message, changes = {}) => {
    snapshot = { ...snapshot, ...changes, phase, message };
    onStatus({ ...snapshot });
  };
  const cancelTimer = () => { if (timer !== null) clock.clearTimeout(timer); timer = null; };
  const recent = point => point && clock.now() - point.time <= MAX_AGE && point.time - clock.now() <= 15000;

  function stopAs(phase = 'idle', message = 'Ubicación detenida.') {
    if (stopping) return stopping;
    running = false;
    latest = null;
    emit(phase,message,{position:null});
    cancelTimer();
    if (freshnessTimer !== null) clock.clearTimeout(freshnessTimer);
    freshnessTimer = null;
    const held = delivery;
    stopping = (async () => {
      let removalFailed = false;
      if (watcher !== null) {
        try { await gps.removeWatcher({ id: watcher }); watcher = null; }
        catch { removalFailed = true; }
      }
      if (flight) await flight;
      if (held) {
        try { await session.request(`/entregas/${encodeURIComponent(held.id)}/seguimiento-movil`, { method: 'DELETE' }); }
        catch (error) { if (![401, 403, 404].includes(error.status)) throw error; }
      }
      if (removalFailed) throw problem('GPS_STOP_FAILED', 'No se pudo detener el servicio de ubicación. Vuelve a intentar.', 500);
      delivery = null;
      pendingRelease = false;
      emit(phase, message, { activeId: null });
    })().catch(error => {
      pendingRelease = true;
      const offline = !error.status && error.code === 'NETWORK_ERROR';
      emit(offline ? 'offline' : 'error', offline ? 'Captura detenida. Falta conexión para retirar el seguimiento; vuelve a intentar.' : 'No se pudo retirar el seguimiento. Vuelve a intentar.');
      throw problem('TRACKING_STOP_FAILED', snapshot.message, error.status || 0);
    }).finally(() => { stopping = null; });
    return stopping;
  }

  function halt(phase, message) {
    emit(phase, message);
    void stopAs(phase, message).catch(() => {});
  }

  function failed(error) {
    if ([403, 404].includes(error.status)) { halt('closed', 'La entrega ya no está disponible para seguimiento.'); return; }
    if (error.status === 401) { halt('error', 'La sesión venció. Inicia sesión nuevamente.'); return; }
    if (error.status === 409 && !['GPS_CHANGED', 'DELIVERY_CHANGED'].includes(error.code)) {
      halt('error', 'El seguimiento pertenece a otra sesión o ya no está activo. Actualiza la entrega.'); return;
    }
    failures++;
    nextAttempt = Math.max(nextAttempt, clock.now() + Math.min(60000, INTERVAL * 2 ** Math.min(failures - 1, 3)));
    if (!error.status) emit('offline', 'Sin conexión. Se conserva solo la muestra más reciente.');
    else if (error.status === 409) emit('reconnecting', 'La ubicación cambió. Actualizando el seguimiento.');
    else if (error.status === 429) emit('reconnecting', 'El servidor pide esperar. Reintentando en unos segundos.');
    else emit('error', 'No se pudo enviar la ubicación. Se volverá a intentar.');
  }

  async function current() {
    const dto = await session.request(path(''));
    if (!shareable(dto)) { halt('closed', 'La entrega finalizó o fue cancelada. Ubicación detenida.'); return false; }
    if (dto.id !== delivery.id || !Number.isSafeInteger(dto.gpsVersion) || dto.gpsVersion < 0) throw problem('INVALID_RESPONSE', 'No se pudo verificar la entrega.', 502);
    delivery = dto;
    // Core Location can provide fractional milliseconds; the API snapshot uses
    // ISO dates with millisecond precision, as does the outgoing request.
    if (latest && Date.parse(dto.ubicacion?.registradaAt) >= Math.trunc(latest.time)) {
      latest = null;
      emit('sharing', 'La ubicación reciente ya está confirmada en el servidor.');
    }
    return running;
  }

  function schedule() {
    cancelTimer();
    if (!running || !latest || flight) return;
    if (!recent(latest)) { latest = null; emit('stale', 'La ubicación está vencida. Esperando una muestra GPS reciente.'); return; }
    const delay = Math.max(0, nextAttempt - clock.now());
    if (delay) timer = clock.setTimeout(() => { timer = null; launch(); }, delay);
    else launch();
  }

  function launch() {
    if (!running || flight || !latest) return;
    flight = (async () => {
      try {
        if (!await current() || !running) return;
        const point = latest;
        if (!point) return;
        if (!recent(point)) { latest = null; emit('stale', 'La ubicación está vencida. Esperando una muestra GPS reciente.'); return; }
        nextAttempt = putNotBefore = clock.now() + INTERVAL;
        const result = await session.request(path('/ubicacion'), { method: 'PUT', data: {
          latitud: point.latitude, longitud: point.longitude, precision: point.accuracy,
          registradaAt: new Date(point.time).toISOString(), esperadoGpsVersion: delivery.gpsVersion,
        } });
        if (Number.isSafeInteger(result?.gpsVersion)) delivery.gpsVersion = result.gpsVersion;
        if (latest === point) latest = null;
        failures = 0;
        nextAttempt = putNotBefore = clock.now() + INTERVAL;
        if (running) emit('sharing', 'Ubicación enviada.', { lastSentAt: clock.now() });
      } catch (error) {
        if (!running) return;
        failed(error);
        if (running && error.status === 409 && ['GPS_CHANGED', 'DELIVERY_CHANGED'].includes(error.code)) {
          try { await current(); } catch (reconcileError) { failed(reconcileError); }
        }
      }
    })().finally(() => { flight = null; schedule(); });
  }

  function capture(point, error) {
    if (!running) return;
    if (error) {
      if (error.code === 'NOT_AUTHORIZED') halt('permission-denied', 'Se perdió el permiso de ubicación. Actívalo en los ajustes para volver a compartir.');
      else emit('stale', 'Sin señal GPS. Esperando una ubicación válida.');
      return;
    }
    if (!point || ![point.latitude, point.longitude, point.accuracy, point.time].every(Number.isFinite)
      || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 || point.accuracy < 0 || point.accuracy > 10000 || !recent(point)) {
      emit('stale', 'La muestra GPS no es válida o está vencida. Esperando una ubicación reciente.'); return;
    }
    if (snapshot.lastCapturedAt !== null && point.time <= snapshot.lastCapturedAt) return;
    latest = { latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, time: point.time };
    if (freshnessTimer !== null) clock.clearTimeout(freshnessTimer);
    freshnessTimer = clock.setTimeout(() => {
      freshnessTimer = null;
      if (running) emit('stale', 'Sin actualización GPS reciente. La última posición está vencida.');
    }, MAX_AGE - (clock.now() - point.time) + 1);
    emit(snapshot.phase === 'offline' ? 'offline' : 'sharing', snapshot.phase === 'offline' ? 'Sin conexión. Capturando la muestra GPS más reciente.' : 'Capturando ubicación.', { lastCapturedAt: point.time, precision: point.accuracy,position:{latitud:point.latitude,longitud:point.longitude,registradaAt:new Date(point.time).toISOString()} });
    schedule();
  }

  return {
    async start(candidate) {
      if (starting || delivery || watcher !== null || stopping) throw problem('TRACKING_ACTIVE', 'Detén el seguimiento actual antes de iniciar otro.', 409);
      if (!candidate?.id || !shareable(candidate)) throw problem('GPS_NOT_ACTIVE', 'Inicia la entrega antes de compartir ubicación.', 409);
      starting = true;
      cancelStart = false;
      let finishStart;
      startSettled = new Promise(resolve => { finishStart = resolve; });
      emit('starting', 'Preparando el seguimiento.', { lastCapturedAt: null, lastSentAt: null, precision: null });
      try {
        delivery = await session.request(`/entregas/${encodeURIComponent(candidate.id)}/seguimiento-movil`, { method: 'POST' });
        if (cancelStart) { await stopAs(); return { ...snapshot }; }
        if (!shareable(delivery)) throw problem('GPS_NOT_ACTIVE', 'La entrega ya no admite seguimiento.', 409);
        running = true;
        nextAttempt = putNotBefore = 0;
        failures = 0;
        emit('starting', 'Solicitando permiso de ubicación.', { activeId: delivery.id });
        let ready = false, pendingCapture;
        watcher = await gps.addWatcher({ backgroundTitle: 'Farmacia Reina del Cisne', backgroundMessage: 'Compartiendo ubicación durante tu entrega. Puedes detenerla desde la app.', requestPermissions: true, stale: false, distanceFilter: 0 }, (point, error) => {
          if (ready) capture(point, error); else pendingCapture = [point, error];
        });
        ready = true;
        if (cancelStart) { await stopAs(); return { ...snapshot }; }
        emit('sharing', 'Esperando una ubicación GPS reciente.');
        if (pendingCapture) capture(...pendingCapture);
        return { ...snapshot };
      } catch (error) {
        const denied = error.code === 'NOT_AUTHORIZED';
        const phase = denied ? 'permission-denied' : !error.status ? 'offline' : 'error';
        const message = denied ? 'Se necesita permiso de ubicación. Actívalo en los ajustes.' : error.status === 409 ? 'Otra sesión mantiene el seguimiento o la entrega cambió. Actualiza antes de continuar.' : !error.status ? 'No se pudo iniciar el seguimiento. Comprueba la conexión.' : 'No se pudo iniciar el seguimiento.';
        if (delivery) await stopAs(phase, message).catch(() => {});
        else emit(phase, message, { activeId: null });
        throw problem(denied ? 'NOT_AUTHORIZED' : 'TRACKING_START_FAILED', message, error.status || 0);
      } finally { starting = false; finishStart(); }
    },
    async stop() {
      if (starting) { cancelStart = true; await startSettled; }
      return stopAs();
    },
    async reconcile() {
      if (stopping) { await stopping; return { ...snapshot }; }
      if (pendingRelease) { await stopAs(); return { ...snapshot }; }
      if (!delivery || !running) return { ...snapshot };
      if (flight) await flight;
      if (!running) { if (stopping) await stopping; return { ...snapshot }; }
      emit('reconnecting', 'Comprobando la entrega y la conexión.');
      try {
        if (await current()) {
          failures = 0;
          nextAttempt = Math.max(clock.now(), putNotBefore);
          const stale = snapshot.lastCapturedAt !== null && clock.now() - snapshot.lastCapturedAt > MAX_AGE;
          emit(stale ? 'stale' : 'sharing', stale ? 'Esperando una ubicación GPS reciente.' : 'Entrega verificada. Capturando ubicación.');
          schedule();
        }
      } catch (error) { failed(error); schedule(); }
      if (stopping) await stopping;
      return { ...snapshot };
    },
    get state() { return { ...snapshot }; },
  };
}
