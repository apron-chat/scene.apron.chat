"""Cuts five of the itcrowd scene's avatars into scenes/itcrowd/<user_id>.png, at 256 pixels. Moss, Roy and Jen
come from itcrowd-avatars.webp, a two-by-two grid of pixel-art portraits split by black lines. Douglas, who'd
commission his own, comes from itcrowd-avatar-douglas.webp, an oil portrait of him on a throne in ermine (the
grid's tile of him goes unused). Richmond comes from itcrowd-avatar-richmond.webp, a drawing of him as a bat on a
transparent sheet, whole, on black. The rest of the staff keep their initials, and Moss's agents share one
drawn face (itcrowd-art.mjs). The PNGs are committed; run this only to change them (it needs Pillow):

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

# Douglas, from his portrait: the square (left, top, side) around his face, the throne's gilt and the ermine, without
# most of the hand. A painting's gradients want a full palette, dithered.
left, top, side = 150, 20, 800
portrait = Image.open(HERE / "itcrowd-avatar-douglas.webp").convert("RGB")
avatar = portrait.crop((left, top, left + side, top + side)).resize((256, 256), Image.LANCZOS)
avatar.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(OUT / "douglas.png", optimize=True)
print("scenes/itcrowd/douglas.png")

# Richmond, as a bat: the whole of him, wings spread, on the black of the server room with the lights off.
bat = Image.open(HERE / "itcrowd-avatar-richmond.webp").convert("RGBA")
dark = Image.new("RGBA", bat.size, "#000000")
dark.alpha_composite(bat)
avatar = dark.convert("RGB").resize((256, 256), Image.LANCZOS)
avatar.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(OUT / "richmond.png", optimize=True)
print("scenes/itcrowd/richmond.png")
