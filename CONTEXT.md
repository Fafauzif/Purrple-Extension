# Purrple context handover

Read PRODUCT.md, README.md, ARCHITECTURE.md, DESIGN.md and UX-CONTRACT.md before
changing this project. User conversation decisions are summarized here so a
fresh developer can continue without the original chat.

## Decisions and history

- Name chosen by the girlfriend: **Purrple**. She loves purple.
- Initial code-drawn cats were rejected. GPT-image Plush Chibi identity is the
  visual source of truth; keep the rounded expressive head and compact body.
- Long tails and unintended head skew were rejected. Keep eyes level for
  frontal views and intentional profile/tilt poses for movement.
- Approved main reference is in art/reference/approved-character.png.
- Thirty illustrated motion rows (six keys each) plus composed movements were
  explored in the earlier animation lab. Presentation is 24/30fps, not 30 unique
  hand-drawn images each second. Root motion and physics are continuous.
- Approved first accessories: moon bow, star bandana and cozy beanie, shown in
  art/reference/approved-accessories.png. Expand to 15 fitted cosmetics.
- Every equipped item must follow the relevant head/neck in every pose.
- Runtime is completely offline, with no AI, inference, model, provider keys,
  telemetry, WhatsApp integration or external backend.
- Interface and canned companion remarks are English.
- Girlfriend's personal name was not provided; it is an optional local setting.
- No personal-letter/mailbox feature. No need to replace new-tab.
- Task coins 10/20/30 and a modest study bonus were approved. No penalties.
- Firefox private signing is deferred. User knows this is the development
  build first; document temporary installation clearly.
- The user intends to upload the complete source ZIP to their own GitHub repo;
  do not publish anything automatically or include credentials in the source.

## Continued work principles

Preserve storage identity and migration compatibility. Keep shared reducer
invariants central. Reuse the common character/wardrobe renderer across popup,
dashboard, sidebar and webpages. Test native browser behavior and distinguish
it from preview adapters. Improve artwork using explicit references and fitted
anchors; do not replace the approved cat with geometric placeholders.
