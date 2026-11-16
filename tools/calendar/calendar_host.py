#!/usr/bin/env python3
"""Optional Firefox native host for a personal Google Calendar."""
import base64
from datetime import datetime, timedelta, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import secrets
import struct
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import webbrowser
from uuid import UUID, uuid4

NAME = 'purrple_calendar'
EXTENSION_ID = 'purrple-companion@purrple.local'
SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned'
TOKEN = 'https://oauth2.googleapis.com/token'
EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
HOME = (Path(os.environ['LOCALAPPDATA']) / 'PurrpleCalendar' if os.name == 'nt'
        else Path.home() / '.config' / 'purrple-calendar')
CLIENT = HOME / 'desktop-oauth.json'
SESSION = HOME / 'connection.json'
UTC = timezone.utc
LIMIT = 128 * 1024


class CalendarError(Exception):
    def __init__(self, message, code='error', status=None):
        super().__init__(message)
        self.code = code
        self.status = status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def request_json(url, *, form=None, body=None, token=None):
    headers = {'Accept': 'application/json'}
    if form is not None:
        data = urlencode(form).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    elif body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    else:
        data = None
    if token:
        headers['Authorization'] = 'Bearer ' + token
    try:
        with build_opener(NoRedirect()).open(Request(url, data, headers), timeout=12) as response:
            raw = response.read(2 * 1024 * 1024 + 1)
            if len(raw) > 2 * 1024 * 1024:
                raise CalendarError('Google returned too many event details.')
            return json.loads(raw) if raw else {}
    except HTTPError as err:
        code = 'google_error'
        message = 'Google Calendar could not complete this request.'
        if err.code == 401:
            code, message = 'reconnect', 'Google authorization expired. Reconnect in Settings.'
        elif err.code == 429 or err.code >= 500:
            code, message = 'retry', 'Google Calendar is temporarily unavailable. Wait briefly, then retry.'
        elif err.code == 403:
            code, message = 'denied', 'Google denied Calendar access. Check permissions, account policy, and quota.'
        elif err.code == 400 and url == TOKEN and form.get('grant_type') == 'refresh_token':
            code, message = 'reconnect', 'Google authorization expired or was revoked. Reconnect in Settings.'
        raise CalendarError(message, code, err.code) from None
    except (URLError, TimeoutError, OSError):
        raise CalendarError('Google could not be reached. Check your connection and retry.', 'retry') from None


def read_json(path, missing=None):
    try:
        with path.open(encoding='utf-8') as handle:
            return json.load(handle)
    except FileNotFoundError:
        return missing
    except (OSError, ValueError):
        raise CalendarError('Calendar setup data could not be opened. Check the setup guide.') from None


def write_private(path, data):
    HOME.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name != 'nt':
        HOME.chmod(0o700)
    fd, name = tempfile.mkstemp(dir=HOME)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(data, handle)
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def credentials():
    value = read_json(CLIENT)
    config = value.get('installed', {}) if isinstance(value, dict) else {}
    client_id = config.get('client_id')
    if not isinstance(client_id, str) or not client_id.endswith('.apps.googleusercontent.com'):
        raise CalendarError('Add your Google Desktop app OAuth JSON using the setup guide.', 'setup')
    form = {'client_id': client_id}
    if isinstance(config.get('client_secret'), str):
        form['client_secret'] = config['client_secret']
    return form


def token_data(old, fresh):
    if not isinstance(fresh.get('access_token'), str):
        raise CalendarError('Google did not return an access token. Reconnect in Settings.', 'reconnect')
    return {**old, 'access_token': fresh['access_token'],
            'refresh_token': fresh.get('refresh_token', old.get('refresh_token')),
            'expires': int(time.time()) + int(fresh.get('expires_in', 3600))}


