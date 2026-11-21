"""Render the original Purrple study and house sprites. Requires Pillow."""
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw

WIDTH, HEIGHT = 448, 256
DEST = Path(__file__).resolve().parents[1] / "extension" / "assets"
PALETTES = {
    "light": {
        "ink": "#633951", "edge": "#7c4d63", "ceiling": "#a77580",
        "wall": "#ce9b8e", "wall_light": "#dcaea0", "wall_shade": "#bc877f",
        "panel": "#b67d7b", "panel_dark": "#a76d76", "panel_light": "#d9a392",
        "floor": "#bd8277", "floor_dark": "#a06469", "floor_light": "#d49783",
        "shade": "#8e5769", "wood": "#a1686d", "wood_hi": "#edaa8a", "wood_mid": "#c88476",
        "window": "#965b6f", "trim": "#e3b397", "cloth": "#915e78",
        "cloth_hi": "#ba8496", "cloth_lo": "#744c6f", "glass": "#8fabc0",
        "glass_low": "#cbc3c4", "cloud": "#eee2cd", "hill_far": "#a398ae",
        "hill": "#776e91", "trees": "#526785", "sun": "#f7ddb2",
        "rug": "#856589", "rug_hi": "#b693a0", "rug_mid": "#a67e97",
        "rug_lo": "#694e76", "spine": "#87546d", "spine_alt": "#a67a59", "leaf": "#698578",
        "leaf_hi": "#97a889", "pot": "#a56671", "metal": "#946064",
        "shade_off": "#ba7e7f", "shade_edge_off": "#744c69",
        "shade_on": "#ffd49d", "shade_edge_on": "#f19a72",
        "beam": "#ffd398", "paper": "#ecd1ac", "line": "#b78b8c",
    },
    "night": {
        "ink": "#201725", "edge": "#302332", "ceiling": "#47334b",
        "wall": "#57415a", "wall_light": "#624b64", "wall_shade": "#4e3a52",
        "panel": "#493649", "panel_dark": "#3a2a40", "panel_light": "#674b5f",
        "floor": "#614358", "floor_dark": "#4a304b", "floor_light": "#774e61",
        "shade": "#4b354d", "wood": "#633e53", "wood_hi": "#b77078", "wood_mid": "#875362",
        "window": "#704d69", "trim": "#967385", "cloth": "#714f73",
        "cloth_hi": "#926785", "cloth_lo": "#4b3557", "glass": "#29354f",
        "glass_low": "#4c5973", "cloud": "#7a7894", "hill_far": "#485274",
        "hill": "#3c4767", "trees": "#2c3854", "sun": "#e6ccc1",
        "rug": "#705575", "rug_hi": "#9b7190", "rug_mid": "#896585",
        "rug_lo": "#4e3a5a", "spine": "#855670", "spine_alt": "#a17866", "leaf": "#5f746d",
        "leaf_hi": "#859486", "pot": "#8b5c70", "metal": "#906472",
        "shade_off": "#a1727e", "shade_edge_off": "#63435b",
        "shade_on": "#ffda9d", "shade_edge_on": "#ee9877",
        "beam": "#f0ae77", "paper": "#c9a697", "line": "#8c6677",
    },
}


