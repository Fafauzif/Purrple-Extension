# Purrple 3.2 verification

The Node suites cover the position and pose handoff, old document rejection, optimistic write safety, scoped game access, and stable request IDs. Browser checks exercise Talk over a pinned panel, startup retries, a navigation handoff with a retained nap, keyboard commands, reduced-motion navigation, the 300 ms loader delay, and Room controls at narrow widths.

The local previews use real Chromium rendering. The webpage panel and content fixtures simulate extension messaging. Native installs remain unverified in this environment.

Run the local checks with a Chromium executable available:

```sh
npm test
python3 tests/calendar_host_test.py
node tests/panel-v3-preview.cjs
node tests/talk-surfaces-preview.cjs
node tests/workday-v3-preview.cjs
node tests/study-room-preview.cjs
node tests/ui_lifecycle.cjs
node tests/ui_view_transitions.cjs
node tests/command-menu-preview.cjs
node tests/planner-loading-preview.cjs
python3 scripts/build_release.py
python3 tests/release_integrity.py
```

[Install or update](INSTALL-3.2.md)
