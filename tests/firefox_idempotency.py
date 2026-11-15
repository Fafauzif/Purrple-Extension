#!/usr/bin/env python3
"""Native durable request journal and absolute completion, across Firefox restart."""
import contextlib,json,shutil,os
from pathlib import Path
import firefox_native as native
ROOT=Path(__file__).resolve().parents[1];EXT=Path(os.environ.get('PURRPLE_EXTENSION_DIR',str(ROOT/'extension')));OUT=ROOT/'verification/firefox-idempotency'
def main():
 OUT.mkdir(parents=True,exist_ok=True);native.OUT=OUT;d=None;report={'native_extension':True,'mocked_apis':False,'installed_from':str(EXT),'runtime_sha256':os.environ.get('PURRPLE_RUNTIME_SHA256'),'checks':[]}
 def check(name,value,detail=None):report['checks'].append({'check':name,'pass':bool(value),'detail':detail});print(('PASS 'if value else'FAIL ')+name,flush=True)
 profile=ROOT/'qa-runtime/idempotency-profile'
 if profile.exists():shutil.rmtree(profile)
 def install():
  nonlocal d
  d=native.Driver(profile);report['browser_version']=d.capabilities['browserVersion'];d.command('/moz/addon/install',{'path':str(EXT),'temporary':True});d.command('/moz/context',{'context':'chrome'});uuid=d.js("window.SidebarController.hide();return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['purrple-companion@purrple.local'];");d.command('/moz/context',{'context':'content'});d.navigate('moz-extension://'+uuid+'/app.html');d.wait('return globalThis.PurrpleUI?.getState()')
 try:
  install();r=d.action('TASK_ADD',title='Absolute completion retry',effort='large');task=r['state']['tasks'][0];request={'type':'ACTION','requestId':'native-absolute-complete','action':{'type':'TASK_SET_DONE','id':task['id'],'done':True}}
  d.async_js('const done=arguments[arguments.length-1];Promise.all(Array.from({length:8},()=>browser.runtime.sendMessage(arguments[0]))).then(done);',request)
  state=d.state();check('native-eight-absolute-completions-stay-done-award-once',state['tasks'][0]['done'] and state['wallet']['balance']==30 and len([l for l in state['ledger']if l['amount']>0])==1)
  purchase={'type':'ACTION','requestId':'native-journal-buy','action':{'type':'SHOP_BUY','id':'moon-bow'}};d.message(purchase);check('native-purchase-initial-balance',d.state()['wallet']['balance']==10)
  d.close();d=None;install()
  duplicate=d.message(request);state=d.state();check('native-completion-request-deduplicates-after-browser-restart',duplicate.get('ok') and state['tasks'][0]['done'] and state['wallet']['balance']==10)
  duplicate=d.message(purchase);check('native-purchase-request-deduplicates-after-browser-restart',duplicate.get('ok') and d.state()['wallet']['balance']==10 and d.state()['owned'].count('moon-bow')==1)
  mismatch=d.message({'type':'ACTION','requestId':'native-journal-buy','action':{'type':'EQUIP','slot':'head','id':'moon-bow'}});check('native-request-id-reuse-with-different-action-rejected',not mismatch.get('ok') and d.state()['equipped']['head'] is None,mismatch)
  repeated=d.action('TASK_SET_DONE',id=task['id'],done=True);check('native-new-request-absolute-completion-remains-idempotent',repeated.get('ok') and repeated['state']['tasks'][0]['done'] and repeated['state']['wallet']['balance']==10)
  for i in range(205):d.message({'type':'ACTION','requestId':'native-journal-bound-'+str(i),'action':{'type':'QUICK_TASK_DRAFT','text':'Journal boundary '+str(i)}})
  journal=d.async_js('const done=arguments[arguments.length-1];browser.storage.local.get("purrpleRequestJournal").then(done);')
  check('native-durable-journal-evicts-to-two-hundred-after-overflow',isinstance(journal.get('purrpleRequestJournal'),list) and len(journal['purrpleRequestJournal'])==200 and all(r['id']!='native-absolute-complete' for r in journal['purrpleRequestJournal']),{'entries':len(journal.get('purrpleRequestJournal',[]))})
  evicted=d.message(request);check('native-permanent-ledger-prevents-bonus-after-journal-eviction',evicted.get('ok') and d.state()['wallet']['balance']==10 and d.state()['tasks'][0]['done'])
 except Exception as e:report['error']=str(e);check('native-idempotency-harness-completes',False,str(e))
 finally:
  if d:d.close()
  report['passed']=sum(c['pass']for c in report['checks']);report['failed']=sum(not c['pass']for c in report['checks']);(OUT/'native-idempotency-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 if report['failed']:raise SystemExit(1)
if __name__=='__main__':main()
