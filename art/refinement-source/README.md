# Purrple refinement artwork

This directory now contains two preparation stages. The original stage below
exports 114 accepted drawings. The supplemental stage exports 84 additional
accepted drawings. Together there are **198 distinct accepted illustrations**
from **216 generated source cells in nine original sheets**. Named reaction
subsets do not add to that unique illustration count.

These five sheets were generated with the built-in image-generation tool using
`art/reference/approved-character.png` as the locked character reference.
The exact prompts are retained in `prompts.json`. No image service or model is
used by the extension at runtime.

Every source sheet is 1536 × 1024 pixels: six columns, four rows, with 256-pixel
cells. All five originals remain unchanged.

| Original | Cells 0–11 | Cells 12–23 |
| --- | --- | --- |
| locomotion | Walking cycle | Running cycle |
| heldcry | Held and dangling cycle | Tears, paw wipe and recovery |
| jumpimpact | Jump poses | Impact, squash and recovery |
| turnknead | Front/profile turn | Kneading cycle |

The social sheet has six cells per action: knead, wave, nuzzle and loaf in row
order. Its six knead drawings were superseded by the dedicated twelve-pose
kneading sequence in `turnknead-original.png` and are not exported.

There are **120 generated source cells and 114 accepted distinct drawings**.
The paw-wipe, soothe and land clips are named subsets of the accepted drawings;
they do not represent additional unique illustrations. The exported manifest
contains 125 frame entries including those reused subsets.

## Preparation

Run `python art/prepare_refinements.py` from the project root. It writes the
fourteen PNG atlases and measured fitting manifest under
`extension/assets/refinement/`. The script only performs segmentation, alpha
cleanup, nearest-neighbour resizing, registration and metadata extraction.
It does not redraw the kitten or invent intermediate illustrations.

Source transparency sometimes contains translucent matte residue. Preparation
keeps the connected opaque coloured silhouette and its enclosed cream fur and
eye highlights, retaining legitimate isolated blue tears. The cleaned exports
use explicit transparent/opaque alpha.

Each source pack receives one shared scale. Frontal views align to a head
centre around x128; right-profile views align around x153 to leave space for
the body and tail. Grounded poses share a 244-pixel baseline. Held poses align
to the eye line instead, allowing feet to dangle without moving the grasp.

Landmark metadata includes eye centre, head width, crown, neck, angle, profile,
ear polygons, a protected head shape and silhouette bounds. Stable expression
families receive an explicit head-width override so closed eyes do not cause
an eye detector to mistake cheeks for an expanding head. These are fitting
measurements and still require visual inspection through the product renderer.

`processed-contact-sheet.png` shows every prepared frame. The registration
report records the corresponding landmark method and final bounds. Intentional
pose changes such as compression and loafing must not be mistaken for a failed
registration merely because the eye height changes.

## Supplemental action drawings

Run `python art/prepare_refinements_supplement.py` after the base script. It
writes `extension/assets/refinement/supplemental-manifest.json` and the six
additional action atlases. Runtime assembly merges the base and supplemental
manifests; this script does not rewrite the base manifest or its fourteen PNGs.

| Source original | Accepted drawings |
| --- | --- |
| groombrush-original.png | First twelve groom drawings |
| brush-only-original.png | Twenty-four dedicated brush drawings |
| studyread-original.png | Twelve writing and twelve reading drawings |
| patwake-original.png | Twelve head-pat reactions and twelve waking poses |

The first attempted brush sequence in `groombrush-original.png` was rejected
after cell-boundary inspection found a partially cropped tool and neighbouring
prop debris. All twelve of those brush cells are superseded by the dedicated
contained brush sequence. The rejected original remains intact for provenance.
Exact additional prompts are in `supplemental-prompts.json` and
`brush-refinement-prompt.txt`.

The waking sequence uses a bounds-aware horizontal floor registration so the
curled tail remains fully visible. Study and reading frames contain their own
illustrated notebook, pencil and page-turn action. Their foreground metadata
protects the book when neckwear is composited. Brush frames include measured
foreground rectangles covering the tool and bristles for final prop restoration.
The brush tool classifier explicitly requires a brown hue with green above blue
and excludes the face/chest region. Brush crown and ear measurements use the
kitten's face geometry, rather than the topmost opaque pixel, which may belong
to the floating brush. Preparation rejects oversized foreground rectangles,
masks reaching the neck, and off-canvas ear geometry.

`supplemental-contact-sheet.png` and its registration report show every accepted
additional frame. All 84 have distinct pixel content, explicit alpha and clear
canvas margins. These checks establish image preparation, not subjective
smoothness or complete accessory fitting, which must be reviewed in playback.
