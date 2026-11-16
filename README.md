# Purrple

A little lavender companion for Firefox: tasks, study sessions, permanent
wardrobe rewards and a playful cat that keeps you company on ordinary webpages.

## Use the extension

Requires Firefox 140 or later. Extract `Purrple_Firefox_Extension.zip`, open
`about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and
select the extracted `manifest.json`. Allow website access for the roaming cat
and refresh already-open website tabs. Open Purrple from the extensions menu.

This is an **unsigned development build**, as agreed. Normal Firefox removes
temporary add-ons on browser restart. Load the same folder again to continue.
Export a backup before uninstalling, clearing extension data, switching browser
profiles or replacing it with a signed release. Signing through Mozilla is
needed for permanent installation in standard Firefox; renaming ZIP to XPI
does not replace that step.

Open **INSTALL-PURRPLE.html** for the friendly illustrated five-step guide.
The same guide is inside the runtime folder, linked from `START_HERE.html`.
It clearly separates this temporary development build from a future signed XPI.

## Everyday use

- Add assignments, errands and small plans with optional due dates, priorities,
  subtasks and daily/weekly recurrence.
- Complete small/medium/large tasks for 10/20/30 coins. Each occurrence earns its
  reward once, including across reopened tasks and multiple browser tabs.
- Start, pause or resume study sessions; a completed focus session earns 5 coins.
  Take 5/10-minute breaks without a penalty.
- Try on 15 accessories, buy favorites permanently and save a head+neck outfit.
- Pet, brush, play, pick up, gently toss, or send Purrple to her little house.
  Explore 45 movements in `extension/animations.html`.
- Choose from 90 authored thoughts with 270 local replies. Quick task drafts
  remember both their title and selected reward size.
- Change size, 24/30 fps presentation, motion level, remarks, quiet hours and the
  list of sites where she should stay hidden.
- Download and restore a complete JSON backup from Settings.

The compact toolbar popup, on-page panel, sidebar and dashboard use the same
data. The compact popup and page panel both offer tasks, focus, wardrobe and
fixed local conversations, so daily actions do not require opening a full tab.
Your existing new-tab page remains
unchanged. Firefox protects settings, add-ons and its built-in PDF viewer from
webpage injection; use the sidebar or dashboard there. When Firefox is fully
closed, reminders catch up when it is running again.

## Local by design

No runtime AI model, API key, login, account, subscription, analytics, remote
font, remote asset or backend. Character artwork was generated during
development and is bundled as fixed local assets. Tasks and progress stay in
this Firefox profile, unless you explicitly export a backup.

Offline operation removes service dependencies. Future browser changes can
still require compatibility maintenance. There is no built-in 5000-task lifetime
cap; archive and export old plans for a manageable list and safe long-term use.

## Source layout

| Directory/file | Purpose |
| --- | --- |
| `extension/` | Complete ready-to-load Firefox runtime |
| `extension/js/core.js` | Pure, versioned state reducer and data validation |
| `extension/js/background.js` | Storage authority, alarms, notifications and tab leases |
| `extension/js/content.js` | Roaming companion, interactions and page isolation |
| `extension/js/renderer*.js` | Shared animation, wardrobe fitting and frame data |
| `extension/js/client.js`, `app.js` | Native data client and shared product interface |
| `art/` | Approved references, accessory sources and reproducible preparation |
| `scripts/build_release.py` | Build both ZIPs without network access |
| `tests/` | Data, background, browser and interaction test scripts |
| `verification/` | Factual test reports; internal browser captures are excluded |
| `CONTEXT.md`, `PRODUCT.md` | Decisions, requirements and future handover |
| `DESIGN.md`, `UX-CONTRACT.md` | Visual system and interaction contracts |
| `INSTALL-PURRPLE.html` | Offline illustrated guide for the recipient |
| `docs/MOZILLA-SIGNING.md` | Private owner-operated Mozilla signing steps |
| `docs/REPLACE-AND-BUILD.md` | Repository-root replacement and reproducible ZIPs |

## Build and test

The prebuilt extension needs no tooling. To rebuild ZIPs, use Python 3:

```sh
python scripts/build_release.py
```

Run logic tests using Node 18 or later:

```sh
node --test tests/*.test.cjs
```

Browser tests need their documented Playwright or Firefox/WebDriver development
dependencies. Browser executables and temporary profiles are deliberately not
included. Asset-preparation scripts list their drawing-time requirements.
Those tools are never needed to run the extension.

For optional Chromium-based UI checks, install the declared development package
with `npm install`, then `npx playwright install chromium`. Run
`node tests/ui_preview.cjs` and `node tests/ui_contrast.cjs`. You can select an
existing browser executable with `PURRPLE_BROWSER`. Native tests instead use
`PURRPLE_FIREFOX` and `PURRPLE_GECKODRIVER` paths and
`python tests/firefox_refinement.py`. They create a separate synthetic-data profile.
See `docs/TESTING.md` for actual toolbar, strict-CSP/zoom, animation and exact-ZIP
checks, their prerequisites, and the distinction between native and preview tests.

All fonts are bundled with their licenses. Read `ARCHITECTURE.md` before
changing persistence, messaging, shared rendering or wardrobe anchors.

## Update the GitHub checkout

The source ZIP contains the repository contents directly, without
the old enclosing `Purrple/` folder. Extract it into the directory containing
`extension/` and `package.json`, and replace matching files. Preserve `.git/`.
The user confirmed no edits since the previous source ZIP; save any newer edits
before replacement. See `docs/REPLACE-AND-BUILD.md` for the full procedure.

## Prepare permanent installation

Mozilla signing is not complete in this package. The owner can prepare an
unlisted signing submission with `python scripts/sign_release.py`; that default
command performs no upload. The explicit `--submit` operation needs the owner's
private Mozilla API environment and uploads to Mozilla. Read
`docs/MOZILLA-SIGNING.md` before using it. Never commit credentials or describe
an unsigned build as signed.

## Optional Google Calendar

See [Calendar setup](docs/CALENDAR.md). The Firefox ZIP works on its own for all non-Calendar features.
