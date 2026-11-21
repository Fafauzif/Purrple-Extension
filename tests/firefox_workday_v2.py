#!/usr/bin/env python3
"""Run one real-minute focus flow against a supplied Firefox runtime archive."""
import argparse
import hashlib
import json
from pathlib import Path

import firefox_native as native

ID = 'purrple-companion@purrple.local'


def verify(archive, output):
    output.mkdir(parents=True, exist_ok=True)
    native.OUT = output
    result = {'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'checks': []}
    driver = native.Driver()
    result['firefox'] = driver.capabilities['browserVersion']

    def check(label, predicate):
        result['checks'].append({'name': label, 'passed': bool(predicate)})
        print(('PASS ' if predicate else 'FAIL ') + label, flush=True)
        assert predicate, label

    try:
        check('Native install uses the unchanged Gecko identity', driver.command('/moz/addon/install', {'path': str(archive), 'temporary': True}) == ID)
        driver.command('/moz/context', {'context': 'chrome'})
        uuid = driver.js('window.SidebarController.hide(); return JSON.parse(Services.prefs.getStringPref("extensions.webextensions.uuids"))[arguments[0]];', ID)
        driver.command('/moz/context', {'context': 'content'})
        driver.navigate(f'moz-extension://{uuid}/app.html')
        driver.wait('return !document.querySelector("main").hidden')
        driver.fill('#quick-title', 'Draft an introduction')
        driver.click('#quick-form button')
        driver.wait('return PurrpleUI.getState().tasks.length===1')
        driver.click('.task-actions > summary')
        driver.click('[data-action="priority"]')
        check('Today records an explicit priority', driver.wait('return PurrpleUI.getState().priorities.length===1'))
        driver.click('[data-action="focus-on-task"]')
        driver.fill('#focus-minutes', 1)
        driver.fill('#focus-intention', 'Write the first sentence')
        driver.click('#focus-start')
        driver.wait('return PurrpleUI.getState().focus?.status==="running"')
        running = driver.state()['focus']
        check('Starts the one-minute duration entered through Focus', running['durationMs'] == 60000)
        session_id = running['id']
        driver.click('#focus-pause')
        driver.wait('return PurrpleUI.getState().focus?.status==="paused"')
        left = driver.state()['focus']['remainingMs']
        driver.fill('#parked-note', 'Check the bibliography')
        driver.click('#parking-form button')
        driver.wait('return PurrpleUI.getState().focus?.notes?.length===1')
        check('Parking while paused leaves remaining time unchanged', driver.state()['focus']['remainingMs'] == left)
        driver.click('#focus-pause')
        driver.wait('return PurrpleUI.getState().focus?.status==="running"')
        driver.wait('return !PurrpleUI.getState().focus && !document.querySelector("#focus-wrap").hidden', timeout=85)
        final = driver.state()
        check('One real minute earns zero coins and one durable focus receipt', final['wallet']['balance'] == 0 and final['stats']['focusMinutes'] == 1 and len([receipt for receipt in final['ledger'] if receipt['ref'] == session_id]) == 1)
        check('Wrap-up names the completed focus and separate earned delta', '0 coins earned' in driver.js('return document.querySelector("#focus-wrap").textContent'))
        driver.click('[data-action="capture-note"]')
        driver.wait('return PurrpleUI.getState().tasks.length===2')
        driver.click('[data-action="wrap-task"]')
        driver.wait('return PurrpleUI.getState().wallet.balance===1')
        driver.click('[data-action="wrap-dismiss"]')
        driver.click('[data-view="today"]')
        driver.click('#day-review summary')
        check('Review counts one completed task and one minute of focus', '1 completed task' in driver.js('return document.querySelector("#day-review-content").textContent'))
        check('Focus and task receipts remain separate', len(driver.state()['ledger']) == 2)
    except Exception:
        result['diagnostics'] = {'page':driver.js('return {at:Date.now(),focus:PurrpleUI.getState().focus,seen:PurrpleUI.getState().wrapSeen,history:PurrpleUI.getState().focusHistory,hidden:document.querySelector("#focus-wrap").hidden,hash:location.hash}'), 'persisted':driver.state()}
        raise
    finally:
        (output / 'workday.json').write_text(json.dumps(result, indent=2) + '\n')
        driver.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    verify(args.archive.resolve(), args.output.resolve())
