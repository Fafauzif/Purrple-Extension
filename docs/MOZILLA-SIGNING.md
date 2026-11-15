# Private Firefox release: owner checklist

The supplied runtime ZIP is **unsigned**. It is immediately usable through
Firefox’s temporary add-on loader. A permanent installation in normal Firefox
requires Mozilla signing. No account login, signing upload or signed artifact
is claimed by this source package.

## Prepare your Mozilla account

1. Sign in to Mozilla’s Add-on Developer Hub using your own account.
2. Choose **On your own** / unlisted self-distribution when submitting Purrple.
   This allows you to give the signed file directly to your girlfriend without
   publishing a public store listing.
3. Keep the existing Gecko ID `purrple-companion@purrple.local`. It is the saved
   extension identity. Export a progress backup before changing installation.
4. Supply the extension source and any further information Mozilla requests.
   The runtime contains fixed local artwork and no remote code, account,
   analytics or AI service.
5. Wait for the signing result. Only distribute the signed `.xpi` that Mozilla
   returns after the submission succeeds. Naming a file `.xpi` does not sign it.

You can submit the runtime ZIP through the Developer Hub, or use Mozilla’s
official `web-ext` command-line tool. Signing contacts Mozilla and uploads the
extension, so it is deliberately a separate owner-operated step.

## Optional command-line route

Install the official tool following Mozilla’s documentation. For example:

```sh
npm install --global web-ext
```

Create API access credentials in your Mozilla developer account. Provide them
to your **private current process environment** using the names
`WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`. Do not paste their values into the
repository, chat, example files, screenshots, command arguments or a committed
`.env` file. The signing script passes no credential values on the command line.

First inspect the preparation plan. This does not submit anything:

```sh
python scripts/sign_release.py
```

When you intend to upload and the credentials are present:

```sh
python scripts/sign_release.py --submit
```

The script validates the stable extension ID, runs `web-ext lint`, then uses
`web-ext sign --channel=unlisted`. Mozilla’s downloaded artifacts go into
`dist/signed/`, which is ignored by the source archive. A repeated version may
be rejected; advance the manifest/package version deliberately for a new release.

## Test and share the signed file

- Export a JSON backup from the current Purrple installation first.
- Test the returned signed XPI in a separate Firefox profile before replacing
  the daily installation. Confirm tasks, wardrobe, focus timer and webpage panel.
- In normal Firefox, open `about:addons`, use the gear menu, and choose
  **Install Add-on From File…**. Select the signed XPI and follow the prompts.
- Pin Purrple from the Extensions button. Grant website access where she should
  roam, then refresh existing website tabs.
- Include `INSTALL-PURRPLE.html` when giving her the file. That friendly guide
  distinguishes the permanent signed route from temporary development loading.

## Official references

- [Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Install add-ons from a file](https://support.mozilla.org/en-US/kb/find-and-install-add-ons-add-features-to-firefox)

The local documentation and product remain usable offline. These external
links require internet access only when you choose to open them.