def backdrop(theme, study=False, lamp_on=False):
    c = PALETTES[theme]
    night = theme == "night"
    image = Image.new("RGB", (WIDTH, HEIGHT), c["wall"])
    draw = ImageDraw.Draw(image)
    rand = Random(81)

    def rect(box, color):
        draw.rectangle(box, fill=c.get(color, color))

    def poly(points, color):
        draw.polygon(points, fill=c.get(color, color))

    def line(points, color, width=1):
        draw.line(points, fill=c.get(color, color), width=width)

    # Plaster, moulding and baseboards. Break the floor seams in perspective.
    rect((0, 0, WIDTH, 16), "wall_shade")
    rect((0, 0, WIDTH, 5), "ceiling")
    rect((0, 11, WIDTH, 13), "wall_light")
    for x in range(10, WIDTH, 14):
        rect((x, 25, x + 1, 128), "wall_light")
        for y in range(32 + (x % 3) * 4, 128, 29):
            poly([(x-2, y), (x, y-2), (x+2, y), (x, y+2)], "wall_shade")
    rect((0, 133, WIDTH, 164), "panel")
    rect((0, 131, WIDTH, 133), "panel_dark")
    rect((0, 134, WIDTH, 136), "panel_light")
    for x in range(8, WIDTH, 27):
        rect((x, 140, x + 1, 162), "panel_dark")
        rect((x + 2, 140, x + 2, 162), "panel_light")
    rect((0, 162, WIDTH, 166), "panel_dark")
    rect((0, 162, WIDTH, 162), "panel_light")
    rect((0, 167, WIDTH, HEIGHT), "floor")
    previous = 167
    for row, y in enumerate((174, 184, 197, 213, 232, 255)):
        rect((0, y, WIDTH, y), "floor_dark")
        if y < 255:
            rect((0, y + 1, WIDTH, y + 1), "floor_light")
        for x in range(-10 + row % 3 * 21, WIDTH, 89):
            line((x, previous + 1, x + ((x - 210) * (row + 2) // 160), y), "floor_dark")
        previous = y
    for _ in range(126):
        x, y = rand.randrange(WIDTH), rand.randrange(169, HEIGHT)
        rect((x, y, min(x + rand.randrange(1, 7), WIDTH - 1), y), rand.choice(("floor_light", "floor_dark")))

    # Inset picture window. A different view outside carries the interface theme.
    rect((53, 31, 201, 125), "edge")
    rect((55, 27, 196, 121), "window")
    rect((59, 29, 192, 119), "trim")
    rect((64, 33, 187, 115), "ink")
    rect((66, 35, 185, 112), "glass")
    rect((66, 71, 185, 112), "glass_low")
    if night:
        for x, y in [(77, 46), (91, 60), (106, 41), (121, 67), (153, 43), (172, 68), (179, 51)]:
            rect((x, y, x + 1, y + 1), "sun")
        draw.ellipse((133, 44, 152, 63), fill=c["sun"])
        draw.ellipse((140, 40, 155, 57), fill=c["glass"])
    else:
        draw.ellipse((131, 46, 151, 66), fill=c["sun"])
        poly([(72, 52),(86, 52),(86, 49),(98, 49),(98, 51),(112, 51),(112, 55),(72, 55)], "cloud")
        poly([(158, 65),(164, 65),(164, 62),(177, 62),(177, 64),(183, 64),(183, 68),(158, 68)], "cloud")
    poly([(66, 89), (86, 74), (105, 88), (125, 76), (145, 90), (185, 70), (185, 112), (66, 112)], "hill_far")
    poly([(66, 101), (104, 84), (140, 99), (164, 90), (185, 102), (185, 112), (66, 112)], "hill")
    for x, y in [(86, 98), (98, 103), (164, 105), (175, 99)]:
        poly([(x-5,y+10),(x,y-2),(x+5,y+10)], "trees")
    rect((123, 31, 128, 117), "window")
    rect((125, 32, 126, 117), "trim")
    rect((62, 76, 189, 79), "window")
    rect((63, 76, 187, 76), "trim")
    rect((42, 24, 209, 27), "ink")
    rect((43, 24, 210, 24), "trim")
    poly([(48, 28), (82, 28), (76, 52), (65, 75), (60, 92), (62, 123), (43, 123), (47, 91), (45, 74)], "cloth")
    poly([(53, 28), (60, 28), (58, 53), (55, 71), (50, 74), (52, 47)], "cloth_hi")
    poly([(70, 28), (79, 28), (74, 47), (62, 72), (57, 74), (64, 51)], "cloth_lo")
    poly([(48, 83), (53, 84), (52, 111), (49, 121), (45, 121)], "cloth_hi")
    poly([(175, 28), (205, 28), (208, 72), (205, 86), (211, 123), (191, 123), (197, 89), (194, 75), (185, 54)], "cloth")
    poly([(190,28),(196,28),(200,49),(201,72),(197,74),(193,48)],"cloth_hi")
    poly([(178,28),(184,28),(188,49),(196,70),(194,75),(186,56)],"cloth_lo")
    rect((46, 75, 62, 78), "wood_hi")
    rect((193, 75, 207, 78), "wood_hi")
    rect((65, 118, 189, 121), "trim")

    # A book shelf and framed pressed sprig add a second scale above the desk.
    rect((270, 70, 368, 74), "ink")
    rect((268, 67, 368, 70), "wood_mid")
    rect((268, 67, 368, 67), "wood_hi")
    rect((278, 74, 281, 82), "edge")
    rect((357, 74, 360, 82), "edge")
    for x, w, h, col in [(279,6,21,"spine"),(287,8,15,"leaf"),(297,5,23,"spine_alt"),
                         (303,9,19,"cloth"),(314,6,16,"spine"),(322,6,12,"edge")]:
        rect((x, 67-h, x+w, 67), col)
        rect((x+1, 69-h, x+w-1, 69-h), "paper")
        rect((x+1, 63, x+w-1, 63), "shade")
    rect((344, 58, 356, 67), "pot")
    rect((342, 57, 358, 60), "wood_mid")
    line((351, 57, 350, 44), "leaf", 2)
    poly([(349,51),(341,51),(338,44),(345,44)], "leaf_hi")
    poly([(352,53),(354,45),(362,43),(359,50)], "leaf")
    rect((385, 40, 411, 74), "ink")
    rect((386, 40, 410, 72), "trim")
    rect((389, 43, 407, 68), "wall_shade")
    line((395,64,402,49), "leaf", 2)
    poly([(399,59),(391,55),(391,52),(396,53)], "leaf_hi")
    poly([(399,56),(402,49),(406,48),(405,52)], "leaf_hi")

    def tabletop(x, y, width):
        poly([(x+6,y-8),(x+width-4,y-8),(x+width,y),(x,y)], "wood_mid")
        line((x+6,y-8,x+width-4,y-8), "wood_hi", 1)
        rect((x, y, x+width, y+3), "wood_hi")
        rect((x, y+4, x+width, y+9), "wood")
        rect((x, y+9, x+width, y+9), "ink")
        rect((x+5, y+10, x+width-4, y+15), "shade")
        for leg in (x+11, x+width-15):
            rect((leg, y+12, leg+6, y+55), "ink")
            rect((leg, y+12, leg+4, y+53), "wood")
            rect((leg, y+12, leg+1, y+52), "wood_mid")

    def paper_book(x, y):
        poly([(x,y-4),(x+10,y-8),(x+22,y-5),(x+32,y-7),(x+40,y-3),(x+39,y+1),(x+2,y+1)],"ink")
        poly([(x,y-5),(x+9,y-10),(x+22,y-6),(x+33,y-9),(x+40,y-4),(x+22,y),(x+12,y-1),(x,y-2)],"paper")
        line((x+22,y-6,x+22,y), "line", 1)
        line((x+7,y-5,x+12,y-7,x+19,y-5), "line", 1)
        line((x+25,y-4,x+33,y-6,x+36,y-4), "line", 1)

    def lamp(x, y):
        rect((x-13,y-2,x+10,y+2), "edge")
        rect((x-11,y-3,x+8,y-1), "metal")
        line((x,y-3,x-1,y-31,x-8,y-41,x-20,y-40), "edge", 3)
        line((x+1,y-4,x,y-30,x-7,y-42,x-19,y-42), "trim", 1)
        shade = "shade_on" if lamp_on else "shade_off"
        edge = "shade_edge_on" if lamp_on else "shade_edge_off"
        poly([(x-33,y-35),(x-26,y-45),(x-14,y-45),(x-7,y-35),(x-8,y-32),(x-33,y-32)], edge)
        poly([(x-30,y-36),(x-25,y-44),(x-15,y-44),(x-10,y-36)], shade)
        line((x-32,y-35,x-9,y-35), "paper", 1)

    if study:
        x, y = 133, 169
        # The drawer and its low stool anchor the desk in the floor.
        poly([(137,212),(387,210),(418,228),(147,233)], "shade")
        tabletop(x, y, 262)
        rect((147, 184, 195, 211), "edge")
        rect((149, 185, 193, 197), "wood")
        rect((150, 186, 193, 186), "wood_mid")
        rect((149, 199, 193, 208), "wood_mid")
        rect((167, 190, 175, 191), "trim")
        rect((167, 203, 175, 204), "trim")
        poly([(55,209),(99,209),(106,218),(48,218)],"cloth_hi")
        rect((48,218,106,224),"cloth")
        rect((50,224,54,244),"edge")
        rect((100,224,104,244),"edge")
        rect((147, 160, 180, 163), "spine")
        rect((150, 157, 176, 159), "paper")
        rect((148, 155, 179, 157), "leaf")
        if lamp_on:
            pool = Image.new("RGBA", image.size)
            light = ImageDraw.Draw(pool)
            red, green, blue = bytes.fromhex(c["beam"][1:])
            light.polygon([(337,137),(359,137),(394,168),(323,178),(234,173),(210,164)],fill=(red,green,blue,40 if night else 65))
            light.polygon([(337,137),(357,137),(376,169),(321,175),(249,169),(242,165)],fill=(red,green,blue,44))
            image = Image.alpha_composite(image.convert("RGBA"),pool).convert("RGB")
            draw = ImageDraw.Draw(image)
        poly([(255,165),(278,164),(303,165),(310,168),(279,171),(246,169)], "shade")
        lamp(370, 171)
        rect((314, 160, 327, 165), "edge")
        rect((315, 158, 326, 162), "pot")
        rect((326, 158, 330, 161), "wood_hi")
    else:
        poly([(35,195),(126,194),(147,203),(143,216),(31,217),(21,207)], "shade")
        tabletop(36, 163, 91)
        rect((46, 177, 116, 196), "edge")
        rect((48, 179, 114, 194), "wood_mid")
        rect((68, 184, 93, 186), "trim")
        paper_book(47, 157)
        rect((98, 148, 113, 156), "pot")
        rect((95, 147, 115, 150), "wood_mid")
        poly([(104,147),(98,139),(93,138),(96,145)],"leaf_hi")
        poly([(105,147),(113,137),(117,135),(114,143)],"leaf")
        # The stepped rug's fringed border gives Purrple and gifts a place to sit.
        poly([(220,185),(384,185),(422,227),(411,236),(191,236),(183,227)], "shade")
        poly([(207,181),(384,181),(418,223),(402,232),(191,232),(180,223)], "rug_lo")
        poly([(209,183),(383,183),(412,223),(400,230),(193,230),(185,223)], "rug")
        poly([(217,188),(378,188),(401,219),(393,224),(201,224),(194,219)], "rug_hi")
        poly([(220,190),(376,190),(396,218),(391,221),(202,221),(199,218)], "rug")
        poly([(238,196),(369,196),(381,217),(218,217)], "rug_mid")
        for x in range(199, 400, 8):
            rect((x,230,x+1,233), "rug_hi")
        for x, y in [(210,218),(224,201),(377,201),(390,218)]:
            poly([(x-3,y),(x,y-2),(x+3,y),(x,y+2)],"rug_hi")
        poly([(276,211),(324,211),(334,214),(326,216),(278,216),(273,214)],"rug")
    return image


def main():
    for theme in PALETTES:
        backdrop(theme).save(DEST / f"purrple-room-{theme}.png", optimize=True)
        for phase, active in [("rest", False), ("lit", True)]:
            backdrop(theme, study=True, lamp_on=active).save(DEST / f"purrple-study-{theme}-{phase}.png", optimize=True)


if __name__ == "__main__":
    main()
