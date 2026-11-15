# Purrple 1.1 verification

The runtime was installed and exercised in native desktop Firefox 160.0 on
Linux. The exact packaged ZIP was separately extracted and installed, including
its actual pinned-toolbar popup and the private floating dashboard.

Verified runtime SHA-256:
`76924955115350c43784848a131287ae845936f1e8b14bd9d9aa50763e7f79db`

## Results

These suites overlap in scope; their counts are not a count of human testers.
All listed checks passed.

| Check | Evidence |
| --- | --- |
| Pure core, event background, reliability and renderer tests | 72 tests |
| Native Firefox task/focus/backup/restart workflows | 49 scenarios |
| Exact extracted runtime ZIP smoke | 16 scenarios |
| Actual Firefox pinned-toolbar popup | 12 scenarios |
| Native new Play actions and throw/recovery sequence | 14 scenarios |
| Native all-clip/outfit sampling and rendering | 8 checks, 2,880 draw samples |
| Strict site CSP, zoom and short-panel operation | 13 scenarios |
| Durable request replay, restart and bounded journal | 8 scenarios |
| Browser-driven full/compact interface journeys | 61 scenarios |
| Draft, size, Undo, reply and route edge cases | 16 scenarios |
| Exact 308 × 167 px short-panel keyboard operation | 9 scenarios |
| Motion explorer controls, all 45 clips and negative control | 153 checks |
| Real-renderer companion fixture | 53 checks |
| Controlled-clock ambient-remark policy | 7 checks |
| Computed visible text contrast, full home and compact panel | 509 samples, no failures |
| Every registered source entry with each individual item | 4,755 fits, none invisible or edge-clipped |
| Full fixed-art preparation from a separate fresh source copy | All six commands succeeded; no extension-file hash changed |

## What was exercised

Native scenarios cover actual extension storage and APIs, task/reward invariants,
legacy version-one saves, title-and-size draft recovery, purchases and outfits,
focus pause/resume, backup validation, private iframe authorization, active-tab
ownership, pointer pickup/throw and the compact dashboard. A real 60 second timer
completed through Firefox's alarm before any UI reconciliation request and
awarded its bonus once. Browser restart retained its durable deadline/progress.

The actual toolbar popup was opened from Firefox chrome, with native typing and
button interactions. Its size, four tabs, local replies, close/reopen state and
reply on return to the webpage were checked. An early autosizing defect was
fixed before the extracted ZIP was retested. Very short floating panels use
full-document scrolling, with keyboard-accessible task and Talk controls.

The final motion library has 45 behaviors/clips and 317 registered source-frame
entries across 38 source rows. There are 198 accepted new illustrations; reaction
subsets and composed movements are counted honestly. Default 30 FPS presentation
joins illustrated poses with registered shape articulation. It does not mean
30 separately illustrated drawings each second.

Every raw item/frame fit was checked numerically, then difficult profiles,
sleeping, held, brush, book, cry/wipe and combined outfits were inspected
visually. All 45 behaviors were reviewed with real-renderer temporal samples.
Measured native drawing p95 was at most 4 ms in this headless environment; this
is not a performance guarantee for another computer.

The two declared preparation stages, support-paw measurement and final merge
recreated all runtime assets and merged metadata byte-for-byte from the supplied
fixed originals in a separate source copy. See art/README.md for the complete
canonical order. Packaging does not require rerunning artwork preparation.

## Check interpretation

Native Firefox suites use actual APIs. Chromium interface suites use a clearly
labeled local preview adapter. The companion fixture uses the real renderer and
artwork but stubs APIs, capabilities and visibility. The ambient-policy suite
uses a controlled clock. These layers supplement one another; no human
usability-research session or girlfriend acceptance session is claimed.

Mozilla web-ext lint reported zero errors and zero notices, with 14 warnings:
13 dynamic HTML heuristics and one Android 140–141 data consent compatibility
warning. User text is escaped, and HTML-payload-as-text behavior was checked.
This release targets desktop Firefox 140 or later; Android has not been verified.
The separate premium static audit resolves canonical ownership but flags 67
external-JavaScript event bindings as actionless because its heuristic only
recognizes inline handlers. Inline script handlers are deliberately incompatible
with extension CSP; real control behavior is checked in the browser suites.
No warning-free or strict-static-audit pass is claimed.

## Remaining limits

- The delivered package is an unsigned development build. A permanent normal
  Firefox installation requires Mozilla signing through the owner's account.
  No submission, account creation or signing is claimed. The bundled guide and
  docs/MOZILLA-SIGNING.md distinguish the two installation routes.
- Native execution was on Linux. Windows/macOS-specific behavior and OS
  notification appearance were not tested. Notification APIs and alarms were.
- Firefox-protected pages cannot host the roaming content companion. Toolbar,
  sidebar and full home provide the supported alternatives.
- Browser tests and sampled visual inspection cannot establish perfection or
  compatibility with every future website/browser update.

Run `npm test` and the applicable scripts in docs/TESTING.md. After building,
run `python tests/release_integrity.py` for archive layout/privacy, source/runtime
parity and an offline extracted-source rebuild. Factual reports are included;
browser binaries, profiles, credentials and private critique exchanges are not.
