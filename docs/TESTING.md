# Testing Purrple

## Purrple 3.1

In addition to the package checks below, these preview commands exercise the redesigned workspace, game window, and sprite playback. Set `PURRPLE_BROWSER` to a local Chromium executable if needed.

```sh
node tests/workday-v3-preview.cjs
node tests/panel-v3-preview.cjs
node tests/study-room-preview.cjs
node art/audit_sprite_playback.cjs
```

The webpage panel fixture uses simulated extension messaging. See the native installation instructions below for installed-addon tests.

## Purrple 3.0

Run the reducer, local Calendar helper, and package rebuild checks from a clean source extraction.

```sh
npm test
python3 tests/calendar_host_test.py
python3 scripts/build_release.py
python3 tests/release_integrity.py
```

The installed-package smoke tests use disposable browser profiles. Run the browser that matches the recipient’s installation.

```sh
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_packaged_v2.py dist/Purrple_Firefox_Extension.zip
PURRPLE_BROWSER=/path/to/brave node tests/chromium-packaged.cjs brave dist/Purrple_Chromium_Extension.zip
PURRPLE_BROWSER=/path/to/google-chrome node tests/chromium-packaged.cjs chrome dist/Purrple_Chromium_Extension.zip
```

Use `chromium` in place of `chrome` for a stock Chromium binary. The reports record the actual browser, archive hash, and checks completed. The Chromium DevTools run opens the real extension popup document in a tab and covers the compact flow from capture, edit and scheduling to a linked timer, completion, and Paw Pairs resume. Firefox also attempts native toolbar and sidebar activation and checks whether a task saved in the webpage panel appears in the toolbar.

For a disposable **local preview** in Chromium, install Playwright's development dependency with `npm ci` and a compatible Chromium binary with `npx playwright install chromium`. Run `node tests/workday-v3-preview.cjs` to exercise the compact flow at 355 × 515 with reduced motion. The preview uses localStorage. Extension permissions, native panel opening, timers across browser restart, and migration require the installed-package workflow.

Run `PURRPLE_BROWSER=/path/to/chromium node tests/panel-v3-preview.cjs` for a separate rendered fixture that uses Chromium and mocks the extension APIs. It checks the webpage controls and panel UI in place. The installed-package checks exercise browser-granted privileges and real extension storage.

For the final manual pass, install the exact archive, pin Purrple and refresh a regular webpage. Check the native toolbar and side panel, an in-place Play round and gift scene, the close button and Escape, task privacy on the host page, wardrobe fit in sitting and sleeping poses, the Bond meter, and a narrow panel at high zoom. Repeat with website access denied and use the toolbar fallback. Export a backup from a prior installation and confirm that tasks, an in-flight focus session, wardrobe, and Companion progress appear after an update. Keep personal profiles, backups, and screenshots out of the source archive.

## Purrple 2.0

Run the unit, helper, and integrity suites using the extracted source tree.

```sh
npm test
python3 tests/calendar_host_test.py
python3 scripts/build_release.py
python3 tests/release_integrity.py
```

For the browser suites, provide actual Firefox and GeckoDriver executables
through `PURRPLE_FIREFOX` and `PURRPLE_GECKODRIVER`. Pass the exact Firefox ZIP
as the archive argument to `tests/firefox_packaged_v2.py`,
`tests/firefox_calendar_v2.py`, `tests/firefox_workday_v2.py`,
`tests/firefox_companion_v2.py`, or `tests/firefox_pet_menu.py`. Run each script
with `--help` for its disposable output and upgrade fixture arguments. Set
`PURRPLE_BROWSER` to an actual Brave or Chrome executable for the installed
Chromium tests and run `node tests/chromium-packaged.cjs brave dist/Purrple_Chromium_Extension.zip`. Use `chrome` in place of `brave` for Chrome. Set `PURRPLE_OVERLAY_ONLY=1` to focus on the webpage and `PURRPLE_PLACEMENT_ONLY=1` to skip the separate Talk scenario during a targeted Move and Reset rerun. See the verification notes for
the browser modes and exercised checks. [Verification](VERIFICATION-2.0.md)

## Historical 1.x verification and development fixtures

The older scripts and screenshots below record the 1.x implementation. A
historical result applies to its stated version and described test mode.

For Purrple 2.0, see the [release verification summary](VERIFICATION-2.0.md). The 1.x checks and results below are historical unless re-run and recorded against the 2.0 archives.

The unit suite runs without a network or a browser:

```sh
npm test
```

