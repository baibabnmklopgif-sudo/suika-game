# 🍉 合成大西瓜 · Android WebGL Edition

本版本升级为 **PixiJS 7 WebGL 渲染框架 + Matter.js 物理框架**。它针对 Android Chrome / Android System WebView 的硬件 GPU 管线运行，且所有可见界面（场景、HUD、商城、道具、弹窗、特效）均为 Pixi DisplayObject，不使用 DOM UI。

## 架构
- **PixiJS 7.4.2**：稳定成熟的 WebGL 2D 运行时，使用 `powerPreference: high-performance`、DPR 上限 2 与抗锯齿纹理采样。
- **Matter.js 0.20.0**：圆形刚体、连续碰撞、静态边界、休眠机制。水果 `inertia: Infinity`，彻底禁止物理角旋转，使脸部永远正向。
- **本地 vendor 依赖**：框架文件随项目提交，不依赖 CDN；内嵌 WebView、弱网或离线缓存环境都可启动。
- **性能策略**：Matter Sleep 减少静止水果 CPU；只同步动态 Sprite；纹理由 GPU 缓存；`autoDensity` 适配屏幕，渲染分辨率上限 2 避免高 DPR 手机 GPU 过载。

## 运行
```bash
python3 -m http.server 8000
```
访问 `http://localhost:8000`。Android WebView 需要启用 JavaScript、DOM Storage 与硬件加速/WebGL。

## 资源
`generate_assets.py` 使用 Python（NumPy + Pillow）生成 512px 精细水果贴图；执行 `pip install numpy pillow && python3 generate_assets.py` 可重建资源。
