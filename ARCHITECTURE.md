# Architecture

## One state authority

Firefox's event background owns storage.local.purrpleState. Product surfaces
send GET_STATE and ACTION messages; the background serializes mutations, saves
successfully, then broadcasts committed state. User interfaces do not write
directly to extension storage. A request ID deduplicates repeated UI requests,
and durable reward/purchase ledger IDs enforce economic idempotency even after
background restart. Never award coins from animation or click callbacks.

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

Dashboard, sidebar and popup share core.js, client.js, renderer.js and app.js.
The client uses browser.runtime for the real extension. A clearly labeled local
preview adapter exists only when extension APIs are unavailable; it is not
evidence of native Firefox behavior.

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

Every product surface uses the same renderer. Fixed illustrated keyframes are
combined with continuous breathing, movement and physics at 24/30 fps presentation.
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
