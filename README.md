# 🍉 合成大西瓜 (Suika Game 2D)

一套全栈精细化、基于统一 2D 物理建模与程序化图形渲染的「合成大西瓜」网页小游戏。支持触屏与鼠标，完美适配各种尺寸移动端设备（iOS / Android）。

🔗 **在线体验**: [https://baibabnmklopgif-sudo.github.io/suika-game/](https://baibabnmklopgif-sudo.github.io/suika-game/)

---

## ✨ 核心特色与技术亮点

### 1. 统一 2D 物理与弹力动力学 (Unified 2D Soft-Body Physics)
- **8-子步微积分解算器 (8 Sub-steps Solver)**：消除高速下落与多物体挤压造成的隧道穿透效应（Zero-tunneling）。
- **果冻弹簧阻尼形变 (Spring Squash & Stretch)**：水果在触底、撞墙与相互碰撞时具有果冻般的挤压与回弹阻尼物理表现。
- **角动量与滚动摩擦模拟**：根据碰撞切向分量与表面摩擦力驱动自然旋转。

### 2. 512x512 菲涅尔 2.5D 高质感贴图 (Python + NumPy 渲染)
- `generate_assets.py` 采用 NumPy 矩阵加速与多层光照模型：
  - 球体 3 段漫反射衰减
  - 菲涅尔边缘光 (Fresnel Rim Light)
  - 水润双高光与环境反光
  - 11 种水果各具特色表情（闭眼呆萌、调皮眨眼、害羞腮红、开怀大笑）与果皮细节纹理。

### 3. 视觉与打击感反馈
- **COMBO 连击系统**：短时间内连续合成触发 `COMBO x2, x3...`，享受倍率加分与连击音阶跃升。
- **冲击波 (Shockwave) & 屏幕震动 (Screen Shake)**：合成高级水果触发扩散光圈冲击波与镜头震感。
- **果汁飞溅粒子 (Splash Particles)** 与得分上浮动画。

### 4. 纯代码程序化音效与触感
- 基于 **WebAudio API** 实时合成和弦音阶与掉落木质打击音，无需下载外部音频包。
- 接入 **Vibration API (Haptic Feedback)**，在支持的移动设备上提供真实的碰撞震感反馈。

---

## 📁 目录结构

```
suika/
├── generate_assets.py   # Python 2D 渲染器 (NumPy + Pillow 批量生成 512x512 贴图)
├── index.html           # 语义化 HTML5 骨架 (HUD, 进化链, 模态弹层, 安全区适配)
├── style.css            # 现代毛玻璃 UI (Glassmorphism), 响应式自适应, 动画特效
├── game.js              # 游戏核心引擎 (统一2D物理, 弹簧软体, 渲染, 音频合成)
├── assets/              # 生成的高清水果与背景纹理 PNG
└── README.md
```

## 🚀 本地运行与开发

```bash
# 1.（可选）重新生成贴图
pip install pillow numpy
python3 generate_assets.py

# 2. 启动本地静态服务器
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```
