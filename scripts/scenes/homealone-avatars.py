"""Cuts six of the homealone scene's avatars out of homealone-avatars.webp, a
three-by-two grid of square tiles with rounded corners, into
scenes/homealone/<user_id>.png at 256 pixels: each tile, a little inside its
edge, so that no corner shows. The rest of the cast keep their initials. The
PNGs are committed; run this only to change them (it needs Pillow):

    python3 scripts/scenes/homealone-avatars.py
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "scenes" / "homealone"
COLUMNS = [11, 521, 1031]  # each column's left edge, in the grid's pixels
ROWS = [10, 518]  # each row's top edge
TILE = 492  # a tile's side
INSET = 16  # trimmed from each edge, past the rounded corners

# user_id, by the tile it's in: row, then column.
CAST = [
    ("buzz", 0, 0),  # Axl, crowned
    ("gus", 0, 1),  # the Polka King
    ("harry", 0, 2),  # a badge, his own
    ("marv", 1, 0),  # the van
    ("nero", 1, 1),  # the shop's sign
    ("marley", 1, 2),  # the shovel
]

grid = Image.open(HERE / "homealone-avatars.webp").convert("RGB")
for user_id, row, column in CAST:
    left, top = COLUMNS[column] + INSET, ROWS[row] + INSET
    side = TILE - 2 * INSET
    avatar = grid.crop((left, top, left + side, top + side)).resize((256, 256), Image.LANCZOS)
    # Flat colour takes a palette well: about a third of the bytes, no visible change.
    avatar.quantize(128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(OUT / f"{user_id}.png", optimize=True)
    print(f"scenes/homealone/{user_id}.png")