The browser development tools are separate from the installed extension. They
are not packaged into the runtime ZIP. Install the declared Playwright
development dependency for preview checks, or provide official Firefox and
Geckodriver binaries for native checks. Do not copy browser profiles or binary
runtimes into a release.

```sh
node tests/refinement-ui.cjs
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_refinement.py
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_animation.py
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_boundaries.py
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_toolbar.py
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_play.py
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_idempotency.py
python3 scripts/build_release.py
python3 tests/release_integrity.py
PURRPLE_FIREFOX=/path/to/firefox PURRPLE_GECKODRIVER=/path/to/geckodriver python3 tests/firefox_zip_smoke.py
```

The Chromium journey uses the visibly labeled local preview adapter. It checks
forms, shared presentation, responsive layouts and navigation. It does not
prove that Firefox permissions, alarms, extension messages or installation work.

The native Firefox suite uses real temporary add-on installation, real
extension storage and messages, real webpage content scripts, and a true
one-minute focus alarm. It exercises the compact popup document, private
floating iframe, drafts, purchases, outfits, authored replies, backups, tab
handoff, host hiding, pointer throws and recovery. The Play suite uses Pillow only to inspect its native screenshot for visible
cat artwork after a tab handoff. Install that development dependency with
`python -m pip install Pillow` if needed. It checks actual visible Play controls,
nap/wake, soft drops and dramatic cry/wipe/soothe recovery.

The actual-toolbar suite also opens the pinned Firefox action, types and clicks
inside its native popup browser, checks its intrinsic size and verifies reopening.
The idempotency suite restarts Firefox between repeated request IDs and checks
absolute completion and the persisted request journal. The separate animation suite
uses the actual shared renderer, samples all clip/item combinations, operates
the explorer, and records live draw timings. Headless timings describe that
machine only.

The test-only WebDriver client can inspect a closed shadow root using privileged
browser automation. Ordinary webpage JavaScript still sees `host.shadowRoot`
as `null`; no production test getter is added. Unauthorized iframe scenarios
must fail reads, mutations and backup access. A private panel token must never
be made available through normal host-page DOM.

The optional upgrade fixture is a local copy of a prior version-1 save profile.
It is deliberately excluded from source archives because browser profiles may
contain personal data. A missing fixture is reported as a skip; prepare one
with version 1.0 before claiming an upgrade test. The remaining fresh-profile
checks do not need that fixture.

`tests/firefox_native.py` retains the baseline lifecycle scenarios.
`tests/firefox_zip_smoke.py` extracts and installs the exact runtime ZIP and
records its SHA-256, keeping package evidence separate from working-tree tests.
Factual JSON reports and screenshots are under `verification/`; use each
report's stated scope and version. Older baseline reports are historical,
not evidence that a newly edited file was tested.

The strict-CSP fixture keeps its `frame-src 'none'` and self-only script, image
and style headers intact. The zoom scenario checks Firefox at 150% and a short
viewport; WebDriver inspects layout and activates zoomed closed-shadow controls
programmatically because its element hit-test retargets those nodes to their host.
Normal-size controls and throws use native pointer events.

No automated run is a human usability study. Headless tests do not verify
physical operating-system toast presentation, a girlfriend's device, or Mozilla
signing. The unsigned ZIP supports temporary loading. A signed XPI must be
received and tested before claiming a normal permanent installation.

A supplemental static interface audit reports literal HTML buttons as having
no inline action. Purrple binds their actions through bundled external
JavaScript, as required by Firefox extension CSP. Those heuristic findings are
not a browser action test or a clean pass. Actual UI journeys and native
activation checks provide the corresponding behavior evidence. The obsolete
initial candidate audit and private review exchanges are excluded from source
archives.

Mozilla web-ext lint was also run on version 1.1.0: zero errors and 14 warnings
in the recorded run. Thirteen warn about dynamic innerHTML assignments; those
templates escape user text and are covered by injection/runtime checks. The
remaining warning concerns data-collection metadata on Firefox for Android
140–141. This release targets desktop Firefox; Android was not verified. A
zero-error lint result is not a signed release or a warning-free security audit.

## Version 1.2 checks

```sh
npm test
python3 tests/calendar_host_test.py
python3 scripts/build_release.py
python3 tests/release_integrity.py
python3 tests/firefox_revision.py
```

The revision test installs the packaged runtime and uses native mouse input.
On desktop Linux without an existing Calendar host registration it temporarily
registers a synthetic host and removes it afterward. This exercises Firefox
permission prompts, the app, and native messaging without contacting Google.
Use a throwaway Google account after following the Calendar setup guide to
verify live consent, agenda, event creation, and token refresh.
