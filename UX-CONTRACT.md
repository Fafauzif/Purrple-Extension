# Purrple interface behavior

## Canonical ownership

| Capability | Owner | Source of truth | Verification |
| --- | --- | --- | --- |
| Task operations | PurrpleCore / background | Core action contract | Reducer and browser workflows |
| Data client | `extension/js/client.js` | Runtime messages | Native Firefox and preview |
| Native select and date controls | Browser | Platform interaction model | Keyboard / narrow viewport |
| Forms and validation | `extension/js/app.js` | Core validation plus visible field errors | Empty and valid submit |
| Toast and error feedback | Shared `notify` helper | App state | Success and failure paths |
| Confirmation | Native dialog with authored content | Backup import workflow | Cancel / restore / Escape |
| Scrollbars | `extension/css/app.css` | DESIGN token mapping | Responsive screenshots |
| Character and accessories | Shared PurrpleRenderer | Asset manifest and fitted slot data | Pose / surface matrix |

## Shared behavior

All durable changes use GET_STATE/ACTION runtime messages. The background
owns serialized writes. UI does not directly mutate stored extension state.
On successful writes, every surface receives STATE_CHANGED and redraws the
same data. In a normal browser without extension APIs, a clearly labeled Local
preview uses localStorage and the identical pure reducer. Preview is not
presented as evidence that a native extension has loaded.

Tasks are created and edited in the same editor. Save closes on success;
validation failure preserves the form and exposes the error. Completion is
immediate with coin feedback; reopening cannot farm a second reward. Archive
is reversible through the Archive filter. Empty and no-search-results states
are distinct. User-written text is HTML-escaped before insertion.

Search is ephemeral private UI state, not written to URLs, to avoid task
titles entering browser history or shared links. Task history displays 25
records with explicit Show more. Focus history displays twelve recent records.

Wardrobe Try on changes only the preview. Buy changes ownership permanently.
Wear persists the selected slot. Head and neck combine; two items cannot
occupy the same slot. Show saved outfit discards a preview. Insufficient funds
disable Buy with the amount still needed in its title. No real money exists.

Focus sessions use durable end timestamps, not a front-end countdown as the
source of truth. Pause/resume/cancel are explicit actions. Completion reconciles
through the core and awards once. Rest and basic pet attention are always free.

Settings save explicitly. Optional name defaults blank. Website permissions
are requested by a user-clicked button only, and sidebar tasks still function
when website access is denied. Hidden sites use hostname inputs. Native time
fields define quiet hours in local browser time.

Backup export downloads current state. Import parses and validates before
opening a confirmation naming what will be replaced. Cancel initially receives
focus, and no data changes until Restore backup is chosen. A malformed or
oversized file produces an error and preserves current data.

## Interaction and accessibility

Buttons and links are semantic controls. Native selects own their popup
geometry and keyboard behavior. Labels activate their inputs. Keyboard focus
is visible. Dialogs support Escape and modal focus behavior. Loading and
errors have stable, readable feedback. Pointer-only pet gestures have explicit
button alternatives. Reduced motion stops the character's decorative motion.

The popup links to the full home and opens the Firefox sidebar directly from
a user gesture. It shows at most three upcoming tasks and a live timer summary.
App and sidebar are one responsive document, never divergent implementations.
