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

`extension/START_HERE.html` contains the illustrated welcome icon and complete
installation, daily-use and backup instructions.

## Everyday use

- Add assignments, errands and small plans with optional due dates, priorities,
  subtasks and daily/weekly recurrence.
- Complete small/medium/large tasks for 10/20/30 coins. Each occurrence earns its
  reward once, including across reopened tasks and multiple browser tabs.
- Start, pause or resume study sessions; a completed focus session earns 5 coins.
  Take 5/10-minute breaks without a penalty.
- Try on 15 accessories, buy favorites permanently and save a head+neck outfit.
- Pet, brush, play, pick up, gently toss, or send Purrple to her little house.
- Change size, 24/30 fps presentation, motion level, remarks, quiet hours and the
  list of sites where she should stay hidden.
- Download and restore a complete JSON backup from Settings.

The sidebar and dashboard use the same data. Your existing new-tab page remains
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
| `verification/` | Factual test results and inspection captures |
| `CONTEXT.md`, `PRODUCT.md` | Decisions, requirements and future handover |
| `DESIGN.md`, `UX-CONTRACT.md` | Visual system and interaction contracts |

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
`python tests/firefox_native.py`. They create a separate synthetic-data profile.

All fonts are bundled with their licenses. Read `ARCHITECTURE.md` before
changing persistence, messaging, shared rendering or wardrobe anchors.
