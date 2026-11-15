# Purrple product brief

## Approved requirements

Purrple is a personal Firefox companion for the user's girlfriend. The approved
identity is the GPT-image lavender Plush Chibi kitten, with round head, glossy
plum eyes, pink cheeks, cream muzzle/chest/paws and a short, slightly slender
tail. English throughout. Artwork can be generated at development time; runtime
must be local and AI-free with no accounts, subscriptions or service dependency.

Core loop: complete personal tasks, earn coins, permanently unlock cosmetic
items, customize Purrple, and let her accompany browser work and study.

Approved surfaces: roaming companion on supported ordinary webpages, Firefox
sidebar, full dashboard and quick popup. Keep the user's new-tab page unchanged.
The optional new-tab idea is not needed for this release. No mailbox/letters.

Task effort earns 10/20/30 coins for small/medium/large. Completed study sessions
earn a modest 5-coin bonus. No streak penalties, pet suffering, decay or paid
currency. Basic play and affection are always free. Purchases persist forever.

Tasks support deadlines, priorities, recurring occurrences and subtasks. Study
sessions support focus and breaks. Reminders catch up after restart/wake; a
closed browser cannot deliver notifications until it is running again.

The initial wardrobe has 15 items, including all three approved previews:
Moon bow, Star bandana, Cozy beanie. Accessories must stay equipped and follow
every illustrated frame and movement; profile, curled, stretched and airborne
poses require deliberate fitting rather than one fixed overlay coordinate.

Persistence includes settings, tasks, purchases, equipment and reward history.
Backups restore local data. Duplicate clicks, repeated completion or multiple
tabs must not award the same reward twice. Source history must avoid a fixed
5000-task lifetime cap. Browser API changes can require future maintenance;
the product does not require an ongoing content or server update service.

## Release deliverables

1. Runtime extension ZIP, manifest at the archive root, with install instructions.
2. Complete GitHub-ready source ZIP containing runtime, asset sources/preparation,
   build/test tools, architecture, decisions, context and handover documentation.

Mozilla signing is deferred because the user has no developer account yet.
An unsigned ZIP supports Firefox temporary add-on loading, not permanent
installation in normal release Firefox. Do not imply otherwise.

## Quality requirements

Preserve rewards and purchases across tabs and restarts. Exercise task and
timer workflows in the real browser. Equipped items must follow every source
pose, with deliberate profile, sleep and prop occlusion. Distinguish native
extension tests from preview adapters in the factual verification summary.
