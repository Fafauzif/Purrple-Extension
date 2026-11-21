# Purrple 2.0 verification

## Release bytes

The Firefox archive uses Gecko ID `purrple-companion@purrple.local`. Both runtime archives report version 2.0.1 and store `manifest.json` at the archive root. The source rebuild test compares all three archive hashes and every runtime entry. Run `python3 scripts/build_release.py` to generate the SHA-256 and size report for the three archives, including source.

| Runtime archive | SHA-256 |
| --- | --- |
| Firefox | `c021e5d5adfc5208e79218f90c6a58fed91fa00393ee0cd1d4df49cdac8fd442` |
| Chromium | `94b18ac91d770a9d60c30ee38d26c2b67f166f51e131f2561f3bcf7352ee11db` |

## Browser evidence

The 2.0.1 patch fixes keyboard focus after moving or resetting the webpage
companion. A byte comparison against 2.0.0 identified two changed runtime
entries per target, the versioned manifest and the pet menu script. Firefox
passed the exact patch-package smoke, same-profile migration, and a new keyboard
regression. The detailed workday, Calendar, Companion, renderer and portable-backup
checks also include prior 2.0.0 runs where the underlying files match.

| Browser | Installed package check |
| --- | --- |
| Firefox 160.0.1 | Exact unsigned ZIP loaded temporarily in disposable Linux profiles. Native pinned toolbar and sidebar opened. Verified strict CSP and forged iframe privacy, click menu and one reply announcement, authoritative webpage timer, local Calendar smoke, and keyboard focus after Move and Reset. |
| Brave 158.1.100.58 | Exact Chromium 2.0.1 ZIP installed in a disposable headless Linux guest with default Shields. Thirteen checks covered dashboard, renderer, capture, local Calendar, timer, popup and the strict-CSP webpage overlay. Move and Reset retained focus for Escape, host-page controls stayed usable, and a webpage timer appeared in the popup. A separate headed run used native clicks to open the pinned toolbar popup and the browser’s real 417-pixel side panel beside a local webpage. |
| Google Chrome 158.0.8127.36 | The exact 2.0.1 ZIP loaded in the actual vendor browser in headless mode. The strict-CSP Talk and Escape checks passed. After a debugger timeout later in that run, a focused rerun passed Move and Reset focus retention, Escape, host click-through, and the webpage-to-popup timer. The broader dashboard and Calendar smoke also passed on 2.0.0. Both Chrome Stable and Chrome for Testing exited during headed guest startup before loading the extension, so native Chrome side-panel activation remains unverified. |

- The Firefox upgrade fixture used the exact app at public repository revision `736c06055e851dbb9a0d4ccd00ff2df71db7104a`, with the source package version synchronized to the unchanged 1.2.0 runtime. Twelve same-profile checks preserved tasks, ledger, completed sessions, clothing, a Large draft, settings, Talk history and favorites, and the in-flight rule of a paused legacy timer. The prior Library archive and Mozilla-signed installation were unavailable. The owner's normal signed-update path remains unverified.
- A disposable portable backup made the round trip from Firefox to Brave and back to Firefox. The final preview and import matched tasks, wallet, ledger, Calendar blocks, focus history, ownership, Talk, and settings.
- A local strict-CSP fixture drove the Chromium overlay QA. Ordinary webpage JavaScript could not read the closed shadow root or the seeded task text. Privileged browser automation sent pointer and keyboard input to the actual overlay.
- The installed Firefox workday flow completed a real one-minute session after pause and resume, kept a parked thought, showed zero focus coins, made the thought into an inbox task, paid the task separately, and counted both workday measures.
- Firefox Calendar passed 12 installed checks, including offline Week, Day, and narrow Agenda, keyboard scheduling, duration and date edits, overlap and cancel, undo, trusted linked focus, and persistence. The actual Firefox native-messaging transport passed five checks with an isolated synthetic Google provider, covering consent, agenda, privacy, explicit task copy, and disconnect. Live Google authorization and production sync were outside these checks.
- Firefox Companion passed eight installed checks, including real Room art, keyboard placement and undo, a gift and remembers scene, resume and completion in Paw Pairs, unlocking and playing both further games, and the Starglow pencil scene reward. Advanced game layouts were not checked in the narrow sidebar.
- The renderer was operated in the installed Firefox dashboard and compact window. Fit review used 216 static samples of eight new wearables and a combined outfit across 12 key frames, on light and dark backgrounds. Twelve mirrored and moving examples covered 96–174 px. Visual inspection sampled fit at runtime size. A separate pixel-presence scan measured all 317 source frames across 23 wearables. All 6,855 supported pairs rendered within the test border, with 436 intentionally inactive pairs. In 48 inactive brushing combinations the original brush mask changed 3–19 edge pixels while the paw accessory stayed hidden.
- Native Firefox zoom tests covered 150% on the webpage cluster, and 200% across all five primary app views at a 330 × 303 CSS-pixel viewport. A toast moved into document flow at small heights, leaving navigation and Calendar Save visible. Screen-reader and physical OS notification presentation were outside these checks.

## Automated and packaging checks

- 105 Node tests and four native helper unit fixtures passed before packaging. They cover second-exact rewards, zero-coin accounting, run/pause/reconcile, daily XP, recurrence, calendar time zone transitions, provider status and backup validation.
- Mozilla `web-ext` 10.8.0 accepted the exact Firefox runtime archive for lint, with zero errors and 21 warnings. These include dynamic HTML heuristics, a global-argument heuristic and an Android metadata warning. This project targets desktop browsers.
- A clean rebuild from the source ZIP verifies all three archives for integrity, provenance and manifest references. The prescribed owner Mozilla submission remains separate.

## Input and design evidence

The owner supplied Brainly and Duolingo ABC screenshot collections. Brainly’s home action labels and continuing-work area informed quick capture and current work placement. Duolingo ABC’s character-led selection and feedback informed the short replies and outfit preview around the actual cat. The supplied bin contained no Brilliant screenshots. The review used the public Brilliant reference for focus and progress hierarchy. Placing Today’s tasks above the fold, increasing narrow Calendar legibility, and re-anchoring the bow in curled poses followed installed screen review. [Brilliant](https://brilliant.org/about/) · [Impeccable review workflows](https://impeccable.style/docs/)

[Reproduce the build](REPLACE-AND-BUILD.md) · [Test commands](TESTING.md) · [Install the extension](INSTALL-2.0.md)
