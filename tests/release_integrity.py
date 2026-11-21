#!/usr/bin/env python3
"""Validate the exact three release archives and rebuild the runtime ZIPs offline."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILENAMES = {
    'source': 'Purrple_Complete_Source.zip',
    'firefox': 'Purrple_Firefox_Extension.zip',
    'chromium': 'Purrple_Chromium_Extension.zip',
}
TARGETS = ('firefox', 'chromium')
PRIVATE = {'qa-runtime', 'privateverification', 'profiles', 'node_modules', '.git',
           'drafts', 'generated_images', 'verification'}


def check(results, name, passed, detail=None):
    results.append(dict(name=name, passed=bool(passed), detail=detail))
    if not passed:
        raise AssertionError(f'{name}: {detail}')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_archive(path, target, results):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        check(results, f'{target}-zip-crc', archive.testzip() is None)
        check(results, f'{target}-unique-safe-paths', len(set(names)) == len(names) and all(
            not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts
            and '\\' not in name for name in names))
        check(results, f'{target}-excludes-private-material', all(
            not (PRIVATE & set(PurePosixPath(name).parts)) and
            not PurePosixPath(name).name.lower().startswith(('client_secret', 'oauth_token'))
            for name in names))
        return {name: archive.read(name) for name in names}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
    parser.add_argument('--report', type=Path, default=ROOT / 'verification/review/release-integrity.json')
    args = parser.parse_args()
    checks = []
    files = {target: args.dist / filename for target, filename in FILENAMES.items()}
    archives = {target: read_archive(path, target, checks) for target, path in files.items()}
    source = archives['source']
    major_minor = '.'.join(json.loads(source['extension/manifest.json'])['version'].split('.')[:2])
    install_guide = f'docs/INSTALL-{major_minor}.md'
    check(checks, 'exactly-three-release-archives',
          {path.name for path in args.dist.glob('*.zip')} == set(FILENAMES.values()))
    needed = {'README.md', 'AGENTS.md', 'CONTEXT.md', 'extension/manifest.json',
              'scripts/build_release.py', 'art/README.md', 'package-lock.json',
              install_guide, 'tools/calendar/calendar_host.py',
              'art/refinement-source/locomotion-original.png',
              'art/refinement-source/brush-only-original.png',
              'art/prepare_refinements.py', 'art/prepare_refinements_supplement.py',
              'art/measure_motion_anchors.py', 'art/merge_renderer_data.py'}
    check(checks, 'source-repository-root-and-art-reproduction', needed <= set(source), sorted(needed - set(source)))
    check(checks, 'install-guide-in-source', b'I love you' in source['INSTALL-PURRPLE.html'])

    manifests = {}
    for target in TARGETS:
        runtime = archives[target]
        check(checks, f'{target}-manifest-at-root', 'manifest.json' in runtime)
        manifests[target] = json.loads(runtime['manifest.json'])
        check(checks, f'{target}-files-match-source', all(
            data == source['extension/' + name] for name, data in runtime.items()
            if name != 'manifest.json'))
        check(checks, f'{target}-guide-and-motion-explorer',
              b'I love you' in runtime['INSTALL-PURRPLE.html'] and 'animations.html' in runtime)
    firefox, chromium = (manifests[target] for target in TARGETS)
    gecko = firefox['browser_specific_settings']['gecko']
    check(checks, 'stable-firefox-id-and-consent', gecko['id'] == 'purrple-companion@purrple.local'
          and gecko['data_collection_permissions']['required'] == ['none']
          and firefox['optional_permissions'] == ['nativeMessaging'])
    check(checks, 'firefox-manifest-matches-source',
          archives['firefox']['manifest.json'] == source['extension/manifest.json'])
    check(checks, 'firefox-background-and-sidebar', bool(firefox['background']['scripts'])
          and 'sidebar_action' in firefox and 'js/worker.js' not in archives['firefox'])
    check(checks, 'chromium-worker-and-side-panel', chromium['background'] == {'service_worker': 'js/worker.js'}
          and chromium['side_panel']['default_path'] == firefox['sidebar_action']['default_panel']
          and 'sidePanel' in chromium['permissions'] and 'js/worker.js' in archives['chromium'])
    check(checks, 'chromium-excludes-firefox-only-declarations',
          not ({'browser_specific_settings', 'sidebar_action', 'optional_permissions'} & set(chromium))
          and 'nativeMessaging' not in chromium['permissions'])
    check(checks, 'shared-runtime-parity',
          set(archives['chromium']) - set(archives['firefox']) == {'js/worker.js'}
          and all(archives['chromium'][name] == data for name, data in archives['firefox'].items()
                  if name != 'manifest.json'))
    version = firefox['version']
    check(checks, 'release-versions-match', version == chromium['version']
          == json.loads(source['package.json'])['version']
          == json.loads(source['package-lock.json'])['version'])
    guide_version = f'Purrple {major_minor}'.encode()
    check(checks, 'release-guide-versions-match', guide_version in source['README.md']
          and guide_version in source[install_guide]
          and all(guide_version in archives[target]['START_HERE.html'] for target in TARGETS))
    metadata = json.loads((args.dist / 'release.json').read_bytes())
    check(checks, 'metadata-version-matches', metadata['version'] == version)
    for target, path in files.items():
        record = metadata['artifacts'][target]
        check(checks, f'{target}-archive-size-sha-and-entry-count',
              record['filename'] == path.name and record['bytes'] == path.stat().st_size
              and record['sha256'] == digest(path.read_bytes()) and record['entries'] == len(archives[target]))
        if target in TARGETS:
            check(checks, f'{target}-entry-sha256', record['entry_sha256'] ==
                  {name: digest(data) for name, data in archives[target].items()})

    with tempfile.TemporaryDirectory(prefix='purrple-source-rebuild-') as temp:
        dest = Path(temp)
        with zipfile.ZipFile(files['source']) as archive:
            archive.extractall(dest)
        scratch_fixtures = ['client_secret.local-test.json',
                            'tools/calendar/client_secret.local-test.json',
                            'extension/client_secret.local-test.json',
                            'extension/assets/local-token.json', 'extension/assets/creds-token.png',
                            'extension/assets/wardrobe/drafts/private.png', 'art/drafts/unselected.png']
        for name in scratch_fixtures:
            path = dest / name
            path.parent.mkdir(exist_ok=True, parents=True)
            path.write_text('{"only_test_data":true}')
        run = subprocess.run([sys.executable, 'scripts/build_release.py'], cwd=dest,
                             text=True, capture_output=True)
        check(checks, 'extracted-source-builds-offline', run.returncode == 0, run.stderr[-1200:])
        for target, path in files.items():
            check(checks, f'{target}-byte-for-byte-from-source',
                  (dest / 'dist' / path.name).read_bytes() == path.read_bytes())

    report = dict(version=version, artifacts=metadata['artifacts'], passed=len(checks), failed=0,
                  scope='Archive CRC, path safety, privacy, manifests, SHA-256 and byte-for-byte offline rebuild.',
                  checks=checks)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('checks', 'artifacts')}, indent=2))


if __name__ == '__main__':
    main()
