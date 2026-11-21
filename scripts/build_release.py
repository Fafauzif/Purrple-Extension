#!/usr/bin/env python3
"""Build the three Purrple release archives offline from one source tree."""

import argparse
import fnmatch
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import posixpath
import re
from struct import unpack
import tempfile
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / 'extension'
GECKO_ID = 'purrple-companion@purrple.local'
ARCHIVES = {
    'source': 'Purrple_Complete_Source.zip',
    'firefox': 'Purrple_Firefox_Extension.zip',
    'chromium': 'Purrple_Chromium_Extension.zip',
}
RUNTIME_PAGES = {'app.html', 'popup.html', 'game.html', 'animations.html', 'START_HERE.html',
                 'INSTALL-PURRPLE.html', 'CALENDAR-SETUP.html', 'manifest.json'}
RUNTIME_DATA = {'assets/atlas-manifest.json', 'assets/refinement/manifest.json',
                'assets/refinement/supplemental-manifest.json'}
ASSET_DIRS = {'assets', 'assets/atlases', 'assets/fonts', 'assets/games', 'assets/refinement',
              'assets/wardrobe', 'assets/wardrobe/thumbs', 'assets/wardrobe/decor'}
ASSET_TYPES = {'.png', '.webp', '.svg', '.ttf', '.woff2', '.txt'}
ART_DATA = {'pose-registration.json', 'sprite-registration.json', 'renderer-base.json', 'renderer-motion-anchors.json',
            'wardrobe-data.json', 'neckwear-fit.json', 'refinement-source/prompts.json',
            'refinement-source/supplemental-prompts.json',
            'refinement-source/registration-report.json',
            'refinement-source/supplemental-registration-report.json'}
ROOT_FILES = {'AGENTS.md', 'ARCHITECTURE.md', 'CONTEXT.md', 'DESIGN.md', '.gitattributes',
              '.gitignore', 'PRODUCT.md', 'README.md', 'UX-CONTRACT.md', 'VERIFICATION.md',
              'package.json', 'package-lock.json', 'premium-ui.json'}
SAFE_SOURCE_TYPES = {
    'art': {'.md', '.py', '.cjs', '.js', '.png', '.webp', '.svg', '.html', '.txt'},
    'docs': {'.md'},
    'scripts': {'.py'},
    'tests': {'.py', '.cjs', '.js', '.mjs', '.html'},
}
PRIVATE_PREFIXES = {'__pycache__', 'profiles', 'node_modules', 'qa-runtime', 'draft',
                    'drafts', 'privateverification', 'generated_images', 'verification'}
SECRET_NAME = re.compile(r'(?:^|[-_.])(?:client[_-]?secret|credentials?|tokens?)(?:[-_.]|$)', re.I)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode('utf-8')


def write_archive(path, entries):
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=7)
    with zipfile.ZipFile(path) as archive:
        damaged = archive.testzip()
        if damaged:
            raise ValueError(f'{path.name} has a damaged entry: {damaged}')


def admissible(path):
    return (path.is_file() and not path.is_symlink() and
            not SECRET_NAME.search(path.name) and
            all(not part.startswith('.') and part not in PRIVATE_PREFIXES
                for part in path.relative_to(ROOT).parts))


def runtime_paths():
    for path in sorted(EXT.rglob('*')):
        if not admissible(path):
            continue
        name = path.relative_to(EXT).as_posix()
        parent = posixpath.dirname(name)
        if (name in RUNTIME_PAGES or name in RUNTIME_DATA or
                parent == 'js' and path.suffix == '.js' or
                parent == 'css' and path.suffix == '.css' or
                parent in ASSET_DIRS and path.suffix in ASSET_TYPES):
            yield name, path


