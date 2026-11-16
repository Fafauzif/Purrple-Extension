# Purrple 1.2.0 development release

## What changed

- The on-page house can be dragged using the mouse or moved using the arrow keys while focused. It snaps to the left, right, or bottom edge. The cat approaches its horizontal location on the page floor. The house and floating dashboard remember separate positions. Settings resets both.
- Neckwear now uses a source-frame attachment and per-item band pivot. Low Loaf and curled Sleep/Wake received separate treatment. Face and prop occlusion still apply. Recolored accessories and fitted thumbnails use the unchanged lavender cat artwork.
- Chatty starts at around 30 eligible seconds, with roughly 60 seconds between remarks. Balanced starts after around a minute and follows up after about two minutes. Quiet hours, focus sessions, naps and interactions suppress unsolicited remarks.
- The opt-in Calendar can read upcoming events and create an event from a task or planned focus block. It targets the connected account's primary calendar. It uses a local native-messaging helper and Google's desktop OAuth flow. [Calendar setup](CALENDAR.md)
- The source and runtime versions match. The archive builder uses explicit packaging paths and excludes setup credentials. The unsigned Firefox ZIP loads temporarily.

## Verification

- 77 Node tests and four Python Calendar helper tests passed. The Python tests use a fake Google API for pagination, ambiguous insert, collision and offline disconnect.
- The bundled renderer was run with a Node Canvas adapter across 4,755 static accessory/pose combinations. No item fell below the visible-pixel threshold or touched the review canvas border. Reviewed samples covered idle, walking, running, held, Loaf, Sleep/Wake, reading, studying and cry. In the tightest curls the band is partially occluded. The coverage metric measures presence, not the accuracy of every attachment.
- Native Firefox 150.0 passed the 16 checks that install and smoke-test the packaged runtime. Separate native suites passed 8 animation, 13 boundary, and 14 Play checks. The revision test verified house drag, saved placement after navigation, reset, a native Chatty remark, Calendar agenda, task and planned focus event creation, and disconnect. Calendar used the actual Firefox native-messaging transport and an isolated fake provider.
- Archive verification checks both ZIPs, automatic source rebuild, byte-for-byte runtime parity, and exclusion of fixture OAuth JSON.
- Live Google authorization, refresh, and event reads/writes with an owner's credentials still need an account-configured smoke test. Windows helper registration is documented and was not run on Windows in this environment.
