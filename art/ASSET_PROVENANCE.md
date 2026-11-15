# Purrple wardrobe artwork

The approved character is the lavender Plush Chibi Purrple chosen during the
project. Character and accessory illustrations were generated during asset
development. The extension uses only the resulting local PNG files.

`wardrobe-original.png` is the unmodified15-item transparent accessory atlas.
Its grid follows the ordered `IDS` list in `prepare_wardrobe.py`. The concepts
extend the approved moon bow, star bandana and cozy beanie into fifteen items.
Lavender/plum pixel shading, cream accents and restrained pink details were
kept consistent with the approved character. There are no runtime generation
calls, models, keys or remote dependencies.

`prepare_wardrobe.py` removes disconnected background/alpha artifacts without
redrawing the character or accessory. It records per-frame registrations from
the prepared character atlases, using paired eyes, profile eyes, crown shape,
pink ear geometry and posture-specific corrections. Hat crowns are registered
independently from the eyes, so looking down does not slide the hat downward.
Ear openings restore the source foreground ears. Neckwear is clipped to the
actor silhouette; the head, paws and held props occlude it where appropriate.

The shared renderer uses these same registrations in the roaming companion,
dashboard and wardrobe previews. Whole-body rotation carries the complete
equipped actor. No accessory is intentionally disabled for a source frame.

Reproduce with Python3, Pillow, NumPy and SciPy:

```
python art/prepare_wardrobe.py
```

For browser contact verification, use Playwright and a local Chromium path:

```
node art/render_fits.cjs
```

The generated fitting viewer is `art/fit-preview.html`. It exposes each of180
raw source frames and every head/neck item. Per-item contacts and pixel-change
coverage are development verification, not a guarantee of perfection; visual
review remains necessary for fit and recognizability.
