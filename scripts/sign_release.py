#!/usr/bin/env python3
"""Prepare the built Firefox ZIP for the owner's existing Mozilla add-on entry."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

from build_release import ARCHIVES, GECKO_ID, ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lint', action='store_true',
                        help='Run Mozilla web-ext lint against the extracted Firefox runtime ZIP.')
    parser.add_argument('--zip', type=Path, default=ROOT / 'dist' / ARCHIVES['firefox'],
                        help='Firefox runtime ZIP produced by build_release.py.')
    args = parser.parse_args()
    if not args.zip.is_file():
        raise SystemExit('Build the Firefox runtime ZIP with scripts/build_release.py first.')
    with zipfile.ZipFile(args.zip) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('browser_specific_settings', {}).get('gecko', {}).get('id') != GECKO_ID:
            raise SystemExit('Firefox release ZIP does not preserve the Purrple Gecko ID.')
        if damaged := archive.testzip():
            raise SystemExit(f'The Firefox ZIP contains a damaged file: {damaged}')
        print(f'Purrple {manifest["version"]} · {GECKO_ID}')
        print('Use the existing Mozilla Add-ons developer entry and its current distribution channel.')
        print('Select the built Firefox runtime ZIP when Mozilla asks for the update package.')
        print('See docs/MOZILLA-SIGNING.md for the signed update workflow.')
        if args.lint:
            if not (tool := shutil.which('web-ext')):
                raise SystemExit('Install Mozilla web-ext or put its executable on PATH to run local lint.')
            with tempfile.TemporaryDirectory(prefix='purrple-firefox-lint-') as dest:
                archive.extractall(dest)
                result = subprocess.run([tool, 'lint', '--source-dir', dest], check=False)
                raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
