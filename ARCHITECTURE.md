# Architecture

## One state authority

Firefox's event background owns storage.local.purrpleState. Product surfaces
send GET_STATE and ACTION messages; the background serializes mutations, saves
successfully, then broadcasts a change notification. Authorized UI clients
fetch the committed state; webpage companions receive only a public projection. User interfaces do not write
directly to extension storage. The last 200 request IDs and action fingerprints form a durable journal,
saved with state in the same storage.local.set call. Retries remain idempotent after background
restart; reusing a request ID for different content is rejected. Task completion
uses TASK_SET_DONE with an absolute boolean, while legacy TASK_TOGGLE remains
compatible. Durable reward/purchase ledger IDs independently prevent extra coins. Never award coins from animation or click callbacks.

The pure PurrpleCore reducer holds task, timer, shop, equipment and import rules.
State version 1 is explicit. Unsupported versions or malformed backups are
rejected without overwriting the existing save. Backups include the ledger
and owned-item history so restoring does not silently invent or lose purchases.

Tasks and their recurring successors are separate occurrences. A rewarded
occurrence cannot earn again when reopened. Subtask edits preserve explicit IDs.
Focus sessions use absolute completion deadlines and persisted remaining time
when paused. Reconciliation awards a completed session once after browser sleep
or restart; backward clock movement must not create an unrestorable state.

## Product surfaces

Dashboard and sidebar share app.js. Every surface shares core.js, client.js
and renderer.js; compact surfaces use compact.js rather than the full app shell.
The client uses browser.runtime for the real extension. A clearly labeled local
preview adapter exists only when extension APIs are unavailable; it is not
evidence of native Firefox behavior.

Version 1.1 uses `compact.js`/`compact.css` for the fully functional compact
toolbar surface and `popup.html?panel=1` for its extension-origin on-page iframe.
The full home still owns the larger task editor, settings and backups. Both
use the same background/core state, not separate task or wallet databases.
`talk.js` loads before `core.js` and supplies 90 fixed local prompts and 270
replies. The shared quick-task draft stores text and effort together. Committing
the matching draft clears its text while preserving the chosen effort preference.

The floating panel must not grant a normal webpage authority to read or mutate
private plans. Its content boundary is a closed shadow root plus the background's
surface authorization. Parent-frame messages are limited to closing, moving,
and bounded canned speech. Private state and actions remain extension messages;
no full saved state is posted into the ordinary webpage.

Content scripts receive only a public companion-state projection. Full task
titles, wallet and backup mutations stay on trusted extension surfaces. The
background validates sender context before handling private operations.

## Roaming companion

The top-level ordinary webpage hosts an isolated shadow-root companion. Host
content is not read or scraped. A background lease gives the active focused tab
ownership of the visible actor. Lease IDs reject stale position writes and
tab-revocation messages stop the old actor. Position saves are throttled.

Canvas renders the cat and fitted wardrobe. Pointer handling is limited to the
actor and controls; the rest of the host page stays clickable. Pointer cancel,
lost capture and hidden tabs release interaction safely. Physics uses bounded
time steps, capped throw speed, gravity, a soft bounce and a grounded recovery.
Focus sessions select quiet study poses; reduced-motion mode keeps her calmer.

## Animation and wardrobe

Every product surface uses the same renderer. The library contains 45 behaviors
and 198 newly accepted illustrations in this refinement. Variable per-frame
timing combines fixed illustrated keys with registered 30 Hz geometry, continuous
breathing, secondary motion, movement and physics at 24/30 fps presentation.
This is not 30 unique hand-drawn frames per second. Source drawings, extraction
scripts, frame metadata and per-pose fitting data remain available for refinement.

Head and neck equipment are anchored to each pose rather than to a screen corner.
Profile, curled sleep, lowered stretches, carried poses and notebook/heart props
need different attachment geometry and occlusion. Preserve all-frame fitting
when adding a movement or accessory; never silently omit an equipped item to
hide a fitting problem. Foreground face/ear/prop masks protect the character.

## Reminders and lifecycle

Alarms reconcile pending deadlines and timer ends. Quiet or disabled reminders
do not generate an every-second wake loop. Failed notification delivery backs
off. A periodic lightweight catch-up handles resuming after time away. The OS
may control notification presentation; the on-page generic nudge is another
local channel. A fully closed browser cannot notify until running again.

## Packaging

Runtime ZIP contains only extension files, with manifest.json at its root.
Source ZIP adds original artwork, preparation and build tools, tests and context.
Browser binaries, test profiles, credentials, private review scores and critique
exchanges are excluded. Mozilla signing is a later release operation; preserve
the stable Gecko ID and backup/migration semantics when moving to a signed build.

Version 1.1 source archives have repository-root contents directly. The runtime
still has `manifest.json` at its own archive root. The build copies the offline
installation guide to the source root while adjusting local asset paths. Signing
preparation is separate from the deterministic offline builder; only the explicit
owner-run signing command contacts Mozilla.
