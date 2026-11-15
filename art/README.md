# Purrple artwork

The approved kitten and the first three accessory concepts are in `reference/`.
The original five illustrated motion sheets are in `motion-source/`. The original
15-item accessory sheet is `wardrobe-original.png`.

The exported extension assets are fixed PNG artwork. The product does not
generate artwork or call an AI service while running.

## Reproduce the asset preparation

Install Pillow, NumPy and SciPy in a development environment, then run:

```sh
python art/prepare_motion_atlases.py
python art/prepare_wardrobe.py
```

The first script cleans and registers the five motion sheets into 180 keys.
The second extracts the fifteen accessory cutouts and measures per-pose head,
neck, crown and ear registration. It writes the shared renderer data. Keep any
intentional manual registration corrections when introducing new artwork.

Open `art/fit-preview.html` to inspect each raw source pose with head and neck
items. Check front, profile, sleep, stretch, carried, notebook and heart poses.
Test both slots together, not just the shop thumbnails. `art/render_fits.cjs`
captures fitting contacts using the same actual product renderer; see its
development-time browser requirements.

The illustrator's six source keys per action are not 30 unique drawings per
second. Presentation and physical motion are continuous; cel-pose changes remain
visible. Add deliberate intermediate artwork when further refining a movement.
