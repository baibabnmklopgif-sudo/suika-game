# 🍉 合成大西瓜（Suika Game）

一套完整的「合成大西瓜」网页小游戏，支持触屏与鼠标，移动设备完美适配。
所有水果贴图均由 Python (Pillow) 程序化绘制生成。

## 文件结构
```
suika/
├── generate_assets.py   # Python 绘图脚本：生成 11 种水果贴图 + 背景纹理
├── index.html           # 页面结构
├── style.css            # 样式（HUD / 弹层 / 进化链 / 动画 / 安全区适配）
├── game.js              # 游戏逻辑：自研圆形刚体物理、合成、粒子、音效
└── assets/              # 生成的贴图（PNG）
```

## 运行方式
1.（可选）重新生成贴图：
   ```bash
   pip install pillow
   python3 generate_assets.py
   ```
2. 启动本地服务器并访问：
   ```bash
   python3 -m http.server 8000
   # 浏览器打开 http://localhost:8000
   ```
   手机可在同一局域网内用电脑 IP 访问，或部署到任意静态托管。

## 玩法
- 点按 / 拖动屏幕选择位置，松手放下水果
- 两个相同水果碰撞即合成更大的水果并得分
- 水果堆过红色虚线超过 1.2 秒则游戏结束
- 进化链：葡萄→樱桃→橘子→柠檬→猕猴桃→番茄→桃子→菠萝→椰子→半西瓜→大西瓜 🍉

## 技术要点
- Canvas 2D + devicePixelRatio 高清渲染，尺寸随屏幕自适应
- 自研物理：重力、圆-圆碰撞（质量∝r² 冲量解算）、多次迭代防穿透
- Pointer Events 统一触屏/鼠标；禁用页面滚动与双击缩放；iOS 安全区 env() 适配
- WebAudio 程序化音效（无音频素材）、粒子特效、得分飘字、最佳成绩 localStorage 存档