def source_entries(runtime):
    guide = runtime['INSTALL-PURRPLE.html'].decode('utf-8')
    guide = (guide.replace('src="assets/', 'src="extension/assets/')
             .replace('href="assets/', 'href="extension/assets/')
             .replace("url('assets/", "url('extension/assets/"))
    entries = {'INSTALL-PURRPLE.html': guide.encode('utf-8')}
    for name in sorted(ROOT_FILES | {'art/' + name for name in ART_DATA}):
        path = ROOT / name
        if path.is_file() and not path.is_symlink():
            entries[name] = path.read_bytes()
    for folder, suffixes in SAFE_SOURCE_TYPES.items():
        for path in sorted((ROOT / folder).rglob('*')):
            if admissible(path) and path.suffix in suffixes:
                entries[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    for path in sorted((ROOT / 'tools/calendar').glob('*.py')):
        if admissible(path):
            entries[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    entries.update({'extension/' + name: data for name, data in runtime.items()})
    return entries


def chromium_manifest(firefox):
    manifest = {key: value for key, value in firefox.items()
                if key not in {'browser_specific_settings', 'sidebar_action', 'optional_permissions'}}
    manifest['background'] = {'service_worker': 'js/worker.js'}
    manifest['permissions'] = [*firefox['permissions'], 'sidePanel']
    manifest['side_panel'] = {'default_path': firefox['sidebar_action']['default_panel']}
    manifest['minimum_chrome_version'] = '116'
    return manifest


class PageReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        properties = dict(attrs)
        if tag in {'script', 'img', 'source', 'video', 'audio', 'iframe'}:
            self.paths.append((properties.get('src'), tag == 'script'))
        elif tag in {'link', 'a'}:
            self.paths.append((properties.get('href'), False))


def check_reference(entries, source, target, *, executable=False):
    if not target:
        return
    path = urlsplit(target)
    if path.scheme == 'data' and not executable:
        return
    if path.scheme or path.netloc:
        if executable:
            raise ValueError(f'{source} loads non-local code: {target}')
        return
    if not path.path:
        return
    if path.path.startswith('/'):
        name = path.path[1:]
    else:
        name = posixpath.normpath(posixpath.join(posixpath.dirname(source), path.path))
    if name not in entries:
        raise ValueError(f'{source} refers to a missing runtime file: {target}')


def check_runtime(entries, manifest):
    options = manifest['options_ui']
    action = manifest['action']
    files = {*manifest['icons'].values(), *action['default_icon'].values(),
             action['default_popup'], options['page']}
    background = manifest['background']
    files.update(background.get('scripts', []))
    worker = background.get('service_worker')
    if worker:
        files.add(worker)
    if 'sidebar_action' in manifest:
        sidebar = manifest['sidebar_action']
        files.update([sidebar['default_panel'], sidebar['default_icon']])
    if 'side_panel' in manifest:
        files.add(manifest['side_panel']['default_path'])
    for script in manifest['content_scripts']:
        files.update(script.get('js', []))
        files.update(script.get('css', []))
    for name in sorted(files):
        check_reference(entries, 'manifest.json', name)
    for block in manifest['web_accessible_resources']:
        for pattern in block['resources']:
            if not any(fnmatch.fnmatchcase(name, pattern) for name in entries):
                raise ValueError(f'manifest.json exposes an absent resource: {pattern}')
    for name, data in entries.items():
        if name.endswith('.html'):
            parser = PageReferences()
            parser.feed(data.decode('utf-8'))
            for target, executable in parser.paths:
                check_reference(entries, name, target, executable=executable)
        elif name.endswith('.css'):
            for match in re.finditer(r'url\(\s*["\']?([^"\'\s)]+)["\']?\s*\)', data.decode('utf-8')):
                check_reference(entries, name, match[1], executable=True)
        elif name.endswith('.js'):
            if re.search(rb'openrouter|api\.openai|runAI', data, re.I):
                raise ValueError(f'Unexpected external model reference in {name}')
    check_art(entries)


def check_art(entries):
    png_header = b'\x89PNG\r\n\x1a\n'
    dimensions = {}
    for name, data in entries.items():
        if name.endswith('.png'):
            if not (len(data) >= 33 and data.startswith(png_header) and data[12:16] == b'IHDR'
                    and data.endswith(b'IEND\xaeB`\x82')):
                raise ValueError(f'Invalid PNG file: {name}')
            width, height = unpack('>II', data[16:24])
            if not width or not height:
                raise ValueError(f'Empty PNG frame: {name}')
            dimensions[name] = (width, height)
    for name in sorted(RUNTIME_DATA):
        metadata = json.loads(entries[name])
        for sprite, frame_data in metadata.get('sprites', metadata).items():
            source = frame_data['src']
            frames = frame_data['frames']
            if source not in dimensions or not frames:
                raise ValueError(f'{name} defines a missing or empty sprite: {sprite}')
            width, height = dimensions[source]
            for frame in frames:
                x, y, w, h = (frame[key] for key in ('x', 'y', 'w', 'h'))
                if not (0 <= x < x + w <= width and 0 <= y < y + h <= height):
                    raise ValueError(f'{name} defines a frame outside {source}: {sprite}')


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--output', type=Path, default=ROOT / 'dist',
                     help='directory for the three archives and release.json')
    args = cli.parse_args()
    firefox = json.loads((EXT / 'manifest.json').read_bytes())
    package = json.loads((ROOT / 'package.json').read_bytes())
    lock = json.loads((ROOT / 'package-lock.json').read_bytes())
    version = firefox['version']
    if not version == package['version'] == lock['version'] == lock['packages']['']['version']:
        raise SystemExit('Manifest, package, and lockfile versions must match.')
    if firefox.get('browser_specific_settings', {}).get('gecko', {}).get('id') != GECKO_ID:
        raise SystemExit('The stable Firefox extension identity must be preserved.')

    runtime = {name: path.read_bytes() for name, path in runtime_paths()}
    chromium = chromium_manifest(firefox)
    sources = [f'js/{name}' for name in re.findall(r"'([^']+\.js)'", runtime['js/worker.js'].decode('utf-8'))]
    if sources != firefox['background']['scripts']:
        raise SystemExit('Chromium worker and Firefox event page must load the same scripts in order.')
    firefox_files = {name: data for name, data in runtime.items() if name != 'js/worker.js'}
    chromium_files = {**runtime, 'manifest.json': json_bytes(chromium)}
    check_runtime(firefox_files, firefox)
    check_runtime(chromium_files, chromium)
    source_files = source_entries(runtime)

    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    result = {'version': version, 'artifacts': {}, 'gecko_id': GECKO_ID,
              'signing_status': 'unsigned Firefox ZIP for temporary testing or owner submission'}
    bundles = {'source': source_files, 'firefox': firefox_files, 'chromium': chromium_files}
    with tempfile.TemporaryDirectory(prefix='purrple-release-', dir=output) as temp:
        staging = Path(temp)
        for target, entries in bundles.items():
            name = ARCHIVES[target]
            path = staging / name
            write_archive(path, entries)
            result['artifacts'][target] = {
                'filename': name, 'bytes': path.stat().st_size,
                'sha256': digest(path.read_bytes()), 'entries': len(entries),
            }
            if target != 'source':
                result['artifacts'][target]['entry_sha256'] = {
                    name: digest(data) for name, data in sorted(entries.items())
                }
        (staging / 'release.json').write_bytes(json_bytes(result))
        for name in (*ARCHIVES.values(), 'release.json'):
            (staging / name).replace(output / name)
    print(json.dumps({**result, 'artifacts': {target: {k: v for k, v in record.items()
          if k != 'entry_sha256'} for target, record in result['artifacts'].items()}}, indent=2))


if __name__ == '__main__':
    main()
