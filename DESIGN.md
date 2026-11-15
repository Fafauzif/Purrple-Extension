---
version: alpha
colors:
  paper: "#f8f3fb"
  surface: "#fffdfd"
  lilac: "#ebdef6"
  primary: "#78508f"
  text: "#4c345b"
  muted: "#75607f"
  line: "#e4d6ec"
  pink: "#e9b2cb"
  success: "#48795f"
  error: "#a5485b"
typography:
  display:
    fontFamily: "Fredoka, system-ui, sans-serif"
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
rounded:
  panel: "23px"
  button: "12px"
  input: "11px"
spacing:
  panel: "26px"
  gap: "22px"
components:
  button:
    minHeight: "42px"
  taskCard:
    borderRadius: "15px"
---

## Overview

Purrple is a private Firefox companion for one person who loves purple, small
pixel-art cats and gentle study company. This is a product interface: tasks,
study sessions, coins and outfit controls should feel familiar and direct.
The approved Plush Chibi kitten is the visual signature. The UI gives her a
quiet lavender corner instead of surrounding every screen with decoration.

## Colors

The tokens above map directly to `extension/css/app.css` `:root` properties.
`primary` maps to `--purple`, `text` to `--purple-dark`; other names map to
their same-name variables. Lilac and pink are expressive. Error and success
retain semantic meaning and are accompanied by text. Gold coin accents are
limited to balances and reward labels, never payment or real-money language.

## Typography

Locally bundled Fredoka owns headings, the Purrple wordmark and the timer.
Nunito owns forms, task text, buttons and metadata. No network font loads.
English is the entire interface language. Dates and time inputs use native
browser controls, with platform-owned popup geometry and local timezone.

## Layout

A four-tab shell holds Today, Study together, Little wardrobe and Settings.
Desktop puts a compact companion beside the task list; narrow sidebars put
her above the list. Wardrobe uses one saved/preview outfit and a bounded
fifteen-item shop. Task history starts at 25 entries with Show more; focus
history is recent twelve sessions. There are no invented completed tasks.

## Elevation & Depth

Borders and pale surfaces establish grouping. Very soft shadows are reserved
for the main companion, focus card and dialogs. Avoid dramatic floating cards,
large gradients or a hero marketing treatment on functional screens.

## Shapes

Rounded panels echo the approved kitten's cheeks. Small controls use smaller
radii; task checkboxes remain a distinct rounded square. The cat is always
rendered through the shared renderer and equipped item slots, including popups.

## Components

Buttons, fields, search, status and dialogs are shared app-level primitives in
`css/app.css` and `js/app.js`. Native select, datetime-local, time, range and
checkbox controls own their keyboard behavior. Dialog uses native `dialog`
with authored content and focus restoration; browser alert/confirm/prompt
are not used. One toast system gives successful/error feedback. Empty states
give a useful next step and do not invent product data.

## Do's and Don'ts

- Keep the approved face, short tail, palette and accessory registration.
- Use plain labels such as Save preferences, Wear, Try on, Start together.
- Keep purchased items permanent and affection available without coins.
- Do not insert model/API/provider language into the product interface.
- Do not add letters or remote messaging; the user declined them.
- Do not claim 30 newly drawn character poses each second: playback combines
  illustrated keys with procedural motion.
- Honor reduced-motion preferences and visible keyboard focus.
- Test the same saved outfit on dashboard, sidebar, popup and webpage pet.