def connect():
    config = credentials()
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    result = {}

    class Callback(BaseHTTPRequestHandler):
        def setup(self):
            self.request.settimeout(3)
            super().setup()

        def log_message(self, *_):
            return

        def do_GET(self):
            url = urlsplit(self.path)
            params = parse_qs(url.query)
            valid = (url.path == '/' and len(params.get('state', [])) == 1
                     and secrets.compare_digest(params['state'][0], state))
            codes = params.get('code', [])
            if valid and not result:
                if len(codes) == 1 and 'error' not in params:
                    result['code'] = codes[0]
                else:
                    result['declined'] = True
            self.send_response(200 if valid else 400)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(b'Return to Purrple to finish connecting.' if valid else b'Unknown Calendar request.')

    with HTTPServer(('127.0.0.1', 0), Callback) as listener:
        listener.timeout = 1
        redirect = f'http://127.0.0.1:{listener.server_port}/'
        query = urlencode({'client_id': config['client_id'], 'redirect_uri': redirect,
                           'response_type': 'code', 'scope': SCOPE, 'access_type': 'offline',
                           'prompt': 'consent select_account', 'state': state,
                           'code_challenge': challenge, 'code_challenge_method': 'S256'})
        if not webbrowser.open('https://accounts.google.com/o/oauth2/v2/auth?' + query):
            raise CalendarError('Firefox could not open Google sign-in. Check your default browser.', 'setup')
        until = time.monotonic() + 120
        while not result and time.monotonic() < until:
            listener.handle_request()
    if 'code' not in result:
        raise CalendarError('Google connection was cancelled or timed out.', 'cancelled')
    fresh = request_json(TOKEN, form={**config, 'code': result['code'], 'code_verifier': verifier,
                                     'grant_type': 'authorization_code', 'redirect_uri': redirect})
    if SCOPE not in fresh.get('scope', '').split():
        raise CalendarError('Google Calendar event permission was not granted.', 'denied')
    saved = token_data({'connection': str(uuid4()), 'client_id': config['client_id']}, fresh)
    if not saved.get('refresh_token'):
        raise CalendarError('Google did not grant refresh access. Reconnect and review the consent screen.')
    write_private(SESSION, saved)
    return status(saved)


def status(saved):
    if not saved:
        return {'connected': False}
    return {'connected': True, 'connection': saved['connection'], 'calendar': 'Primary Google calendar'}


def authenticate(saved, force=False):
    if not saved:
        raise CalendarError('Connect Google Calendar from Settings first.', 'reconnect')
    config = credentials()
    if config['client_id'] != saved['client_id']:
        raise CalendarError('Your Google OAuth configuration changed. Reconnect in Settings.', 'reconnect')
    if not force and saved['expires'] > time.time() + 60:
        return saved
    fresh = request_json(TOKEN, form={**config, 'grant_type': 'refresh_token',
                                     'refresh_token': saved['refresh_token']})
    if 'scope' in fresh and SCOPE not in fresh['scope'].split():
        raise CalendarError('Google Calendar event permission was revoked.', 'reconnect')
    updated = token_data(saved, fresh)
    write_private(SESSION, updated)
    return updated


def calendar_call(saved, url, body=None):
    session = authenticate(saved)
    try:
        return request_json(url, body=body, token=session['access_token'])
    except CalendarError as err:
        if err.status != 401:
            raise
        session = authenticate(session, force=True)
        return request_json(url, body=body, token=session['access_token'])


def event_view(entry):
    def bound(key):
        value = entry.get(key, {})
        return {k: value[k] for k in ('date', 'dateTime') if isinstance(value.get(k), str)}
    return {'title': (entry.get('summary') or 'Busy')[:250], 'start': bound('start'),
            'end': bound('end'), 'link': entry.get('htmlLink', '')}


def upcoming(saved):
    now = datetime.now(UTC).replace(microsecond=0)
    params = {'timeMin': now.isoformat(), 'timeMax': (now + timedelta(days=7)).isoformat(),
              'singleEvents': 'true', 'orderBy': 'startTime', 'maxResults': 25,
              'fields': 'nextPageToken,items(summary,start,end,status,htmlLink)'}
    rows = []
    has_more = False
    for _ in range(4):
        batch = calendar_call(saved, EVENTS + '?' + urlencode(params))
        rows.extend(event_view(entry) for entry in batch.get('items', []) if entry.get('status') != 'cancelled')
        page = batch.get('nextPageToken')
        has_more = bool(page)
        if not page:
            break
        params['pageToken'] = page
    return {**status(saved), 'events': rows, 'hasMore': has_more}


