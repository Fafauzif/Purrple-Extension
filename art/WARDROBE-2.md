# Purrple 2.0 wardrobe and room art

The 1.2 cat and its original 15 cosmetics remain the visual and compatibility reference. The bundled atlas crops measure 256 × 256. The compositor aligns different atlas baselines to row 232, pads the result to 320 × 320 and uses nearest-neighbor display scaling. It mirrors the complete fitted actor when turning. The 45 behaviors share 317 illustrated source placements and the existing timeline geometry. The art never uses a replacement drawing of the character.

The 2.0 wardrobe adds eight wearables across the head, neck, face, paw and body slots. The room adds ten full-color decor pieces. `wardrobe-v2-master.png` is the accepted editable transparent 5 × 4 sheet. Each 224px cell contains one original asset. Image generation used the owner-approved Purrple art as a style reference. The two concept sheets established the new props. An individual quilt iteration gave the blanket a draped silhouette, and the rectangular lens was drawn to keep the cat’s original pupils clear. The accepted export excludes discarded concepts, reference screenshots and source backgrounds. All runtime art is local PNG.

## Registration

| Slot | Attachment and layering | Behavior |
| --- | --- | --- |
| Head | Source crown and foreground ear masks for the hat. Measured inner-ear silhouette for the silk bow. | Fits frontal, profile, low and curled poses. |
| Neck | Per-frame band pivot with body-silhouette clipping. Original face and drawn props can cover the scarf. | Stays registered when awake or curled. |
| Face | One open lens on each measured eye center. A single lens and temple on the profile. | Lenses preserve eye and highlight pixels. Closures use the eyelid center. |
| Paw | Measured cream forepaw where available, plus a local source mask for the grip. | Used in resting or carried poses with a free forepaw. It returns after active locomotion, curling or use of a pre-drawn prop. |
| Body | Seated drape follows the lower-body silhouette and baseline. On curled poses it tilts over the rear body. | Used when seated or curled. Movement and notebook poses keep the equipped choice ready for the next rest. |
| Room | Transparent PNG cutouts with stable IDs and placement suggestions. | Uses separate wall, shelf and floor positions. |

Authoring inputs are in `wardrobe-v2-master.png` and `wardrobe-v2-source.py`. To regenerate the runtime PNG files and normalized per-frame anchors, run `python art/wardrobe-v2-source.py` with Pillow, NumPy and SciPy installed. The JS registry defines stable IDs, slots, prices, pivot and draw order. Legacy item registration still comes from `renderer-data.js`.

## Fit verification

For a pose-by-pose check, open `art/fit-preview.html` in a local browser. Select artwork and crop in any supported slot. The marker option shows optical, neck, grip and lap landmarks. The animation toggle uses the same geometry as the live extension.

Run `node art/render_wardrobe_v2.cjs` with Playwright and `PURRPLE_BROWSER` set to a local Chromium executable. For Gecko set `PURRPLE_FIREFOX` and `PURRPLE_GECKODRIVER`, then run `python art/render_wardrobe_v2_firefox.py --package dist/Purrple_Firefox_Extension.zip` after the build. Set `PURRPLE_FIT_OUTPUT` to choose an output directory. The Gecko runner records the tested package hash. The browser probe compares each item against the bare actor across the full source pool, tests expected pose fallbacks, and emits both static light and dark contact sheets and mirrored views at representative runtime sizes. The `--thumbnails` option saves a fitted snapshot for each shop item. The quilt uses the curled sleep pose to show the drape.
