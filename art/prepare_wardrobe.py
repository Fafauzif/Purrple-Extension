#!/usr/bin/env python3
"""Prepare generated accessory cutouts and measure all180 illustrated poses.
No cat artwork is redrawn here. Accessory output retains generated pixel art.
"""
from pathlib import Path
import json,math,shutil
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
EXT=ROOT/'extension'
SOURCE=EXT/'assets'
OUT=EXT/'assets/wardrobe'
IDS=['moon-bow','cozy-beanie','star-beret','flower-clip','cloud-cap','crescent-crown',
     'heart-bow','plum-ribbon','stargazer-hat','star-bandana','moon-collar','cozy-scarf',
     'petal-collar','cloud-bib','night-bandana']
ITEMS={
 'moon-bow':dict(slot='head',kind='clip',w=.44,h=.34),
 'cozy-beanie':dict(slot='head',kind='hat',w=.91,h=.39),
 'star-beret':dict(slot='head',kind='hat',w=.87,h=.32),
 'flower-clip':dict(slot='head',kind='clip',w=.35,h=.28),
 'cloud-cap':dict(slot='head',kind='hat',w=.88,h=.31),
 'crescent-crown':dict(slot='head',kind='hat',w=.80,h=.29),
 'heart-bow':dict(slot='head',kind='clip',w=.43,h=.34),
 'plum-ribbon':dict(slot='head',kind='clip',w=.43,h=.28),
 'stargazer-hat':dict(slot='head',kind='hat',w=.88,h=.45),
 'star-bandana':dict(slot='neck',kind='bib',w=.52,h=.28),
 'moon-collar':dict(slot='neck',kind='collar',w=.48,h=.20),
 'cozy-scarf':dict(slot='neck',kind='scarf',w=.53,h=.29),
 'petal-collar':dict(slot='neck',kind='collar',w=.48,h=.21),
 'cloud-bib':dict(slot='neck',kind='bib',w=.51,h=.27),
 'night-bandana':dict(slot='neck',kind='bib',w=.52,h=.28),
}


def accessory_cutouts():
 im=Image.open(ROOT/'art/wardrobe-original.png').convert('RGBA');a=np.array(im)
 r,g,b,alpha=a.transpose(2,0,1).astype(np.int16)
 bad=((r>170)&(b>170)&(g<110))|((r>170)&(b<115)&(g<130))|((b>180)&(r<120)&(g<140))
 keep=(alpha>170)&~bad
 labels,n=ndi.label(keep);components=[]
 for j,sl in enumerate(ndi.find_objects(labels),1):
  if sl is None:continue
  mask=labels[sl]==j;area=int(mask.sum())
  if area>2500:
   yy,xx=sl;components.append((area,(xx.start,yy.start,xx.stop,yy.stop),j))
 components=sorted(components,reverse=True)[:15]
 assert len(components)==15, len(components)
 # Sort into visual rows, then column. Generated portrait grid is intentionally spacious.
 components.sort(key=lambda v:(v[1][1]+v[1][3])/2)
 ordered=[]
 for row in range(5):ordered.extend(sorted(components[row*3:row*3+3],key=lambda v:v[1][0]))
 for item,(_,bbox,j) in zip(IDS,ordered):
  mask=ndi.binary_fill_holes(labels==j)
  # Preserve light highlights enclosed by the generated outline; reject detached halos.
  rgba=a.copy();rgba[:,:,3]=np.where(mask & ~bad,255,0).astype(np.uint8)
  rgba[rgba[:,:,3]==0,:3]=0
  cut=Image.fromarray(rgba).crop(bbox)
  cut.save(OUT/f'{item}.png')
  ITEMS[item].update(src=f'assets/wardrobe/{item}.png',native=list(cut.size))


def components(mask):
 lab,n=ndi.label(mask);out=[]
 for j,sl in enumerate(ndi.find_objects(lab),1):
  if sl is None:continue
  yy,xx=sl;area=int((lab[sl]==j).sum());w=xx.stop-xx.start;h=yy.stop-yy.start
  out.append(dict(area=area,x=xx.start,y=yy.start,w=w,h=h,cx=(xx.start+xx.stop-1)/2,cy=(yy.start+yy.stop-1)/2))
 return out