def event_time(value):
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if not parsed.tzinfo:
        raise ValueError
    return parsed


def create(saved, event):
    if not saved or not isinstance(event, dict) or saved['connection'] != event.get('connection'):
        raise CalendarError('Connection changed. Reopen the event form after reconnecting.', 'reconnect')
    try:
        operation = UUID(event.get('operation', ''), version=None)
        title = event['title'].strip()
        start, end = event_time(event['start']), event_time(event['end'])
        if not 1 <= len(title) <= 200 or not timedelta(0) < end-start <= timedelta(days=1):
            raise ValueError
    except (AttributeError, KeyError, ValueError, TypeError):
        raise CalendarError('Check the event title, start time, and duration.', 'validation') from None
    event_id = operation.hex
    marker = hashlib.sha256(f'{saved["connection"]}|{event_id}|{title}|{start.isoformat()}|{end.isoformat()}'.encode()).hexdigest()
    body = {'id': event_id, 'summary': title, 'start': {'dateTime': start.isoformat()},
            'end': {'dateTime': end.isoformat()}, 'extendedProperties': {'private': {'purrpleOp': marker}}}
    try:
        created = calendar_call(saved, EVENTS, body)
    except CalendarError as err:
        if err.status != 409 and err.code != 'retry':
            raise
        if err.code == 'retry':
            message = 'Google may have saved this event. Retry this same draft to verify it.'
        else:
            message = 'An existing event could not be verified. Retry this same draft.'
        try:
            created = calendar_call(saved, EVENTS + '/' + quote(event_id, safe=''))
        except CalendarError:
            raise CalendarError(message, 'retry') from None
        if created.get('extendedProperties', {}).get('private', {}).get('purrpleOp') != marker:
            raise CalendarError('The existing event does not match this draft. Check Google Calendar before creating another event.', 'conflict') from None
    return {'event': event_view(created)}


def dispatch(message):
    if not isinstance(message, dict):
        raise CalendarError('Unknown Calendar request.')
    operation = message.get('operation')
    if operation == 'connect':
        previous = read_json(SESSION)
        if previous:
            raise CalendarError('Disconnect the existing account before connecting a different one.')
        return connect()
    saved = read_json(SESSION)
    if operation == 'status':
        credentials()
        return status(saved)
    if operation == 'disconnect':
        revoked = True
        if saved:
            SESSION.unlink(missing_ok=True)
            try:
                request_json('https://oauth2.googleapis.com/revoke', form={'token': saved['refresh_token']})
            except CalendarError:
                revoked = False
        return {'connected': False, 'revoked': revoked}
    if operation == 'list':
        return upcoming(saved)
    if operation == 'create':
        return create(saved, message.get('event'))
    raise CalendarError('Unknown Calendar request.')


def main():
    try:
        header = sys.stdin.buffer.read(4)
        if len(header) != 4:
            return
        length = struct.unpack('=I', header)[0]
        if length > LIMIT:
            raise CalendarError('Calendar request exceeds its size limit.')
        message = json.loads(sys.stdin.buffer.read(length))
        reply = {'ok': True, **dispatch(message)}
    except CalendarError as err:
        reply = {'ok': False, 'error': str(err), 'code': err.code}
    except (ValueError, OSError, KeyError, TypeError):
        reply = {'ok': False, 'error': 'Calendar could not use its local setup or Google returned an unexpected reply.', 'code': 'error'}
    encoded = json.dumps(reply).encode()
    sys.stdout.buffer.write(struct.pack('=I', len(encoded)) + encoded)
    sys.stdout.buffer.flush()


if __name__ == '__main__':
    main()
