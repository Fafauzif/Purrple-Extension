"""Measure two anatomical paw groups from the fixed illustrations.
Only cream paw-tip components below the neck are eligible. Intermediate raster
geometry uses these positions; this never generates or redraws character art.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'extension/assets/refinement/manifest.json').read_text())
result={}
for clip in ['walk','run','knead']:
    spec=m['sprites'][clip];atlas=Image.open(ROOT/'extension'/spec['src']).convert('RGBA');out=[]
    for index,(f,p) in enumerate(zip(spec['frames'],m['poses'][clip])):
        im=atlas.crop((f['x'],f['y'],f['x']+256,f['y']+256));arr=np.array(im).astype(np.int16)
        r,g,b,a=arr.transpose(2,0,1);yy,xx=np.indices((256,256));ey=p['eye'][0];base=spec['baseline']
        mask=(a>200)&(r>175)&(g>145)&(r-b>=-7)&(r-g<65)&(yy>max(p['neck'][1]+8,base-64))
        labels,n=ndimage.label(mask);components=[]
        for ident in range(1,n+1):
            sy,sx=np.nonzero(labels==ident)
            if len(sx)<7 or sy.max()<base-48:continue
            components.append({'x':float(sx.mean()),'y':float(sy.mean()),'area':len(sx),'bottom':int(sy.max())})
        expected=[(ey-63,base-13),(ey+17,base-13)] if p.get('profile') else [(ey-24,base-13),(ey+24,base-13)]
        chosen=[]
        if p.get('profile'):
            # Measure real support tips from the bottom silhouette in rear/front
            # anatomical regions. Cream-only detection can mistake the belly
            # for a foot when an illustrated paw is lavender rather than cream.
            for left,right,first in [(int(p['bbox'][0]),int(ey-18),True),(int(ey-25),int(p['bbox'][2]),False)]:
                region=(a>200)&(xx>=left)&(xx<=right)&(yy>p['neck'][1]+8)
                py,px=np.nonzero(region)
                if len(px):
                    bottom=int(py.max());tips=region&(yy>=bottom-5);ls,n=ndimage.label(tips);opts=[]
                    for ident in range(1,n+1):
                        sy,sx=np.nonzero(ls==ident)
                        if len(sx)>=3:opts.append({'x':float(sx.mean()),'y':float(sy.mean()),'area':len(sx),'bottom':int(sy.max())})
                    c=(min(opts,key=lambda c:c['x']) if first else max(opts,key=lambda c:c['x'])) if opts else {'x':float(px.mean()),'y':float(py.max()),'area':len(px),'bottom':bottom}
                    chosen.append(c)
        if not chosen:
            for ex,eyy in expected:
                options=[c for c in components if c not in chosen]
                if options:
                    c=min(options,key=lambda c:(c['x']-ex)**2+(c['y']-eyy)**2);chosen.append(c)
                else:chosen.append({'x':ex,'y':eyy,'area':0,'bottom':base})
        out.append({'paws':[[round(c['x'],2),round(c['y'],2)] for c in chosen],
                    'pawAnchorMethod':'measured lower-silhouette support tips; rear/front groups' if p.get('profile') else 'cream paw-tip component centroids; left/right groups',
                    'pawComponents':[c['area'] for c in chosen]})
    result[clip]=out
(ROOT/'art/renderer-motion-anchors.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:sum(all(a>0 for a in f['pawComponents']) for f in v) for k,v in result.items()}))
