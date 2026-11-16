# Google Calendar in Purrple

Purrple's tasks, timer, rewards, wardrobe and authored dialogue work offline. Calendar is optional. The desktop integration reads upcoming events from the signed-in account's primary calendar and sends an event only when you confirm a task or a planned focus block. Creating a focus block does not start a timer or give coins.

## Windows setup

1. Extract both ZIPs if you want to inspect them. Keep the source tree somewhere you control. Install Python 3.10 or newer with the Windows launcher.
2. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project, enable **Google Calendar API**, and set up Google Auth Platform. If the audience is **External** and publishing status is **Testing**, add your Google account under **Audience → Test users**. A managed Google Workspace account can have additional app restrictions.
3. Create a **Desktop app** OAuth client under **Clients**. Download its JSON to a private directory outside the source tree. You do not need an API key. Keep Google credentials out of chats and source control.
4. In PowerShell in the extracted source root run:

   ```powershell
   py tools/calendar/setup_calendar.py install "$env:USERPROFILE\Downloads\your-desktop-client.json"
   ```

   Substitute your actual JSON filename. The installer registers only the current Windows user.
5. Load **Purrple_Firefox_Extension.zip** from Firefox `about:debugging` → **This Firefox** → **Load Temporary Add-on**. In Purrple's **Settings → Google Calendar**, choose **Allow Calendar data** if shown, then **Connect Google Calendar**. Grant the Firefox permission, then complete Google's consent in the browser that opens. Use **Today** to see upcoming events. Use **Add to Calendar** on a task or **Plan focus in Google Calendar** in Study together.

## Linux and macOS

Run `python3 tools/calendar/setup_calendar.py install ~/path/to/your-desktop-client.json` from the source archive root. The helper registers the current user's standard Firefox native-messaging manifest. Sandboxed Firefox distributions can require separate native-messaging host support.

## Access and troubleshooting

- The helper uses Google's desktop loopback flow with PKCE and the calendar-events-owned scope. It sends title, start time and end time only on confirmation. The agenda uses a bounded seven-day view. To change a created event, edit it in Google Calendar.
- OAuth settings and tokens are kept in the current user's local configuration folder (`%LOCALAPPDATA%\PurrpleCalendar` on Windows; `~/.config/purrple-calendar` on Linux/macOS). These files are readable by the local OS account and should stay private. They are outside Firefox's extension storage and Purrple backups.
- If consent expires, use **Disconnect** and then **Connect**. Google's External Testing status can expire refresh tokens after seven days.
- If a create may have succeeded, retry the same title and time in the same Firefox app session. Purrple checks for the same event ID. If the tab or browser closed after an ambiguous result, check Google Calendar before recreating the event.
- Use **Disconnect** to clear this device's connection and attempt to revoke Google's grant. If Google could not be reached, remove the app in your [Google Account connections](https://myaccount.google.com/connections). Uninstall the helper with `py tools/calendar/setup_calendar.py uninstall` or `python3 tools/calendar/setup_calendar.py uninstall`.
- The development add-on is temporary. Back up any Purrple data you want to keep before restarting Firefox or removing the add-on. Authorization and feature tests with real owner credentials must be done after this setup.

[Google desktop OAuth guide](https://developers.google.com/identity/protocols/oauth2/native-app) · [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth) · [Firefox native host documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging)
