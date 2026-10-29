# Recorrido completo de roles y carrito inferior

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Registrar resultados y evidencia sin usar datos reales como fixtures.

**Goal:** probar y mostrar los recorridos de cliente, administrador y repartidor, corregir defectos reproducidos y facilitar el acceso al carrito desde Productos.

**Architecture:** conservar las tres capas existentes y sus eventos de sesión/carrito. Barra inferior en catálogo y ficha, con cantidad y enlace al carrito; el precio detallado permanece en el carrito para evitar consultas redundantes o datos de precio desactualizados. HTML generado desde la plantilla, sin dependencias nuevas.

**Spec:** ampliación autorizada del contrato y diseño comercial del 28 de octubre; nueva petición del propietario de recorrido visual y carrito inferior. La ubicación de demostración y los importes son sintéticos; la tarifa real de Puerto Quito sigue pendiente hasta decisión administrativa.

## Restricciones

- Conservar marca, HTML/CSS/JavaScript, Express y Prisma 6; ningún cambio de schema previsto.
- Probar escrituras con SQLite/usuarios temporales, nunca con pedidos, precios o repartidores reales.
- Publicar correcciones verificadas en Render/Pages existentes; conservar Auto-Deploy Off, DNS y planes.
- No modificar checkouts anidados ni capturas históricas. Capturas nuevas etiquetadas como demostración sintética.

## Revisión

- Tarifa pendiente, gratuita explícita, cobrada y cambio concurrente: total y confirmación correctos.
- Cliente ajeno, repartidor ajeno y sesión vencida: ninguna exposición ni mutación.
- GPS voluntario, retirada, precisión/hora y cierre; navegación Maps y llamada únicamente al llegar.
- Farmi precio/promoción/zona/asignación/estado y datos incompletos: autorización y validación conservadas.
- Barra inferior: vacía/roles ocultos, actualización inmediata, foco/teclado, 320 px y mascota sin solapamiento.

## Tareas

- [ ] Revisar y reproducir recorridos y huecos de prueba; corregir la causa de cualquier fallo real.
- [ ] Implementar barra inferior mínima reutilizando estructura y conteo existentes; RED/GREEN y revisión.
- [ ] Recorrer visualmente compra → tarifa → administración/Farmi → asignación → GPS/mapa → llegada/llamada → entrega y privacidad, con evidencia de cada paso.
- [ ] Ejecutar comprobaciones adecuadas de Node/navegador/Pages y registrar fallos, correcciones y omisiones exactas.
- [ ] Revisar cambios, publicar en servicios existentes y comprobar artefactos/barreras públicos.
- [ ] Entregar galería/documento con capturas del recorrido y límites reales de la prueba.
