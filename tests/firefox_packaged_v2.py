"""Operate the exact Firefox archive in disposable native profiles."""
import argparse
import contextlib
import hashlib
import http.server
import json
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import time
import zipfile

ROOT = Path(__file__).resolve().parent
import firefox_native as native

GECKO = "purrple-companion@purrple.local"
SHADOW = "shadow-6066-11e4-a52e-4f735466cecf"

class StrictPage(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        document = b'<!doctype html><html lang="en"><title>Local Purrple QA page</title><h1>Strict host page</h1><button id="host-button">Host control</button><label>Host input <input id="host-input"></label></html>'
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        if self.path != '/panels':
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src 'none'; object-src 'none'")
        self.send_header("Content-Length", str(len(document)))
        self.end_headers()
        self.wfile.write(document)
    def log_message(self, *args): pass

def install(d, archive):
    assert d.command("/moz/addon/install", {"path": str(archive), "temporary": True}) == GECKO
    d.command("/moz/context", {"context": "chrome"})
    try:
        uuid = d.js("window.SidebarController.hide(); return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]];", GECKO)
    finally:
        d.command("/moz/context", {"context": "content"})
    return f"moz-extension://{uuid}/"

def shadow(d, selector):
    host = d.command("/element", {"using":"css selector","value":"purrple-companion"})
    root = d.command(f"/element/{host[native.ELEMENT]}/shadow", method="GET")[SHADOW]
    return d.command(f"/shadow/{root}/element", {"using":"css selector","value":selector})

def wait_shadow(d, selector, expression, timeout=10):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            element = shadow(d, selector)
            if d.js(expression, element):
                return element
        except RuntimeError:
            pass
        time.sleep(.15)
    raise AssertionError(f'No matching state for {selector}: {expression}')

def exact(args, out):
    report = {"browser":"Mozilla Firefox", "mode":"native unsigned temporary ZIP, WebDriver", "archive":args.zip.name, "sha256":hashlib.sha256(args.zip.read_bytes()).hexdigest(), "checks": {}}
    def check(name, action):
        try:
            report["checks"][name] = {"pass":True,"evidence":action()}
            print("PASS",name,flush=True)
        except Exception as error:
            report["checks"][name] = {"pass":False,"detail":str(error)}
            print("FAIL",name,error,flush=True)
            with contextlib.suppress(Exception):
                d.screenshot("failure-" + name + ".png")
    d = None
    try:
        with zipfile.ZipFile(args.zip) as archive:
            assert archive.testzip() is None
            manifest = json.loads(archive.read("manifest.json"))
            assert manifest["browser_specific_settings"]["gecko"]["id"] == GECKO
            assert manifest["manifest_version"] == 3
            report["checks"]["zip-integrity-version-identity"] = {"pass":True,"entries":len(archive.namelist())}
        server = http.server.ThreadingHTTPServer(("127.0.0.1",0),StrictPage)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        d = native.Driver()
        report["version"] = d.capabilities["browserVersion"]
        base = install(d,args.zip)
        report["checks"]["install-exact-zip"] = {"pass":True}
        d.navigate(base + "app.html")
        d.wait("return !!document.getElementById('main') && !document.getElementById('main').hidden")
        assert d.js("return browser.runtime.getManifest().version") == manifest["version"]
        d.wait("return typeof PurrpleRenderer !== 'undefined' && PurrpleRenderer.assetsReady")
        d.screenshot("today-narrow-or-desktop.png")
        report["checks"]["real-extension-dashboard-renderer"] = {"pass":True}

        def task_reward():
            d.fill("#quick-title","QA private task title")
            d.click("#quick-form button[type=submit]")
            d.wait("return document.getElementById('task-list').textContent.includes('QA private task title')")
            task = next(t for t in d.state()["tasks"] if t["title"] == "QA private task title")
            assert task["effort"] == "small", task
            actions = d.async_js("""const done=arguments[arguments.length-1];const id=arguments[0];Promise.all(Array.from({length:8},()=>browser.runtime.sendMessage({type:'ACTION',action:{type:'TASK_SET_DONE',done:true,id}}))).then(done);""",task["id"])
            assert all(r["ok"] for r in actions)
            done = d.state()
            assert done["wallet"]["balance"] == 1
            assert [r["amount"] for r in done["ledger"] if r["ref"] == task["id"]] == [1]
            assert d.action("TASK_SET_DONE", id=task["id"], done=False)["ok"]
            assert d.action("TASK_SET_DONE", id=task["id"], done=True)["ok"]
            assert d.state()["wallet"]["balance"] == 1
            return done["wallet"]
        check("task-ui-small-and-concurrent-reward", task_reward)

        def calendar():
            d.click('[data-view="calendar"]')
            d.wait("return !document.getElementById('view-calendar').hidden && !!document.getElementById('planner-heading')")
            d.click("#planner-add")
            d.wait("return document.getElementById('planner-dialog').open")
            d.fill("#planner-block-title", "QA private schedule item")
            d.click("#planner-save")
            d.wait("return !document.getElementById('planner-dialog').open")
            stored = d.state()["calendar"]["blocks"]
            assert any(block["title"] == "QA private schedule item" for block in stored)
            for mode in ("day","agenda","week"):
                d.click(f'[data-calendar-view="{mode}"]')
            d.screenshot("calendar.png")
            return stored
        check("calendar-save-local-and-change-views", calendar)

        def compact():
            d.navigate(base + "popup.html")
            d.wait("return !document.getElementById('compact-main').hidden && document.querySelector('.compact-pet')")
            d.click(".compact-pet")
            d.wait("return !document.getElementById('compact-pet-menu').hidden")
            d.screenshot("popup-pet-menu.png")
            return d.js("return [...document.querySelectorAll('#compact-pet-menu button[data-action]')].map(b=>b.textContent)")
        check("popup-pet-menu", compact)

        def native_surfaces():
            d.command("/moz/context",{"context":"chrome"})
            try:
                d.js("window.SidebarController.hide(); window.CustomizableUI.addWidgetToArea('purrple-companion_purrple_local-browser-action',window.CustomizableUI.AREA_NAVBAR);")
                d.click("#purrple-companion_purrple_local-BAP")
                d.wait("return !!document.querySelector('browser.webextension-popup-browser')")
                def popup_script(script):
                    return d.async_js("""const done=arguments[arguments.length-1]; const b=document.querySelector('browser.webextension-popup-browser'); const a=b?.browsingContext.currentWindowGlobal?.getActor('MarionetteCommands'); if(!a){done(null);return;} a.executeScript(arguments[0],[],{timeout:10000}).then(done,e=>done({error:String(e)}));""",script)
                import time
                for _ in range(35):
                    info=popup_script("return PurrpleCompact?.getState() && {native:PurrpleClient.native,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,labels:[...document.querySelectorAll('[data-compact-view]')].map(e=>e.textContent.trim())};")
                    if info and info.get("native"): break
                    time.sleep(.15)
                assert info and info["native"] and info["scrollWidth"] <= info["width"],info
                click = d.async_js("""const done=arguments[arguments.length-1];const b=document.querySelector('browser.webextension-popup-browser'); const a=b.browsingContext.currentWindowGlobal.getActor('MarionetteCommands'); (async()=>{const el=await a.findElement('css selector','#open-sidebar',{}); await a.clickElement(el,new Map([['moz:accessibilityChecks',false],['moz:webdriverClick',true]]));return true;})().then(done,e=>done(String(e)));""")
                assert click is True,click
                sidebar=d.wait("""const el=document.getElementById('sidebar-box');return window.SidebarController.isOpen && {width:el.getBoundingClientRect().width};""",timeout=12)
                assert sidebar["width"] > 150,sidebar
                info["sidebar"]=sidebar
                d.js("window.SidebarController.hide();")
                return info
            finally:
                d.command("/moz/context",{"context":"content"})
        check("actual-firefox-toolbar-and-sidebar",native_surfaces)

        def host():
            d.navigate(f"http://127.0.0.1:{server.server_port}/")
            d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'",timeout=18)
            assert d.js("return document.querySelector('purrple-companion').shadowRoot === null")
            def click(selector):
                d.js("arguments[0].click();",shadow(d, selector))
            def visible(selector):
                return d.js("return !arguments[0].hidden",shadow(d,selector))
            click(".actor")
            assert visible(".menu")
            click(".menu button[data-action=talk]")
            click(".menu button[data-action=joke]")
            import time
            for _ in range(25):
                if visible(".speech"): break
                time.sleep(.15)
            assert visible(".speech")
            joke = d.js("return arguments[0].textContent",shadow(d,".speech p"))
            assert joke and "QA private" not in joke
            assert d.js("return arguments[0].textContent",shadow(d,".pet-announcement")) == joke
            assert not d.js("return document.documentElement.innerHTML.includes('QA private')")
            d.screenshot("host-joke.png")
            d.js("arguments[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}))",shadow(d,'.speech button'))
            assert not visible(".speech") and not visible(".menu")
            d.fill("#host-input","Host page still works")
            click(".actor")
            click(".menu button[data-action=focus]")
            click(".menu button[data-action=start-25]")
            return joke
        check("strict-csp-host-talk-one-announcement-escape", host)
        def timer():
            d.navigate(base + "app.html#focus")
            d.wait("return !document.getElementById('main').hidden")
            state = d.state()
            assert state["focus"]["status"] == "running" and state["focus"]["durationMs"] == 25*60000,state["focus"]
            assert d.action("FOCUS_PAUSE")["ok"]
            assert d.state()["focus"]["status"] == "paused"
            assert d.action("FOCUS_RESUME")["ok"]
            assert d.action("FOCUS_CANCEL")["ok"]
            return True
        check("webpage-timer-background-roundtrip", timer)

        if int(manifest["version"].split(".")[0]) >= 3:
            def today_panel():
                url = f"http://127.0.0.1:{server.server_port}/panels"
                d.navigate(url)
                d.wait("return document.querySelector('purrple-companion')?.dataset.active==='true'")
                if tuple(map(int,manifest["version"].split(".")[:2])) >= (3,1):
                    d.js("arguments[0].click()", shadow(d, '.actor'))
                    d.js("arguments[0].click()", shadow(d, '.menu [data-action=today]'))
                else:
                    d.js("arguments[0].click()", shadow(d, '.paw'))
                frame = wait_shadow(d, '.panel iframe', "return arguments[0].title.includes('Today')")
                d.command("/frame", {"id":frame})
                try:
                    d.wait("return !!document.querySelector('#compact-today')?.getClientRects().length")
                    assert d.js("return PurrpleClient.native && document.querySelector('#preview-label').hidden")
                    d.fill("#compact-task-title", "Saved beside this page")
                    d.click("#compact-task-add")
                    d.wait("return document.querySelector('#compact-task-list').textContent.includes('Saved beside this page')")
                    d.click("#panel-close")
                finally:
                    d.command("/frame", {"id":None})
                assert d.js("return location.href") == url
                wait_shadow(d, '.panel', "return arguments[0].hidden")
                assert d.js("return document.querySelector('purrple-companion').shadowRoot === null")
                assert not d.js("return document.documentElement.innerHTML.includes('Saved beside this page')")
                d.navigate(base + "popup.html")
                d.wait("return document.querySelector('#compact-task-list').textContent.includes('Saved beside this page')")
                return True
            check("webpage-today-creates-same-task-without-navigation",today_panel)

        def privacy():
            backup = d.message({"type":"BACKUP_EXPORT"})
            assert backup["ok"]
            store = backup["backup"]
            (out/"portable-from-firefox.json").write_text(json.dumps(store,indent=2))
            invalid = json.loads(json.dumps(store))
            invalid["state"]["wallet"]["balance"] += 5
            preview = d.message({"type":"BACKUP_PREVIEW","backup":invalid})
            assert not preview["ok"]
            assert d.state()["wallet"]["balance"] == 1
            return True
        check("portable-export-tamper-rejection",privacy)

        def errors():
            d.command("/moz/context",{"context":"chrome"})
            try:
                messages=d.js("return Services.console.getMessageArray().filter(m=>m.sourceName && m.sourceName.startsWith(arguments[0]) && m.errorMessage).map(m=>({message:m.errorMessage,source:m.sourceName,line:m.lineNumber}));",base)
            finally:
                d.command("/moz/context",{"context":"content"})
            assert not messages,messages
            return messages
        check("no-bundled-script-errors",errors)
    finally:
        if d: d.close()
        if "server" in locals(): server.shutdown()
        (out/"firefox-exact.json").write_text(json.dumps(report,indent=2))
    return report

def upgrade(args,out):
    with zipfile.ZipFile(args.zip) as archive:
        archive_version = json.loads(archive.read("manifest.json"))["version"]
    evidence = {"method":f"Upgrade to {archive_version} in a copied disposable Firefox profile; target installed as a temporary unsigned ZIP","checks":{}}
    before = json.loads(args.before.read_text())
    with tempfile.TemporaryDirectory(prefix="purrple-upgrade-") as temp:
        profile = Path(temp)/"profile"
        shutil.copytree(args.profile,profile,ignore=shutil.ignore_patterns("lock", ".parentlock", "parent.lock"))
        d = native.Driver(profile)
        try:
            base = install(d,args.zip)
            d.navigate(base + "app.html")
            d.wait("return !document.getElementById('main').hidden")
            after = d.state()
            for field in ["wallet","owned","drafts","talk"]:
                evidence["checks"][field] = before[field] == after[field]
            for field in ["ledger","focusHistory"]:
                evidence["checks"][field] = len(before[field]) == len(after[field]) and all(
                    all(value==updated.get(key) for key,value in old.items())
                    for old,updated in zip(before[field],after[field]))
            for field in ["settings","equipped","focus"]:
                original, migrated = before[field], after[field]
                evidence["checks"][field] = (
                    original == migrated if original is None or migrated is None
                    else all(value==migrated.get(key) for key,value in original.items())
                )
            if "calendar" in before:
                evidence["checks"]["calendar-blocks"] = before["calendar"]["blocks"] == after["calendar"]["blocks"]
            if "companion" in before:
                for field in ["rounds","discoveries","xp","room"]:
                    evidence["checks"][f"companion-{field}"] = before["companion"][field] == after["companion"][field]
            evidence["checks"]["tasks"] = all(old.get("id")==new.get("id") and old.get("title")==new.get("title") and old.get("effort")==new.get("effort") and old.get("done")==new.get("done") for old,new in zip(before["tasks"],after["tasks"])) and len(before["tasks"])==len(after["tasks"])
            if before["focus"]:
                evidence["legacy_focus_policy"] = after["focus"].get("rule")
                evidence["checks"]["timer-rule-preserved"] = evidence["legacy_focus_policy"] == before["focus"].get("rule",1)
            evidence["checks"]["saved-version-changed"] = d.js("return browser.runtime.getManifest().version") == archive_version
            for name,value in evidence["checks"].items():
                print("UPGRADE","PASS" if value else "FAIL",name,flush=True)
        finally:
            d.close()
            (out/"firefox-upgrade.json").write_text(json.dumps(evidence,indent=2))
    return evidence

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("zip",nargs="?",type=Path,default=ROOT.parent/"dist/Purrple_Firefox_Extension.zip")
    parser.add_argument("--out",type=Path,default=ROOT.parent/"verification/firefox-package")
    parser.add_argument("--profile",type=Path,help="Disposable prior-version Firefox profile to copy")
    parser.add_argument("--before",type=Path,help="State JSON captured from the prior version in that profile")
    args=parser.parse_args()
    args.zip=args.zip.resolve()
    out=args.out.resolve()
    out.mkdir(parents=True,exist_ok=True)
    native.OUT=out
    report=exact(args,out)
    bad = not all(c["pass"] for c in report["checks"].values())
    if bool(args.profile) != bool(args.before):
        parser.error("Pass both --profile and --before to run the optional upgrade fixture.")
    if args.profile:
        result=upgrade(args,out)
        bad = bad or not all(result["checks"].values())
    sys.exit(bad)

if __name__ == "__main__":
    main()
