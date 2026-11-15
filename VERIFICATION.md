# Verification summary

This release was exercised in native Firefox 160.0 as a temporarily installed
Manifest V3 add-on, not only as a webpage preview. The packaged runtime ZIP was
also extracted to a separate folder and installed independently.

| Check | Result |
| --- | --- |
| Native Firefox workflows, alarms, visibility and restart | 47 passed |
| Exact extracted runtime ZIP in native Firefox | 12 passed |
| Core, event-background and long-history logic tests | 38 passed |
| Browser-driven product-interface scenarios | 51 passed |
| Visible text contrast samples | 205 checked, no failures |
| Isolated content interaction and inactive-tab smoke checks | 18 passed |
| Accessory × illustrated-source-pose coverage | 2,700 checked, none invisible or canvas-clipped |

The native scenarios include task creation/editing, concurrent completion and
purchase idempotency, all 15item purchases and thumbnails, combined head/neck
equipment, popup/sidebar state, hidden sites, active-tab ownership, pointer
pickup/throw, host-page click-through, backup roundtrip and malformed-backup
rejection. A genuine one-minute session completed through a native alarm before
any UI state reconciliation request. Its bonus was awarded once. An actual
Firefox restart with the same test profile retained tasks, coins, equipment,
session history and a running timer deadline after reloading the temporary add-on.

Long-history tests round-tripped 6,001 tasks and rewards, and 370 completed focus
sessions while retaining lifetime bonuses. They also exercised canonical-ID
collisions, prototype-shaped IDs, clock changes and rejected-import immutability.

Wardrobe coverage renders the same shared actor used in the product. It includes
all 15items over all 180illustrated source frames, plus head/neck combinations and
light/dark critical-pose contacts. Pixel-coverage checks are supplemented by
visual inspection of profile, sleep, stretch, held, notebook and tilted poses.

The interface scenarios use a clearly labeled local preview adapter and a real
Chromium browser. They supplement, rather than replace, the separate native
Firefox tests. No actual human usability-research session is claimed.

## Scope and limits

- This is unsigned development packaging. Permanent standard-Firefox
  installation still needs Mozilla signing, as agreed.
- Playback uses fixed illustrated keys plus continuous procedural movement.
  24/30 fps presentation does not mean 30 separately illustrated images each second.
- Firefox intentionally blocks webpage injection into privileged surfaces;
  the sidebar/dashboard is the companion surface there.
- Native notification APIs and alarm behavior were tested. OS-specific
  notification appearance and every operating-system configuration were not.
- Browser-driven checks and sampled pose inspection cannot establish that no
  possible future website, browser update or user sequence will expose a bug.

Factual machine-readable reports and test scripts are included. Browser binaries,
test profiles and private evaluation exchanges are excluded from the source ZIP.
