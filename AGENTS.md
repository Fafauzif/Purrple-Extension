# Working on Purrple

Read CONTEXT.md, PRODUCT.md, ARCHITECTURE.md, DESIGN.md and UX-CONTRACT.md first.
Use docs/EXTENDING-PURRPLE.md for the approved workflow and routes for new games, accessories and décor.
Keep the approved purple Plush Chibi identity and its fixed local artwork.

- Core features stay offline and AI-free. Google Calendar is the sole optional
  integration, through an owner-installed local Firefox native host. Keep
  credentials out of the extension and never add analytics or remote artwork.
- Keep persistence and reward invariants in PurrpleCore; serialize background
  commits. Never award coins from UI animation callbacks.
- Use the same renderer in every surface. Review every equipped item across all source
  poses. Preserve intentional coverage rules for body and paw props. Do not
  use visibility to conceal a rendering defect.
- Keep content-page state minimal. Never expose task text, wallet history or
  backups to an ordinary webpage or scrape the page's contents.
- Preserve backup compatibility and existing ownership. Rejected imports must
  leave the current save untouched.
- Run meaningful unit and actual-browser tests after related changes. Clearly
  distinguish native Firefox tests from preview adapters and mocked tests.
- Rebuild with scripts/build_release.py. Exclude browser runtimes, test profiles,
  credentials and private evaluation exchanges from the release archives.
- Signing is a separate release step. Never describe an unsigned development
  ZIP as permanently installable in standard Firefox.
