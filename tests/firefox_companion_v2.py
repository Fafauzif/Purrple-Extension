#!/usr/bin/env python3
"""Installed Firefox companion journey using a disposable profile and a synthetic save."""

import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import time
import uuid

import firefox_native
from firefox_native import Driver, ELEMENT


def run(driver, package):
    d = driver
    def press(selector,key):
        for _ in range(5):
            try:
                e=d.command('/element',{'using':'css selector','value':selector})
                return d.command('/element/'+e[ELEMENT]+'/value',{'text':key})
            except RuntimeError as error:
                if 'stale element reference' not in str(error):raise
                time.sleep(.1)
        raise AssertionError('Unstable target '+selector)
    def expect(script):
        d.wait('return ('+script+')')
    def key_button(selector):
        press(selector,'\ue007')
    def state():
        return d.state()['companion']
    addon=d.command('/moz/addon/install',{'path':str(package),'temporary':True})
    assert addon=='purrple-companion@purrple.local',addon
    d.command('/moz/context',{'context':'chrome'})
    addon_uuid=d.js("window.SidebarController.hide(); return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];")
    d.command('/moz/context',{'context':'content'})
    base='moz-extension://'+addon_uuid+'/app.html'
    d.command('/window/rect',{'width':1200,'height':885})
    d.navigate(base+'#companion')
    expect("document.querySelector('.cp-cat') && PurrpleRenderer.ready")
    expect("(()=>{const c=document.querySelector('.cp-cat');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v)})()")
    d.screenshot('companion-room.png')
    print('PASS room displays canonical renderer in Firefox',flush=True)
    before=state()['room']['placements']['plum-cushion']['x']
    press('#cp-x','\ue014')
    key_button('[data-cp="place"]')
    expect(f'document.querySelector(".cp-decor-plum-cushion").style.left === "{before+1}%"')
    expect('!document.querySelector("[data-cp=undo-room]").disabled')
    key_button('[data-cp="undo-room"]')
    expect(f'document.querySelector(".cp-decor-plum-cushion").style.left === "{before}%"')
    print('PASS keyboard room move and undo',flush=True)
    key_button('[data-cp="tab"][data-id="gifts"]')
    expect('document.querySelector("[data-cp=give]")')
    key_button('[data-cp="give"]')
    expect('document.querySelector("[data-cp-key=gift-response]")?.textContent.includes("You kept it flat")')
    print('PASS gift and authored response',flush=True)
    key_button('[data-cp="tab"][data-id="play"]')
    expect('document.querySelector("[data-cp=open-game][data-id=paw-pairs]")')
    key_button('[data-cp="open-game"][data-id="paw-pairs"]')
    expect('document.querySelector("[data-cp=start-game]")')
    key_button('[data-cp="start-game"]')
    expect('document.querySelectorAll(".cp-pair").length===12')
    key_button('[data-cp-key="cell-0"]')
    expect('document.querySelector(".cp-board-status strong").textContent.includes("second card")')
    d.screenshot('companion-play.png')
    d.navigate(base+'#companion-play-paw-pairs')
    expect('document.querySelector(".cp-board-status strong")?.textContent.includes("second card")')
    for turn in range(40):
        x=d.async_js("""
        const done=arguments[arguments.length - 1];
        browser.runtime.sendMessage({type:'GET_STATE'}).then(({state})=>{
          const round=state.companion.rounds['paw-pairs'], model=PurrpleCompanionDomain.game(round);
          const index=model.pending===null?model.deck.findIndex((_,i)=>!model.matched.includes(i)):model.deck.findIndex((p,i)=>i!==model.pending&&p===model.deck[model.pending]);
          done({index,ended:!!model.outcome});
        });
        """)
        if x['ended']:break
        selector='[data-cp-key="cell-'+str(x['index'])+'"]'
        expect('!document.querySelector('+json.dumps(selector)+').disabled')
        key_button(selector)
    expect('document.querySelector(".cp-game-result h4")?.textContent.match(/You won|A draw/)')
    print('PASS keyboard Paw Pairs and round persisted before rematch',flush=True)
    # Real extension clicks against a clean, legitimate portable receipt history.
    d.command('/window/rect',{'width':450,'height':650})
    d.screenshot('companion-play-narrow.png')
    expect('document.documentElement.scrollWidth<=innerWidth')
    print('PASS narrow view',flush=True)
    d.command('/window/rect',{'width':1200,'height':885})
    progressed=d.js('''
      const date=Date.now()-12*86400000;
      let state=PurrpleCore.defaultState(date);
      for (let day=0; day<7; day++) {
        for (let session=0; session<3; session++) {
          const now=date+day*86400000+session*2400000;
          state=PurrpleCore.reduce(state,{type:'FOCUS_START',minutes:30},now);
          state=PurrpleCore.reconcile(state,now+1800000);
        }
      }
      return {format:'purrple-backup',version:state.version,state,exportedAt:Date.now()};
    ''')
    restored=d.message({'type':'ACTION','requestId':str(uuid.uuid4()),'action':{'type':'BACKUP_IMPORT','backup':progressed}})
    assert restored.get('ok'),restored
    d.navigate(base+'#companion-room')
    for discovery in range(20):
        current=state()
        if all(game in [scene['id'] for scene in current['discoveries']] for game in ['clue-notebook','lantern-window','lantern-afterglow']):
            break
        expect('document.querySelector("[data-cp=discover]")')
        key_button('[data-cp="discover"]')
        expect('document.querySelector("[data-cp=close-story]")')
        key_button('[data-cp="close-story"]')
    else:
        raise AssertionError('Expected story gates did not open')
    assert 'starglow-pencil' in d.state()['owned']
    print('PASS introduced both unlockable games in scenes and durable wardrobe gift',flush=True)
    d.navigate(base+'#companion-play-cozy-clues')
    expect('document.querySelector("[data-cp=start-game]")')
    key_button('[data-cp="start-game"]')
    expect('document.querySelector("[data-cp=clue-hint]")')
    key_button('[data-cp="clue-hint"]')
    expect('document.querySelector("[data-cp=clue-hint]")?.textContent==="Another hint"')
    key_button('[data-cp="clue-hint"]')
    expect('document.querySelectorAll(".cg-hints li").length===2')
    key_button('[data-cp="clue-choice"]')
    expect('document.querySelector(".cp-board-status")?.textContent.includes("Clue 2 of 5")')
    d.navigate(base+'#calendar')
    d.navigate(base+'#companion-play-cozy-clues')
    expect('document.querySelector(".cp-board-status")?.textContent.includes("Clue 2 of 5")')
    print('PASS Cozy Clues hint, answer and resumed clue',flush=True)
    d.navigate(base+'#companion-play-lantern-paths')
    expect('document.querySelector("[data-cp=start-game]")')
    key_button('[data-cp="start-game"]')
    expect('document.querySelector(".cp-square.legal")')
    key_button('[data-cp-key="cell-1"]')
    expect('document.querySelector(".cp-game-feedback")?.textContent.includes("Purrple chose")')
    d.navigate(base+'#calendar')
    d.navigate(base+'#companion-play-lantern-paths')
    expect('document.querySelector(".cp-game-feedback")?.textContent.includes("Purrple chose")')
    assert len(state()['rounds']['lantern-paths']['moves'])==1
    print('PASS Lantern Paths legal keyboard move, Purrple response and resumed board',flush=True)



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path, help='Firefox runtime ZIP, or extension directory for source development checks')
    parser.add_argument('--output', type=Path, help='Optional output directory for synthetic fixture screenshots')
    options = parser.parse_args()
    package = options.package.resolve(strict=True)
    with tempfile.TemporaryDirectory(prefix='purrple-companion-qa-') as temporary:
        temporary = Path(temporary)
        firefox_native.OUT = options.output or temporary
        firefox_native.OUT.mkdir(parents=True, exist_ok=True)
        driver = Driver(temporary / 'profile')
        try:
            print(f'Firefox {driver.capabilities["browserVersion"]}', flush=True)
            if package.is_file():
                print('SHA-256', hashlib.sha256(package.read_bytes()).hexdigest(), flush=True)
            run(driver, package)
        finally:
            driver.close()


if __name__ == '__main__':
    main()
