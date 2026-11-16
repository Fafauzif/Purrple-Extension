#!/usr/bin/env python3
"""Register the optional Calendar host for this OS user only."""
import argparse
import json
import os
from pathlib import Path
import shlex
import shutil
import sys

from calendar_host import CLIENT, EXTENSION_ID, HOME, NAME, SESSION, credentials


def manifest_path():
    if os.name == 'nt':
        return HOME / (NAME + '.json')
    if sys.platform == 'darwin':
        return Path.home() / 'Library' / 'Application Support' / 'Mozilla' / 'NativeMessagingHosts' / (NAME + '.json')
    return Path.home() / '.mozilla' / 'native-messaging-hosts' / (NAME + '.json')


def registry(path):
    if os.name != 'nt':
        return
    import winreg
    key = r"Software\Mozilla\NativeMessagingHosts" + chr(92) + NAME
    if path is None:
        try:
            winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key)
        except FileNotFoundError:
            pass
        return
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key) as entry:
        winreg.SetValueEx(entry, '', 0, winreg.REG_SZ, str(path))


def install(oauth):
    HOME.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name != 'nt':
        HOME.chmod(0o700)
    data = json.loads(oauth.read_text(encoding='utf-8-sig'))
    if not isinstance(data.get('installed'), dict) or not str(data['installed'].get('client_id', '')).endswith('.apps.googleusercontent.com'):
        raise SystemExit('Select the JSON downloaded for a Google OAuth Desktop app client.')
    if SESSION.exists():
        raise SystemExit('Disconnect Google Calendar before replacing its OAuth configuration.')
    from calendar_host import write_private
    write_private(CLIENT, data)
    credentials()
    host = HOME / 'calendar_host.py'
    shutil.copyfile(Path(__file__).with_name('calendar_host.py'), host)
    python = str(Path(sys.executable).resolve())
    if os.name == 'nt':
        launcher = HOME / 'calendar_host.bat'
        launcher.write_text(f'@echo off\n"{python.replace("%", "%%")}" "%~dp0calendar_host.py"\n', encoding='utf-8')
    else:
        launcher = HOME / 'calendar_host.sh'
        launcher.write_text(f'#!/bin/sh\nexec {shlex.quote(python)} {shlex.quote(str(host))}\n', encoding='utf-8')
        launcher.chmod(0o700)
    path = manifest_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'name': NAME, 'description': 'Purrple Google Calendar',
                                'path': str(launcher), 'type': 'stdio',
                                'allowed_extensions': [EXTENSION_ID]}, indent=2), encoding='utf-8')
    registry(path)
    print('Calendar helper installed. Open Purrple Settings and choose Connect Google Calendar.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    setup = commands.add_parser('install')
    setup.add_argument('google_oauth_json', type=Path)
    commands.add_parser('uninstall')
    args = parser.parse_args()
    if args.command == 'install':
        install(args.google_oauth_json)
        return
    registry(None)
    manifest_path().unlink(missing_ok=True)
    for name in ('desktop-oauth.json', 'connection.json', 'calendar_host.py', 'calendar_host.sh', 'calendar_host.bat'):
        (HOME / name).unlink(missing_ok=True)
    print('Calendar helper removed. Revoke app access from your Google Account if it was not disconnected.')


if __name__ == '__main__':
    main()
