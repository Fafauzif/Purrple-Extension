#!/usr/bin/env python3
"""Native Firefox regression checks for the dock and optional Calendar surface."""
import contextlib
import http.server
import json
from pathlib import Path
import stat
import sys
import tempfile
import threading
import time
import zipfile

import firefox_native as native

ROOT = Path(__file__).resolve().parents[1]
SHADOW = 'shadow-6066-11e4-a52e-4f735466cecf'


@contextlib.contextmanager
def fixture():
    """Register an isolated fixture for Firefox on Linux and remove it afterward."""
    directory = Path.home() / '.mozilla' / 'native-messaging-hosts'
    path = directory / 'purrple_calendar.json'
    if not sys.platform.startswith('linux') or path.exists():
        yield False
        return
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='purrple-fixture-') as temp:
        helper = Path(temp) / 'purrple-calendar-fixture'
        helper.write_text(f'#!{sys.executable}\n' + """
import json, struct, sys
size, = struct.unpack('=I', sys.stdin.buffer.read(4))
data = json.loads(sys.stdin.buffer.read(size))
operation = data['operation']
reply = {'ok': True, 'connected': True, 'connection': 'test-only', 'calendar': 'Primary Google calendar'}
if operation == 'list':
    reply['events'] = [{'title': '<b>All day</b>', 'start': {'date': '2026-11-19'}, 'end': {'date': '2026-11-20'}}]
if operation == 'create':
    event = data['event']
    reply['event'] = {'title': event['title'], 'link': 'https://calendar.google.com/calendar/event?eid=fixture'}
if operation == 'disconnect':
    reply = {'ok': True, 'connected': False, 'revoked': True}
out = json.dumps(reply).encode()
sys.stdout.buffer.write(struct.pack('=I', len(out)) + out)
""")
        helper.chmod(stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
        with path.open('x') as file:
            json.dump({'name': 'purrple_calendar', 'description': 'Temporary Calendar test fixture',
                       'path': str(helper), 'type': 'stdio',
                       'allowed_extensions': ['purrple-companion@purrple.local']}, file)
        try:
            yield True
        finally:
            path.unlink(missing_ok=True)


def run(d, url, fixture_ready):
    d.command('/moz/context', {'context':'chrome'})
    uuid = d.js("window.SidebarController.hide(); return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local']")
    d.command('/moz/context', {'context':'content'})
    home = f'moz-extension://{uuid}/app.html'
    d.navigate(url)
    active = "return document.querySelector('purrple-companion')?.dataset.active==='true'"
    d.wait(active, timeout=35)

    def element(selector):
        host = d.command('/element', {'using':'css selector','value':'purrple-companion'})
        shadow = d.command('/element/'+host[native.ELEMENT]+'/shadow', method='GET')[SHADOW]
        return d.command('/shadow/'+shadow+'/element', {'using':'css selector','value':selector})

    def house():
        return d.js("const b=arguments[0].getBoundingClientRect();return{x:b.left,y:b.top,w:b.width,h:b.height,view:innerWidth}", element('.house'))

    initial = house()
    assert initial['x'] > initial['view'] / 2, initial
    x, y = round(initial['x'] + 26), round(initial['y'] + 24)
    steps = [{'type':'pointerMove','duration':0,'x':x,'y':y},
             {'type':'pointerDown','button':0},
             {'type':'pointerMove','duration':400,'x':38,'y':150},
             {'type':'pointerUp','button':0}]
    d.command('/actions', {'actions':[{'type':'pointer','id':'mouse','parameters':{'pointerType':'mouse'},'actions':steps}]})
    assert house()['x'] < 50, house()
    assert d.js("return document.querySelector('purrple-companion').dataset.atHome")=='false'
    print('PASS native house drag moves it and does not send Purrple home',flush=True)
    d.navigate(url+'next')
    d.wait(active, timeout=30)
    moved = house()
    assert moved['x'] < 50 and moved['y'] < initial['y'] - 50, moved
    print('PASS dock position persists across navigation and a new document',flush=True)

    d.navigate(home+'#settings')
    d.wait("return !document.querySelector('#calendar-settings').hidden")
    d.click('#reset-layout')
    d.wait("return document.querySelector('#toast').textContent.includes('positions were reset')")
    print('PASS Firefox settings can reset the saved layout',flush=True)
    if fixture_ready:
        def allow_prompt():
            d.command('/moz/context', {'context':'chrome'})
            try:
                return d.wait("""
                  const panel=document.getElementById('notification-popup');
                  const notification=panel?.querySelector('popupnotification:not([hidden])');
                  if(!notification?.button || panel.state!=='open') return false;
                  notification.button.click();
                  return true;
                """,timeout=5)
            finally:
                d.command('/moz/context', {'context':'content'})

        if d.js("return !document.querySelector('#calendar-consent').hidden"):
            d.click('#calendar-consent')
            allow_prompt()
            d.wait("return document.querySelector('#calendar-consent').hidden")
        d.click('#calendar-connect')
        try:
            allow_prompt()
        except AssertionError:
            # The native permission can be granted silently in some test profiles.
            pass
        d.wait("return !document.querySelector('#calendar-disconnect').hidden")
        d.click('[data-view=today]')
        d.wait("return document.querySelector('#calendar-events').textContent.includes('<b>All day</b>')")
        assert d.js("return !document.querySelector('#calendar-events b')")
        assert d.action('TASK_ADD', title='Native Calendar task fixture')['ok']
        d.click('[data-action=calendar-task]')
        assert d.js("return document.querySelector('#calendar-title').value")=='Native Calendar task fixture'
        d.js("document.querySelector('#calendar-start').value='2026-11-25T16:00'")
        d.click('#calendar-create')
        d.wait("return document.querySelector('#calendar-form-status').textContent.includes('Event saved')")
        d.click('#calendar-cancel')
        d.click('[data-view=focus]')
        d.click('#calendar-focus')
        d.js("document.querySelector('#calendar-start').value='2026-11-26T16:00'")
        d.click('#calendar-create')
        d.wait("return document.querySelector('#calendar-form-status').textContent.includes('Event saved')")
        assert not d.state()['focus']
        assert d.state()['wallet']['balance'] == 0
        assert not any('Calendar' in key for key in d.state())
        d.click('#calendar-cancel')
        d.click('[data-view=settings]')
        d.click('#calendar-disconnect')
        d.wait("return document.querySelector('#calendar-disconnect').hidden")
        print('PASS real Firefox native messaging with a fake provider: agenda, event creation, disconnect',flush=True)
    else:
        print('SKIP native Calendar fixture: Linux with no existing registration is required',flush=True)
    d.navigate(url+'reset')
    d.wait(active, timeout=30)
    assert house()['x'] > house()['view'] / 2
    print('PASS dock returns to the initial placement',flush=True)
    d.navigate(home)
    d.wait("return !document.querySelector('#main').hidden")
    assert d.action('SETTINGS',patch={'chattiness':'chatty','reducedMotion':True})['ok']
    d.navigate(url+'remark')
    d.wait(active, timeout=20)
    until = time.monotonic() + 42
    while time.monotonic() < until:
        if d.js("return !arguments[0].hidden && arguments[0].querySelector('p').textContent", element('.speech')):
            print('PASS Chatty emits an authored remark in the installed extension',flush=True)
            break
        time.sleep(1)
    else:
        raise AssertionError('No native ambient remark appeared in a Chatty session.')


def main():
    with fixture() as fixture_ready, tempfile.TemporaryDirectory(prefix='purrple-revision-') as temp:
        native.OUT = Path(temp)
        install = Path(temp) / 'runtime'
        with zipfile.ZipFile(ROOT/'dist/Purrple_Firefox_Extension.zip') as archive:
            archive.extractall(install)
        with http.server.ThreadingHTTPServer(('127.0.0.1', 0), native.QuietHandler) as server:
            threading.Thread(target=server.serve_forever, daemon=True).start()
            d = None
            try:
                d = native.Driver()
                d.command('/moz/addon/install', {'path':str(install),'temporary':True})
                run(d, f'http://127.0.0.1:{server.server_port}/', fixture_ready)
            finally:
                if d:
                    d.close()
                server.shutdown()


if __name__ =='__main__':
    main()
