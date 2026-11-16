# Purrple interface behavior

## Canonical ownership

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native Firefox select | Platform keyboard and popup behavior | Full dashboard and compact panel geometry | Keyboard selection and narrow native viewport |
| Date | Native Firefox datetime-local/time inputs | Local browser timezone and core timestamp validation | Task deadline and quiet-hours clock | Valid/invalid date entry and persistence |
| Form | Shared app/compact handlers plus PurrpleCore | Core action contract and visible validation errors | Task, focus, settings and backup confirmation | Submit, invalid input, cancel and restore workflows |
| Scrollbar | Shared app/compact CSS tokens | DESIGN color and overflow ownership | Dashboard document, compact panel and task list | Narrow viewport and keyboard scrolling |
| Toast | Shared surface feedback helpers | Committed response or validation error | Full-home toast and compact status message | Success, failure, focus and recovery feedback |
| CRUD | PurrpleCore and serialized background | GET_STATE/ACTION domain contract | Full task editor and compact quick actions | Reducer, concurrency and native Firefox workflows |

The shared renderer owns character/accessory fitting on every surface. Native
dialogs with authored content own confirmation, Escape and focus restoration.
`client.js` owns native messaging and the explicitly labeled development preview.

## Shared behavior

All durable changes use GET_STATE/ACTION runtime messages. The background
owns serialized writes. UI does not directly mutate stored extension state.
On successful writes, trusted surfaces receive STATE_CHANGED, fetch the
authorized state and redraw the same data. Content scripts receive only the
public companion projection. In a normal browser without extension APIs, a clearly labeled Local
preview uses localStorage and the identical pure reducer. Preview is not
presented as evidence that a native extension has loaded.

Tasks use the full editor or compact quick form. A quick draft persists its
title and effort together. Save closes the full editor on success;
validation failure preserves the form and exposes the error. Completion is
immediate with coin feedback; reopening cannot farm a second reward. Completion uses absolute TASK_SET_DONE
values; retries are deduplicated by the durable 200-entry request journal. Archive
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

Settings save explicitly. Optional name defaults blank. Firefox controls the initial website grants. Settings offers a recovery button
if access is missing and sidebar tasks still function when access is denied. Hidden sites use hostname inputs. Native time
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

The compact popup and authorized floating panel share Today, Focus, Wardrobe
and Talk views. They support quick tasks, durable title-and-effort draft recovery,
timer controls,
explicit try/buy/wear actions and the same 90-prompt, 270-reply conversation bank.
Every surface uses the 45-behavior renderer with the 198 new illustrations,
variable frame timing and registered 30 Hz geometry; equipment never changes
merely because a motion or conversation preview is shown. Full home
and Firefox sidebar remain available from deliberate controls. The full home
and sidebar are one responsive document, never divergent implementations.

The on-page house supports dragging and arrow keys. The dashboard bar can be
repositioned independently. Settings resets both saved positions. Calendar is
shown in the full app and sidebar only, with a confirmation before any write.
