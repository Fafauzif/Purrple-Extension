#!/usr/bin/env python3
"""Prepare the new illustrated cels. This crops, cleans alpha and registers art.

It does not draw a cat or synthesize intermediate illustrations. Original
generated sheets and exact prompts remain in refinement-source for reproducibility.
"""
from pathlib import Path
import importlib.util
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/refinement-source'
OUT=ROOT/'extension/assets/refinement'
SIZE=256
spec=importlib.util.spec_from_file_location('wardrobe_measure',ROOT/'art/prepare_wardrobe.py')
wardrobe=importlib.util.module_from_spec(spec);spec.loader.exec_module(wardrobe)

PACKS={
 'locomotion': {'scale':1.05,'clips':{'walk':list(range(12)),'run':list(range(12,24))}},
 'heldcry': {'scale':1.0,'clips':{'held':list(range(12)),'cry':list(range(12,24)),
                                'paw-wipe':[17,18,19],'soothe':[20,21,22,23]}},
 'jumpimpact': {'scale':1.0,'clips':{'jump':list(range(12)),'impact':list(range(12,24)),
                                   'land':[21,22,23,12]}},
 'social': {'scale':1.0,'clips':{'wave':list(range(6,12)),'nuzzle':list(range(12,18)),
                              'loaf':list(range(18,24))}},
 'turnknead': {'scale':.90,'clips':{'turn':list(range(12)),'knead':list(range(12,24))}}
}
TIMINGS={'walk':64,'run':47,'held':80,'cry':100,'paw-wipe':120,'soothe':125,
         'jump':70,'impact':47,'land':75,'wave':110,'nuzzle':140,'loaf':150,'turn':75,'knead':88}

def clean(cell):
 a=np.array(cell.convert('RGBA'));rgb=a[:,:,:3].astype(np.int16)
 # Generated transparent sheets sometimes retain a translucent neutral or
 # purple matte. Cat pixels are opaque. Keep connected coloured foreground,
 # then fill its enclosed cream fur and white eye highlights.
 candidate=(a[:,:,3]>200)&((rgb.max(2)-rgb.min(2))>18)
 lab,n=ndi.label(candidate);co=np.bincount(lab.ravel());co[0]=0
 if not n or co.max()<500:raise ValueError('Missing sprite foreground')
 mask=ndi.binary_fill_holes(lab==co.argmax())
 yy,xx=np.nonzero(mask);bbox=(xx.min(),yy.min(),xx.max()+1,yy.max()+1)
 # Isolated blue tear droplets are legitimate foreground, not cleanup debris.
 r,g,b=rgb.transpose(2,0,1)
 tears=(a[:,:,3]>200)&(b>r*1.15)&(g>r*1.08)&(b>110)
 tl,tn=ndi.label(tears)
 for k,sl in enumerate(ndi.find_objects(tl),1):
  if sl is None:continue
  ys,xs=sl;part=tl[sl]==k
  if part.sum()>12 and bbox[0]-15<xs.start<bbox[2]+15 and bbox[1]+35<ys.start<bbox[3]:
   mask[sl]|=part
 a[:,:,3]=np.where(mask,255,0);a[~mask,:3]=0
 im=Image.fromarray(a,'RGBA')
 return im

