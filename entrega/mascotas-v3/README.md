# Farmi, Boti y Goti · Compañeros de farmacia

Tres personajes con arte original, selector y nueve gestos animados, ya integrados en las páginas de la Farmacia Reina del Cisne. El widget ayuda a buscar en el catálogo real de la tienda, abre el carrito y los pedidos, muestra el horario y reacciona cuando añades un producto al carrito. Su conversación es una guía local por reglas; no crea pedidos ni modifica el inventario.

Esta carpeta también incluye una demostración autónoma para probar todas las animaciones y los controles. El chat de esa demostración usa ejemplos locales, sin consultar los datos de la tienda.

## Abrir

En Windows, ejecuta `iniciar-vista-previa.ps1` con PowerShell. Abre `http://127.0.0.1:8768/`. El servidor solo escucha en el equipo local. Si el puerto está ocupado, usa `./iniciar-vista-previa.ps1 -Port 8769`.

Puedes cambiar de compañero, acercar el cursor para saludar, pulsarlo para saltar, arrastrarlo para caminar o pulsar el escenario para que vaya allí. Las flechas también lo mueven; espacio y Enter lo hacen saltar. El botón de pausa detiene sus fotogramas, sus desplazamientos y la vista GIF; la elección y la pausa se guardan en este navegador.

Los nueve botones permiten probar reposo, saludo, salto, caminata en ambas direcciones, pensamiento, espera, revisión y reacción de error. El chat reproduce ejemplos locales de atención comercial y activa pensamiento y respuesta. Los datos de productos, inventario, precios, ubicación y horario deberán llegar del bot real.

## Archivos

- `art/*-base.png`: arte canónico y retratos.
- `runs/{farmi,boti,goti}/frames/{estado}/00.png`: fotogramas extraídos y registrados.
- `runs/{personaje}/frames-web/{estado}/00.png`: fotogramas web con una transformación compartida por fila.
- `runs/{personaje}/qa/registration.json`: registro de escala, desplazamiento, salto y aterrizaje.
- `sprites/{personaje}.png`: atlas transparente de 1536 × 1872, con celdas de 192 × 208.
- `sprites/manifest.json`: rectángulos, duraciones, estados disponibles y hashes de los originales.
- `previews/{personaje}/*.gif`: demostración de cada estado y secuencia conjunta.
- `previews/{personaje}/contacto.png`: todos los fotogramas, etiquetados.
- `previews/empaquetado.json`: comprobación del empaquetado.
- `index.html`, `demo.css`, `demo.js`: reproductor sin dependencias ni recursos de red.
- `demo-responsive.css`, `frontend/assets/mascotas/widget-responsive.css`: ajustes fluidos para móviles estrechos, tabletas, escritorio, muescas y pantallas horizontales de poca altura.

Los originales se conservan. Antes de componer el atlas, el empaquetador aplica una sola transformación a cada fila, compartida por todos sus fotogramas. Usa el primer fotograma de cada estado para igualar el tamaño entre reposo y salto y fijar una línea de suelo común. Calcula un tamaño que deje espacio a todas las poses y a la altura del salto, sin recortar ni volver a centrar cada pose por separado. `registration.json` deja constancia de los límites y de la transición al salto.

## Regenerar recursos

Se necesita Python 3.12 con Pillow. Desde la carpeta del proyecto:

```powershell
py -3.12 entrega/mascotas-v3/fuentes/empaquetar_sprites.py
py -3.12 entrega/mascotas-v3/fuentes/empaquetar_sprites.py --strict
```

Sin `--strict`, se pueden inspeccionar las filas terminadas durante la generación. La página revisa el manifiesto cada ocho segundos mientras falten estados. `--strict` exige los nueve estados válidos para los tres personajes y devuelve un error si falta algún fotograma, si su tamaño no es 192 × 208, si está vacío o si falla el registro de escala y salto.

## Widget integrado en la tienda

`frontend/controllers/app.js` carga de forma dinámica `mascota.js` en las páginas de atención al cliente. El widget usa estilos aislados y los recursos de `frontend/assets/mascotas/`. Permite cambiar y pausar a los tres compañeros, saluda al abrir, salta al pulsarlo y reacciona al evento real `cart:changed`. Su guía local ofrece búsqueda con enlace al catálogo, carrito, pedidos, horario y contacto de WhatsApp. El texto introducido no se envía a ningún servidor. `window.FarmaciaMascota` expone `setCharacter`, `setState`, `setPaused`, `open`, `sendMessage` y `getStatus` para conectar más eventos de la tienda.

El generador `scripts/build-frontend.cjs` conserva esta integración: solo regenera las páginas HTML, que siguen cargando el mismo `controllers/app.js`.

## Conectar con el bot

La demo publica una pequeña API en `window.MascotaFarmacia`:

```javascript
MascotaFarmacia.setCharacter('goti'); // 'farmi', 'boti', 'goti'
MascotaFarmacia.setState('waving', { loops: 2 });
MascotaFarmacia.setState('running', { loop: true }); // pensando, sin correr
MascotaFarmacia.handleBotEvent('start');
MascotaFarmacia.handleBotEvent('response');
MascotaFarmacia.handleBotEvent('need-input');
MascotaFarmacia.handleBotEvent('error');
MascotaFarmacia.handleBotEvent('success');
MascotaFarmacia.setPaused(true);
console.log(MascotaFarmacia.getStatus());
```

`setState` acepta los estados `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`. Devuelve `false` si ese estado no está disponible. Los eventos del navegador `mascota:character`, `mascota:state`, `mascota:motion`, `mascota:ready` y `mascota:message` permiten observar cambios. Los mensajes de la demo se identifican con `source: 'local-demo'`.

Para integrar en la farmacia, usa los rectángulos y tiempos del manifiesto en el componente real y conecta los estados al inicio, respuesta, solicitud de datos y error del bot. El texto de demostración no sustituye la lógica de atención ni el catálogo.

## Diseño y prueba de movimiento

El arte de Farmi, Boti y Goti y sus filas animadas se creó con ImageGen integrado. Los prompts de los diseños están en `art/*-brief.txt`; los prompts de las secuencias se conservan en `runs/*/prompts/` dentro del proyecto. La extracción, el registro y la composición reutilizan los píxeles generados y no dibujan personajes nuevos.

`previews/tres-en-accion.gif` muestra las tres mascotas y sus nueve acciones en un bucle de 57 fotogramas. La vista `index.html?animar=1` reproduce automáticamente los gestos, respetando la pausa y la preferencia de movimiento reducido.
