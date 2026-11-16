#!/usr/bin/env python3
"""Verify both deliverables, including the source archive's offline rebuild.

Run after scripts/build_release.py. Uses only Python's standard library.
Private review material and local browser profiles must never enter either ZIP.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
checks = []


def check(name, passed, detail=None):
    checks.append(dict(name=name, passed=bool(passed), detail=detail))
    if not passed:
        raise AssertionError(name + ': ' + str(detail))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    runtime = DIST / 'Purrple_Firefox_Extension.zip'
    source = DIST / 'Purrple_Complete_Source.zip'
    with zipfile.ZipFile(runtime) as rz, zipfile.ZipFile(source) as sz:
        rn, sn = rz.namelist(), sz.namelist()
        for name, archive in [('runtime', rz), ('source', sz)]:
            check(name + '-zip-crc', archive.testzip() is None)
            check(name + '-safe-relative-paths', all(
                not PurePosixPath(n).is_absolute() and '..' not in PurePosixPath(n).parts
                for n in archive.namelist()))
            check(name + '-excludes-local-and-private-material', all(
                not ({'qa-runtime', 'privateverification', 'node_modules', '.git'} & set(PurePosixPath(n).parts))
                and not n.startswith('verification/review/')
                for n in archive.namelist()))
        check('runtime-manifest-at-root', 'manifest.json' in rn)
        check('source-repository-root-layout', all(n in sn for n in [
            'README.md', 'AGENTS.md', 'CONTEXT.md', 'extension/manifest.json',
            'scripts/build_release.py', 'art/README.md']))
        check('no-extra-source-wrapper-folder', not any(n.startswith('Purrple/') for n in sn))
        check('internal-browser-captures-not-shipped', not any(
            n.startswith('verification/') and PurePosixPath(n).suffix.lower() in
            {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.webm', '.mp4', '.pdf'} for n in sn))
        manifest = json.loads(rz.read('manifest.json'))
        check('stable-addon-identity', manifest['browser_specific_settings']['gecko']['id'] == 'purrple-companion@purrple.local')
        check('runtime-matches-source-archive', all(
            'extension/' + n in sn and rz.read(n) == sz.read('extension/' + n) for n in rn))
        check('cute-installation-guide-in-both-deliverables', all(
            b'I love you' in archive.read(name)
            for archive, name in [(rz, 'INSTALL-PURRPLE.html'), (sz, 'INSTALL-PURRPLE.html')]))
        check('motion-explorer-shipped', 'animations.html' in rn)
        check('original-refinement-art-and-reproduction-sources-shipped', all(n in sn for n in [
            'art/refinement-source/locomotion-original.png',
            'art/refinement-source/brush-only-original.png',
            'art/prepare_refinements.py', 'art/prepare_refinements_supplement.py',
            'art/measure_motion_anchors.py', 'art/merge_renderer_data.py']))
        with tempfile.TemporaryDirectory(prefix='purrple-source-rebuild-') as temp:
            dest = Path(temp)
            sz.extractall(dest)
            # A Desktop OAuth download could end up beside the sources by mistake.
            fixtures = ['client_secret.local-test.json','tools/calendar/client_secret.local-test.json',
                        'extension/client_secret.local-test.json','extension/assets/local-token.json']
            for name in fixtures:
                (dest / name).write_text('{"only_test_data":true}')
            run = subprocess.run([sys.executable, 'scripts/build_release.py'], cwd=dest,
                                 text=True, capture_output=True)
            check('extracted-source-builds-offline', run.returncode == 0, run.stderr[-1200:])
            built = dest / 'dist/Purrple_Firefox_Extension.zip'
            with zipfile.ZipFile(dest / 'dist/Purrple_Complete_Source.zip') as guarded_source:
                check('local-oauth-json-is-not-packaged', all(n not in guarded_source.namelist() for n in fixtures))

            check('extracted-source-reproduces-runtime-byte-for-byte',
                  built.read_bytes() == runtime.read_bytes())
    report = dict(version=manifest['version'], runtime_sha256=digest(runtime.read_bytes()),
                  source_sha256=digest(source.read_bytes()), passed=len(checks), failed=0,
                  scope='Archive CRC, privacy/root layout, source/runtime parity and offline source rebuild.',
                  checks=checks)
    out = ROOT / 'verification/review/release-integrity.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'checks'}, indent=2))


if __name__ == '__main__':
    main()
