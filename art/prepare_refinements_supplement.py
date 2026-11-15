#!/usr/bin/env python3
"""Prepare six additional illustrated actions without changing the base atlases."""
from pathlib import Path
import importlib.util
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/refinement-source';OUT=ROOT/'extension/assets/refinement'
spec=importlib.util.spec_from_file_location('refinement_prepare',ROOT/'art/prepare_refinements.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
PACKS={
 'groombrush':{'scale':.92,'clips':{'groom':list(range(12))}},
 'brush-only':{'scale':1.02,'clips':{'brush':list(range(24))}},
 'studyread':{'scale':.93,'clips':{'study':list(range(12)),'read':list(range(12,24))}},
 'patwake':{'scale':.98,'clips':{'pat':list(range(12)),'wake':list(range(12,24))}}
}
TIMINGS={'groom':90,'brush':60,'study':105,'read':120,'pat':95,'wake':105}

def clean(cell,clip):
 im=base.clean(cell)
 if clip not in ['brush','study','read']:return im
 a=np.array(cell.convert('RGBA'));rgb=a[:,:,:3].astype(np.int16)
 candidate=(a[:,:,3]>200)&((rgb.max(2)-rgb.min(2))>18)
 lab,n=ndi.label(candidate);mask=np.array(im.getchannel('A'))>200
 r,g,b=rgb.transpose(2,0,1)
 wood=(r>150)&(g>90)&(b<180)&(r>g*1.12)&candidate
 for k,sl in enumerate(ndi.find_objects(lab),1):
  if sl is None:continue
  ys,xs=sl;part=lab[sl]==k;area=int(part.sum())
  keep_brush=clip=='brush' and area>45 and xs.start>60 and (wood[sl]&part).sum()>12
  keep_book=clip in ['study','read'] and area>100 and xs.stop-xs.start>60 and ys.start>120
  if keep_brush or keep_book:mask[sl]|=part
 mask=ndi.binary_fill_holes(mask)
 a[:,:,3]=np.where(mask,255,0);a[~mask,:3]=0
 return Image.fromarray(a,'RGBA')

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 data={'version':1,'sprites':{},'poses':{},'provenance':{'tool':'built-in image_gen','runtimeAI':False,'rawSheetCount':4,'rawIllustratedCells':96,'acceptedDistinctSourceCells':84,'rejectedSourceCells':[{'pack':'groombrush','cells':list(range(12,24)),'reason':'superseded by the contained 24-pose brush-only sheet after edge review'}],'frameSize':256,'baseline':244}}
 review=[];report=[]
 for pack,cfg in PACKS.items():
  source=Image.open(SOURCE/f'{pack}-original.png').convert('RGBA')
  if source.size!=(1536,1024):raise ValueError(f'{pack}: nonuniform grid')
  for clip,indices in cfg['clips'].items():
   cells=[];poses=[]
   for key,index in enumerate(indices):
    raw=source.crop((index%6*256,index//6*256,(index%6+1)*256,(index//6+1)*256))
    cleaned=clean(raw,clip)
    if clip=='wake':
     s=cfg['scale'];box=cleaned.getbbox();src_lm=base.wardrobe.landmarks(cleaned,clip,key)
     dx=round(128-src_lm['eye'][0]*s)
     dx=round(min(253-box[2]*s,max(3-box[0]*s,dx)))
     dy=round(244-box[3]*s)
     cell=Image.new('RGBA',(256,256));cell.alpha_composite(cleaned.resize((round(256*s),round(256*s)),Image.Resampling.NEAREST),(dx,dy))
     lm=base.wardrobe.landmarks(cell,clip,key);lm['baseline']=244;lm['paws']=[];lm['neckMask']={'type':'silhouette'}
    else:cell,lm=base.register(cleaned,clip,cfg['scale'],key)
    # Closed eyes and paw-to-cheek contact do not enlarge the skull.
    if clip in ['groom','brush','study','read','pat','wake']:lm['headWidth']=146 if clip in ['groom','brush','wake'] else 148
    ex,ey=lm['eye'];w=lm['headWidth']
    if clip in ['groom','brush','pat']:
     lm['neck']=[round(ex,2),round(ey+w*.38,2)]
    if clip in ['study','read']:
     lm['neck']=[round(ex,2),round(ey+w*.36,2)]
    if clip=='wake' and key<5:
     ex,ey=lm['eye'];w=lm['headWidth']
     lm['neck']=[round(ex+w*.33,2),round(ey+w*.20,2)]
    elif clip=='wake' and key<9:
     lm['neck']=[round(ex+w*.18,2),round(ey+w*.28,2)]
    elif clip=='wake':lm['neck']=[round(ex,2),round(ey+w*.38,2)]
    if clip in ['study','read']:
     lm['restoreProps']=True
     lm['propY']=round(lm['eye'][1]+lm['headWidth']*.48,2)
    if clip=='groom':
     lm['restoreProps']=True;lm['propY']=round(lm['eye'][1]+lm['headWidth']*.55,2)
    if clip=='brush':
     a=np.array(cell);r,g,b=a[:,:,:3].astype(np.int16).transpose(2,0,1)
     # Purple fur shadows can satisfy r>g, so a wood mask MUST also require
     # green above blue. Without that constraint the foreground rectangle
     # spans the whole cat and later erases neckwear during restoration.
     rows=np.indices(a.shape[:2])[0]
     wood=(a[:,:,3]>200)&(r>g+20)&(g>b+5)&(rows<lm['eye'][1]-lm['headWidth']*.20)
     yy,xx=np.nonzero(wood)
     if len(xx):
      x0=max(0,int(xx.min())-4);x1=min(255,int(xx.max())+5)
      y0=max(0,int(yy.min())-4);y1=min(255,int(yy.max())+16)
      lm['foregroundPolygons']=[[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]]
     # The floating brush is not the kitten's crown. Use the face's anatomy
     # for headwear placement, and measure the actual warm-pink ear openings
     # rather than deriving ear polygons from a prop-contaminated top edge.
     ex,ey=lm['eye'];w=lm['headWidth'];lm['crownY']=round(ey-w*.36,2)
     alpha=a[:,:,3]>200;rows=np.indices(alpha.shape)[0]
     pink=alpha&(r-b>28)&(r-g>45)&(b-g>8)&(rows<ey-18)
     labels,n=ndi.label(pink);ears=[]
     for label,sl in enumerate(ndi.find_objects(labels),1):
      if sl is None:continue
      ys,xs=sl;part=labels[sl]==label;area=int(part.sum())
      if area<55 or xs.stop-xs.start<6 or ys.stop-ys.start<8:continue
      py,px=np.nonzero(part);points=np.stack([px+xs.start,py+ys.start],axis=1)
      hull=points[ConvexHull(points).vertices];centre=hull.mean(axis=0)
      hull=centre+(hull-centre)*1.25
      ears.append((area,[[round(float(x),1),round(float(y),1)] for x,y in hull],
                   [max(0,xs.start-5),max(0,ys.start-6),min(255,xs.stop+5),min(255,ys.stop+6)]))
     ears.sort(key=lambda p:p[0],reverse=True)
     lm['earPolygons']=[e[1] for e in ears[:2]]
     lm['earBoxes']=[e[2] for e in ears[:2]]
     if len(lm['earPolygons'])<2:
      # Anatomical fallback retains valid on-canvas ear openings when a
      # particularly relaxed ear has only a few isolated pink pixels.
      lm['earPolygons']=[[[round(ex+s*w*.45,1),round(lm['crownY']+w*.14,1)],
                          [round(ex+s*w*.36,1),round(lm['crownY']-w*.20,1)],
                          [round(ex+s*w*.16,1),round(lm['crownY']+w*.02,1)]] for s in [-1,1]]
     # A prop restoration region must never be able to repaint the whole cat
     # over an equipped item. Keep these assertions in the preparation step.
     assert lm.get('foregroundPolygons'), f'brush {key}: missing tool mask'
     for polygon in lm['foregroundPolygons']:
      px=[p[0] for p in polygon];py=[p[1] for p in polygon]
      assert max(px)-min(px)<100 and max(py)-min(py)<70, f'brush {key}: oversized tool mask'
      assert max(py)<ey+5, f'brush {key}: tool mask reaches face or neck'
     assert ey-w*.55<lm['crownY']<ey-w*.20, f'brush {key}: crown belongs to prop'
     assert all(0<=v<=255 for p in lm['earPolygons'] for pt in p for v in pt), f'brush {key}: off-canvas ear mask'
    ex,ey=lm['eye'];w=lm['headWidth']
    lm['headMask']={'type':'ellipse','cx':ex,'cy':ey-w*.10,'rx':w*.54,'ry':w*.51,'angle':lm['angle']}
    lm['sourceCell']=index;cells.append(cell);poses.append(lm)
    report.append({'clip':clip,'key':key,'sourceCell':index,'bbox':cell.getbbox(),'eye':lm['eye'],'headWidth':w})
   # Floating props must not accidentally register the cat by their outline.
   # In the brush sequence measured eyes are the stable anatomical anchor.
   atlas=Image.new('RGBA',(1536,math.ceil(len(cells)/6)*256));frames=[]
   for key,cell in enumerate(cells):
    x=key%6*256;y=key//6*256;atlas.alpha_composite(cell,(x,y));review.append((clip,key,cell))
    frames.append({'x':x,'y':y,'w':256,'h':256,'durationMs':TIMINGS[clip],'sourceCell':indices[key]})
   atlas.save(OUT/f'{clip}.png',optimize=True)
   data['sprites'][clip]={'src':f'assets/refinement/{clip}.png','frames':frames,'native':256,'baseline':244,'sourceKeys':len(cells),'sourcePack':pack,'registration':'anatomical head centre / floor','loop':clip in ['groom','study','read','brush','pat']}
   data['poses'][clip]=poses
 (OUT/'supplemental-manifest.json').write_text(json.dumps(data,indent=2)+'\n')
 (SOURCE/'supplemental-registration-report.json').write_text(json.dumps(report,indent=2)+'\n')
 try:font=ImageFont.truetype(str(ROOT/'extension/assets/fonts/NunitoSans.ttf'),14)
 except OSError:font=ImageFont.load_default()
 sheet=Image.new('RGB',(1536,math.ceil(len(review)/12)*158),'#f8f3fb');dr=ImageDraw.Draw(sheet)
 for i,(clip,key,cell) in enumerate(review):
  x=i%12*128;y=i//12*158;small=cell.resize((128,128),Image.Resampling.NEAREST)
  sheet.paste(small,(x,y),small);dr.text((x+4,y+132),f'{clip} {key+1}',font=font,fill='#50345e')
 sheet.save(SOURCE/'supplemental-contact-sheet.png')
 print(json.dumps({'clips':{k:len(s['frames']) for k,s in data['sprites'].items()},'acceptedUniqueDrawings':84},indent=2))

if __name__=='__main__':main()
