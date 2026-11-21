# Update the existing Firefox add-on

1. Download a backup from the existing browser profile.
2. In the Mozilla Add-ons Developer Hub, open the existing Purrple entry and submit `Purrple_Firefox_Extension.zip` as a new version in its existing distribution channel. The Gecko ID stays `purrple-companion@purrple.local`.
3. Review Mozilla’s validation result. The standard Purrple features keep their data local. The manifest discloses optional data transmission for the Firefox Google Calendar helper. Keep the submission answers consistent with the actual integration and its opt-in consent.
4. For a self-distributed update, download Mozilla’s signed XPI. Test it in a disposable Firefox profile before updating your everyday profile. In `about:addons`, select the gear menu → **Install Add-on From File…** and choose the signed XPI.

[Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) · [Firefox data collection and transmission consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) · [Installing a self-distributed add-on](https://extensionworkshop.com/documentation/publish/install-self-distributed/)

For a local preflight with Mozilla’s `web-ext`, build first, then run `python3 scripts/sign_release.py --lint`. This lints the extracted release ZIP before you submit through the Developer Hub. Temporary tests can load the unsigned ZIP through `about:debugging`.
