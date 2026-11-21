# Purrple context handover

Read PRODUCT.md, README.md, ARCHITECTURE.md, DESIGN.md and UX-CONTRACT.md before
changing this project. User conversation decisions are summarized here so a
fresh developer can continue without the original chat.

## Approved 3.2 baseline

Start with [the extension workflow](docs/EXTENDING-PURRPLE.md) for new games,
cosmetics, and room décor. Treat the installed 3.2 behavior and
[release notes](docs/RELEASE-3.2.md) as the baseline if older notes below differ.

- The owner approved the Halftone Dossier planner and original Pixel Study Room.
  Keep the approved lavender cat artwork and all existing purchased assets.
  Light and Night share a saved preference.
- Click the roaming cat for six balanced action bubbles. Tasks is inside the
  menu; the toolbar opens Today directly. Talk replies remain above the planner
  even when pinned. Agenda opens in-page.
- Play opens a dedicated board with Begin or restores a saved round. Keep the
  planner tabs off the game surface. Restore focus on close. Borrow interaction
  principles from the references named in the release notes and create original
  game artwork, rules, and writing.
- Use the shared CSS-pixel character size across full surfaces. Compact
  thumbnails and constrained canvases fit their available space. Keep the
  last grounded position and resting pose when handing off across supported
  pages and warm the resident artwork for short tab switches.
- Preserve room decoration controls, keyboard access, reduced motion, and the
  restored game and room state on browser Back/Forward.
- Current task payouts are 1/2/3 coins. Older 10/20/30 coin receipts remain
  valid. The current focus payout is 1 coin from 15 minutes and 2 from 30,
  with legacy rules retained for older saved sessions.
- Chromium local previews and simulated extension messaging were exercised.
  The 3.2 handoff does not establish native add-on installation or real
  handoff timing. Keep that distinction in any future verification notes.

## Decisions and history

- Name chosen by the girlfriend: **Purrple**. She loves purple.
- Initial code-drawn cats were rejected. GPT-image Plush Chibi identity is the
  visual source of truth; keep the rounded expressive head and compact body.
- Long tails and unintended head skew were rejected. Keep eyes level for
  frontal views and intentional profile/tilt poses for movement.
- Approved main reference is in art/reference/approved-character.png.
- The earlier animation lab used thirty illustrated rows with six keys each.
  This is historical source material, not the current frame-count claim.
  Version 1.1 has 45 runtime behaviors and adds 198 accepted unique drawings.
  Variable frame timing and registered 30 Hz geometry provide smoother playback;
  root motion and physics are continuous. No 30-unique-drawings-per-second claim.
- Approved first accessories: moon bow, star bandana and cozy beanie, shown in
  art/reference/approved-accessories.png. Expand to 15 fitted cosmetics.
- Every equipped item must follow the relevant head/neck in every pose.
- Core features work offline and use no AI, telemetry, or remote artwork.
  Google Calendar is optional and connects through an owner-installed local helper.
- Interface and canned companion remarks are English.
- Girlfriend's personal name was not provided; it is an optional local setting.
- No personal-letter/mailbox feature. No need to replace new-tab.
- The original 10/20/30 task payouts and older study bonuses are historical. Preserve their receipts. No penalties.
- Firefox private signing is deferred. The owner is willing to use a Mozilla
  account, but authentication and actual submission have not happened. Keep
  temporary loading, preparation for signing and a truly signed release distinct.
- The user intends to upload the complete source ZIP to their own GitHub repo;
  do not publish anything automatically or include credentials in the source.

## Approved version 1.1 continuation

- Keep daily interactions in a functional compact toolbar popup and the same
  extension-origin on-page panel. The chosen route is `popup.html?panel=1`, with
  optional `view=talk`; full home and sidebar remain available.
- English Talk uses 90 authored prompts with three replies each, 270 variants
  in total. Keep it
  cheeky and affectionate, offline, deterministic and honest about its scope.
- Strong throws may briefly trigger a dramatic cartoon cry, followed by a
  gentle recovery. The pet must remain friendly and usable.
- The final library contains 45 behaviors, with 198 newly accepted illustrations,
  variable per-frame timing and registered 30 Hz geometry plus secondary motion.
  No claim of 30 independently drawn frames per second.
- All 15 equipped cosmetics still follow every source pose, including new ones.
- The quick-task draft saves both title and effort size. Closing and reopening
  must not silently change a Large task to Medium. Backups include both fields.
- TASK_SET_DONE carries an absolute completion value. A durable 200-entry
  request journal deduplicates retries across event-background restarts; permanent
  reward ledger IDs separately prevent repeat payouts.
- `INSTALL-PURRPLE.html` is the recipient's cute, printable offline guide. Its
  personal “I love you” sentence belongs to the guide, not a letter feature.
- `scripts/sign_release.py` prepares an unlisted Mozilla submission by default;
  upload requires the explicit owner-operated `--submit` switch and private
  `WEB_EXT_API_KEY` / `WEB_EXT_API_SECRET` environment. No secrets in archives.
- The owner confirmed no changes after uploading the old source ZIP to
  `https://github.com/Fafauzif/Purrple-Extension`. New source archives contain
  repository-root files directly, without the old `Purrple/` wrapper. The remote
  checkout was not independently fetched during this run, and no push occurred.

## Image and motion provenance

The approved cat and illustrated source sheets were generated with GPT Image
during development. Accessory artwork and the approved preview are bundled in
`art/`; processing scripts remove background artifacts and fit local assets.
Runtime animation combines those fixed illustrations with authored frame
selection, fitted layers, secondary motion and physics. Development tools and
provenance do not create a model or network dependency in the installed product.

## Continued work principles

Preserve storage identity and migration compatibility. Keep shared reducer
invariants central. Reuse the common character/wardrobe renderer across popup,
dashboard, sidebar and webpages. Test native browser behavior and distinguish
it from preview adapters. Improve artwork using explicit references and fitted
anchors; do not replace the approved cat with geometric placeholders.
