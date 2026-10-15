"""Empaqueta solo los recursos de las mascotas y su integracion local."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

BASE = Path(__file__).resolve().parents[1]
PROJECT = BASE.parents[1]
OUTPUT = PROJECT / "entrega" / "Mascotas_Farmacia_Animadas.zip"
items = {}
for name in ("index.html", "demo.css", "demo-responsive.css", "demo.js", "README.md", "iniciar-vista-previa.ps1"):
    items[name] = BASE / name
for folder in ("art", "sprites", "fuentes"):
    for source in (BASE / folder).rglob("*"):
        if source.is_file() and "__pycache__" not in source.parts and source.suffix in {".png", ".json", ".txt", ".py", ".cjs"}:
            items[source.relative_to(BASE).as_posix()] = source
for source in (BASE / "previews").rglob("*"):
    if source.is_file() and (source.suffix == ".gif" or source.name in {"tres-en-accion.png", "tres-companeros.png", "empaquetado.json", "atlas-identico.json", "prueba-demo.json", "prueba-widget.json"}):
        items[source.relative_to(BASE).as_posix()] = source
for pet in ("farmi", "boti", "goti"):
    for folder in ("frames-web", "prompts", "qa"):
        for source in (BASE / "runs" / pet / folder).rglob("*"):
            if source.is_file() and source.suffix in {".png", ".json", ".txt", ".md"}:
                items[source.relative_to(BASE).as_posix()] = source
items["integracion/frontend/controllers/mascota.js"] = PROJECT / "frontend/controllers/mascota.js"
items["integracion/frontend/assets/mascotas/widget.css"] = PROJECT / "frontend/assets/mascotas/widget.css"
items["integracion/frontend/assets/mascotas/widget-responsive.css"] = PROJECT / "frontend/assets/mascotas/widget-responsive.css"
assert OUTPUT.resolve().is_relative_to(PROJECT.resolve())
with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
    for name, source in sorted(items.items()):
        archive.write(source, name)
    archive.writestr("integracion/LEEME.txt", "La integracion ya esta hecha en este proyecto. Para otra copia: coloca mascota.js, widget.css y widget-responsive.css en sus rutas frontend; copia art/ y sprites/ del paquete a frontend/assets/mascotas/. Carga mascotaController desde controllers/app.js despues de layoutController mediante import('./mascota.js').then(({mascotaController})=>mascotaController()). No se necesitan claves ni servicios externos.\n")
with ZipFile(OUTPUT) as archive:
    assert archive.testzip() is None
    assert {"sprites/farmi.png", "sprites/boti.png", "sprites/goti.png", "sprites/manifest.json", "demo-responsive.css", "previews/tres-en-accion.gif", "integracion/frontend/controllers/mascota.js", "integracion/frontend/assets/mascotas/widget-responsive.css"} <= set(archive.namelist())
    print(f"Paquete verificado: {len(archive.namelist())} archivos, {OUTPUT.stat().st_size / 1048576:.2f} MB")
