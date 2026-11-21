/* Calendar is only available in the direct full extension app or sidebar. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const transport = globalThis.browser;
  const permission = { permissions: ['nativeMessaging'] };
  const collection = { data_collection: ['personalCommunications', 'personallyIdentifyingInfo'] };
  const dateFormat = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
  const clockFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  function safeLink(value) {
    try {
      const url = new URL(value);
      return url.origin === 'https://calendar.google.com' && url.pathname.startsWith('/calendar/') ? url.href : '';
    } catch { return ''; }
  }
  function civilDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }
  function startValue(epoch) {
    const value = new Date(epoch);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  async function call(operation, event) {
    const result = await transport.runtime.sendMessage({ type: 'CALENDAR', operation, event });
    if (!result?.ok) {
      const error = Error(result?.error || 'Purrple could not reach the Calendar helper.');
      error.code = result?.code;
      throw error;
    }
    return result;
  }
  function renderEvents(events) {
    const list = $('calendar-events');
    list.replaceChildren();
    let previousDay;
    for (const event of events) {
      const date = event.start?.date;
      const start = date ? civilDate(date) : new Date(event.start?.dateTime);
      if (!Number.isFinite(start.getTime())) continue;
      const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      const day = dateFormat.format(start);
      if (day !== previousDay) {
        const heading = document.createElement('li');
        heading.className = 'calendar-day'; heading.textContent = day; list.append(heading);
        previousDay = day;
      }
      const row = document.createElement('li'), link = safeLink(event.link);
      const title = document.createElement(link ? 'a' : 'strong');
      title.textContent = event.title;
      if (link) { title.href = link; title.target = '_blank'; title.rel = 'noopener'; }
      const time = document.createElement('span');
      time.className = 'muted';
      time.textContent = date ? 'All day' : clockFormat.format(start);
      if (date && event.end?.date) {
        const last = civilDate(event.end.date); last.setDate(last.getDate() - 1);
        if (last > start) time.textContent += ' through ' + dateFormat.format(last);
      } else if (end && Number.isFinite(end.getTime())) {
        if (start < new Date() && end > new Date()) time.textContent = 'In progress · ends ' + clockFormat.format(end);
        else time.textContent += ' – ' + (dateFormat.format(end) === day ? '' : dateFormat.format(end) + ', ') + clockFormat.format(end);
      }
      row.append(title, time); list.append(row);
    }
  }
  function mount({ onChange, onEvents = () => {} }) {
    if (!transport?.runtime?.id || !$('calendar-settings') || location.protocol !== 'moz-extension:' || window.top !== window) return null;
    let connection = '', fetchedAt = 0, busy = false, refreshId = 0, creating = false, eventSaved = false;
    const dialog = $('calendar-dialog'), createButton = $('calendar-create');
    $('calendar-settings').hidden = false;
    function setConnected(result) {
      const next = result.connected ? result.connection : '';
      if (next !== connection) {
        onEvents({ status: next ? 'loading' : 'disconnected', account: next });
        refreshId++;
        fetchedAt = 0;
        renderEvents([]);
        connection = next;
      }
      $('calendar-connect').hidden = !!connection;
      $('calendar-disconnect').hidden = !connection;
      $('calendar-focus').hidden = !connection;
      $('calendar-agenda').hidden = !connection;
      $('calendar-status').textContent = connection ? 'Connected to your primary Google calendar.' : 'Google Calendar is disconnected.';
      onChange();
    }
    async function refresh() {
      if (!connection || $('calendar-refresh').disabled) return;
      const attempt = ++refreshId, selected = connection;
      $('calendar-refresh').disabled = true;
      $('calendar-agenda-status').textContent = 'Refreshing events…';
      try {
        const result = await call('list');
        if (attempt !== refreshId || !connection) return;
        if (result.connection !== selected) { setConnected(result); return; }
        renderEvents(result.events);
        fetchedAt = Date.now();
        onEvents({ status: result.hasMore ? 'limited' : 'connected', account: selected, events: result.events, fetchedAt });
        $('calendar-agenda-status').textContent = (result.events.length ? 'Next seven days.' : 'No upcoming events in the next seven days.') +
          (result.hasMore ? ' The list is limited to the first 100 events.' : '');
      } catch (error) {
        if (attempt !== refreshId) return;
        const prefix = fetchedAt ? 'Showing the last refresh from ' + new Date(fetchedAt).toLocaleTimeString() + '. ' : '';
        $('calendar-agenda-status').textContent = prefix + error.message;
        if (error.code === 'reconnect') $('calendar-status').textContent = 'Authorization expired. Disconnect, then connect again.';
        const revoked = ['reconnect', 'permission'].includes(error.code);
        if (revoked) { renderEvents([]); fetchedAt = 0; }
        onEvents({ status: revoked ? 'revoked' : 'stale', account: selected, message: error.message });
      } finally { $('calendar-refresh').disabled = false; }
    }
    async function updateConsent() {
      const granted = (await transport.permissions.getAll()).data_collection;
      const needsConsent = Array.isArray(granted) && !collection.data_collection.every(type => granted.includes(type));
      $('calendar-consent').hidden = !needsConsent;
      $('calendar-connect').disabled = needsConsent;
      if (needsConsent && connection) {
        renderEvents([]);
        refreshId++;
        fetchedAt = 0;
        $('calendar-agenda-status').textContent = 'Allow Calendar data in Settings to see events.';
        onEvents({ status: 'revoked' });
      }
      return !needsConsent;
    }
    $('calendar-consent').onclick = async () => {
      try {
        if (!await transport.permissions.request(collection)) throw Error('Calendar data permission declined.');
        $('calendar-status').textContent = connection ? 'Calendar data allowed.' : 'Calendar data allowed. You can now connect.';
        if (await updateConsent() && connection) void refresh();
      } catch (error) { $('calendar-status').textContent = error.message; }
    };
    transport.permissions.onRemoved.addListener(change => {
      if (change?.permissions?.includes('nativeMessaging')) setConnected({ connected: false });
      updateConsent().catch(() => {});
    });
    $('calendar-refresh').onclick = refresh;
    $('calendar-connect').onclick = async () => {
      if (busy) return;
      busy = true; $('calendar-connect').disabled = true;
      try {
        if (!await transport.permissions.request(permission)) throw Error('Permission declined. You can still use Purrple offline.');
        const before = await call('status');
        if (!before.connected) $('calendar-status').textContent = 'Finish Google consent in your default browser. This can take up to two minutes.';
        setConnected(before.connected ? before : await call('connect'));
        await refresh();
      } catch (error) { $('calendar-status').textContent = error.message; }
      finally { busy = false; $('calendar-connect').disabled = false; }
    };
    $('calendar-disconnect').onclick = async () => {
      if (busy) return;
      busy = true; $('calendar-disconnect').disabled = true;
      try {
        const result = await call('disconnect');
        setConnected(result);
        if (!result.revoked) $('calendar-status').textContent = 'Disconnected here. Remove Purrple access in your Google Account to revoke the grant.';
      } catch (error) { $('calendar-status').textContent = error.message; }
      finally { busy = false; $('calendar-disconnect').disabled = false; }
    };
    $('calendar-cancel').onclick = () => dialog.close();
    dialog.addEventListener('cancel', event => { if (creating) event.preventDefault(); });
    $('calendar-form').onsubmit = async event => {
      event.preventDefault();
      if (creating || eventSaved || !connection) return;
      const title = $('calendar-title').value.trim(), start = new Date($('calendar-start').value);
      const duration = Number($('calendar-duration').value);
      const status = $('calendar-form-status');
      if (!title || !Number.isFinite(start.getTime()) || duration < 1 || duration > 1440 ||
          startValue(start.getTime()) !== $('calendar-start').value) {
        status.textContent = 'Enter a title, a valid local time, and a duration.';
        return;
      }
      creating = true; createButton.disabled = true; $('calendar-cancel').disabled = true;
      status.textContent = 'Creating the event…';
      try {
        const draft = { connection, title, start: start.toISOString(), end: new Date(start.getTime() + duration * 60000).toISOString() };
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(draft)));
        const key = 'purrple.calendar.operation.' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        draft.operation = sessionStorage.getItem(key) || crypto.randomUUID();
        sessionStorage.setItem(key, draft.operation);
        const result = await call('create', draft);
        eventSaved = true;
        const link = $('calendar-created');
        link.href = safeLink(result.event.link); link.hidden = !link.getAttribute('href');
        status.textContent = 'Event saved to Google Calendar.';
        void refresh();
      } catch (error) { status.textContent = error.message; }
      finally {
        creating = false; createButton.disabled = eventSaved; $('calendar-cancel').disabled = false;
      }
    };
    async function syncConnection() {
      if (busy || !await transport.permissions.contains(permission)) return;
      setConnected(await call('status'));
      if (await updateConsent() && location.hash === '#today') void refresh();
    }
    transport.runtime.onMessage.addListener(message => {
      if (message?.type === 'CALENDAR_CHANGED') syncConnection().catch(error => { $('calendar-status').textContent = error.message; });
    });
    updateConsent().then(async consent => {
      if (!await transport.permissions.contains(permission) || busy) return;
      setConnected(await call('status'));
      if (consent && location.hash !== '#settings') void refresh();
    }).catch(error => { $('calendar-status').textContent = error.message; });
    return {
      get connected() { return !!connection; },
      refresh,
      showAgenda() { if (!fetchedAt || Date.now() - fetchedAt > 300000) void refresh(); },
      openDraft(title, start, minutes) {
        if (!connection || dialog.open) return;
        eventSaved = false; createButton.disabled = false;
        $('calendar-title').value = title;
        $('calendar-zone').textContent = '(' + zone + ')';
        $('calendar-start').value = start ? startValue(start) : '';
        $('calendar-duration').value = minutes;
        $('calendar-form-status').textContent = '';
        $('calendar-created').hidden = true;
        dialog.showModal();
      }
    };
  }
  globalThis.PurrpleCalendarUI = Object.freeze({ mount });
})();