def register(im,clip,scale,key):
 srcbox=im.getbbox();profile=clip in ['walk','run','jump'] or (clip=='turn' and key in [3,4,5,6,7,8])
 lm=wardrobe.landmarks(im,'walk' if profile else clip,key)
 ex,ey=lm['eye'];b=srcbox
 # Keep the source's anatomical head centre stable, independent of tail and
 # raised paws. Every frame in a pack receives one shared scale.
 dx=round((153 if profile else 128)-ex*scale)
 dy=round((114-ey*scale) if clip=='held' else (244-b[3]*scale))
 resized=im.resize((round(SIZE*scale),round(SIZE*scale)),Image.Resampling.NEAREST)
 dst=Image.new('RGBA',(SIZE,SIZE));dst.alpha_composite(resized,(dx,dy))
 # Profile registration uses the measured eye, not the silhouette's centre.
 measured=wardrobe.landmarks(dst,'walk' if profile else clip,key)
 measured['profile']=profile
 # The closed-eye expression does not widen the head. Automatic eye pairing
 # can select cheeks/eyelashes, so each stable anatomical family has an
 # explicit width; deliberate impact squash alone changes the head width.
 widths={'held':134,'cry':146,'paw-wipe':146,'soothe':146,'wave':151,
         'nuzzle':151,'loaf':151,'knead':148}
 if clip in widths:measured['headWidth']=widths[clip]
 measured['sourceCell']=key
 measured['baseline']=244
 measured['paws']=[]
 a=np.array(dst);alpha=a[:,:,3]>200
 # Semantically useful protected foreground area for neckwear and gestures.
 ex,ey=measured['eye'];w=measured['headWidth']
 measured['headMask']={'type':'ellipse','cx':ex,'cy':ey-w*.10,'rx':w*.54,'ry':w*.51,'angle':measured['angle']}
 measured['neckMask']={'type':'silhouette'}
 measured['method']='measured illustration; shared-scale anatomical registration; '+measured['method']
 if profile:
  measured['neck']=[round(ex+w*.03,2),round(ey+w*.43,2)]
 return dst,measured

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 data={'version':1,'sprites':{},'poses':{},'provenance':{'tool':'built-in image_gen','runtimeAI':False,'rawSheetCount':5,'rawIllustratedCells':120,'acceptedDistinctSourceCells':114,'reactionSubsetsReuseSourceCells':True,'frameSize':256,'baseline':244}}
 review=[];stats=[]
 for pack,cfg in PACKS.items():
  original=Image.open(SOURCE/f'{pack}-original.png').convert('RGBA')
  if original.size!=(1536,1024):raise ValueError(f'{pack}: unexpected grid {original.size}')
  cleaned={i:clean(original.crop((i%6*256,i//6*256,(i%6+1)*256,(i//6+1)*256))) for i in range(24)}
  for clip,indices in cfg['clips'].items():
   atlas=Image.new('RGBA',(1536,math.ceil(len(indices)/6)*256));frames=[];poses=[]
   for j,index in enumerate(indices):
    cell,lm=register(cleaned[index],clip,cfg['scale'],j)
    x=j%6*256;y=j//6*256;atlas.alpha_composite(cell,(x,y))
    frames.append({'x':x,'y':y,'w':256,'h':256,'durationMs':TIMINGS[clip],'sourceCell':index})
    poses.append(lm);review.append((clip,j,cell));stats.append({'clip':clip,'key':j,'bbox':cell.getbbox(),'eye':lm['eye'],'method':lm['method']})
   atlas.save(OUT/f'{clip}.png',optimize=True)
   data['sprites'][clip]={'src':f'assets/refinement/{clip}.png','frames':frames,'native':256,'baseline':244,'sourceKeys':len(indices),'sourcePack':pack,'registration':'anatomical head centre / floor','loop':clip in ['walk','run','held','knead']}
   data['poses'][clip]=poses
 (OUT/'manifest.json').write_text(json.dumps(data,indent=2)+'\n')
 (SOURCE/'registration-report.json').write_text(json.dumps(stats,indent=2)+'\n')
 try:font=ImageFont.truetype(str(ROOT/'extension/assets/fonts/NunitoSans.ttf'),14)
 except OSError:font=ImageFont.load_default()
 sheet=Image.new('RGB',(1536,math.ceil(len(review)/12)*158),'#f8f3fb');dr=ImageDraw.Draw(sheet)
 for i,(clip,key,cell) in enumerate(review):
  x=i%12*128;y=i//12*158
  sheet.paste(cell.resize((128,128),Image.Resampling.NEAREST),(x,y),cell.resize((128,128),Image.Resampling.NEAREST))
  dr.text((x+4,y+132),f'{clip} {key+1}',font=font,fill='#50345e')
 sheet.save(SOURCE/'processed-contact-sheet.png')
 print(json.dumps({'clips':{k:len(v['frames']) for k,v in data['sprites'].items()},'sourceCells':120,'preparedFramesIncludingReactionSubsets':len(review),'output':str(OUT)},indent=2))

if __name__=='__main__':main()
