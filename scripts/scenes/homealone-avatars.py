"""Cuts six of the homealone scene's avatars into scenes/homealone/<user_id>.png,
at 256 pixels. The rest of the cast keep their initials. The PNGs are
committed; run this only to change them (it needs Pillow):

    python3 scripts/scenes/homealone-avatars.py

Two sheets, for a mix that says who set their own picture:

- homealone-avatars.webp, a three-by-two grid of illustrated square tiles with
  rounded corners: for those who'd have promo art (Gus) or a logo (Marv's van).
  Each is cut a little inside its edge, so that no corner shows.
- homealone-avatars-photos.webp, photos and logos in circles on white (its top
  row, likenesses of the film's cast, blanked: the family keeps initials): for
  the neighbors, who'd take a picture with their phone (Buzz's tarantula,
  Harry's badge, Marley's shovel), and Little Nero's round sign. Each is cut
  as the square around its circle, and the corners outside the circle, which
  are white in the sheet, are filled with the colour at the circle's edge, so
  that the picture fills a square avatar as well as a round one.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageStat

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "scenes" / "homealone"

COLUMNS = [11, 521, 1031]  # each tile column's left edge, in the grid's pixels
ROWS = [10, 518]  # each tile row's top edge
TILE = 492  # a tile's side
INSET = 16  # trimmed from each edge, past the rounded corners

# user_id, by the tile it's in: row, then column.
TILES = [
    ("gus", 0, 1),  # the Polka King
    ("marv", 1, 0),  # the van
]

# user_id, and the circle to cut in the photo sheet: its centre (x, y) and the radius kept. Little Nero's circle runs
# off the sheet's bottom edge, so it keeps a smaller radius, inside its green ring.
CIRCLES = [
    ("buzz", 193, 556, 168),  # Axl, photographed
    ("harry", 961, 557, 168),  # a badge, his own
    ("nero", 399, 877, 146),  # the shop's sign
    ("marley", 775, 867, 150),  # the shovel
]


def save(user_id, avatar, colours):
    small = avatar.resize((256, 256), Image.LANCZOS)
    small.quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE if colours < 256 else Image.Dither.FLOYDSTEINBERG).save(OUT / f"{user_id}.png", optimize=True)
    print(f"scenes/homealone/{user_id}.png")


grid = Image.open(HERE / "homealone-avatars.webp").convert("RGB")
for user_id, row, column in TILES:
    left, top = COLUMNS[column] + INSET, ROWS[row] + INSET
    side = TILE - 2 * INSET
    # Flat colour takes a small palette well: about a third of the bytes, no visible change.
    save(user_id, grid.crop((left, top, left + side, top + side)), 128)

photos = Image.open(HERE / "homealone-avatars-photos.webp").convert("RGB")
for user_id, x, y, r in CIRCLES:
    square = photos.crop((x - r, y - r, x + r, y + r))
    inside = Image.new("L", square.size, 0)
    ImageDraw.Draw(inside).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
    # The colour at the circle's edge: a thin ring just inside it.
    ring = Image.new("L", square.size, 0)
    ImageDraw.Draw(ring).ellipse((0, 0, 2 * r - 1, 2 * r - 1), outline=255, width=6)
    edge = tuple(round(c) for c in ImageStat.Stat(square, ring).mean)
    avatar = Image.new("RGB", square.size, edge)
    avatar.paste(square, mask=inside)
    # Photos need every colour of a palette, dithered.
    save(user_id, avatar, 256)
