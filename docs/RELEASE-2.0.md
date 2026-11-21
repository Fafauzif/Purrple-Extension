# Purrple 2.0 release notes

Version 2.0.1 keeps keyboard focus on the webpage companion after moving or
resetting its position. Escape closes the menu and returns focus to Purrple.

Purrple now runs on Firefox and on Chromium-based Brave and Chrome. Select the
cat on a supported webpage or in the toolbar to talk, play, or start a timer.
Use Today to capture tasks and choose up to three priorities, then reserve time
in Calendar or start work directly from Focus.

- **Calendar** works offline. Use Week, Day, or Agenda, create independent or
  linked blocks, schedule a series, and edit individual occurrences. A task’s
  deadline is independent of its scheduled blocks. Archiving keeps linked
  blocks and session history recoverable.
- **Focus** follows the same timer between views. You can add an intention,
  pause, park a thought, and turn it into an inbox task during wrap-up. A new
  Small, Medium, or Large task earns 1, 2, or 3 coins. A completed focus session
  earns 1 coin from 15 minutes or 2 coins from 30 minutes. Shorter sessions count
  toward focus time. Active timers carried forward from v1 keep their original
  reward rule.
- **Companion** has three local games, visits and discoveries, a configurable
  birthday, and a room with movable keepsakes. Use the wardrobe to preview
  head, neck, face, paw, and body slots. Purrple’s birthday is November 20.
  The local anniversary uses the profile’s first date. February 29 occasions
  use February 28 in a non-leap year, with a seven-day local grace window.
- **Backups** include local plans, history, outfits, room, settings, and
  positions. Restore previews the incoming file and can save a copy of the
  current profile first. Each browser profile keeps an independent save.

Firefox keeps the optional owner-installed Google Calendar native helper. It
reads a bounded seven-day agenda from the connected account’s primary calendar.
Sending a local task or focus block still requires confirmation. Google tokens
stay with the helper. The hosted read-only pilot architecture is ready for
future configuration. [Helper setup](CALENDAR.md) · [Hosted Calendar design](HOSTED-CALENDAR.md)

Brave and Chrome request the Side Panel permission for the compact workspace.
Local Calendar needs no Google permission. Timer sound and notifications start
off on fresh profiles. Existing notification preferences carry forward.

[Install and update](INSTALL-2.0.md) · [Verification](VERIFICATION-2.0.md)
