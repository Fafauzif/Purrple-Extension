"""Paint the original 16px Paw Pairs motifs used in the local game sprite sheet."""
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
INK = "#553b58"
GOLD = "#f6d78c"
PINK = "#e7a4b2"
CREAM = "#fff4dc"
PURPLE = "#b99ac6"
GREEN = "#77a77e"
LIGHT_GREEN = "#c6d9a6"
BROWN = "#b67a62"
BLUE = "#b3cce2"


def moon(d):
    d.polygon([(8, 1), (5, 3), (4, 7), (7, 12), (12, 11), (14, 8),
               (14, 12), (11, 14), (6, 14), (3, 12), (2, 9), (2, 5),
               (4, 2)], fill=GOLD, outline=INK)


def spool(d):
    d.rectangle((4, 2, 11, 13), fill=PINK, outline=INK)
    for y in (5, 7, 9, 11):
        d.line((5, y, 10, y-1), fill="#965877")
    for y in (1, 12):
        d.rectangle((3, y, 12, y+2), fill=GOLD, outline=INK)


def teacup(d):
    d.rounded_rectangle((9, 6, 14, 10), 2, fill=GOLD, outline=INK)
    d.polygon([(2, 5), (11, 5), (11, 9), (9, 12), (5, 12), (2, 10)],
              fill=CREAM, outline=INK)
    d.line((4, 8, 9, 8), fill=PINK)
    d.line((2, 13, 12, 13), fill=INK)
    d.line((6, 4, 7, 3, 6, 2), fill=BROWN)


def leaf(d):
    d.polygon([(3, 11), (3, 7), (6, 4), (13, 2), (12, 9), (9, 12),
               (5, 13)], fill=GREEN, outline=INK)
    d.line((2, 14, 10, 6), fill=INK)
    d.line((6, 10, 9, 10), fill=LIGHT_GREEN)


def notebook(d):
    d.polygon([(4, 2), (12, 2), (13, 12), (11, 14), (3, 14), (2, 12),
               (3, 4)], fill=PURPLE, outline=INK)
    d.line((4, 12, 11, 12), fill=CREAM)
    d.line((7, 6, 11, 6), fill=GOLD, width=2)
    d.line((4, 4, 4, 11), fill=INK)


def lantern(d):
    d.rectangle((7, 1, 9, 4), outline=INK)
    d.polygon([(5, 4), (11, 4), (12, 6), (12, 12), (11, 14), (5, 14),
               (4, 12), (4, 6)], fill=GOLD, outline=INK)
    d.rectangle((7, 8, 9, 11), fill=CREAM)
    d.line((5, 12, 11, 12), fill=BROWN)


def feather(d):
    d.polygon([(3, 11), (3, 8), (5, 5), (10, 2), (13, 2), (13, 6),
               (10, 7), (12, 8), (8, 11), (5, 12)], fill=BLUE, outline=INK)
    d.line((2, 14, 11, 5), fill=INK)


def star(d):
    d.polygon([(8, 1), (10, 5), (14, 5), (11, 9), (12, 13), (8, 11),
               (4, 13), (5, 9), (2, 5), (6, 5)], fill=GOLD, outline=INK)
    d.point((7, 6), fill=CREAM)
    d.point((8, 7), fill=CREAM)


def bell(d):
    d.ellipse((6, 11, 10, 14), fill=GOLD, outline=INK)
    d.polygon([(7, 2), (10, 3), (11, 5), (11, 9), (13, 11),
               (3, 11), (5, 9), (5, 5)], fill=GOLD, outline=INK)
    d.line((7, 5, 7, 8), fill=CREAM)


def acorn(d):
    d.polygon([(4, 6), (12, 6), (12, 10), (10, 13), (8, 14), (6, 13),
               (4, 10)], fill="#e7b475", outline=INK)
    d.polygon([(3, 7), (3, 5), (6, 3), (10, 3), (13, 5), (13, 7)],
              fill=BROWN, outline=INK)
    d.line((8, 3, 9, 1), fill=INK)


def key(d):
    d.line((4, 11, 10, 5), fill=INK, width=4)
    d.line((4, 11, 10, 5), fill=GOLD, width=2)
    d.line((4, 11, 6, 13), fill=INK, width=3)
    d.ellipse((8, 1, 14, 7), fill=GOLD, outline=INK)
    d.rectangle((11, 3, 12, 4), fill=INK)


def cloud(d):
    d.polygon([(2, 12), (2, 9), (4, 7), (6, 7), (7, 4), (10, 4),
               (12, 6), (12, 8), (14, 9), (14, 11), (12, 13), (4, 13)],
              fill=BLUE, outline=INK)
    d.line((5, 10, 11, 10), fill=CREAM)


artists = (moon, spool, teacup, leaf, notebook, lantern, feather, star, bell, acorn, key, cloud)
sheet = Image.new("RGBA", (16 * len(artists), 16))
for index, paint in enumerate(artists):
    icon = Image.new("RGBA", (16, 16))
    paint(ImageDraw.Draw(icon))
    sheet.paste(icon, (16 * index, 0))
sheet.save(ROOT / "extension/assets/games/paw-pairs.png", optimize=True)
