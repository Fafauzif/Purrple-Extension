# Purrple artwork

The approved Plush Chibi character and first accessory concepts are in
`reference/`. Fixed illustrated assets are bundled with the extension. No artwork
is generated, inferred or downloaded while Purrple runs.

## Current source of truth

- `motion-source/`: the five original six-key motion sheets.
- `wardrobe-original.png`: the original fifteen-accessory sheet.
- `renderer-base.json`: preserved original actor/item metadata and deliberate
  original-pose registration corrections. Keep this file when rebuilding.
- `refinement-source/`: nine additional original sheets, exact prompts,
  preparation reports and contacts. Its README documents 198 distinct accepted
  new illustrations from 216 cells, rejected cells and reused reaction subsets.
- `renderer-motion-anchors.json`: measured support-paw landmarks, regenerated
  by `measure_motion_anchors.py`.

The merged actor has 317 registered source-frame entries across 38 source rows,
including documented reused subsets. The shared renderer exposes 45 behaviors.
These are not 317 unique new drawings or 45 entirely new actions. Root movement
and registered shape articulation run independently of illustrated pose cadence;
the default presentation target is 30 FPS.

## Build a release without changing artwork

Run `python scripts/build_release.py` from the project root. All prepared PNGs
and merged metadata are included. Packaging needs only the Python standard
library, no image-generation account or image-preparation tools.

## Canonical artwork preparation order

For intentional asset work, install Pillow, NumPy and SciPy in a development
environment. Run the complete sequence from the project root:

```sh
python art/prepare_motion_atlases.py
python art/prepare_wardrobe.py
python art/prepare_refinements.py
python art/prepare_refinements_supplement.py
python art/measure_motion_anchors.py
python art/merge_renderer_data.py
```

The first two commands reconstruct the original 180 keys and accessory cutouts.
`prepare_wardrobe.py` temporarily writes original-only renderer data. **Do not
stop there or ship that intermediate file.**

The two refinement commands prepare 20 dedicated source clips and 209 entries,
including 198 accepted new illustrations and 11 documented reaction-subset
reuses. The supplemental stage contains dedicated grooming, brushing, writing,
reading, pat and wake artwork. It preserves brush-specific anatomical/prop-mask
corrections and bounds-aware registration for the curled waking tail.

The anchor command measures actual support-paw groups for walk/run/knead. The
final merge combines the preserved base, both refinement manifests, measured
anchors and family-level outfit adjustments into `extension/js/renderer-data.js`.
Runtime reads that bundled script directly and does not fetch preparation data.

`renderer-base.json` preserves approved original fitting. If you change original
items or registration, update that canonical base intentionally; do not replace
it blindly with an intermediate automatic output. Do not hand-edit the merged
renderer file as the only record of a fix.

## Inspect and verify

Open `extension/animations.html` for all 45 behaviors using the same renderer as
the companion. It has speed controls, frame stepping, scrubbing, outfits,
backgrounds, travel, source counts and PNG export. Open `art/fit-preview.html`
for raw-pose and landmark inspection.

With the project's Playwright development dependency and browser installed:

```sh
node art/render_fits.cjs
node art/render_motion_review.cjs
node tests/animation-explorer-e2e.cjs
```

`render_fits.cjs` regenerates shop thumbnails and checks every registered frame
against all 15 individual items, with combined-outfit contacts.
`render_motion_review.cjs` samples actual runtime clips and reports drawing cost.
Treat reports as preparation/coverage evidence, then inspect playback at 128px
and larger dashboard sizes. Visibility counts alone do not establish good fit
or smoothness.

Keep face, ears, paws, neckwear and props correctly layered in front, profile,
curled, held and airborne views. Never omit equipped items to conceal a fitting
defect. `record_motion_review.cjs` optionally records a temporal reel to the
private excluded review directory; it is a development aid, not runtime code.
