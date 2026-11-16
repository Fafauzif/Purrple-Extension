"""Merge local refinement art into the shared renderer's build-time data.
No runtime fetch and no network dependency. Original metadata is retained.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'extension/js/renderer-data.js'
BASE=ROOT/'art/renderer-base.json'
if not BASE.exists():
    text=TARGET.read_text();BASE.write_text(json.dumps(json.loads(text.split('=',1)[1].rstrip(';\n')),separators=(',',':'))+'\n')
data=json.loads(BASE.read_text())
manifest=json.loads((ROOT/'extension/assets/refinement/manifest.json').read_text())
supplement_path=ROOT/'extension/assets/refinement/supplemental-manifest.json'
if supplement_path.exists():
    supplement=json.loads(supplement_path.read_text())
    manifest['sprites'].update(supplement['sprites'])
    manifest['poses'].update(supplement['poses'])
    manifest['provenance']={'base':manifest['provenance'],'supplemental':supplement['provenance']}
for ident,spec in manifest['sprites'].items():
    spec=dict(spec,refined=True)
    data['sprites'][ident]=spec
    poses=manifest['poses'][ident]
    assert len(poses)==len(spec['frames'])
    for pose in poses:
        pose['family']='profile' if pose.get('profile') else 'held' if ident=='held' else 'front'
    data['poses'][ident]=poses
anchors_path=ROOT/'art/renderer-motion-anchors.json'
if anchors_path.exists():
    anchors=json.loads(anchors_path.read_text())
    for ident,frames in anchors.items():
        for pose,extra in zip(data['poses'][ident],frames):pose.update(extra)
for ident,poses in data['poses'].items():
    for pose in poses:
        pose.setdefault('family','profile' if pose.get('profile') else 'sleep' if ident=='sleep' else 'held' if ident in ['held','wiggle'] else 'front')
# Register the visible band and its local angle separately from the skeleton
# neck used for the animation mesh. Corrections travel with their source pose.
fits=json.loads((ROOT/'art/neckwear-fit.json').read_text())
for ident,poses in data['poses'].items():
    for key,pose in enumerate(poses):
        cfg={**fits['default'], **fits['families'].get(pose['family'],{}),
             **fits['clips'].get(ident,{}), **fits['frames'].get(ident,{}).get(str(key),{})}
        x,y=pose[cfg['relativeTo']]
        dx,dy=cfg['offset']
        width=pose['headWidth']
        bottom=(data['sprites'][ident].get('baseline') or 244)-cfg.get('floorGap',9)
        pose['neckFit']={'x':round(x+dx*width,2), 'y':round(min(bottom,y+dy*width),2),
                         'angle':cfg.get('angle',pose['angle']), 'scale':cfg['scale']}
for ident,pivot in fits['itemPivots'].items():
    data['items'][ident]['pivot']=pivot

data['motionProvenance']=manifest['provenance']
data['motionContract']={'geometryHz':30,'crossfade':False,'intermediateGeometry':'registered triangular raster mesh','sourceCountIsIllustrationCount':True}
# Local family-level refinements; never omit an equipped item in difficult poses.
data['fitOverrides']={
 'cozy-beanie':{'profile':{'scaleX':.96,'scaleY':1.02,'y':1},'sleep':{'scaleX':.95,'scaleY':.98,'y':1}},
 'stargazer-hat':{'sleep':{'scaleX':.95,'scaleY':.94,'y':1}},
}
TARGET.write_text('/* Build-time merged local artwork; see art/merge_renderer_data.py. */\nglobalThis.PurrpleArt='+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps({'refined_clips':len(manifest['sprites']),'refined_entries':sum(len(x['frames']) for x in manifest['sprites'].values()),'all_source_rows':len(data['sprites'])}))
