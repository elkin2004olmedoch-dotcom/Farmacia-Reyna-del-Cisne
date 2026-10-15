/* Local pharmacy companion player. All character pixels come from generated artwork. */
"use strict";
(() => {
  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#actor");
  const context = canvas.getContext("2d");
  const stage = $("#stage");
  const metadata = {
    farmi: { id: "farmi", name: "Farmi", kind: "Tu pequeño farmacéutico", short: "El atento", personality: "Atento, curioso y siempre listo para ayudarte.", portrait: "art/farmi-base.png", color: "#9ad9a2" },
    boti: { id: "boti", name: "Boti", kind: "Tu frasquito de confianza", short: "El cariñoso", personality: "Cariñoso y organizado. Le encanta preparar pedidos.", portrait: "art/boti-base.png", color: "#ffb8b6" },
    goti: { id: "goti", name: "Goti", kind: "Una gotita de buena energía", short: "El alegre", personality: "Alegre, tranquilo y muy expresivo.", portrait: "art/goti-base.png", color: "#8fddf2" },
  };
  const stateInfo = {
    idle: ["En reposo", "◡", "Respira, parpadea y te acompaña mientras navegas."],
    waving: ["Saludar", "♧", "Te saluda cuando acercas el cursor. ¡Pasa a decir hola!"],
    jumping: ["Saltar", "↑", "Toca a tu compañero para verlo saltar y aterrizar."],
    "running-right": ["Caminar →", "→", "Camina hacia la derecha. También puedes arrastrarlo por el escenario."],
    "running-left": ["← Caminar", "←", "Camina hacia la izquierda. Haz clic en el suelo para que vaya allí."],
    running: ["Pensar", "⋯", "Se concentra mientras el bot prepara una respuesta."],
    waiting: ["Esperar", "◷", "Te mira con paciencia cuando necesita que respondas."],
    review: ["Revisar", "✓", "Comprueba el resultado cuando el bot termina una tarea."],
    failed: ["Intentar de nuevo", "↻", "Expresa que una tarea necesita otro intento."],
  };
  const sequence = ["idle", "running-right", "running-left", "waving", "jumping", "failed", "waiting", "running", "review"];
  const images = new Map();
  let manifest = null;
  let selected = safeRead("farmacia-companion") || "goti";
  if (!metadata[selected]) selected = "goti";
  let paused = safeRead("farmacia-motion") === "paused";
  let state = "idle", frame = 0, elapsed = 0, lifetime = Infinity;
  let width = 760, height = 370, position = 0.5, destination = null, pointer = null, hovered = false;
  let lastTimestamp = 0, sequenceIndex = -1, sequenceRemaining = 0, chatting = false, chatTimer = null;
  let lastManifestVersion = null, toastTimer = null;

  function safeRead(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function safeWrite(key, value) { try { localStorage.setItem(key, value); } catch { /* Private storage is optional. */ } }
  function emit(type, detail) { window.dispatchEvent(new CustomEvent(`mascota:${type}`, { detail })); }
  function character() { return manifest?.characters.find((item) => item.id === selected) || { ...metadata[selected], states: {} }; }
  function clip(name = state) { return character().states?.[name]; }
  function duration(name) { return clip(name)?.durations.reduce((sum, value) => sum + value, 0) || 1200; }
  function hasState(name) { return Boolean(clip(name)?.frames.length); }
  function announce(message) {
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 2200);
  }
  function loadImage(src) {
    if (images.has(src)) return images.get(src);
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    images.set(src, image);
    return image;
  }
  function setState(nextState, options = {}) {
    if (!stateInfo[nextState]) return false;
    if (!hasState(nextState)) {
      if (!options.silent) announce("Este gesto se está preparando. Se activará al terminar sus fotogramas.");
      return false;
    }
    state = nextState;
    frame = 0;
    elapsed = 0;
    lifetime = options.durationMs ?? (options.loop === true || nextState === "idle" ? Infinity : duration(nextState) * (options.loops || 2));
    $("#state-label").lastChild.textContent = ` ${stateInfo[state][0]}`;
    $("#action-description").textContent = stateInfo[state][2];
    document.querySelectorAll(".state-button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.state === state)));
    emit("state", { character: selected, state, available: true });
    return true;
  }
  function stopSequence() {
    sequenceIndex = -1;
    sequenceRemaining = 0;
    $("#play-all").textContent = "▶ Ver todos los gestos";
  }
  function goTo(normalizedX) {
    if (paused) togglePause(false);
    const bounded = Math.min(0.82, Math.max(0.18, normalizedX));
    const nextState = bounded > position ? "running-right" : "running-left";
    if (Math.abs(bounded - position) < 0.015 || !hasState(nextState)) return;
    stopSequence();
    destination = bounded;
    setState(nextState, { loop: true });
    $("#target").hidden = false;
    $("#target").style.left = `${bounded * 100}%`;
  }
  function setCharacter(id, options = {}) {
    if (!metadata[id]) return false;
    stopSequence();
    destination = null;
    pointer = null;
    hovered = false;
    $("#target").hidden = true;
    canvas.classList.remove("dragging");
    selected = id;
    position = 0.5;
    state = "idle"; frame = 0; elapsed = 0; lifetime = Infinity;
    safeWrite("farmacia-companion", id);
    $("#character-name").textContent = metadata[id].name;
    $("#personality").textContent = metadata[id].personality;
    canvas.setAttribute("aria-label", `${metadata[id].name}: pulsa para saltar, arrastra para caminar. Usa las flechas o la barra espaciadora.`);
    document.querySelectorAll(".character-card").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.character === id)));
    refreshAvailability();
    setState("idle", { silent: true });
    updateProof();
    if (!options.initial && hasState("waving")) setState("waving", { loops: 1 });
    emit("character", { id, name: metadata[id].name });
    return true;
  }
  function togglePause(force) {
    paused = typeof force === "boolean" ? force : !paused;
    safeWrite("farmacia-motion", paused ? "paused" : "active");
    $("#pause").setAttribute("aria-pressed", String(paused));
    $("#pause").setAttribute("aria-label", paused ? "Reanudar animación" : "Pausar animación");
    $("#pause").textContent = paused ? "▶" : "Ⅱ";
    updateProof();
    emit("motion", { paused });
  }
  function updateProof() {
    const item = character();
    const gif = $("#proof-gif"), link = $("#download-gif"), contact = $("#contact-link");
    $("#proof-name").textContent = `${metadata[selected].name} · ${Object.keys(item.states || {}).length} estados`;
    if (item.allStatesGif) {
      gif.src = paused ? item.portrait : `${item.allStatesGif}?v=${lastManifestVersion || "1"}`;
      gif.alt = paused ? `${metadata[selected].name}, vista estática con movimiento pausado` : `Animación de todos los gestos de ${metadata[selected].name}`;
      gif.hidden = false;
      $("#proof-pending").hidden = true;
      link.href = item.allStatesGif; link.hidden = false;
      contact.href = item.contactSheet; contact.hidden = false;
    } else {
      gif.src = item.portrait; gif.alt = `${metadata[selected].name}, arte base`;
      gif.hidden = false;
      $("#proof-pending").hidden = true;
      link.hidden = contact.hidden = true;
    }
  }
  function refreshAvailability() {
    const count = Object.keys(character().states || {}).length;
    $("#asset-status").textContent = count === 9 ? "9 gestos disponibles" : `${count}/9 gestos preparados`;
    for (const button of document.querySelectorAll(".state-button")) {
      button.disabled = !hasState(button.dataset.state);
      button.title = button.disabled ? "Fotogramas en preparación" : stateInfo[button.dataset.state][2];
    }
    $("#play-all").disabled = count === 0;
  }
  async function refreshManifest() {
    try {
      const response = await fetch(`sprites/manifest.json?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      if (next.schema !== "farmacia-companions-1" || next.generatedAt === lastManifestVersion) return;
      manifest = next;
      lastManifestVersion = next.generatedAt;
      for (const item of next.characters) {
        item.atlasImage = `${item.atlas}?v=${item.atlasSha256 || next.generatedAt}`;
        loadImage(item.atlasImage);
      }
      refreshAvailability();
      updateProof();
      if (!hasState(state)) setState("idle", { silent: true });
      emit("ready", { complete: manifest.complete, characters: next.characters.map(({ id, states }) => ({ id, states: Object.keys(states) })) });
    } catch { /* The canonical images remain usable while a partial package is being rebuilt. */ }
  }
  function actorRect() {
    const h = Math.min(250, height * 0.73), w = h * 192 / 208;
    return { x: position * width - w / 2, y: height - 40 - h, width: w, height: h };
  }
  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  function hit(pointValue) {
    const box = actorRect();
    return pointValue.x >= box.x && pointValue.x <= box.x + box.width && pointValue.y >= box.y && pointValue.y <= box.y + box.height;
  }
  function resize() {
    const bounds = stage.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width; height = bounds.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    const current = character(), currentClip = clip(), image = current.atlasImage ? images.get(current.atlasImage) : null, box = actorRect();
    if (currentClip && image?.complete && image.naturalWidth) {
      const rect = currentClip.frames[Math.min(frame, currentClip.frames.length - 1)];
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height, box.x, box.y, box.width, box.height);
    } else {
      const portrait = loadImage(current.portrait);
      if (!portrait.complete || !portrait.naturalWidth) return;
      const scale = Math.min(box.width / portrait.naturalWidth, box.height / portrait.naturalHeight);
      const w = portrait.naturalWidth * scale, h = portrait.naturalHeight * scale;
      context.drawImage(portrait, box.x + (box.width - w) / 2, box.y + box.height - h, w, h);
    }
  }
  function advanceSequence(delta) {
    if (sequenceIndex < 0) return;
    sequenceRemaining -= delta;
    if (sequenceRemaining > 0) return;
    sequenceIndex += 1;
    while (sequenceIndex < sequence.length && !hasState(sequence[sequenceIndex])) sequenceIndex += 1;
    if (sequenceIndex >= sequence.length) { stopSequence(); setState("idle", { silent: true }); return; }
    const next = sequence[sequenceIndex];
    setState(next, { loop: true });
    sequenceRemaining = duration(next) * 2 + 250;
    $("#play-all").textContent = `■ Detener · ${sequenceIndex + 1}/9`;
  }
  function tick(timestamp) {
    const delta = lastTimestamp ? Math.min(timestamp - lastTimestamp, 80) : 0;
    lastTimestamp = timestamp;
    if (!paused && !document.hidden) {
      if (destination !== null && !pointer) {
        const step = delta * 0.17 / width;
        if (Math.abs(destination - position) <= step) {
          position = destination; destination = null; $("#target").hidden = true; setState("idle", { silent: true });
        } else position += Math.sign(destination - position) * step;
      }
      const currentClip = clip();
      if (currentClip) {
        elapsed += delta;
        while (elapsed >= currentClip.durations[frame]) {
          elapsed -= currentClip.durations[frame]; frame = (frame + 1) % currentClip.frames.length;
        }
      }
      if (Number.isFinite(lifetime)) {
        lifetime -= delta;
        if (lifetime <= 0 && sequenceIndex < 0 && !pointer && destination === null) setState("idle", { silent: true });
      }
      advanceSequence(delta);
    }
    draw();
    requestAnimationFrame(tick);
  }
  function appendMessage(text, kind) {
    const node = document.createElement("div");
    node.className = `message ${kind}`; node.textContent = text;
    $("#messages").append(node);
    $("#messages").scrollTop = $("#messages").scrollHeight;
    return node;
  }
  function replyFor(message) {
    const text = message.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/horario|abren|cierran|direccion|ubicacion/.test(text)) return { state: "waiting", text: "Puedo mostrar el horario y la ubicación cuando me conecten con los datos de la farmacia. En esta demo aún no tengo esos datos. ¿Quieres probar otro gesto?" };
    if (/pedido|comprar|carrito|entrega/.test(text)) return { state: "review", text: "¡Vamos a preparar tu pedido! Dime el nombre del producto y la cantidad. Esta demo no crea pedidos ni confirma precios; la farmacia podrá revisarlos cuando conectemos el bot." };
    if (/buscar|producto|catalogo|stock|precio/.test(text)) return { state: "waiting", text: "Cuéntame qué producto buscas. Cuando esté conectado al catálogo podré ayudarte a localizarlo y consultar su disponibilidad. Por ahora puedes ver cómo pienso y espero tu respuesta." };
    if (/hola|buenas|salud/.test(text)) return { state: "waving", text: `¡Hola! Soy ${metadata[selected].name}. Me encanta acompañarte. Puedes pedirme que busque un producto o pulsar los botones para conocer todos mis gestos.` };
    if (/gracias|listo|perfecto/.test(text)) return { state: "jumping", text: "¡Con gusto! Aquí estaré para ayudarte. Si quieres, cambia de compañero: cada uno tiene su propia personalidad." };
    if (/dosis|tomar|sintoma|dolor|tratamiento|medicamento|embaraz|receta/.test(text)) return { state: "waiting", text: "Puedo ayudarte con el catálogo y los pedidos. Para una consulta sobre medicamentos o salud, habla con el profesional de la farmacia; esta demo no evalúa síntomas ni indica tratamientos." };
    return { state: "review", text: `Te acompaño con gusto. Soy ${metadata[selected].name}, y puedo mostrarte la búsqueda de productos, la preparación de pedidos y mis gestos. Esta es una conversación de demostración local.` };
  }
  function sendMessage(message) {
    const text = String(message || "").trim().slice(0, 240);
    if (!text) return false;
    clearTimeout(chatTimer);
    document.querySelectorAll(".message.thinking").forEach((node) => node.remove());
    stopSequence(); destination = null; $("#target").hidden = true;
    if (paused) togglePause(false);
    appendMessage(text, "user");
    $("#chat-input").value = "";
    chatting = true;
    const thinking = appendMessage(`${metadata[selected].name} está pensando…`, "bot thinking");
    setState("running", { loop: true, silent: true });
    emit("message", { text, source: "local-demo" });
    chatTimer = setTimeout(() => {
      thinking.remove();
      const reply = replyFor(text);
      appendMessage(reply.text, "bot");
      chatting = false;
      if (!setState(reply.state, { loops: reply.state === "waiting" ? 4 : 2, silent: true })) {
        setState("idle", { silent: true });
      }
    }, 1550);
    return true;
  }

  for (const id of ["farmi", "boti", "goti"]) {
    const item = metadata[id], button = document.createElement("button");
    button.type = "button"; button.className = "character-card"; button.dataset.character = id;
    button.setAttribute("aria-pressed", String(selected === id)); button.setAttribute("aria-label", `Elegir a ${item.name}: ${item.kind}`);
    const image = document.createElement("img"); image.src = item.portrait; image.alt = "";
    const label = document.createElement("span"), title = document.createElement("strong"), description = document.createElement("small");
    title.textContent = item.name; description.textContent = item.short;
    label.append(title, description); button.append(image, label); button.addEventListener("click", () => setCharacter(id));
    $("#characters").append(button); loadImage(item.portrait);
  }
  for (const [name, [label, symbol]] of Object.entries(stateInfo)) {
    const button = document.createElement("button"), icon = document.createElement("span");
    button.type = "button"; button.className = "state-button"; button.dataset.state = name;
    button.setAttribute("aria-pressed", String(name === "idle")); button.disabled = true;
    icon.textContent = symbol; icon.setAttribute("aria-hidden", "true"); button.append(icon, label);
    button.addEventListener("click", () => {
      stopSequence(); destination = null; $("#target").hidden = true;
      if (paused) togglePause(false);
      if (name === "running-right" || name === "running-left") {
        // Move toward the opposite side if already near the chosen edge.
        if (name === "running-right" && position > 0.75) position = 0.25;
        if (name === "running-left" && position < 0.25) position = 0.75;
        goTo(name === "running-right" ? 0.80 : 0.20);
      } else setState(name);
    });
    $("#states").append(button);
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const location = point(event);
    if (hit(location)) {
      stopSequence(); destination = null; $("#target").hidden = true;
      pointer = { id: event.pointerId, x: location.x, lastX: location.x, moved: false };
      canvas.setPointerCapture(event.pointerId); canvas.classList.add("dragging");
      if (paused) togglePause(false);
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const location = point(event);
    if (pointer?.id === event.pointerId) {
      const dx = location.x - pointer.lastX;
      if (Math.abs(location.x - pointer.x) > 6) pointer.moved = true;
      if (pointer.moved && Math.abs(dx) > 0.5) {
        position = Math.max(0.15, Math.min(0.85, location.x / width));
        const next = dx > 0 ? "running-right" : "running-left";
        if (state !== next) setState(next, { loop: true, silent: true });
      }
      pointer.lastX = location.x;
    } else {
      const inside = hit(location);
      if (inside && !hovered && state === "idle" && !paused && !chatting) setState("waving", { loops: 1, silent: true });
      hovered = inside;
      canvas.style.cursor = inside ? "grab" : "pointer";
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (pointer?.id === event.pointerId) {
      const moved = pointer.moved;
      pointer = null; canvas.classList.remove("dragging");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      setState(moved ? "idle" : "jumping", { loops: 1, silent: true });
    } else if (event.button === 0) goTo(point(event).x / width);
  });
  canvas.addEventListener("pointercancel", () => { pointer = null; canvas.classList.remove("dragging"); setState("idle", { silent: true }); });
  canvas.addEventListener("pointerleave", () => { hovered = false; });
  canvas.addEventListener("keydown", (event) => {
    if ([" ", "Enter", "ArrowLeft", "ArrowRight"].includes(event.key)) event.preventDefault();
    if ([" ", "Enter"].includes(event.key)) { if (paused) togglePause(false); stopSequence(); setState("jumping", { loops: 1 }); }
    if (event.key === "ArrowLeft") goTo(position - 0.2);
    if (event.key === "ArrowRight") goTo(position + 0.2);
  });
  $("#pause").addEventListener("click", () => togglePause());
  $("#play-all").addEventListener("click", () => {
    if (sequenceIndex >= 0) { stopSequence(); setState("idle", { silent: true }); return; }
    if (paused) togglePause(false);
    destination = null; position = 0.5; $("#target").hidden = true;
    sequenceIndex = -1; sequenceRemaining = 0;
    sequenceIndex = 0;
    while (sequenceIndex < sequence.length && !hasState(sequence[sequenceIndex])) sequenceIndex++;
    if (sequenceIndex >= sequence.length) { stopSequence(); return; }
    setState(sequence[sequenceIndex], { loop: true });
    sequenceRemaining = duration(sequence[sequenceIndex]) * 2 + 250;
    $("#play-all").textContent = `■ Detener · ${sequenceIndex + 1}/9`;
  });
  $("#chat-form").addEventListener("submit", (event) => { event.preventDefault(); sendMessage($("#chat-input").value); });
  document.querySelectorAll("[data-message]").forEach((button) => button.addEventListener("click", () => sendMessage(button.dataset.message)));
  window.addEventListener("resize", resize);
  new ResizeObserver(resize).observe(stage);
  window.MascotaFarmacia = Object.freeze({
    setCharacter,
    setState: (name, options = {}) => { stopSequence(); destination = null; $("#target").hidden = true; return setState(name, options); },
    setPaused: (value) => togglePause(Boolean(value)),
    getStatus: () => ({ character: selected, state, frame, paused, x: position, availableStates: Object.keys(character().states || {}), complete: Boolean(character().complete) }),
    sendMessage,
    handleBotEvent: (event) => {
      const map = { start: "running", response: "review", "need-input": "waiting", error: "failed", greeting: "waving", success: "jumping", idle: "idle" };
      return map[event] ? setState(map[event], { loop: ["start", "need-input", "idle"].includes(event), silent: true }) : false;
    },
  });
  setCharacter(selected, { initial: true });
  togglePause(paused);
  resize();
  refreshManifest().then(() => {
    const auto = new URLSearchParams(location.search).get("animar") === "1";
    if (auto && manifest?.complete && !paused && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      $("#play-all").click();
    }
  });
  setInterval(() => { if (!manifest?.complete) refreshManifest(); }, 8000);
  requestAnimationFrame(tick);
})();
