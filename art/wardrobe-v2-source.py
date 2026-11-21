#!/usr/bin/env python3
"""Export the accepted transparent master and measure attachment points from the runtime atlas."""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / 'extension'
ART = ROOT / 'art'
MASTER = ART / 'wardrobe-v2-master.png'
REGISTRY = RUNTIME / 'js/wardrobe-v2.js'
TARGET = RUNTIME / 'assets/wardrobe'
CELL = 224
ITEMS = (
    'silk-ear-bow', 'confetti-hat', 'rose-knit-scarf', 'round-moon-glasses', 'study-frames',
    'pocket-reader', 'starglow-pencil', 'quilted-lap-blanket',
    'plum-cushion', 'reading-lamp', 'lavender-shelf', 'pressed-flower-frame', 'lantern-keepsake',
    'birthday-postcard', 'purrple-birthday-ornament', 'anniversary-frame', 'window-garland', 'moon-globe',
)
# Optional re-authoring route for the two original concept atlases. The accepted
# master is intentionally sufficient by itself for a source archive rebuild.
CONCEPTS = ((0, 0), (1, 0), (0, 2), (0, 3), None, (0, 4), (0, 5), (0, 6),
            (0, 7), (0, 8), (1, 1), (0, 10), (0, 9), (0, 11), (1, 2), (1, 3), (1, 4), (1, 5))
RESTING = set('idle blink look ear tail tilt land sit wake held wiggle impact shake yawn pat think cry paw-wipe soothe wave nuzzle loaf knead'.split())
LAP = set('idle blink look ear tail tilt sit wake sleep yawn groom pat think heart reminder cry paw-wipe soothe wave nuzzle loaf knead brush'.split())


