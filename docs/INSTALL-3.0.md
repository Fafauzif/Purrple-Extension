# Install Purrple 3.0

| Archive | Use |
| --- | --- |
| `Purrple_Firefox_Extension.zip` | Firefox 140 or later. Load temporarily or submit as an update through the existing Mozilla Add-ons developer entry. |
| `Purrple_Chromium_Extension.zip` | Current Brave and Chrome on desktop. Both browsers use the same unpacked extension. |
| `Purrple_Complete_Source.zip` | The source, artwork, build and test tools, and Calendar helper setup. Extract into a fresh folder to rebuild. |

Download a JSON backup in **Settings** before updating or moving browsers. Each browser profile has its own local save. To move a save, open **Settings → Restore a backup** in the destination and review the import preview before confirming.

## Firefox

For a temporary test, use `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** and choose the Firefox ZIP or the extracted `manifest.json`. Firefox removes temporary add-ons on restart. [Temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

For a permanent update, submit the Firefox ZIP in the existing Mozilla Add-ons developer entry using the current distribution channel. Keep the ID `purrple-companion@purrple.local`. For a self-distributed copy, download Mozilla’s signed XPI, go to `about:addons`, and select **Install Add-on From File…** in the gear menu. [Submitting an update](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) · [Installing a self-distributed add-on](https://extensionworkshop.com/documentation/publish/install-self-distributed/)

## Brave and Chrome

1. Extract the Chromium ZIP to a permanent directory. For example, create a `Purrple` folder under Documents and use the location where `manifest.json` sits directly inside the folder.
2. Open `brave://extensions` or `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and select that folder. For later updates, replace the runtime files in the same folder, then choose **Reload** on the extensions page. Keeping the location and profile preserves the unpacked extension’s identity.
4. Pin Purrple from the Extensions menu and refresh previously opened website tabs. Use the toolbar’s **Sidebar** action for the browser panel or a Purrple tab when the panel is unavailable.

[Brave extension help](https://support.brave.com/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave) · [Chrome unpacked extension help](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)

## Your first workday

Pin Purrple, then open the toolbar and add a task in **Today**. Start a focus session from the task or set aside time in **Calendar**. Click the cat on a supported webpage to bring up the planner or play a round. Return to the page when you close the panel.

Use **Settings → Download backup** before changing or removing the extension. A backup includes your plans, saved progress, wardrobe and preferences.

## Permissions and Calendar

Website access lets Purrple appear on ordinary HTTP and HTTPS webpages. On protected browser pages, use the toolbar, sidebar, or dashboard. Chromium requests side panel access to show Purrple alongside a tab.

Local Calendar works in every supported browser and needs no sign-in. Firefox users who already use the optional native Google Calendar helper can keep using it. The helper uses a separate OS-local configuration and sends event details only through the opt-in Google workflow. Its configuration and OAuth tokens are outside portable Purrple backups. [Firefox helper setup](CALENDAR.md)
