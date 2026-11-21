# Purrple 3.1 verification

- The test suites cover the planner, focus notes and timers, backup compatibility, companion progression, and shared appearance. Game-window authorization is bound to the game document and excludes planner actions and backups.
- Chromium local previews exercise Today, Agenda, Light and Night, the illustrated focus states, gifts, and saved rounds. A separate Chromium fixture renders the actual webpage overlay with simulated extension messaging to test the action ring and dedicated game frame.
- Chromium rendered 6,024 samples at 30 FPS across all 45 clips, and the frame audit covered all 317 registered source frames. No blank or clipped frames were detected in the sampled scenarios. At a 128 px render size the largest measured turn displacement between samples fell from 29.19 px to 1.28 px. Some distinct authored poses are still visible as changes, particularly in Chase. See [the audit runner](../art/audit_sprite_playback.cjs).
- Native installation is unverified in this environment. The full Chromium process could not open a fresh local browser profile. The available headless browser rendered previews and did not support unpacked extension installation. Firefox was unavailable.
- The package integrity command checks the exact archives, including version agreement, manifest references, hashes, and byte-for-byte rebuilds.

[Reproduce the browser and archive checks](TESTING.md) · [Install or update](INSTALL-3.1.md)