def landmarks(im,clip,key):
 a=np.array(im);rgb=a[:,:,:3].astype(np.int16);r,g,b=rgb.transpose(2,0,1);alpha=a[:,:,3]>200
 box=im.getbbox();x0,y0,x1,y1=box;h=y1-y0
 dark=alpha&(r<118)&(g<90)&(b<150)
 candidates=[c for c in components(dark) if c['area']>24 and 4<c['w']<41 and 2<c['h']<37 and c['cy']<y0+h*.75]
 pairs=[]
 for i,c in enumerate(candidates):
  for d in candidates[i+1:]:
   dx=abs(c['cx']-d['cx']);dy=abs(c['cy']-d['cy'])
   if 32<dx<90 and dy<35:
    area=min(c['area'],600)+min(d['area'],600)
    similar=min(c['area'],d['area'])/max(c['area'],d['area'])
    pairs.append((area*similar-dy*3,c,d))
 profile=clip in ['walk','run']
 if pairs and not profile:
  _,c,d=max(pairs,key=lambda t:t[0]);c,d=sorted([c,d],key=lambda c:c['cx'])
  ex=(c['cx']+d['cx'])/2;ey=(c['cy']+d['cy'])/2
  angle=math.atan2(d['cy']-c['cy'],d['cx']-c['cx'])
  width=max(116,min(164,math.hypot(d['cx']-c['cx'],d['cy']-c['cy'])*2.43))
  method='measured paired eyes'
 elif candidates:
  eye=max(candidates,key=lambda c:c['area'])
  width=140 if profile else min(156,max(118,h*.82))
  ex=eye['cx']-(width*.24 if profile else 0);ey=eye['cy']
  angle=0;method='measured profile eye' if profile else 'single-eye estimate'
 else:
  width=min(156,max(115,(x1-x0)*.78));ex=(x0+x1)/2;ey=y0+h*.40;angle=0;method='silhouette estimate'
 # Constrain erroneous dark-region detections, then use semantic posture corrections.
 angle=max(-.55,min(.55,angle))
 if profile:angle=0
 if clip=='sleep':
  # Eye line is tilted in the approved curled pose; its neck is behind the right cheek.
  if not (-.5<angle<-.12):angle=-.36
 if clip=='stretch' or (clip=='toy' and key in [0,1,2,4,5]):
  if ey<145:
   ex=x0+(x1-x0)*.34;ey=y0+h*.66;width=min(150,(x1-x0)*.69);angle=-.20;method+='; crouch correction'
 # Register the actual crown separately from the eyes. A downward gaze must
 # not slide a cap down over the forehead when the head silhouette stays put.
 crown=[]
 for col in range(max(0,round(ex-width*.12)),min(256,round(ex+width*.12))):
  ys=np.flatnonzero(alpha[:,col])
  if len(ys):crown.append(int(ys[0]))
 crownY=float(np.median(crown)) if crown else ey-width*.37
 crownY=min(crownY,ey-width*.22)
 # Pink ear regions locate the real ear openings so hats never paint over them.
 pink=alpha&(r>145)&(r>g*1.10)&(b>g*1.03)&(r>b*.98)
 ears=[c for c in components(pink) if 45<c['area']<1800 and c['cy']<ey-12 and 6<c['h']<80 and 6<c['w']<60]
 ears=sorted(ears,key=lambda c:c['area'],reverse=True)[:2]
 earboxes=[];earpolygons=[]
 for c in ears:
  earboxes.append([max(0,c['x']-7),max(0,c['y']-8),min(256,c['x']+c['w']+7),min(256,c['y']+c['h']+7)])
  yy,xx=np.nonzero(pink[c['y']:c['y']+c['h'],c['x']:c['x']+c['w']])
  points=np.stack([xx+c['x'],yy+c['y']],axis=1)
  if len(points)>3:
   hull=points[ConvexHull(points).vertices];center=hull.mean(axis=0)
   # The convex pink ear triangle expands only enough to restore its plum rim.
   hull=center+(hull-center)*1.28
   earpolygons.append([[round(float(x),1),round(float(y),1)] for x,y in hull])
 if not profile and len(earpolygons)<2:
  # Some generated ears have no isolated pink component. Register conservative
  # triangular openings from the measured crown instead of covering the ears.
  for side in [-1,1]:
   pts=[(ex+side*width*.44,crownY+width*.18),
        (ex+side*width*.35,crownY-width*.22),
        (ex+side*width*.16,crownY+width*.03)]
   rotated=[]
   for x,y in pts:
    dx,dy=x-ex,y-ey
    rotated.append([round(ex+dx*math.cos(angle)-dy*math.sin(angle),1),
                    round(ey+dx*math.sin(angle)+dy*math.cos(angle),1)])
   earpolygons.append(rotated)
 if clip=='sleep' or (clip=='wake' and key in [0,1]):neck=[ex+width*.36,ey+width*.16]
 elif clip=='stretch' or (clip=='toy' and key in [0,1,2,4,5]):neck=[ex+width*.39,ey+width*.19]
 elif ey>160 and h<175:neck=[ex+width*.46,ey+width*.035]
 elif clip in ['study','read','heart','reminder']:neck=[ex,ey+width*.35]
 else:neck=[ex,ey+width*.45]
 prop=clip in ['study','read','heart','reminder','think','groom']
 return dict(eye=[round(ex,2),round(ey,2)],crownY=round(crownY,2),headWidth=round(width,2),angle=round(angle,4),
             profile=profile,earBoxes=earboxes,earPolygons=earpolygons,neck=[round(v,2) for v in neck],
             restoreProps=prop,propY=round(ey+width*(.45 if clip in ['study','read','heart','reminder'] else .58),2),bbox=list(box),method=method)


def main():
 OUT.mkdir(parents=True,exist_ok=True)
 accessory_cutouts()
 manifest=json.loads((SOURCE/'atlas-manifest.json').read_text());poses={}
 for clip,spec in manifest.items():
  atlas=Image.open(EXT/spec['src']).convert('RGBA');poses[clip]=[]
  for key,f in enumerate(spec['frames']):
   im=atlas.crop((f['x'],f['y'],f['x']+256,f['y']+256));poses[clip].append(landmarks(im,clip,key))
 data=dict(sprites=manifest,items=ITEMS,poses=poses)
 (ROOT/'art/pose-registration.json').write_text(json.dumps(poses,indent=2)+'\n')
 (ROOT/'art/wardrobe-data.json').write_text(json.dumps(data,indent=2)+'\n')
 (EXT/'js/renderer-data.js').write_text('/* Generated from approved local artwork; no runtime requests beyond extension assets. */\nglobalThis.PurrpleArt='+json.dumps(data,separators=(',',':'))+';\n')
 print('Prepared',len(ITEMS),'accessories and',sum(map(len,poses.values())),'frame-specific registrations')


if __name__=='__main__':main()
