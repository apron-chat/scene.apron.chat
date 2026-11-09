"""Cuts four of the itcrowd scene's avatars into scenes/itcrowd/<user_id>.png, at 256 pixels: Douglas, Moss, Roy
and Jen, from itcrowd-avatars.webp, a two-by-two grid of pixel-art portraits split by black lines. The rest of the
staff keep their initials, and Moss's agents share one drawn face (itcrowd-art.mjs). The PNGs are committed; run
this only to change them (it needs Pillow):

    python3 scripts/scenes/itcrowd-avatars.py
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "scenes" / "itcrowd"

COLUMNS = [6, 632]  # each tile column's left edge, inside the black lines, in the grid's pixels
ROWS = [7, 632]  # each tile row's top edge
TILE = 615  # a tile's side
INSET = 4  # trimmed from each edge, so that no line shows

# user_id, by the tile it's in: row, then column.
TILES = [
    ("douglas", 0, 0),
    ("moss", 0, 1),
    ("roy", 1, 0),
    ("jen", 1, 1),
]

grid = Image.open(HERE / "itcrowd-avatars.webp").convert("RGB")
for user_id, row, column in TILES:
    left, top = COLUMNS[column] + INSET, ROWS[row] + INSET
    side = TILE - 2 * INSET
    avatar = grid.crop((left, top, left + side, top + side)).resize((256, 256), Image.LANCZOS)
    # Pixel art takes a small palette well.
    avatar.quantize(128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(OUT / f"{user_id}.png", optimize=True)
    print(f"scenes/itcrowd/{user_id}.png")
