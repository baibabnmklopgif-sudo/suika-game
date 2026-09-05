#!/usr/bin/env python3
# Generate a high-resolution adaptive-style watermelon launcher icon.
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
root=Path(__file__).parent
out=root/'android/app/src/main/res'
for d in ['mipmap-hdpi','mipmap-mdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi']:
    (out/d).mkdir(parents=True,exist_ok=True)
# 1024 master: warm orange app tile + centered detailed watermelon asset
S=1024
im=Image.new('RGBA',(S,S),(255,205,91,255))
bg=Image.new('RGBA',(S,S),(0,0,0,0));d=ImageDraw.Draw(bg)
# layered circular highlight and shadow
for r,a in [(470,18),(410,24),(350,30)]: d.ellipse((512-r,512-r,512+r,512+r),fill=(255,255,255,a))
im=Image.alpha_composite(im,bg)
# watermark speckles
sp=Image.new('RGBA',(S,S),(0,0,0,0));d=ImageDraw.Draw(sp)
for x,y in [(130,175),(840,210),(185,825),(830,790),(105,520),(910,525)]: d.ellipse((x-18,y-18,x+18,y+18),fill=(255,245,200,110))
im=Image.alpha_composite(im,sp)
# long soft shadow
sh=Image.new('RGBA',(S,S),(0,0,0,0));d=ImageDraw.Draw(sh);d.ellipse((230,650,794,855),fill=(124,70,7,95));sh=sh.filter(ImageFilter.GaussianBlur(32));im=Image.alpha_composite(im,sh)
fruit=Image.open(root/'assets/watermelon.png').convert('RGBA').resize((650,650),Image.Resampling.LANCZOS)
im.alpha_composite(fruit,(187,145))
# outer subtle inset ring
d=ImageDraw.Draw(im);d.ellipse((22,22,S-22,S-22),outline=(255,244,192,175),width=20)
for name,size in [('mipmap-mdpi',48),('mipmap-hdpi',72),('mipmap-xhdpi',96),('mipmap-xxhdpi',144),('mipmap-xxxhdpi',192)]:
    icon=im.resize((size,size),Image.Resampling.LANCZOS).convert('RGB')
    icon.save(out/name/'ic_launcher.png','PNG',optimize=True)
    icon.save(out/name/'ic_launcher_round.png','PNG',optimize=True)
# Play Store master as well
(root/'android/app/icon-1024.png').write_bytes(b'')
im.save(root/'android/app/icon-1024.png','PNG',optimize=True)
print('Generated launcher PNGs and 1024px master icon')
