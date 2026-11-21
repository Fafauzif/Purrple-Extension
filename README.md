# Purrple 3.2

Purrple is a local workday planner, focus timer, and lavender browser companion. Open the toolbar to see your tasks, or click Purrple on a supported webpage to plan, work, play, or give her a gift.

## Install

| Browser | Archive and installation |
| --- | --- |
| Firefox | Select `Purrple_Firefox_Extension.zip` in **Load Temporary Add-on…** at `about:debugging#/runtime/this-firefox`. For a permanent update, the owner submits this ZIP through the existing Mozilla Add-ons developer entry and installs the signed update. |
| Brave | Extract `Purrple_Chromium_Extension.zip` to a permanent folder. At `brave://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`. |
| Chrome | Use the same Chromium ZIP and **Load unpacked** at `chrome://extensions`. |

Pin Purrple from the Extensions menu and refresh open websites. Download a backup from **Settings** before an update or a browser move. Keep an unpacked Brave or Chrome installation in the same directory when updating. [Full installation instructions](docs/INSTALL-3.2.md) · [Illustrated quick start](INSTALL-PURRPLE.html) · [Mozilla update workflow](docs/MOZILLA-SIGNING.md)

## Make a plan

- **Today** opens from the toolbar or Purrple’s menu. Add, edit, complete, or start focusing on a task from the compact planner. Use the full dashboard for a broader review.
- **Calendar** schedules local blocks in Week, Day, or Agenda. A task’s due date is independent of the time you reserve for it.
- **Focus** starts, pauses, or resumes a session and keeps parked notes in the trusted extension view. Small, medium, and large tasks earn 1, 2, and 3 coins. A completed focus session earns 1 coin from 15 minutes or 2 coins from 30 minutes. Shorter sessions still count in your history.
- **Play** opens a game-only window where you are and saves unfinished rounds. Choose a Paw Pairs board, try a themed Cozy Clues pack, or discover Lantern Paths, Pocket Pong and Three Paws. **Companion** also keeps your room, gifts, outfits and conversation journal together.
- **Light and Night** share one saved appearance across Purrple’s surfaces. **Settings** controls roaming, quiet hours, reminders, display preferences, and backups. Export and restore transfers your local progress between browser profiles.

The local planner, timer, and companion work offline. The optional Firefox Google Calendar helper continues to use the local native-messaging setup. [Firefox Google Calendar setup](docs/CALENDAR.md)

## Continue development

Start with [project context](CONTEXT.md), then use [the extension workflow](docs/EXTENDING-PURRPLE.md) for adding games, accessories, or room décor. It includes a reusable brief for future collaborators.

## Build and verify

From the extracted source root, use Python 3.10 or later to reproduce the three ZIPs. Use Node 20 or later for the unit tests.

```sh
python3 scripts/build_release.py
python3 tests/release_integrity.py
npm test
python3 tests/calendar_host_test.py
```

`release.json` in the output directory records file sizes, SHA-256 hashes and per-entry runtime hashes. The integrity test checks the archives and rebuilds them from the extracted source. [Rebuild details](docs/REPLACE-AND-BUILD.md) · [Verification results](docs/VERIFICATION-3.2.md) · [Test workflows](docs/TESTING.md) · [Purrple 3.2 release notes](docs/RELEASE-3.2.md)

## Source

| Path | Purpose |
| --- | --- |
| `extension/` | Shared runtime and Firefox source manifest. The build applies a small Chromium overlay and uses the Chromium service worker. |
| `extension/js/core.js`, `extension/js/background.js` | State validation, durable timer, rewards, migration, and serialized saves. |
| `extension/js/renderer.js`, `art/` | Shared character renderer, fit data, artwork, and preparation tools. |
| `tools/calendar/` | Firefox local Google Calendar helper and installer. |
| `tests/` | Unit, browser, and release verification. |

[Architecture](ARCHITECTURE.md) · [Artwork provenance](art/ASSET_PROVENANCE.md) · [Purrple 1.2 historical release notes](docs/RELEASE-1.2.md)
