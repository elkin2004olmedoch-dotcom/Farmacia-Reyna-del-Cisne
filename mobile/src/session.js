const STORAGE_KEY = 'farmacia.reparto.session.v1';
const CODES = new Set(['INVALID_TOKEN', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'INVALID_CREDENTIALS', 'MOBILE_SESSION_REQUIRED', 'GPS_CHANGED', 'GPS_STALE', 'GPS_NOT_ACTIVE', 'GPS_TOO_FREQUENT', 'GPS_OWNED', 'GPS_SESSION_BUSY', 'DELIVERY_CHANGED', 'INVALID_DELIVERY_TRANSITION', 'ORDER_NOT_READY', 'ORDER_NOT_DELIVERABLE', 'TOO_MANY_REQUESTS']);

function failure(status, code) {
  const message = status === 0 ? 'No se pudo conectar. Comprueba tu conexión e intenta nuevamente.'
    : status === 401 ? 'La sesión venció. Inicia sesión nuevamente.'
      : status === 403 ? 'No tienes permiso para esta acción.'
        : status === 404 ? 'La entrega ya no está disponible.'
          : status === 409 ? 'Los datos cambiaron. Actualiza antes de continuar.'
            : status === 429 ? 'Espera unos segundos antes de intentar nuevamente.'
              : 'No se pudo completar la solicitud.';
  return Object.assign(new Error(message), { status, code });
}

function nextSecret(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw failure(0, 'RANDOM_UNAVAILABLE');
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const safeProfile = user => Object.fromEntries(['id', 'nombre', 'email', 'telefono', 'role', 'activo'].filter(key => user?.[key] !== undefined).map(key => [key, user[key]]));

export function createSession({ transport, storage, randomBytes, now = Date.now }) {
  let record = null, token = null, expiresAt = 0, renewal = null, loaded = false, accessVersion = 0;

  async function stored(method, value) {
    try { return await storage[method](STORAGE_KEY, value); }
    catch { throw failure(0, 'SECURE_STORAGE_ERROR'); }
  }

  async function clear() {
    token = null;
    expiresAt = 0;
    record = null;
    loaded = true;
    await stored('remove');
  }

  async function send(path, options) {
    let response;
    try { response = await transport(path, options); }
    catch { throw failure(0, 'NETWORK_ERROR'); }
    if (!response || !Number.isInteger(response.status)) throw failure(0, 'NETWORK_ERROR');
    if (response.status === 204) return null;
    if (response.status < 200 || response.status >= 300 || response.body?.ok !== true) {
      const code = response.body?.error?.code;
      throw failure(response.status, CODES.has(code) ? code : 'REQUEST_FAILED');
    }
    return response.body.data;
  }

  async function accept(data) {
    if (data?.usuario?.role !== 'repartidor') { await clear(); throw failure(403, 'FORBIDDEN'); }
    if (typeof data.token !== 'string' || !data.token || typeof data.refreshToken !== 'string'
      || !Number.isFinite(Date.parse(data.expiresAt)) || !Number.isFinite(Date.parse(data.refreshExpiresAt))) {
      throw failure(502, 'INVALID_RESPONSE');
    }
    const saved = { refreshToken: data.refreshToken, pendingNextSecret: null, usuario: safeProfile(data.usuario), refreshExpiresAt: data.refreshExpiresAt, ...(record?.pendingRevocation ? { pendingRevocation: true } : {}) };
    await stored('set', saved);
    record = saved;
    token = data.token;
    accessVersion++;
    expiresAt = Date.parse(data.expiresAt);
    loaded = true;
    return { ...saved.usuario };
  }

  async function load() {
    if (loaded) return;
    record = await stored('get');
    loaded = true;
    if (record && (typeof record.refreshToken !== 'string' || record.usuario?.role !== 'repartidor'
      || !Number.isFinite(Date.parse(record.refreshExpiresAt)) || Date.parse(record.refreshExpiresAt) <= now()
      || (record.pendingNextSecret != null && !/^[A-Za-z0-9_-]{43}$/.test(record.pendingNextSecret)))) await clear();
  }

  async function renew() {
    if (renewal) return renewal;
    renewal = (async () => {
      await load();
      if (!record) throw failure(401, 'INVALID_TOKEN');
      if (Date.parse(record.refreshExpiresAt) <= now()) { await clear(); throw failure(401, 'INVALID_TOKEN'); }
      if (!record.pendingNextSecret) {
        let secret;
        try { secret = nextSecret(randomBytes(32)); }
        catch { throw failure(0, 'RANDOM_UNAVAILABLE'); }
        const pending = { ...record, pendingNextSecret: secret };
        await stored('set', pending);
        record = pending;
      }
      try {
        return await accept(await send('/auth/mobile/renew', { method: 'POST', data: { refreshToken: record.refreshToken, nextSecret: record.pendingNextSecret } }));
      } catch (error) {
        if (error.status === 401 || error.status === 403) await clear();
        throw error;
      }
    })();
    try { return await renewal; }
    finally { renewal = null; }
  }

  async function ensureAccess() {
    if (renewal) await renewal;
    else if (!token || expiresAt - now() < 60000) await renew();
  }

  async function revokePending(revocationToken) {
    try {
      if (!revocationToken) { await ensureAccess(); revocationToken = token; }
      await send('/auth/mobile/logout', { method: 'POST', token: revocationToken });
      await clear();
    } catch (error) {
      if (error.status === 401) { await clear(); return; }
      throw error;
    } finally { token = null; expiresAt = 0; }
  }

  async function logout() {
    await load();
    if (!record) { await clear(); return; }
    const revocationToken = expiresAt > now() ? token : null;
    record = { ...record, pendingRevocation: true };
    token = null;
    expiresAt = 0;
    let markerFailed = false;
    try { await stored('set', record); } catch { markerFailed = true; }
    // A failed local write must not prevent revocation while an access token
    // still works. If both boundaries fail, the UI must not claim local closure.
    try { return await revokePending(revocationToken); }
    catch (error) { if (markerFailed) throw failure(0, 'LOCAL_LOGOUT_FAILED'); throw error; }
  }

  return {
    async login(email, password) {
      if (renewal) await renewal.catch(() => {});
      await load();
      if (record) await logout();
      return accept(await send('/auth/mobile/login', { method: 'POST', data: { email, password } }));
    },
    async restore() {
      await load();
      if (!record) return null;
      if (record.pendingRevocation) { await revokePending(); return null; }
      return renew();
    },
    async request(path, { method = 'GET', data } = {}) {
      if (typeof path !== 'string' || !/^\/(?!\/)/.test(path) || /[\\\r\n]/.test(path)) throw failure(400, 'INVALID_PATH');
      await load();
      if (record?.pendingRevocation) throw failure(401, 'SESSION_REVOCATION_PENDING');
      await ensureAccess();
      const usedToken = token;
      const usedVersion = accessVersion;
      try { return await send(path, { method, data, token: usedToken }); }
      catch (error) {
        if (error.status !== 401) throw error;
        if (usedVersion === accessVersion) await renew();
        else await ensureAccess();
        try { return await send(path, { method, data, token }); }
        catch (retryError) { if (retryError.status === 401) await clear(); throw retryError; }
      }
    },
    logout,
    get user() { return !record?.pendingRevocation && record?.usuario ? { ...record.usuario } : null; },
    get authenticated() { return Boolean(!record?.pendingRevocation && token && expiresAt > now()); },
  };
}
