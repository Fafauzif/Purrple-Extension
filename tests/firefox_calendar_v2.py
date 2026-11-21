#!/usr/bin/env python3
"""Operate Calendar in a disposable native Firefox profile using a supplied runtime ZIP."""
import argparse
import hashlib
import json
from pathlib import Path

import firefox_native as native


def verify(bundle, output):
    report = {'mode': 'temporary installation of the exact Firefox ZIP', 'sha256': hashlib.sha256(bundle.read_bytes()).hexdigest(), 'checks': []}
    native.OUT = output
    output.mkdir(parents=True, exist_ok=True)
    driver = native.Driver()
    report['browser_version'] = driver.capabilities['browserVersion']

    def check(name, condition):
        report['checks'].append({'name': name, 'pass': bool(condition)})
        print(f'{"PASS" if condition else "FAIL"} {name}', flush=True)
        assert condition, name

    def field(selector, value):
        driver.js('const el=document.querySelector(arguments[0]); el.value=arguments[1]; el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true}));', selector, value)

    def calendar():
        driver.click('[data-view="calendar"]')
        driver.wait('return !document.getElementById("view-calendar").hidden')

    def open_block(title):
        driver.wait('return Boolean(document.querySelector(".planner-entry-block button.planner-entry-title"))')
        element = driver.js('return Array.from(document.querySelectorAll(".planner-entry-block button.planner-entry-title")).find(b=>b.textContent===arguments[0]);', title)
        if not element:
            raise AssertionError('No visible planned block: ' + title)
        driver.js('arguments[0].focus();', element)
        assert driver.js('return document.activeElement===arguments[0];', element)
        keys = [{'type': 'keyDown', 'value': '\ue007'}, {'type': 'keyUp', 'value': '\ue007'}]
        driver.command('/actions', {'actions': [{'id': 'keyboard', 'type': 'key', 'actions': keys}]})
        driver.wait('return document.querySelector("#planner-dialog").open')

    try:
        check('Native temporary install keeps Gecko ID', driver.command('/moz/addon/install', {'path': str(bundle), 'temporary': True}) == 'purrple-companion@purrple.local')
        driver.command('/moz/context', {'context': 'chrome'})
        extension_id = driver.js("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
        driver.js('Services.io.offline=true;')
        driver.command('/moz/context', {'context': 'content'})
        driver.command('/window/rect', {'width': 1240, 'height': 850})
        driver.navigate(f'moz-extension://{extension_id}/app.html#calendar')
        driver.wait('return !document.querySelector("main").hidden && !document.querySelector("#view-calendar").hidden && document.querySelectorAll(".planner-week .planner-day").length===7')
        check('Week loads while Firefox is offline', driver.js('return document.querySelector("[data-calendar-view=week]").getAttribute("aria-pressed")==="true"'))
        field('#planner-jump', '2026-11-25')
        task = driver.action('TASK_ADD', id='calendar-test-task', title='Read the seminar packet', dueDate='2026-11-25')['state']['tasks'][0]
        driver.wait('return document.querySelector("[data-calendar-focus=schedule-calendar-test-task]")')
        driver.click('[data-calendar-focus=schedule-calendar-test-task]')
        field('#planner-block-time', '13:00')
        field('#planner-block-duration', '25')
        driver.click('#planner-save')
        driver.wait('return !document.querySelector("#planner-dialog").open && document.querySelector(".planner-entry-block")')
        state = driver.state()
        block = state['calendar']['blocks'][0]
        check('Unscheduled task creates one local block and one deadline', block['taskId'] == task['id'] and block['date'] == '2026-11-25' and driver.js('return document.querySelectorAll(".planner-entry-due").length===1'))
        driver.screenshot('calendar-week-native.png')
        open_block(task['title'])
        field('#planner-block-date', '2026-11-26')
        field('#planner-block-duration', '31')
        driver.click('#planner-save')
        driver.wait('return !document.querySelector("#planner-dialog").open')
        state = driver.state()
        updated = state['calendar']['blocks'][0]
        check('Keyboard opens schedule editor, date and duration update without moving deadline', updated['id'] == block['id'] and updated['date'] == '2026-11-26' and updated['duration'] == 31 and state['tasks'][0]['dueDate'] == task['dueDate'])
        driver.click('[data-calendar-focus=undo]')
        driver.wait('return !document.querySelector("[data-calendar-focus=undo]")')
        check('Undo restores previous block', driver.state()['calendar']['blocks'][0] == block)
        driver.click('#planner-add')
        field('#planner-block-title', 'Overlap validation')
        field('#planner-block-time', '13:10')
        check('Overlapping preview reports the other block and allows the user to decide', 'Overlaps' in driver.js('return document.querySelector("#planner-preview").textContent') and not driver.js('return document.querySelector("#planner-save").disabled'))
        driver.click('#planner-cancel')
        driver.wait('return !document.querySelector("#planner-dialog").open')
        check('Cancel preserves previously committed block', driver.state()['calendar']['blocks'] == [block])
        driver.click('[data-calendar-view=day]')
        check('Day has separate all-day and timed lanes', driver.js('return !!document.querySelector(".planner-day-view .planner-all-lane") && !!document.querySelector(".planner-day-view .planner-timed-lane")'))
        open_block(task['title'])
        driver.click('#planner-start-focus')
        driver.wait('return !document.querySelector("#view-focus").hidden')
        check('From Calendar starts authoritative focus linked to task and block', driver.state()['focus']['blockId'] == block['id'] and driver.state()['focus']['taskId'] == task['id'])
        calendar()
        driver.click('[data-calendar-view=week]')
        driver.command('/window/rect', {'width': 490, 'height': 650})
        driver.wait('return document.querySelector("[data-calendar-view=agenda]").getAttribute("aria-pressed")==="true"')
        driver.screenshot('calendar-agenda-native.png')
        sizes = driver.js('return {view:innerWidth, scroll:document.documentElement.scrollWidth, wide:[...document.querySelectorAll("body *")].filter(n=>n.getBoundingClientRect().right>innerWidth+2).map(n=>[n.id||n.className,n.getBoundingClientRect().right]).slice(0,15)}')
        report['narrow_geometry'] = sizes
        check('Narrow layout switches to Agenda without horizontal overflow', sizes['scroll'] <= sizes['view'] + 2)
        driver.navigate(f'moz-extension://{extension_id}/app.html#calendar')
        driver.wait('return !document.querySelector("main").hidden')
        check('Calendar and active timer persist after page reopen', driver.state()['calendar']['blocks'] == [block] and driver.state()['focus']['blockId'] == block['id'])
        backup = driver.message({'type': 'BACKUP_EXPORT'})['backup']
        check('Backup includes local block but excludes credentials', backup['state']['calendar']['blocks'] == [block] and set(backup['state']['calendar']) == {'blocks', 'undo'})
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        try:
            driver.command('/moz/context', {'context': 'chrome'})
            driver.js('Services.io.offline=false;')
        finally:
            driver.close()
            (output / 'calendar-native.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip', type=Path)
    parser.add_argument('--output', type=Path, default=native.ROOT / 'verification' / 'calendar-native')
    args = parser.parse_args()
    verify(args.zip.resolve(), args.output.resolve())
