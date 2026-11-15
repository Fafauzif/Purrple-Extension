#!/usr/bin/env python3
"""Slice and normalize Purrple's illustrated keyframe atlases for local playback.

This is sprite preparation, not an artwork generator. The five source sheets
are retained unchanged. Background segmentation removes transparent-image
matting residue without repainting the character. Each pack uses one shared
scale; frames are never independently enlarged to their bounding boxes.
"""
from pathlib import Path
import argparse
import json
import shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/motion-source'
OUT=ROOT/'extension/assets/atlases'
REVIEW=ROOT/'verification/motion-art'
SIZE=256
PACKS={
    'everyday':dict(file='exec-26d515b4-669d-4abd-99ba-8f94813d9da7.png',
                    rows=['idle','blink','look','ear','tail','tilt'],scale_rows=[0,1,2,3,4,5]),
    'locomotion':dict(file='exec-6f744722-eb51-4942-8fc0-a3e4e3cb6595.png',
                     rows=['walk','run','jump','land','sit','wake'],scale_rows=[0,1,4]),
    'physics':dict(file='exec-04d619d8-ec1b-451b-8e03-bcc46165874b.png',
                  rows=['held','wiggle','tumble','impact','shake','toy'],scale_rows=[0,1,4]),
    'cozy':dict(file='exec-b0ac64f6-c789-4130-a3bd-af617dc320e3.png',
               rows=['sleep','stretch','yawn','groom','pat','study'],scale_rows=[2,3,4,5]),
    'social':dict(file='exec-aff7bb0f-9121-4822-a1d0-3345a219d037.png',rows=['think','read','reminder','heart','celebrate','brush'],scale_rows=[0,1,2,3,5]),
}


def clean_cell(cell):
    arr=np.array(cell.convert('RGBA'))
    rgb=arr[:,:,:3].astype(np.int16)
    r,g,b=rgb.transpose(2,0,1)
    magenta=(r>170)&(b>170)&(g<110)
    neutral=(rgb.max(axis=2)-rgb.min(axis=2))<14
    candidate=(arr[:,:,3]>160)&~magenta&~neutral
    labels,count=ndimage.label(candidate)
    counts=np.bincount(labels.ravel());counts[0]=0
    if count==0 or counts.max()<300:
        raise ValueError('No reliable cat silhouette in source cell')
    mask=labels==counts.argmax()
    # Neutral highlights inside the outline are legitimate eyes/cream fur.
    inside=ndimage.binary_fill_holes(mask)
    mask=mask|(inside&(arr[:,:,3]>160)&~magenta)
    # Retain only alpha beneath the cleaned silhouette. No soft noisy halo.
    arr[:,:,3]=np.where(mask,255,0).astype(np.uint8)
    arr[~mask,:3]=0
    result=Image.fromarray(arr,'RGBA')
    bbox=result.getbbox()
    if bbox is None:raise ValueError('Empty cleaned frame')
    return result,bbox


def anchor_x(im,bbox,kind):
    x0,y0,x1,y1=bbox
    if kind in ['idle','blink','look','ear','tail','tilt','yawn','groom','pat','study','think','read','reminder','heart','brush','held','wiggle','shake']:
        alpha=np.array(im.getchannel('A'))>0
        # Exclude the tail/lower body from upright registration to avoid tail
        # swishes dragging the whole head sideways.
        stop=int(y0+(y1-y0)*.62)
        yy,xx=np.nonzero(alpha[y0:stop])
        return float(np.median(xx)) if len(xx) else (x0+x1)/2
    return (x0+x1)/2


def font(size):
    try:return ImageFont.truetype(str(ROOT/'extension/assets/fonts/NunitoSans.ttf'),size)
    except OSError:return ImageFont.load_default()


