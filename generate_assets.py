#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合成大西瓜 (Suika Game) - 2D 精细化素材生成器
基于 NumPy + Pillow 硬件级矩阵渲染：
512x512 高清贴图，包含菲涅尔边缘光 (Fresnel Glow)、球体多段漫反射、果冻感水润高光、
多形态萌趣表情 (眨眼/害羞/大笑/萌呆) 与丰富果皮纹理 (西瓜条纹/菠萝菱格/猕猴桃绒毛/橘皮微孔/桃心切线)。
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 512
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(OUT_DIR, exist_ok=True)

def create_sphere_base(light_color, base_color, shadow_color, light_pos=(-0.25, -0.28)):
    """
    NumPy 快速生成 2.5D 高质感球体底图（带菲涅尔边缘光）
    """
    y, x = np.ogrid[:SIZE, :SIZE]
    r = SIZE / 2.0
    dx = x - (r - 0.5)
    dy = y - (r - 0.5)
    dist_center = np.sqrt(dx*dx + dy*dy)
    mask = dist_center <= (r - 1.0)

    # 光照距离
    lx = r + light_pos[0] * r
    ly = r + light_pos[1] * r
    dl = np.sqrt((x - lx)**2 + (y - ly)**2) / (r * 1.55)
    dl = np.clip(dl, 0.0, 1.0)

    # 3 段渐变混合
    c_light = np.array(light_color, dtype=np.float32)
    c_base = np.array(base_color, dtype=np.float32)
    c_shadow = np.array(shadow_color, dtype=np.float32)

    # 初始化 RGB 矩阵
    rgb = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    t1 = np.clip(dl / 0.45, 0.0, 1.0)[..., None]
    part1 = c_light * (1.0 - t1) + c_base * t1
    t2 = np.clip((dl - 0.45) / 0.55, 0.0, 1.0)[..., None]
    part2 = c_base * (1.0 - t2) + c_shadow * t2

    rgb = np.where(dl[..., None] < 0.45, part1, part2)

    # 菲涅尔边缘反光 (Fresnel Rim Light)
    norm_dist = np.clip(dist_center / r, 0.0, 1.0)[..., None]
    rim = np.power(norm_dist, 3.8) * 0.32
    rgb = rgb * (1.0 - rim) + 255.0 * rim

    # Alpha 通道平滑羽化边缘
    edge_alpha = np.clip(r - dist_center, 0.0, 1.0) * 255.0
    rgba = np.dstack([np.clip(rgb, 0, 255), edge_alpha]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")

def add_gloss(img):
    """添加水润半透明双高光"""
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # 主月牙高光
    hx, hy = SIZE * 0.32, SIZE * 0.22
    hw, hh = SIZE * 0.30, SIZE * 0.17
    d.ellipse([hx - hw/2, hy - hh/2, hx + hw/2, hy + hh/2], fill=(255, 255, 255, 185))
    # 小圆点高光
    d.ellipse([SIZE * 0.52, SIZE * 0.16, SIZE * 0.59, SIZE * 0.23], fill=(255, 255, 255, 220))
    # 底部环境光弧线
    d.arc([SIZE*0.16, SIZE*0.16, SIZE*0.84, SIZE*0.88], 45, 135, fill=(255, 255, 255, 55), width=int(SIZE*0.035))
    layer = layer.filter(ImageFilter.GaussianBlur(SIZE // 45))
    return Image.alpha_composite(img, layer)

def add_surface_detail(img, color, amount=70, size=2, seed=1):
    """在球面可见区添加细腻斑点/绒毛，不依赖外部素材。"""
    rng = np.random.default_rng(seed)
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(amount):
        angle = float(rng.random() * math.tau)
        # 中心略稀、边缘不越出球面
        distance = float((rng.random() ** .55) * SIZE * .42)
        x, y = SIZE/2 + math.cos(angle)*distance, SIZE/2 + math.sin(angle)*distance
        rad = size * (0.55 + float(rng.random())*.8)
        d.ellipse([x-rad, y-rad, x+rad, y+rad], fill=color)
    return Image.alpha_composite(img, layer)

def clip_circle(img):
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, SIZE - 1, SIZE - 1], fill=255)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out

def draw_kawaii_face(img, face_type="happy"):
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = SIZE * 0.5, SIZE * 0.55
    eye_dx = SIZE * 0.16
    line_w = max(3, int(SIZE * 0.024))
    eye_c = (46, 26, 26, 255)

    if face_type == "sleepy":  # 葡萄：呆萌闭眼
        for sx in (-1, 1):
            x = cx + sx * eye_dx
            d.arc([x - SIZE*0.065, cy - SIZE*0.035, x + SIZE*0.065, cy + SIZE*0.045], 20, 160, fill=eye_c, width=line_w)
        d.ellipse([cx - SIZE*0.025, cy + SIZE*0.055, cx + SIZE*0.025, cy + SIZE*0.10], fill=(175, 60, 60, 255))

    elif face_type == "wink":  # 柠檬：眨眼调皮
        lx = cx - eye_dx
        d.arc([lx - SIZE*0.065, cy - SIZE*0.045, lx + SIZE*0.065, cy + SIZE*0.045], 200, 340, fill=eye_c, width=line_w)
        rx = cx + eye_dx
        d.ellipse([rx - SIZE*0.055, cy - SIZE*0.055, rx + SIZE*0.055, cy + SIZE*0.055], fill=eye_c)
        d.ellipse([rx - SIZE*0.035, cy - SIZE*0.045, rx - SIZE*0.005, cy - SIZE*0.015], fill=(255, 255, 255, 255))
        d.arc([cx - SIZE*0.045, cy + SIZE*0.02, cx + SIZE*0.045, cy + SIZE*0.08], 15, 165, fill=eye_c, width=line_w)

    elif face_type == "shy":  # 桃子/猕猴桃/樱桃：害羞大圆眼
        for sx in (-1, 1):
            x = cx + sx * eye_dx
            d.ellipse([x - SIZE*0.058, cy - SIZE*0.058, x + SIZE*0.058, cy + SIZE*0.058], fill=eye_c)
            d.ellipse([x - SIZE*0.040, cy - SIZE*0.048, x - SIZE*0.010, cy - SIZE*0.018], fill=(255, 255, 255, 255))
            d.ellipse([x + SIZE*0.010, cy + SIZE*0.010, x + SIZE*0.035, cy + SIZE*0.035], fill=(255, 255, 255, 220))
        d.arc([cx - SIZE*0.04, cy + SIZE*0.03, cx + SIZE*0.04, cy + SIZE*0.075], 20, 160, fill=eye_c, width=line_w)

    elif face_type == "big_smile":  # 西瓜：开怀大笑
        for sx in (-1, 1):
            x = cx + sx * eye_dx
            d.arc([x - SIZE*0.07, cy - SIZE*0.055, x + SIZE*0.07, cy + SIZE*0.055], 200, 340, fill=eye_c, width=line_w)
        my = cy + SIZE * 0.04
        mw, mh = SIZE * 0.11, SIZE * 0.09
        d.pieslice([cx - mw, my - mh*0.3, cx + mw, my + mh*1.3], 0, 180, fill=(160, 30, 45, 255))
        d.pieslice([cx - mw*0.6, my + mh*0.4, cx + mw*0.6, my + mh*1.3], 0, 180, fill=(255, 120, 140, 255))

    else:  # 元气微笑
        for sx in (-1, 1):
            x = cx + sx * eye_dx
            d.arc([x - SIZE*0.065, cy - SIZE*0.05, x + SIZE*0.065, cy + SIZE*0.05], 200, 340, fill=eye_c, width=line_w)
        d.arc([cx - SIZE*0.05, cy + SIZE*0.02, cx + SIZE*0.05, cy + SIZE*0.08], 20, 160, fill=eye_c, width=line_w)

    # 萌系腮红
    blush = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blush)
    for sx in (-1, 1):
        bx = cx + sx * (eye_dx + SIZE * 0.10)
        by = cy + SIZE * 0.055
        bd.ellipse([bx - SIZE*0.06, by - SIZE*0.035, bx + SIZE*0.06, by + SIZE*0.035], fill=(255, 105, 135, 140))
    blush = blush.filter(ImageFilter.GaussianBlur(SIZE // 32))

    layer = Image.alpha_composite(blush, layer)
    return Image.alpha_composite(img, layer)

def draw_leaf(img, cx=0.5, cy=0.10, s=0.18, angle=-30, color=(85, 185, 75)):
    leaf = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(leaf)
    w, h = s * SIZE, s * SIZE * 0.52
    x, y = cx * SIZE, cy * SIZE
    d.ellipse([x - w/2, y - h/2, x + w/2, y + h/2], fill=color + (255,))
    d.line([x - w*0.38, y, x + w*0.38, y], fill=(45, 100, 35, 180), width=max(2, int(SIZE*0.012)))
    leaf = leaf.rotate(angle, center=(x, y), resample=Image.BICUBIC)
    return Image.alpha_composite(img, leaf)

def draw_stem(img, cx=0.5, cy=0.07, h=0.10, color=(120, 85, 50)):
    stem = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(stem)
    w = max(4, int(SIZE * 0.036))
    d.line([cx*SIZE, cy*SIZE, cx*SIZE, (cy+h)*SIZE], fill=color + (255,), width=w)
    return Image.alpha_composite(img, stem)

# ---- 水果渲染 ----
def make_grape():
    img = create_sphere_base((220, 170, 255), (155, 80, 215), (95, 35, 150))
    img = add_surface_detail(img, (100, 40, 155, 42), 64, 2.2, 19)
    img = add_gloss(img)
    img = draw_kawaii_face(img, "sleepy")
    img = draw_stem(img, 0.5, 0.03, 0.08, (90, 130, 60))
    img = draw_leaf(img, 0.58, 0.08, 0.14, -20, (110, 195, 75))
    return clip_circle(img)

def make_cherry():
    img = create_sphere_base((255, 120, 130), (225, 35, 65), (145, 15, 35))
    img = add_gloss(img)
    img = draw_kawaii_face(img, "shy")
    img = draw_stem(img, 0.52, 0.02, 0.09, (120, 85, 45))
    img = draw_leaf(img, 0.62, 0.06, 0.16, -25, (100, 185, 65))
    return clip_circle(img)

def make_orange():
    img = create_sphere_base((255, 205, 100), (245, 135, 25), (195, 85, 10))
    tex = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(tex)
    r = SIZE * 0.5
    for i in range(16):
        a = i * math.pi / 8.0 + 0.2
        px, py = r + math.cos(a)*r*0.68, r + math.sin(a)*r*0.68
        d.ellipse([px-SIZE*0.008, py-SIZE*0.008, px+SIZE*0.008, py+SIZE*0.008], fill=(185, 90, 10, 80))
    img = Image.alpha_composite(img, tex)
    img = add_gloss(img)
    img = draw_kawaii_face(img, "happy")
    img = draw_leaf(img, 0.56, 0.06, 0.16, -30, (90, 180, 65))
    return clip_circle(img)

def make_lemon():
    img = create_sphere_base((255, 250, 150), (250, 210, 40), (210, 160, 20))
    img = add_gloss(img)
    img = draw_kawaii_face(img, "wink")
    img = draw_leaf(img, 0.57, 0.06, 0.16, -32, (115, 200, 75))
    return clip_circle(img)

def make_kiwi():
    img = create_sphere_base((195, 160, 105), (145, 110, 65), (95, 65, 35))
    img = add_surface_detail(img, (62, 40, 19, 78), 900, 0.85, 71)
    img = add_gloss(img)
    img = draw_kawaii_face(img, "shy")
    return clip_circle(img)

def make_tomato():
    img = create_sphere_base((255, 130, 105), (230, 50, 40), (165, 25, 20))
    img = add_gloss(img)
    img = draw_kawaii_face(img, "happy")
    for ang in (-45, -15, 15, 45):
        img = draw_leaf(img, 0.5 + ang*0.0014, 0.075, 0.16, ang, (75, 165, 60))
    img = draw_stem(img, 0.5, 0.02, 0.07, (60, 140, 50))
    return clip_circle(img)

def make_peach():
    img = create_sphere_base((255, 225, 205), (255, 140, 150), (230, 80, 100))
    d = ImageDraw.Draw(img)
    d.arc([SIZE*0.35, -SIZE*0.05, SIZE*0.65, SIZE*0.48], 250, 290, fill=(215, 65, 90, 180), width=int(SIZE*0.016))
    img = add_gloss(img)
    img = draw_kawaii_face(img, "shy")
    img = draw_leaf(img, 0.58, 0.065, 0.17, -25, (100, 190, 75))
    return clip_circle(img)

def make_pineapple():
    img = create_sphere_base((255, 215, 95), (235, 160, 30), (175, 105, 15))
    d = ImageDraw.Draw(img)
    step = SIZE * 0.14
    lw = max(3, int(SIZE * 0.014))
    for k in range(-10, 11):
        d.line([0, k*step, SIZE, k*step + SIZE], fill=(180, 110, 15, 140), width=lw)
        d.line([SIZE, k*step, 0, k*step + SIZE], fill=(180, 110, 15, 140), width=lw)
    img = clip_circle(img)
    img = add_gloss(img)
    img = draw_kawaii_face(img, "happy")
    for ang in (-40, -18, 0, 18, 40):
        img = draw_leaf(img, 0.5 + ang*0.0018, 0.05, 0.19, 90 + ang, (65, 175, 65))
    return img

def make_coconut():
    img = create_sphere_base((180, 140, 95), (120, 85, 55), (75, 50, 30))
    img = add_surface_detail(img, (65, 41, 22, 60), 160, 1.8, 31)
    d = ImageDraw.Draw(img)
    for i in (-1, 0, 1):
        x = SIZE * 0.5 + i * SIZE * 0.12
        y = SIZE * 0.24 + abs(i) * SIZE * 0.03
        d.ellipse([x - SIZE*0.03, y - SIZE*0.03, x + SIZE*0.03, y + SIZE*0.03], fill=(55, 35, 20, 255))
    img = add_gloss(img)
    img = draw_kawaii_face(img, "happy")
    return clip_circle(img)

def make_half_melon():
    img = create_sphere_base((140, 225, 120), (55, 165, 75), (25, 105, 45))
    d = ImageDraw.Draw(img)
    n = 8
    for i in range(n):
        a = i * math.pi / (n / 2) + 0.3
        pts = []
        for t in range(0, 25):
            tt = t / 24.0
            ang = a + math.sin(tt * math.pi * 2.5) * 0.14
            rr = SIZE * 0.5 * tt
            pts.append((SIZE/2 + math.cos(ang)*rr, SIZE/2 + math.sin(ang)*rr))
        d.line(pts, fill=(20, 80, 35, 230), width=int(SIZE*0.048))
    img = clip_circle(img)
    img = add_gloss(img)
    img = draw_kawaii_face(img, "big_smile")
    return img

def make_watermelon():
    img = create_sphere_base((130, 220, 115), (45, 155, 68), (20, 95, 40))
    d = ImageDraw.Draw(img)
    n = 9
    for i in range(n):
        a = i * math.pi / (n / 2) + 0.25
        pts = []
        for t in range(0, 30):
            tt = t / 29.0
            ang = a + math.sin(tt * math.pi * 3.0) * 0.16
            rr = SIZE * 0.5 * tt
            pts.append((SIZE/2 + math.cos(ang)*rr, SIZE/2 + math.sin(ang)*rr))
        d.line(pts, fill=(16, 75, 30, 240), width=int(SIZE*0.052))
    img = clip_circle(img)
    img = add_gloss(img)
    img = draw_kawaii_face(img, "big_smile")
    img = draw_stem(img, 0.5, 0.01, 0.07, (100, 140, 60))
    img = draw_leaf(img, 0.59, 0.05, 0.18, -25, (85, 180, 70))
    return img

FRUITS = [
    ("grape",      make_grape),
    ("cherry",     make_cherry),
    ("orange",     make_orange),
    ("lemon",      make_lemon),
    ("kiwi",       make_kiwi),
    ("tomato",     make_tomato),
    ("peach",      make_peach),
    ("pineapple",  make_pineapple),
    ("coconut",    make_coconut),
    ("halfmelon",  make_half_melon),
    ("watermelon", make_watermelon),
]

def main():
    print(f"Generating 512x512 ultra-refined 2D assets...")
    for name, fn in FRUITS:
        im = fn()
        path = os.path.join(OUT_DIR, f"{name}.png")
        im.save(path, "PNG", optimize=True)
        print(f"  ✓ {name}.png")

    bg = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bg)
    for cx, cy in [(50, 50), (150, 150)]:
        bd.ellipse([cx-16, cy-16, cx+16, cy+16], fill=(255, 255, 255, 28))
    bg.save(os.path.join(OUT_DIR, "bg_dots.png"), "PNG")
    print("  ✓ bg_dots.png")
    print("All 2D assets rendered successfully!")

if __name__ == "__main__":
    main()
