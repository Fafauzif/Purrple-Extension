#!/usr/bin/env python3
"""Prepare an unlisted Mozilla signing submission; uploading requires --submit.

Credentials are read by web-ext from WEB_EXT_API_KEY / WEB_EXT_API_SECRET.
This script never writes them to disk or includes them in command arguments.
"""
from pathlib import Path
import argparse,json,os,shutil,subprocess,sys

ROOT=Path(__file__).resolve().parents[1]
EXPECTED_ID='purrple-companion@purrple.local'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--submit',action='store_true',help='Explicitly upload this extension to Mozilla for unlisted signing')
    args=parser.parse_args()
    manifest=json.loads((ROOT/'extension/manifest.json').read_text())
    if manifest.get('browser_specific_settings',{}).get('gecko',{}).get('id')!=EXPECTED_ID:
        raise SystemExit('The stable Purrple extension ID changed. Resolve identity and migration before signing.')
    tool=shutil.which('web-ext')
    artifact=ROOT/'dist/signed'
    commands=[['web-ext','lint','--source-dir',str(ROOT/'extension')],
              ['web-ext','sign','--channel=unlisted','--source-dir',str(ROOT/'extension'),'--artifacts-dir',str(artifact)]]
    print(f"Purrple {manifest['version']} · unlisted Mozilla signing")
    print('Extension identity:',EXPECTED_ID)
    print('Signed artifacts directory:',artifact)
    if not args.submit:
        print('Preparation only. Nothing has been uploaded or signed.')
        print('Install Mozilla web-ext, provide WEB_EXT_API_KEY and WEB_EXT_API_SECRET through your private session environment, then rerun with --submit.')
        for command in commands:print('Command:', ' '.join(command))
        return
    if not tool:raise SystemExit('Install Mozilla web-ext first. See docs/MOZILLA-SIGNING.md.')
    if not all(os.environ.get(key) for key in ['WEB_EXT_API_KEY','WEB_EXT_API_SECRET']):
        raise SystemExit('The private signing environment is incomplete. No credentials were printed and no upload was attempted.')
    artifact.mkdir(parents=True,exist_ok=True)
    for command in commands:
        command[0]=tool
        subprocess.run(command,cwd=ROOT,check=True)
    print('Signing command completed. Inspect Mozilla’s response and the downloaded XPI before sharing it. A local ZIP filename alone is not evidence of signing.')

if __name__=='__main__':
    try:main()
    except subprocess.CalledProcessError as error:sys.exit(error.returncode)