def prepare_pack(name,cfg,path):
    src=Image.open(path).convert('RGBA')
    w,h=src.size
    if w%6 or h%6:raise ValueError(f'{name}: source dimensions not divisible by six')
    cw,ch=w//6,h//6
    rows=[]
    for row,kind in enumerate(cfg['rows']):
        frames=[]
        for col in range(6):
            frame,bbox=clean_cell(src.crop((col*cw,row*ch,(col+1)*cw,(row+1)*ch)))
            frames.append((frame,bbox))
        rows.append(frames)
    heights=[b[3]-b[1] for row in cfg['scale_rows'] for _,b in rows[row]]
    maxdim=max(max(b[2]-b[0],b[3]-b[1]) for row in rows for _,b in row)
    scale=min(200/float(np.median(heights)),224/maxdim)
    atlas=Image.new('RGBA',(SIZE*6,SIZE*6))
    entry={}
    metrics=[]
    for row,kind in enumerate(cfg['rows']):
        output_frames=[]
        for col,(frame,bbox) in enumerate(rows[row]):
            x0,y0,x1,y1=bbox
            anchor=anchor_x(frame,bbox,kind)
            resized=frame.resize((round(cw*scale),round(ch*scale)),Image.Resampling.NEAREST)
            dx=round(SIZE/2-anchor*scale)
            dy=round(232-y1*scale)
            dest=Image.new('RGBA',(SIZE,SIZE))
            dest.alpha_composite(resized,(dx,dy))
            bounds=dest.getbbox()
            if bounds[0]<=0 or bounds[1]<=0 or bounds[2]>=SIZE or bounds[3]>=SIZE:
                raise ValueError(f'{name}/{kind}/{col}: normalized crop touches boundary {bounds}')
            atlas.alpha_composite(dest,(col*SIZE,row*SIZE))
            output_frames.append(dict(x=col*SIZE,y=row*SIZE,w=SIZE,h=SIZE))
            metrics.append(dict(id=kind,frame=col,source_bbox=list(bbox),normalized_bbox=list(bounds),
                                anchor_x=round(anchor,3),scale=round(scale,5)))
        entry[kind]=dict(src=f'assets/atlases/{name}.png',frames=output_frames,native=SIZE,
                         sourcePack=name,row=row,anchor='baseline',sourceKeys=6)
    atlas.save(OUT/f'{name}.png',optimize=True)
    for theme,color in [('light','#F8F2FC'),('dark','#282034')]:
        contact=Image.new('RGB',(SIZE*6,SIZE*6+6*28),color)
        d=ImageDraw.Draw(contact)
        for row,kind in enumerate(cfg['rows']):
            d.text((10,row*(SIZE+28)+3),kind,font=font(17),fill='#7D628C' if theme=='light' else '#D9C1EC')
            strip=atlas.crop((0,row*SIZE,SIZE*6,(row+1)*SIZE))
            contact.paste(strip,(0,row*(SIZE+28)+28),strip)
        contact.save(REVIEW/f'assets-{name}-{theme}.png')
    return entry,dict(pack=name,scale=round(scale,5),median_standing_height=float(np.median(heights)),frames=metrics)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--social',default='')
    parser.add_argument('--source-dir',default='')
    args=parser.parse_args()
    if args.social:PACKS['social']['file']=args.social
    for p in [SOURCE,OUT,REVIEW]:p.mkdir(parents=True,exist_ok=True)
    manifest={};reports=[]
    for name,cfg in PACKS.items():
        path=Path(cfg['file'])
        bundled=SOURCE/f'{name}-original.png'
        if not path.is_absolute():
            path=(Path(args.source_dir)/path if args.source_dir else
                  bundled if bundled.is_file() else ROOT.parent/'generated_images'/path)
        if not cfg['file'] or not path.is_file():raise FileNotFoundError(str(path))
        if path.resolve()!=bundled.resolve():shutil.copyfile(path,bundled)
        entry,report=prepare_pack(name,cfg,path)
        manifest.update(entry);reports.append(report)
    (ROOT/'extension/assets/atlas-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (REVIEW/'asset-preparation.json').write_text(json.dumps(dict(
        method='alpha>160; remove saturated magenta and neutral background; largest connected silhouette; preserve enclosed highlights; shared pack scale; baseline registration',
        packs=reports),indent=2)+'\n')
    print(json.dumps({'clips':len(manifest),'packs':[r['pack'] for r in reports],
                      'manifest':str(ROOT/'extension/assets/atlas-manifest.json')},indent=2))


if __name__=='__main__':main()
