#!/usr/bin/env python3
"""Native Firefox checks for the actual packaged Purrple action cluster."""
import argparse
import hashlib
import http.server
import json
from pathlib import Path
import tempfile
import threading

import firefox_native as native

SHADOW = 'shadow-6066-11e4-a52e-4f735466cecf'
ACTIVE = "return document.querySelector('purrple-companion')?.dataset.active==='true'"

def run(driver, url, capture):
    driver.command('/moz/context', {'context':'chrome'})
    uuid = driver.js("window.SidebarController.hide(); return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local']")
    driver.command('/moz/context', {'context':'content'})
    base = f'moz-extension://{uuid}/'
    driver.navigate(url)
    driver.wait(ACTIVE, timeout=35)
    assert driver.js("return document.querySelector('purrple-companion').shadowRoot===null")

    def element(selector):
        host = driver.command('/element', {'using':'css selector','value':'purrple-companion'})
        shadow = driver.command('/element/'+host[native.ELEMENT]+'/shadow', method='GET')[SHADOW]
        return driver.command('/shadow/'+shadow+'/element', {'using':'css selector','value':selector})

    def read(script, selector):
        return driver.js(script, element(selector))

    def click(selector):
        node = element(selector)
        return driver.command('/element/'+node[native.ELEMENT]+'/click', {})

    def press(selector, value):
        node = element(selector)
        return driver.command('/element/'+node[native.ELEMENT]+'/value', {'text': value})

    def menu_pick(id):
        return click(f'.menu [data-action="{id}"]')

    def names():
        return read("return [...arguments[0].querySelectorAll('.actions > button')].map(b=>b.textContent)", '.menu')

    def wait_shadow(script, selector):
        node = element(selector)
        # One WebDriver script sees the same actual closed-shadow nodes that users operate.
        return driver.async_js("""
          const node=arguments[0], predicate=arguments[1], done=arguments[arguments.length-1];
          const check=new Function('node','return '+predicate); const end=Date.now()+10000;
          const timer=setInterval(()=>{if(check(node)||Date.now()>end){clearInterval(timer);done(check(node));}},40);
        """, node, script)

    def shot(name):
        if capture:
            driver.screenshot(name)

    click('.actor')
    assert names() == ['Talk','Focus','Play','Care','More']
    shot('menu.png')
    menu_pick('talk')
    assert names()[:3] == ['Say hello','Ask how she is','Tell a joke']
    shot('talk.png')
    menu_pick('joke')
    assert wait_shadow("!node.hidden && !!node.querySelector('p').textContent",'.speech')
    reply = read("return arguments[0].querySelector('p').textContent",'.speech')
    assert read("return arguments[0].textContent",'.pet-announcement') == reply
    assert read("return arguments[0].hidden",'.panel')
    shot('reply.png')
    click('.speech [data-action=joke]')
    assert wait_shadow("!node.hidden && node.querySelector('p').textContent !== " + json.dumps(reply),'.speech')
    press('.speech [data-action=back]', '\uE00C')
    assert read("return arguments[0].hidden",'.speech')
    assert read("return arguments[0].getRootNode().activeElement===arguments[0]",'.actor')
    click('.actor')
    menu_pick('more')
    menu_pick('move')
    old_x = read("return arguments[0].getBoundingClientRect().x",'.actor')
    menu_pick('move-left')
    assert read("return arguments[0].getBoundingClientRect().x",'.actor') < old_x
    assert read("return arguments[0].getRootNode().activeElement===arguments[0]",'.menu [data-action=move-left]')
    menu_pick('reset-pet')
    assert read("return arguments[0].getBoundingClientRect().x",'.actor') > old_x - 5
    assert read("return arguments[0].getRootNode().activeElement===arguments[0]",'.menu [data-action=reset-pet]')
    driver.command('/actions',{'actions':[{'type':'key','id':'menu-keyboard','actions':[
        {'type':'keyDown','value':'\uE00C'},{'type':'keyUp','value':'\uE00C'}
    ]}]})
    assert read("return arguments[0].hidden",'.menu')
    assert read("return arguments[0].getRootNode().activeElement===arguments[0]",'.actor')
    click('.actor')
    menu_pick('focus')
    menu_pick('start-25')
    assert wait_shadow("!node.hidden && node.textContent.includes('Notebook open')",'.speech')
    driver.click('#host-button')
    assert driver.js("return document.querySelector('#host-button').textContent==='Still works'")
    driver.navigate(base+'popup.html')
    driver.wait("return !document.getElementById('compact-main').hidden")
    assert driver.state()['focus']['durationMs'] == 25*60*1000
    driver.click('#compact-pet')
    driver.click('#compact-pet-menu [data-action=focus]')
    assert driver.js("return [...document.querySelectorAll('#compact-pet-menu .actions > button')].map(b=>b.textContent).join(',')==='View active timer,Back'")
    assert driver.state()['talk']['total'] == 2
    assert driver.action('FOCUS_CANCEL')['ok']
    driver.wait("return !PurrpleCompact.getState()?.focus")
    shot('popup-before-custom.png')
    driver.click('#compact-pet-menu [data-action=back]')
    driver.click('#compact-pet-menu [data-action=focus]')
    driver.click('#compact-pet-menu [data-action=custom]')
    driver.fill('#compact-pet-menu input', '5')
    driver.click('#compact-pet-menu button[type=submit]')
    driver.wait("return !document.getElementById('compact-pet-speech').hidden")
    assert driver.state()['focus']['durationMs'] == 5*60*1000
    shot('popup.png')
    return ['leased cat cluster and two distinct replies', 'single live region, Escape and focus return', 'placement and reset preserve keyboard focus for Escape', '25-minute webpage timer observed from popup', 'active timer has precedence', 'custom duration in toolbar document', 'host click-through and closed shadow root']

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('archive',type=Path)
    parser.add_argument('--out',type=Path)
    args=parser.parse_args()
    archive=args.archive.resolve()
    with tempfile.TemporaryDirectory(prefix='purrple-pet-menu-') as temp:
        native.OUT=args.out or Path(temp)
        native.OUT.mkdir(parents=True,exist_ok=True)
        with http.server.ThreadingHTTPServer(('127.0.0.1',0),native.QuietHandler) as server:
            threading.Thread(target=server.serve_forever,daemon=True).start()
            driver=native.Driver()
            try:
                addon=driver.command('/moz/addon/install',{'path':str(archive),'temporary':True})
                assert addon=='purrple-companion@purrple.local'
                checks=run(driver,f'http://127.0.0.1:{server.server_port}/',bool(args.out))
                print(json.dumps({'browserVersion': driver.capabilities['browserVersion'], 'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'checks': checks}, indent=2))
            finally:
                driver.close()
                server.shutdown()

if __name__=='__main__':
    main()
