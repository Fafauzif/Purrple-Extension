#!/usr/bin/env python3
"""Reproduce non-lavender accessory accents from the original accessory sheet."""
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image
import prepare_wardrobe as original

PALETTE = {
    'moon-bow': (0.95, 0.47),
    'cozy-beanie': (0.43, 0.38),
    'star-beret': (0.59, 0.50),
    'flower-clip': (0.10, 0.57),
    'cloud-cap': (0.54, 0.37),
    'stargazer-hat': (0.62, 0.52),
    'star-bandana': (0.54, 0.43),
    'moon-collar': (0.095, 0.62),
    'cozy-scarf': (0.43, 0.42),
    'petal-collar': (0.96, 0.56),
    'cloud-bib': (0.13, 0.53),
    'night-bandana': (0.61, 0.47),
}


def main():
    original.accessory_cutouts()
    for ident, (hue, saturation) in PALETTE.items():
        path = Path(original.OUT) / (ident + '.png')
        pixels = np.array(Image.open(path).convert('RGBA'))
        colors = set(map(tuple, pixels[pixels[:, :, 3] > 0, :3]))
        for color in colors:
            h, light, sat = colorsys.rgb_to_hls(*(int(c) / 255 for c in color))
            if sat < .13 or not .63 <= h <= .94:
                continue
            wanted = colorsys.hls_to_rgb(hue, light, saturation * (.55 + .45 * sat))
            target = np.array([round(c * 255) for c in wanted])
            mask = (pixels[:, :, :3] == color).all(axis=2) & (pixels[:, :, 3] > 0)
            pixels[mask, :3] = target
        Image.fromarray(pixels).save(path)


if __name__ == '__main__':
    main()
