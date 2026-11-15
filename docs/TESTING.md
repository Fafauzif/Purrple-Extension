# Testing Purrple

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
