"""Cuts the piper scene's avatars out of piper-avatars.webp, a grid of the
cast drawn as pixel-art caricatures, into scenes/piper/<user_id>.png: a
square around each face, inside its own row of the grid, on the colour that
person's avatar had before, at 256 pixels. The PNGs are committed; run this
only to change them (it needs Pillow):

    python3 scripts/scenes/piper-avatars.py
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "scenes" / "piper"
SIZE = 270  # the square cut around each face, in the grid's pixels
ROWS = [(0, 333), (334, 667)]  # the grid's two rows, top and bottom

# user_id, the centre of the face in the grid (x, y), its row, and its background.
CAST = [
    ("ada", 205, 135, 0, "#2a9d8f"),  # Richard
    ("gilfoyle", 640, 125, 0, "#26232b"),
    ("dinesh", 930, 125, 0, "#e9c46a"),
    ("jared", 1350, 120, 0, "#a8dadc"),
    ("erlich", 1720, 120, 0, "#e76f51"),
    ("bighead", 235, 445, 1, "#90be6d"),
    ("jianyang", 665, 450, 1, "#8ecae6"),
    ("russ", 1105, 440, 1, "#ffb703"),
    ("monica", 1600, 445, 1, "#b8c0ff"),
]

grid = Image.open(HERE / "piper-avatars.webp").convert("RGBA")
for user_id, x, y, row, background in CAST:
    top, bottom = ROWS[row]
    # A little below the face's centre, for shoulders, but never into the other row.
    y0 = max(top, min(y - SIZE // 2 + 20, bottom - SIZE))
    face = grid.crop((x - SIZE // 2, y0, x + SIZE // 2, y0 + SIZE))
    avatar = Image.new("RGBA", face.size, background)
    avatar.alpha_composite(face)
    # Pixel art takes a palette well: a quarter of the bytes, no visible change.
    small = avatar.convert("RGB").resize((256, 256), Image.LANCZOS)
    small.quantize(128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(OUT / f"{user_id}.png", optimize=True)
    print(f"scenes/piper/{user_id}.png")
