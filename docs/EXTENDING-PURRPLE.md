# Extending Purrple

This is the workflow distilled from the approved 3.2 revisions. Start with
[project context](../CONTEXT.md), [working rules](../AGENTS.md), and the
[UX contract](../UX-CONTRACT.md). Use [architecture](../ARCHITECTURE.md) to
trace the current code before changing it. Older release notes are historical.

## Work in a small, reviewable slice

1. Write the user path from entry to return. Include what is saved, what
   changes on screen, and what happens if a save fails. Resolve material choices
   about character art, reward rules, or data migrations with the owner.
2. Inspect a shipped feature that has the closest behavior. Reuse its renderer,
   state actions, and surfaces. Keep game rules and saved state in the domain
   layer, and keep the UI responsible for controls and feedback.
3. Try the complete path in a real browser at desktop and compact widths.
   Include keyboard input, Light and Night, and reduced motion. Give an
   independent reviewer the actual build and a task to complete when available.
4. Fix observed failures, then repeat the same journey. Check the saved state
   after reopen, and test an existing backup if the change touches persistence.
5. Rebuild and verify the archives. Record which journeys used a preview or
   simulated transport and which ran in an installed extension.

## Add a game

Use **Three Paws** as the small deterministic example, **Paw Pairs** for a
configurable board, and **Cozy Clues** for moves with different action types.

| Step | Where to work |
| --- | --- |
| Choose a stable ID and define how the game unlocks | `extension/js/companion-domain.js` has the game IDs, names, modes, bond levels, discovery gates, and milestone copy. Keep the parallel lists aligned. |
| Implement the round | Add deterministic replay to `game(round)`, plus any game-specific result details, variants, or move normalization. Persist the round and its moves. Keep compatible readers for old round shapes and validate the new ones. |
| Build the interface | `companion-games.js` holds the game descriptions and board views. `companion-ui.js` hosts the board and routes moves through the existing start/move actions. Show the ready board with Begin, resume an unfinished round, and keep game-specific options close to the board. |
| Wire entry and exit | Check `pet-menu.js` labels, the parent-frame game allowlist in `content.js`, route validation in `background.js`, and visibility through Commands. Test the Room, toolbar, and roaming entry points. Make Escape or Close return focus to the opener. |
| Verify progression | Extend the companion game tests for replay, invalid moves, stale revisions, unlocks, backup roundtrip, and repeated completion. Use the existing once-only reward and practice paths. Keep planner data outside the dedicated game state. |

Start a new game, play a move, close it, and reopen it from a different entry
point. Confirm the same round and move return. Finish one ranked round and one
practice round. Confirm each behaves according to the existing reward rules.
Exercise the largest board in a small popup with the keyboard.

## Add an accessory or room object

1. Use [the approved character](../art/reference/approved-character.png) and
   [approved accessory examples](../art/reference/approved-accessories.png) to
   guide silhouette, palette, and scale. Keep editable art and preparation
   scripts in `art/` and record provenance in `art/ASSET_PROVENANCE.md`.
2. For a wearable, export a transparent local PNG and add a stable ID, slot,
   price, and fit metadata in `extension/js/wardrobe-v2.js`. Use an existing
   slot when it fits. Match the path conventions in `extension/assets/wardrobe/`
   and provide the shop thumbnail. The core catalog and renderer consume the
   same registry. Use `art/WARDROBE-2.md` for the fitting and export commands.
3. Fit the wearable in the shared renderer. Check frontal, profile, mirror,
   sleep, motion, and held poses, including foreground props. Paw and body
   items have intentional pose coverage. Check those documented fallbacks and
   confirm the saved equipped item returns in the next suitable pose. For
   instance, the quilt’s shop preview uses the sleep pose to show its drape.
4. For room décor, use a stable wall, shelf, or floor ID and the local décor asset
   convention. Follow an existing gift or scene from the wardrobe/decor and
   companion domain registries through Room placement and Undo. Test keyboard
   placement, at least one tight layout, and both themes.
5. Test buy, equip, switch slots, restart, export, and restore. Preserve already
   owned IDs, equip state, ledger entries, and existing item prices unless a
   separately approved change includes the relevant backup compatibility work.

## Release checks

Run from the extracted source root with Node 20+ and Python 3.10+.

```sh
npm test
python3 tests/calendar_host_test.py
python3 scripts/build_release.py
python3 tests/release_integrity.py
```

For a game, start with `tests/companion-games-v3.test.cjs` for behavior and
`tests/panel-v3-preview.cjs` for the roaming entry and exit fixture. For a
wearable, start with `tests/renderer.test.cjs`, `tests/wardrobe-v2.test.cjs`,
and the rendered fitting checks in the wardrobe guide. Follow
[testing](TESTING.md) and [the 3.2 verification notes](VERIFICATION-3.2.md)
for the environment and other journeys. The release integrity check rebuilds
the three ZIPs from the extracted source. Firefox signing is a separate step.

## Reusable brief for a future session

> Read AGENTS.md, CONTEXT.md, and docs/EXTENDING-PURRPLE.md in this extracted
> source. I want to add [feature, game, or accessory]. Keep the approved 3.2
> character art, visual language, offline behavior, and existing saves. Use
> [closest shipped example] as the implementation reference. Build the full
> entry, action, save, reopen, and return path. Exercise the relevant browser
> and unit tests, revise from observed failures, then report what was verified
> and rebuild the release archives if I request them.
