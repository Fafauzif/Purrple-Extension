#!/usr/bin/env python3
"""Render the shared sprite compositor in official Firefox, optionally from the release ZIP."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests'))
import firefox_native as native


def verify_installed_wardrobe(d, base):
    d.navigate(base + 'app.html#wardrobe')
    d.wait("return !document.getElementById('view-wardrobe')?.hidden && !!globalThis.PurrpleRenderer?.assetsReady;")
    reduce_motion = d.action('SETTINGS', patch={'reducedMotion': True})
    assert reduce_motion.get('ok'), reduce_motion
    prize = d.js("""
        let save = PurrpleCore.defaultState();
        for (let index = 0; index < 3; index++) {
            const id = 'wardrobe-fit-fixture-' + index;
            save = PurrpleCore.reduce(save, {type:'TASK_ADD', id, title:'Synthetic wardrobe funding', effort:'large'});
            save = PurrpleCore.reduce(save, {type:'TASK_SET_DONE', id, done:true});
        }
        return save;
    """)
    prize['settings']['reducedMotion'] = True
    added = d.action('BACKUP_IMPORT', backup=prize)
    assert added.get('ok'), added
    glasses = 'round-moon-glasses'
    select = f'[data-action="preview-item"][data-id="{glasses}"]'
    canvas = "document.getElementById('wardrobe-canvas')"
    d.wait(f"return {canvas}.getContext('2d').getImageData(100,150,250,120).data.some(pixel => pixel);" )
    before = d.js(f'return {canvas}.toDataURL();')
    d.click(select)
    d.wait(f'return {canvas}.toDataURL() !== arguments[0];'.replace('arguments[0]', json.dumps(before)))
    assert not d.state()['equipped'].get('face'), 'Trying an item changed the permanent face slot.'
    d.click(f'[data-action="buy-item"][data-id="{glasses}"]')
    wear = f'[data-action="equip-item"][data-id="{glasses}"]'
    d.wait(f"return !!document.querySelector({json.dumps(wear)});")
    d.click(wear)
    d.wait("return document.querySelector('#outfit-slots')?.textContent.includes('Round moon glasses');")
    assert d.state()['equipped']['face'] == glasses
    d.screenshot('installed-wardrobe.png')
    d.navigate(base + 'popup.html')
    d.wait("return !!globalThis.PurrpleRenderer?.assetsReady;")
    d.click('[data-compact-view="wardrobe"]')
    d.wait("return document.querySelector('#compact-worn-items')?.textContent.includes('Round moon glasses');")
    assert d.state()['equipped']['face'] == glasses
    d.screenshot('installed-compact-wardrobe.png')
    d.navigate(base + 'app.html#companion')
    d.wait("return !document.getElementById('view-companion')?.hidden;")
    d.screenshot('installed-companion-entry.png')
    return ['Canvas changed during dashboard preview', 'Trying on left saved slot empty',
            'Dashboard buy and wear persisted across views', 'Compact view showed equipped face slot']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', type=Path, help='Exact release ZIP to temporary install and test')
    parser.add_argument('--thumbnails', action='store_true')
    parser.add_argument('--preview-only', action='store_true')
    parser.add_argument('--surface-checks', action='store_true', help='Also exercise preview, purchase and wardrobe state in a disposable packaged profile.')
    args = parser.parse_args()
    out = Path(os.environ.get('PURRPLE_FIT_OUTPUT', ROOT / 'verification/wardrobe-v2')).resolve()
    out.mkdir(parents=True, exist_ok=True)
    native.OUT = out
    d = native.Driver()
    try:
        if args.package:
            artwork = args.package.resolve()
            addon = d.command('/moz/addon/install', {'path': str(artwork), 'temporary': True})
            assert addon == 'purrple-companion@purrple.local', addon
            d.command('/moz/context', {'context': 'chrome'})
            uid = d.js("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
            d.command('/moz/context', {'context': 'content'})
            base = f'moz-extension://{uid}/'
            d.navigate(base + 'app.html')
            d.wait('return !!globalThis.PurrpleWardrobeV2', timeout=30)
            preload = d.async_js("const done = arguments[0]; PurrpleRenderer.preload({all: true}).then(() => done(true), e => done(String(e)));")
            assert preload is True, preload
        else:
            d.navigate((ROOT / 'art/fit-preview.html').as_uri())
            d.wait('return !!globalThis.PurrpleFit?.ready', timeout=15)
        d.command('/timeouts', {'script': 56000, 'pageLoad': 30000, 'implicit': 0})
        probe = (ROOT / 'art/wardrobe-v2-canvas-probe.cjs').read_text()
        script = probe + '\nreturn measureWardrobeFit(...arguments);'
        result = d.js(script, False, [], True)
        record = result['record']
        if not args.preview_only:
            total = d.js('return Object.keys(PurrpleArt.sprites).length;')
            for start in range(0, total, 4):
                partial = d.js(script, True, [start, start+4], False)['record']
                for field in ('rendered', 'intentionalPoseFallbacks', 'clipped', 'insufficientPixels', 'unexpectedPixels'):
                    record[field] += partial[field]
                for name, values in partial['byId'].items():
                    stat = record['byId'][name]
                    stat['rendered'] += values['rendered']
                    stat['fallback'] += values['fallback']
                    stat['peak'] = max(stat['peak'], values['peak'])
                    numbers = [v for v in (stat['min'], values['min']) if v is not None]
                    stat['min'] = min(numbers) if numbers else None
        record['browser'] = 'Firefox ' + d.capabilities['browserVersion']
        if args.package:
            record['packageSha256'] = hashlib.sha256(artwork.read_bytes()).hexdigest()
            record['scope'] = 'Exact runtime ZIP temporary-installed in Gecko. Pixels produced from its app page.'
        else:
            record['scope'] = 'Firefox Canvas and the shared renderer in the local source fit viewer.'
        for name, image in result['sheets'].items():
            (out / f'{name}.png').write_bytes(base64.b64decode(image))
        (out / 'coverage.json').write_text(json.dumps(record, indent=2) + '\n')
        if args.thumbnails:
            for name, image in result['thumbs'].items():
                target = ROOT / 'extension/assets/wardrobe/thumbs' / f'{name}.png'
                target.write_bytes(base64.b64decode(image))
        if args.package and args.surface_checks:
            record['surfaces'] = verify_installed_wardrobe(d, base)
            (out / 'coverage.json').write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps(record, indent=2))
        if record['clipped'] or record['insufficientPixels'] or record['unexpectedPixels']:
            raise SystemExit(1)
    finally:
        d.close()


if __name__ == '__main__':
    main()