def cell(image, index, columns, rows):
    x, y = index % columns, index // columns
    return image.crop((x*image.width//columns, y*image.height//rows,
                       (x+1)*image.width//columns, (y+1)*image.height//rows))


def clean(image):
    pixels = np.array(image.convert('RGBA'))
    alpha = pixels[:, :, 3]
    labels, _ = ndimage.label(alpha >= 165)
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    if not areas.max():
        raise ValueError('The concept has no opaque silhouette.')
    silhouette = labels == areas.argmax()
    r, g, b = pixels[:, :, :3].transpose(2, 0, 1)
    saturated_fringe = ((r > 150) & (g < 70) & ((b < 110) | (b > 158)))
    keep = ndimage.binary_dilation(silhouette) & (alpha >= 65) & ~saturated_fringe
    pixels[~keep] = 0
    clean_image = Image.fromarray(pixels)
    return clean_image.crop(clean_image.getbbox())


def round_lens(concepts):
    # Isolate the ring's actual lens. The renderer supplies temples and the
    # bridge from measured eye spacing so the source's spacing never drifts.
    tile = cell(concepts, 3, 4, 3)
    lens = tile.crop((58, 124, 173, 242))
    pixels = np.array(lens)
    yy, xx = np.indices(pixels.shape[:2])
    edge = ((xx - 55)/57)**2 + ((yy - 58)/59)**2 > 1.03
    pixels[edge] = 0
    return clean(Image.fromarray(pixels))


def study_lens():
    # The exact rectangular clear opening is editable and avoids tinting the
    # gloss of Purrple's eyes. Draw at intentional small-pixel resolution.
    result = Image.new('RGBA', (35, 30))
    draw = ImageDraw.Draw(result)
    draw.rounded_rectangle((0, 1, 34, 29), radius=7, fill='#573551')
    draw.rounded_rectangle((2, 2, 32, 26), radius=6, fill='#9b6676')
    draw.rounded_rectangle((4, 4, 30, 25), radius=5, fill=(0, 0, 0, 0))
    draw.rectangle((2, 8, 5, 10), fill='#e8b382')
    draw.rectangle((29, 8, 32, 10), fill='#e8b382')
    draw.line((8, 2, 25, 2), fill='#d5a188', width=1)
    return result.crop(result.getbbox()).resize((175, 145), Image.Resampling.NEAREST)


def author_master(first, second):
    with Image.open(first) as first_image, Image.open(second) as second_image:
        concepts = (first_image.convert('RGBA'), second_image.convert('RGBA'))
    master = Image.new('RGBA', (5*CELL, 4*CELL))
    for index, ref in enumerate(CONCEPTS):
        if index == 3:
            item = round_lens(concepts[0])
        elif ref is None:
            item = study_lens()
        else:
            source, tile = ref
            item = clean(cell(concepts[source], tile, *( (4, 3) if source == 0 else (3, 2))))
        item = ImageOps.contain(item, (CELL-16, CELL-16), Image.Resampling.LANCZOS)
        x, y = index % 5 * CELL, index // 5 * CELL
        master.alpha_composite(item, (x+(CELL-item.width)//2, y+(CELL-item.height)//2))
    master.save(MASTER, optimize=True)


def replace_quilt(path):
    index = ITEMS.index('quilted-lap-blanket')
    x, y = index % 5 * CELL, index // 5 * CELL
    with Image.open(MASTER) as previous, Image.open(path) as layer:
        master = previous.convert('RGBA')
        tile = ImageOps.contain(clean(layer), (CELL-16, CELL-16), Image.Resampling.LANCZOS)
    master.paste((0, 0, 0, 0), (x, y, x+CELL, y+CELL))
    master.alpha_composite(tile, (x+(CELL-tile.width)//2, y+(CELL-tile.height)//2))
    master.save(MASTER, optimize=True)


def export_layers():
    (TARGET / 'decor').mkdir(parents=True, exist_ok=True)
    with Image.open(MASTER) as art:
        for i, name in enumerate(ITEMS):
            tile = cell(art, i, 5, 4)
            tile = tile.crop(tile.getbbox())
            out = TARGET / ('decor' if i >= 8 else '') / f'{name}.png'
            tile.save(out, optimize=True)


def regions(mask):
    labels, _ = ndimage.label(mask)
    for ident, rect in enumerate(ndimage.find_objects(labels), 1):
        if not rect:
            continue
        ys, xs = rect
        size = int((labels[rect] == ident).sum())
        yield ((xs.start+xs.stop-1)/2, (ys.start+ys.stop-1)/2, xs.stop-xs.start, ys.stop-ys.start, size)


def fit_eyes(pixels, pose):
    red, green, blue, alpha = pixels.transpose(2, 0, 1)
    ex, ey = pose['eye']
    scale = pose['headWidth']
    profile = pose.get('profile')
    angle = pose['angle']
    if profile:
        expected = [(ex + scale*.24, ey)]
    else:
        expected = [(ex + t*scale*.205*math.cos(angle), ey + t*scale*.205*math.sin(angle)) for t in (-1, 1)]
    candidates = [reg for reg in regions((alpha > 195)&(red < 118)&(green < 90)&(blue < 150))
                  if 8 <= reg[2] <= 43 and 3 <= reg[3] <= 41 and reg[4] > 24]
    result = []
    for px, py in expected:
        options = [(math.hypot(cx-px, cy-py) - min(area, 650)*.008, (cx, cy, w, h))
                   for cx, cy, w, h, area in candidates if abs(cx-px)<24 and abs(cy-py)<19]
        if options:
            _, eye = min(options)
            result.append(eye)
            candidates = [entry for entry in candidates if entry[:4] != eye]
        else:
            result.append((px, py, scale*.18, scale*.17))
    return [normalize(eye) for eye in result]


def fit_ear(pixels, pose):
    red, green, blue, alpha = pixels.transpose(2, 0, 1)
    ex, ey = pose['eye']
    scale = pose['headWidth']
    crown = pose['crownY']
    left = pose['bbox'][0]
    if pose.get('family') == 'sleep':
        # The pink patch behind the head is part of the curled tail. Anchor to
        # the lowered near ear instead of that much brighter patch.
        return normalize((ex-scale*.31, crown+scale*.14))
    target = ex-scale*(.11 if pose.get('profile') else .28)
    if not pose.get('profile'):
        target = max(target, left+scale*.27)
    pink = (alpha > 190)&(red > 155)&(red > green*1.12)&(blue > green*1.03)&(red > blue*.98)
    candidates = [(abs(x-target), x, y, h) for x,y,w,h,area in regions(pink)
                  if 40 < area < 1800 and 8 < w < 62 and 9 < h < 70 and y < ey-16
                  and abs(x-target) < scale*.21 and y < crown+scale*.30]
    if candidates:
        _, x, y, h = min(candidates)
        return normalize((x, y-h*.23))
    return normalize((target, crown+scale*.10))


def fit_paw(pixels, pose, clip):
    if clip not in RESTING or pose.get('profile') or pose.get('family') == 'sleep':
        return None
    red, green, blue, alpha = pixels.transpose(2, 0, 1)
    _, _, _, bottom = pose['bbox']
    ex = pose['neck'][0]
    width = pose['headWidth']
    raised = clip in ('held', 'wiggle')
    target_x = ex - width*.16
    target_y = (pose['neck'][1] + width*.14) if raised else bottom-width*.085
    yy, xx = np.indices(alpha.shape)
    mask = (alpha > 190)&(red > 178)&(green > 143)&(blue > 133)&(red >= blue-5)&(green >= blue-25)
    region = mask&(np.abs(xx-target_x)<width*.24)&(np.abs(yy-target_y)<width*.18)
    candidates = [(math.hypot(cx-target_x, cy-target_y)-min(size, 350)*.01, cx, cy, max(7, min(w, h)*.56))
                  for cx, cy, w, h, size in regions(region) if size >= 18 and h >= 5 and w >= 6]
    if not candidates:
        return normalize((target_x, target_y, 8))
    _, cx, cy, radius = min(candidates)
    return normalize((cx, cy, radius))


def fit_lap(pixels, pose, clip):
    if clip not in LAP or pose.get('profile'):
        return None
    left, _, right, bottom = pose['bbox']
    neck_x, neck_y = pose['neck']
    width = pose['headWidth']
    if pose.get('family') == 'sleep':
        # Cover the body behind the chin, with the far corner inside the curl.
        span = width * .67
        center = min(right - span * .49, neck_x + width * .11)
        return [*normalize((center, bottom - width * .29, span, width * .34)), -.50]

    # Sample the low torso consistently; the neck can follow a head turn or
    # bounce several pixels while the lap and paws stay on the same baseline.
    torso = pixels[max(0, round(bottom - width * .31)):round(bottom - width * .10), :, 3]
    _, lower_body_x = np.nonzero(torso > 202)
    center = float(np.median(lower_body_x)) if lower_body_x.size else (left + right) / 2
    low = clip in {'loaf', 'knead', 'groom'} or bottom - neck_y < width * .20
    span = width * (.58 if low else .66)
    center = min(max(center, left + span / 2), right - span / 2)
    drop = width * (.14 if low else .18)
    height = width * (.20 if low else .26)
    return [*normalize((center, bottom - drop, span, height)), 0]


def normalize(coords):
    return [round(value/256, 5) for value in coords]


def measure_anchors():
    raw = (RUNTIME / 'js/renderer-data.js').read_text().split('globalThis.PurrpleArt=', 1)[1]
    data = json.loads(raw.strip().removesuffix(';'))
    atlases = {}
    for src in {spec['src'] for spec in data['sprites'].values()}:
        with Image.open(RUNTIME/src) as image:
            atlases[src] = image.convert('RGBA')
    anchors = {}
    for clip, spec in data['sprites'].items():
        atlas = atlases[spec['src']]
        rows = []
        for frame, pose in zip(spec['frames'], data['poses'][clip], strict=True):
            x, y = frame['x'], frame['y']
            pixels = np.array(atlas.crop((x, y, x+256, y+256))).astype(np.int16)
            rows.append({'e': fit_eyes(pixels, pose), 'b': fit_ear(pixels,pose), 'p': fit_paw(pixels, pose, clip), 'l': fit_lap(pixels, pose, clip)})
        anchors[clip] = rows
    prefix, _, rest = REGISTRY.read_text().partition('/* BEGIN FIT */')
    _, _, suffix = rest.partition('/* END FIT */')
    if not prefix or not suffix:
        raise ValueError('Missing wardrobe registry anchors markers.')
    # One readable pose family per line keeps the generated browser data reviewable.
    generated = ',\n'.join('    '+json.dumps(k)+': '+json.dumps(v, separators=(',', ':')) for k, v in anchors.items())
    REGISTRY.write_text(f'{prefix}/* BEGIN FIT */ {{\n{generated}\n  }} /* END FIT */{suffix}')
    print(f'Measured {sum(map(len, anchors.values()))} illustrated frame registrations.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--concepts', nargs=2, type=Path, help='Optionally rebuild accepted art master from the two original concept sheets.')
    parser.add_argument('--quilt', type=Path, help='Optionally replace the master’s quilt tile with an accepted new pose layer.')
    args = parser.parse_args()
    if args.concepts:
        author_master(*args.concepts)
    if args.quilt:
        replace_quilt(args.quilt)
    export_layers()
    measure_anchors()


if __name__ == '__main__':
    main()
