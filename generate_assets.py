#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合成大西瓜 - 素材生成器
使用 Pillow 绘制 11 种可爱水果贴图（带渐变、高光、萌脸）以及标题图。
运行: python3 generate_assets.py  ->  输出到 assets/ 目录
"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

SS = 4                 # 超采样倍数（抗锯齿）
BASE = 256             # 输出贴图尺寸
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t): return a + (b - a) * t
def mixc(c1, c2, t): return tuple(int(lerp(c1[i], c2[i], t)) for i in range(3))

def radial_ball(size, inner, outer, light=(-0.28, -0.30)):
    """带球形渐变的圆，light 为高光偏移(相对半径)"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    r = size / 2
    cx, cy = r + light[0] * r, r + light[1] * r
    maxd = r * 1.55
    for y in range(size):
        for x in range(size):
            dx, dy = x - r + .5, y - r + .5
            if dx*dx + dy*dy <= r*r:
                d = math.hypot(x - cx, y - cy) / maxd
                d = min(1.0, d ** 1.15)
                px[x, y] = mixc(inner, outer, d) + (255,)
    return img

def add_rim_shadow(img):
    """底部环境阴影，增强立体感"""
    size = img.size[0]; r = size / 2
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse([size*0.08, size*0.30, size*0.92, size*1.06], fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(size // 14))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size-1, size-1], fill=255)
    shadow_clip = Image.new("RGBA", (size, size), (0,0,0,0))
    shadow_clip.paste(sh, (0, 0), mask)
    return Image.alpha_composite(img, shadow_clip)

def add_gloss(img, w=0.34, h=0.20, pos=(0.30, 0.22), alpha=170):
    size = img.size[0]
    g = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    x, y = pos[0]*size, pos[1]*size
    d.ellipse([x - w*size/2, y - h*size/2, x + w*size/2, y + h*size/2],
              fill=(255, 255, 255, alpha))
    g = g.filter(ImageFilter.GaussianBlur(size // 30))
    # 小高光点
    d2 = ImageDraw.Draw(g)
    d2.ellipse([size*0.50, size*0.13, size*0.58, size*0.19], fill=(255,255,255,200))
    return Image.alpha_composite(img, g)

def draw_face(img, scale=1.0, cy=0.58, blush=(255, 120, 130, 110), open_mouth=False):
    """萌脸：眯眯眼 + 微笑 + 腮红"""
    size = img.size[0]
    d = ImageDraw.Draw(img)
    s = size * scale
    ex = size * 0.5
    eye_dx, eye_y = 0.16 * s, cy * size - 0.10 * s
    lw = max(3, int(s * 0.028))
    for sx in (-1, 1):
        x = ex + sx * eye_dx
        d.arc([x - 0.075*s, eye_y - 0.06*s, x + 0.075*s, eye_y + 0.06*s],
              200, 340, fill=(40, 30, 30, 255), width=lw)
    my = cy * size + 0.035 * s
    if open_mouth:
        d.pieslice([ex - 0.075*s, my - 0.045*s, ex + 0.075*s, my + 0.085*s],
                   0, 180, fill=(120, 40, 40, 255))
        d.pieslice([ex - 0.045*s, my + 0.015*s, ex + 0.045*s, my + 0.085*s],
                   0, 180, fill=(255, 120, 120, 255))
    else:
        d.arc([ex - 0.06*s, my - 0.05*s, ex + 0.06*s, my + 0.05*s],
              20, 160, fill=(40, 30, 30, 255), width=lw)
    for sx in (-1, 1):
        bx = ex + sx * 0.30 * s
        b = Image.new("RGBA", img.size, (0,0,0,0))
        ImageDraw.Draw(b).ellipse([bx - 0.075*s, eye_y + 0.06*s,
                                   bx + 0.075*s, eye_y + 0.16*s], fill=blush)
        b = b.filter(ImageFilter.GaussianBlur(size // 40))
        img.alpha_composite(b)
    return img

def leaf(img, cx=0.5, cy=0.10, s=0.16, angle=-30, color=(80, 170, 70)):
    size = img.size[0]
    layer = Image.new("RGBA", (size, size), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    w, h = s*size, s*size*0.55
    d.ellipse([cx*size - w/2, cy*size - h/2, cx*size + w/2, cy*size + h/2],
              fill=color + (255,))
    layer = layer.rotate(angle, center=(cx*size, cy*size), resample=Image.BICUBIC)
    img.alpha_composite(layer)
    return img

def stem(img, cx=0.5, cy=0.06, color=(110, 80, 50)):
    size = img.size[0]
    d = ImageDraw.Draw(img)
    w = size * 0.035
    d.line([cx*size, cy*size, cx*size, (cy+0.09)*size], fill=color+(255,), width=int(w))
    return img

# ---------- 各水果绘制 ----------

def clip_circle(img):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size-1, size-1], fill=255)
    out = Image.new("RGBA", (size, size), (0,0,0,0))
    out.paste(img, (0,0), mask)
    return out

def fruit_grape(size):
    img = radial_ball(size, (200, 140, 235), (120, 55, 170))
    img = add_rim_shadow(img); img = add_gloss(img)
    img = draw_face(img, 1.0)
    return img

def fruit_cherry(size):
    img = radial_ball(size, (255, 105, 110), (185, 25, 55))
    img = add_rim_shadow(img); img = add_gloss(img)
    img = draw_face(img, 1.0)
    img = stem(img, 0.52, 0.02); img = leaf(img, 0.60, 0.07, 0.13, -20)
    return img

def fruit_orange(size):
    img = radial_ball(size, (255, 190, 90), (235, 120, 25))
    d = ImageDraw.Draw(img)
    for i in range(12):  # 果皮纹理点
        a = i * math.pi / 6 + 0.26
        r = size * 0.36
        x, y = size/2 + math.cos(a)*r, size/2 + math.sin(a)*r
        d.ellipse([x-size*0.008, y-size*0.008, x+size*0.008, y+size*0.008],
                  fill=(200, 100, 20, 120))
    img = add_rim_shadow(img); img = add_gloss(img)
    img = draw_face(img, 1.0)
    img = leaf(img, 0.56, 0.06, 0.14, -25)
    return img

def fruit_lemon(size):
    img = radial_ball(size, (255, 240, 130), (240, 195, 35))
    img = add_rim_shadow(img); img = add_gloss(img)
    img = draw_face(img, 1.0)
    img = leaf(img, 0.57, 0.06, 0.13, -30, (110, 190, 80))
    return img

def fruit_kiwi(size):
    img = radial_ball(size, (185, 150, 95), (120, 90, 50))
    d = ImageDraw.Draw(img)
    # 绒毛质感
    import random; random.seed(7)
    for _ in range(int(size*size/900)):
        x, y = random.uniform(0, size), random.uniform(0, size)
        dx, dy = x-size/2, y-size/2
        if dx*dx+dy*dy < (size*0.47)**2:
            d.point((x, y), fill=(90, 65, 35, 90))
    img = clip_circle(img)
    img = add_rim_shadow(img); img = add_gloss(img, alpha=110)
    img = draw_face(img, 1.0)
    return img

def fruit_tomato(size):
    img = radial_ball(size, (255, 120, 90), (210, 45, 35))
    img = add_rim_shadow(img); img = add_gloss(img)
    img = draw_face(img, 1.0)
    for a in (-40, -10, 20, 50):  # 蒂叶
        img = leaf(img, 0.5 + a*0.0012, 0.075, 0.14, a, (70, 150, 60))
    return img

def fruit_peach(size):
    img = radial_ball(size, (255, 205, 190), (250, 120, 130))
    d = ImageDraw.Draw(img)
    d.arc([size*0.30, -size*0.05, size*0.70, size*0.45], 250, 290,
          fill=(230, 90, 110, 200), width=max(3, size//60))  # 桃缝
    img = add_rim_shadow(img); img = add_gloss(img)
    img = draw_face(img, 1.0)
    img = leaf(img, 0.58, 0.07, 0.15, -25, (95, 180, 75))
    return img

def fruit_pineapple(size):
    img = radial_ball(size, (255, 205, 80), (225, 150, 30))
    d = ImageDraw.Draw(img)
    step = size * 0.16
    lw = max(3, size//80)
    for k in range(-8, 9):  # 菱形网格
        d.line([0, k*step, size, k*step + size], fill=(200, 130, 25, 150), width=lw)
        d.line([size, k*step, 0, k*step + size], fill=(200, 130, 25, 150), width=lw)
    img = clip_circle(img)
    img = add_rim_shadow(img); img = add_gloss(img, alpha=120)
    img = draw_face(img, 1.0)
    for a in (-35, 0, 35):
        img = leaf(img, 0.5 + a*0.002, 0.055, 0.16, 90 + a, (60, 160, 70))
    return img

def fruit_coconut(size):
    img = radial_ball(size, (165, 125, 85), (100, 70, 45))
    d = ImageDraw.Draw(img)
    for i in range(3):  # 椰子孔
        a = math.pi/2*3 + (i-1)*0.5
        x, y = size/2 + math.cos(a)*size*0.16, size*0.24 + math.sin(a)*size*0.05
        d.ellipse([x-size*0.028, y-size*0.028, x+size*0.028, y+size*0.028],
                  fill=(70, 48, 30, 255))
    img = add_rim_shadow(img); img = add_gloss(img, alpha=90)
    img = draw_face(img, 1.0)
    return img

def watermelon_stripes(size, inner, outer, stripe):
    img2 = radial_ball(size, inner, outer)
    d = ImageDraw.Draw(img2)
    n = 8
    for i in range(n):
        a = i * math.pi / (n/2) + 0.4
        pts = []
        for t in range(0, 21):
            tt = t / 20
            ang = a + math.sin(tt * math.pi * 2) * 0.12
            rr = size * 0.5 * tt
            pts.append((size/2 + math.cos(ang)*rr, size/2 + math.sin(ang)*rr))
        d.line(pts, fill=stripe + (230,), width=int(size*0.045))
    return clip_circle(img2)

def fruit_half_melon(size):
    img = watermelon_stripes(size, (120, 205, 110), (40, 140, 60), (25, 95, 45))
    img = add_rim_shadow(img); img = add_gloss(img, alpha=130)
    img = draw_face(img, 1.0, open_mouth=True)
    return img

def fruit_watermelon(size):
    img = watermelon_stripes(size, (110, 200, 105), (30, 130, 55), (20, 85, 40))
    img = add_rim_shadow(img); img = add_gloss(img, alpha=140)
    img = draw_face(img, 1.08, open_mouth=True)
    img = stem(img, 0.5, 0.015, (90, 130, 60))
    img = leaf(img, 0.585, 0.055, 0.15, -25, (70, 160, 65))
    return img

FRUITS = [
    ("grape",      fruit_grape),
    ("cherry",     fruit_cherry),
    ("orange",     fruit_orange),
    ("lemon",      fruit_lemon),
    ("kiwi",       fruit_kiwi),
    ("tomato",     fruit_tomato),
    ("peach",      fruit_peach),
    ("pineapple",  fruit_pineapple),
    ("coconut",    fruit_coconut),
    ("halfmelon",  fruit_half_melon),
    ("watermelon", fruit_watermelon),
]

def main():
    big = BASE * SS
    for name, fn in FRUITS:
        img = fn(big)
        img = img.resize((BASE, BASE), Image.LANCZOS)
        path = os.path.join(OUT, f"{name}.png")
        img.save(path)
        print("saved", path)
    # 背景圆点纹理
    tile = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    for cx, cy in [(40, 40), (120, 120)]:
        d.ellipse([cx-14, cy-14, cx+14, cy+14], fill=(255, 255, 255, 26))
    tile.save(os.path.join(OUT, "bg_dots.png"))
    print("saved bg_dots.png")

if __name__ == "__main__":
    main()
