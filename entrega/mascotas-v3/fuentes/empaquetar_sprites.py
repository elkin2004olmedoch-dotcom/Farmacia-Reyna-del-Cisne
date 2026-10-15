#!/usr/bin/env python3
"""Package generated pharmacy characters with deterministic, shared row registration."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CELL = (192, 208)
STATES = {
    "idle": ("En reposo", [280, 110, 110, 140, 140, 320]),
    "running-right": ("Caminar a la derecha", [120] * 7 + [220]),
    "running-left": ("Caminar a la izquierda", [120] * 7 + [220]),
    "waving": ("Saludar", [140, 140, 140, 280]),
    "jumping": ("Saltar", [140, 140, 140, 140, 280]),
    "failed": ("Algo salió mal", [140] * 7 + [240]),
    "waiting": ("Esperar tu respuesta", [150] * 5 + [260]),
    "running": ("Pensar y trabajar", [120] * 5 + [220]),
    "review": ("Revisar el pedido", [150] * 5 + [280]),
}
CHARACTERS = {
    "farmi": {"name": "Farmi", "kind": "Tu pequeño farmacéutico", "color": "#9ad9a2", "personality": "Atento, curioso y siempre listo para ayudarte."},
    "boti": {"name": "Boti", "kind": "Tu frasquito de confianza", "color": "#ffb8b6", "personality": "Cariñoso y organizado. Le encanta preparar pedidos."},
    "goti": {"name": "Goti", "kind": "Una gotita de buena energía", "color": "#8fddf2", "personality": "Alegre, tranquilo y muy expresivo."},
}


def font(size: int) -> ImageFont.ImageFont:
    for path in [Path("C:/Windows/Fonts/arial.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default(size=size)


def save_gif(frames: list[Image.Image], durations: list[int], target: Path) -> None:
    """Use one palette across a whole clip to avoid color flicker."""
    target.parent.mkdir(parents=True, exist_ok=True)
    backdrop = (22, 32, 30, 255)
    opaque = []
    for source in frames:
        frame = Image.new("RGBA", source.size, backdrop)
        frame.alpha_composite(source)
        opaque.append(frame.convert("RGB"))
    palette_source = Image.new("RGB", (opaque[0].width * len(opaque), opaque[0].height))
    for index, frame in enumerate(opaque):
        palette_source.paste(frame, (index * frame.width, 0))
    palette = palette_source.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    encoded = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in opaque]
    encoded[0].save(target, save_all=True, append_images=encoded[1:], duration=durations, loop=0, disposal=2, optimize=False)


def read_state(source: Path, expected: int) -> tuple[list[Image.Image], list[str], list[str]]:
    files = sorted(source.glob("*.png")) if source.is_dir() else []
    errors = []
    if len(files) != expected:
        return [], [], [f"{len(files)}/{expected} fotogramas"]
    frames, hashes = [], []
    for path in files:
        try:
            with Image.open(path) as opened:
                image = opened.convert("RGBA")
                if image.size != CELL:
                    errors.append(f"{path.name}: tamaño {image.size}; se requiere {CELL}")
                elif image.getchannel("A").getbbox() is None:
                    errors.append(f"{path.name}: fotograma vacío")
                else:
                    frames.append(image.copy())
                    hashes.append(hashlib.sha256(path.read_bytes()).hexdigest())
        except (OSError, ValueError) as error:
            errors.append(f"{path.name}: {error}")
    return ([], [], errors) if errors else (frames, hashes, [])


def contact_sheet(character: dict, states: dict[str, list[Image.Image]], target: Path) -> None:
    header, row_gap, label_width = 74, 38, 210
    sheet = Image.new("RGB", (label_width + 8 * CELL[0] + 24, header + len(STATES) * (CELL[1] + row_gap)), "#14201d")
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), f"{character['name']} · animaciones originales", font=font(25), fill="#f0f6ee")
    for row, (state, (label, durations)) in enumerate(STATES.items()):
        y = header + row * (CELL[1] + row_gap)
        draw.text((20, y + 30), label, font=font(18), fill="#c5d9cd")
        if state not in states:
            draw.text((label_width, y + 86), "En preparación", font=font(20), fill="#9dafa5")
        for index, image in enumerate(states.get(state, [])):
            x = label_width + index * CELL[0]
            draw.rounded_rectangle((x + 3, y + 3, x + CELL[0] - 3, y + CELL[1] + 24), radius=9, fill="#1c2a25")
            sheet.paste(image, (x, y), image)
            draw.text((x + 10, y + CELL[1] + 4), f"{index + 1} · {durations[index]} ms", font=font(13), fill="#9db5a6")
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target)


def visible_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    return image.getchannel("A").point(lambda value: 255 if value > 16 else 0).getbbox()


def register_rows(root: Path, character_id: str, states: dict[str, list[Image.Image]]) -> tuple[dict, dict]:
    """One affine per whole row, sharing a feasible character height across all rows."""
    target_height = 140.0
    center, baseline, margin = 96.0, 198.0, 4.0
    rows = {}
    for state, frames in states.items():
        first = visible_bounds(frames[0])
        first_height = first[3] - first[1]
        first_center = (first[0] + first[2]) / 2
        bounds = [visible_bounds(frame) for frame in frames]
        rows[state] = {"first": first, "height": first_height, "center": first_center, "bounds": bounds}
        for box in bounds:
            for distance, room in [
                (first_center - box[0], center - margin),
                (box[2] - first_center, CELL[0] - margin - center),
                (first[3] - box[1], baseline - margin),
                (box[3] - first[3], CELL[1] - margin - baseline),
            ]:
                if distance > 0:
                    target_height = min(target_height, room * first_height / distance)
    # Reserve a pixel for the raster rounding of the shared row transform.
    target_height = max(1.0, target_height - 1.0)
    registered = {}
    report = {"character": character_id, "method": "one shared nearest-neighbor affine per row, derived from frame 0", "alphaThreshold": 16, "requestedHeight": 140, "targetHeight": round(target_height, 3), "baseline": baseline, "centerX": center, "rows": {}, "ok": True}
    for state, values in rows.items():
        scale = target_height / values["height"]
        dx = center - values["center"] * scale
        dy = baseline - values["first"][3] * scale
        output = []
        for index, original in enumerate(states[state]):
            frame = original.transform(CELL, Image.Transform.AFFINE, (1 / scale, 0, -dx / scale, 0, 1 / scale, -dy / scale), resample=Image.Resampling.NEAREST)
            output_dir = root / "runs" / character_id / "frames-web" / state
            output_dir.mkdir(parents=True, exist_ok=True)
            frame.save(output_dir / f"{index:02d}.png")
            output.append(frame)
        registered[state] = output
        output_bounds = [visible_bounds(frame) for frame in output]
        clipped = [index for index, box in enumerate(output_bounds) if not box or box[0] <= 0 or box[1] <= 0 or box[2] >= CELL[0] or box[3] >= CELL[1]]
        report["rows"][state] = {"scale": round(scale, 6), "translation": [round(dx, 4), round(dy, 4)], "sourceFirstBounds": values["first"], "sourceBounds": values["bounds"], "bounds": output_bounds, "clippedFrames": clipped}
        if clipped:
            report["ok"] = False
    if "idle" in registered and "jumping" in registered:
        idle = visible_bounds(registered["idle"][0])
        jump = [visible_bounds(frame) for frame in registered["jumping"]]
        height_ratio = (jump[0][3] - jump[0][1]) / (idle[3] - idle[1])
        lift = jump[0][3] - min(box[3] for box in jump)
        landing_delta = jump[-1][3] - idle[3]
        report["jump"] = {"firstHeightToIdleRatio": round(height_ratio, 4), "firstBaselineDelta": jump[0][3] - idle[3], "peakLiftPixels": lift, "landingBaselineDelta": landing_delta, "ok": 0.94 <= height_ratio <= 1.06 and lift >= 5 and abs(landing_delta) <= 10}
        report["ok"] = report["ok"] and report["jump"]["ok"]
    report_path = root / "runs" / character_id / "qa" / "registration.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return registered, report


def make_lineup(root: Path, characters: dict[str, Image.Image]) -> None:
    sheet = Image.new("RGB", (1000, 500), "#101914")
    draw = ImageDraw.Draw(sheet)
    draw.text((30, 22), "Tres pequeños compañeros para tu farmacia", font=font(25), fill="#e2edd9")
    for index, (character_id, info) in enumerate(CHARACTERS.items()):
        x = 30 + index * 320
        draw.rounded_rectangle((x, 68, x + 300, 473), radius=20, fill="#1a2820", outline="#354431")
        if character_id in characters:
            image = characters[character_id].resize((288, 312), Image.Resampling.NEAREST)
            sheet.paste(image, (x + 6, 76), image)
        draw.text((x + 23, 391), info["name"], font=font(25), fill=info["color"])
        draw.text((x + 23, 430), info["kind"], font=font(13), fill="#95ac8c")
    sheet.save(root / "previews" / "tres-companeros.png")


def package(root: Path, strict: bool) -> dict:
    sprite_dir, preview_dir = root / "sprites", root / "previews"
    sprite_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    result = {"schema": "farmacia-companions-1", "generatedAt": datetime.now(timezone.utc).isoformat(), "cell": {"width": CELL[0], "height": CELL[1]}, "complete": True, "characters": [], "comparisonPreview": "previews/tres-companeros.png", "issues": []}
    resting_frames = {}
    for character_id, info in CHARACTERS.items():
        atlas = Image.new("RGBA", (CELL[0] * 8, CELL[1] * len(STATES)))
        source_states, hashes_by_state, combined, combined_durations = {}, {}, [], []
        item = {"id": character_id, **info, "portrait": f"art/{character_id}-base.png", "atlas": f"sprites/{character_id}.png", "states": {}, "complete": True, "contactSheet": f"previews/{character_id}/contacto.png", "allStatesGif": f"previews/{character_id}/todas.gif", "registration": f"runs/{character_id}/qa/registration.json"}
        for state, (_label, durations) in STATES.items():
            images, hashes, errors = read_state(root / "runs" / character_id / "frames" / state, len(durations))
            if errors:
                result["complete"] = item["complete"] = False
                result["issues"].append({"character": character_id, "state": state, "problems": errors})
            else:
                source_states[state], hashes_by_state[state] = images, hashes
        states, registration = register_rows(root, character_id, source_states)
        if "idle" in states:
            resting_frames[character_id] = states["idle"][0]
        item["registrationOk"] = registration["ok"]
        if not registration["ok"]:
            result["complete"] = item["complete"] = False
            result["issues"].append({"character": character_id, "state": "registration", "problems": ["Falló el registro de fila, la escala de transición o el salto; revisar qa/registration.json"]})
        for row, (state, (label, durations)) in enumerate(STATES.items()):
            if state not in states:
                continue
            images = states[state]
            for column, image in enumerate(images):
                # Exact placement: no crop, resize, per-frame centering, or jump correction.
                atlas.alpha_composite(image, (column * CELL[0], row * CELL[1]))
            gif_path = f"previews/{character_id}/{state}.gif"
            item["states"][state] = {"label": label, "durations": durations, "frames": [{"x": column * CELL[0], "y": row * CELL[1], "width": CELL[0], "height": CELL[1]} for column in range(len(images))], "gif": gif_path, "sourceSha256": hashes_by_state[state], "normalizedSha256": [hashlib.sha256((root / "runs" / character_id / "frames-web" / state / f"{index:02d}.png").read_bytes()).hexdigest() for index in range(len(images))]}
            save_gif(images, durations, root / gif_path)
            for index, image in enumerate(images):
                shown = Image.new("RGBA", (CELL[0], CELL[1] + 30), (22, 32, 30, 255))
                shown.alpha_composite(image, (0, 30))
                draw = ImageDraw.Draw(shown)
                draw.rounded_rectangle((5, 3, CELL[0] - 5, 26), radius=6, fill="#263d32")
                draw.text((12, 7), f"{label} · {index + 1}/{len(images)}", font=font(11), fill="#e3f5df")
                combined.append(shown)
                combined_durations.append(durations[index] + (420 if index == len(images) - 1 else 0))
        atlas.save(root / item["atlas"], optimize=True)
        item["atlasSha256"] = hashlib.sha256((root / item["atlas"]).read_bytes()).hexdigest()
        if combined:
            save_gif(combined, combined_durations, root / item["allStatesGif"])
        else:
            item["allStatesGif"] = None
        contact_sheet(item, states, root / item["contactSheet"])
        if "idle" in states and "jumping" in states:
            transition = states["idle"] + states["jumping"] + states["idle"]
            transition_durations = STATES["idle"][1] + STATES["jumping"][1] + STATES["idle"][1]
            item["jumpTransitionGif"] = f"previews/{character_id}/salto-transicion.gif"
            save_gif(transition, transition_durations, root / item["jumpTransitionGif"])
        result["characters"].append(item)
    make_lineup(root, resting_frames)
    manifest_file = sprite_dir / "manifest.json"
    temporary = manifest_file.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(manifest_file)
    summary = {"ok": result["complete"] or not strict, "complete": result["complete"], "manifest": str(manifest_file), "states": {item["id"]: len(item["states"]) for item in result["characters"]}, "issues": result["issues"]}
    (root / "previews" / "empaquetado.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if strict and not result["complete"]:
        raise SystemExit(1)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--strict", action="store_true", help="Exit with failure unless all three characters have all nine valid states.")
    args = parser.parse_args()
    package(args.root.resolve(), args.strict)


if __name__ == "__main__":
    main()
