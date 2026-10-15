"""Compose a synchronized preview using only approved normalized web sprites.

Run with Python 3.12 + Pillow. No character pixels are drawn or synthesized.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageSequence


ROOT = Path(__file__).resolve().parents[1]
SIZE = (720, 340)
ORDER = (
    "waving",
    "jumping",
    "running-right",
    "running-left",
    "running",
    "waiting",
    "review",
    "failed",
    "idle",
)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    filename = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / filename), size)


def centered(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str,
             fill: str, face: ImageFont.FreeTypeFont) -> None:
    draw.text(xy, value, fill=fill, font=face, anchor="mm")


def main() -> None:
    manifest = json.loads((ROOT / "sprites/manifest.json").read_text(encoding="utf-8-sig"))
    characters = manifest["characters"]
    assert [c["id"] for c in characters] == ["farmi", "boti", "goti"]
    assert manifest["cell"] == {"width": 192, "height": 208}
    title_font, state_font, name_font = font(19), font(17, True), font(18, True)
    frames: list[Image.Image] = []
    durations: list[int] = []

    for state in ORDER:
        reference = characters[0]["states"][state]
        label = reference["label"]
        for character in characters:
            assert character["states"][state]["durations"] == reference["durations"]
            assert len(character["states"][state]["frames"]) == len(reference["frames"])
        for index, duration in enumerate(reference["durations"]):
            canvas = Image.new("RGB", SIZE, "#101c17")
            draw = ImageDraw.Draw(canvas)
            centered(draw, (360, 23), "Tres pequeños compañeros para tu farmacia", "#e6efdd", title_font)
            box = draw.textbbox((0, 0), label, font=state_font)
            pill_width = max(210, box[2] - box[0] + 40)
            draw.rounded_rectangle((360 - pill_width // 2, 44, 360 + pill_width // 2, 78),
                                   radius=17, fill="#293b30", outline="#405643")
            centered(draw, (360, 60), label, "#c8e8bb", state_font)
            for column, character in enumerate(characters):
                left = 20 + column * 233
                draw.rounded_rectangle((left, 90, left + 214, 327), radius=20,
                                       fill="#1b2c22", outline="#344a37")
                source = (ROOT / "runs" / character["id"] / "frames-web" /
                          state / f"{index:02}.png")
                with Image.open(source) as sprite:
                    assert sprite.size == (192, 208)
                    rgba = sprite.convert("RGBA")
                    canvas.paste(rgba, (left + 11, 92), rgba)
                centered(draw, (left + 107, 309), character["name"], character["color"], name_font)
            frames.append(canvas)
            durations.append(duration)

    assert len(frames) == 57
    output = ROOT / "previews"
    output.mkdir(parents=True, exist_ok=True)
    frames[0].save(output / "tres-en-accion.png")

    # Derive one shared palette from the actual composed frames to avoid flicker.
    palette_source = Image.new("RGB", (144 * len(frames), 68))
    for index, frame in enumerate(frames):
        palette_source.paste(frame.resize((144, 68), Image.Resampling.NEAREST), (index * 144, 0))
    palette = palette_source.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    encoded = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    destination = output / "tres-en-accion.gif"
    encoded[0].save(destination, save_all=True, append_images=encoded[1:],
                    duration=durations, loop=0, disposal=2, optimize=False)

    with Image.open(destination) as animation:
        actual = [frame.convert("RGB").tobytes() for frame in ImageSequence.Iterator(animation)]
        actual_duration = sum(frame.info.get("duration", 0) for frame in ImageSequence.Iterator(animation))
        assert animation.n_frames == 57, animation.n_frames
        assert len(set(actual)) == 57
        assert actual_duration == sum(durations)
        assert animation.info.get("loop") == 0
        print(json.dumps({"ok": True, "size": SIZE, "frames": animation.n_frames,
                          "uniqueFrames": len(set(actual)), "durationMs": actual_duration,
                          "gif": str(destination),
                          "still": str(output / "tres-en-accion.png")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
