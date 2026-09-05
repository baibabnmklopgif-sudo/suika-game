# 🍉 合成大西瓜 · Unified 2D Canvas Engine

一款移动端适配的合成大西瓜网页游戏。**全部可见界面**——游戏场景、果篮、HUD、金币、商城、道具栏、开始页、结算页——均由一个 Canvas 上的 Unified 2D 渲染引擎绘制；HTML 只保留画布宿主，CSS 仅管理全屏与输入安全。

## 在线试玩

[https://baibabnmklopgif-sudo.github.io/suika-game/](https://baibabnmklopgif-sudo.github.io/suika-game/)

## 本次核心更新

- **修复“灵异转圈”**：移除水果的角速度与切向角冲量累积。水果采用稳定的无旋转圆体模型，仅保留弹簧阻尼驱动的 Q 弹缩放；不会再原地陀螺式旋转。
- **金币系统**：每次合成均立即按水果等级、连击奖励金币；总金币保存在浏览器 `localStorage` 中，跨局保留。
- **水果商城**：使用金币直接购买任意 11 个等级的水果，购买后将立即替换当前待投放水果。
- **道具系统**：
  - 🔨 **碎果锤（50 金币）**：开启后点按场内任意水果，将其直接消除。
  - 📳 **摇一摇（30 金币）**：为场上水果施加一次受控扰动，帮助调整布局。
- **全部 UI Canvas 化**：HUD、商城网格、购买按钮、道具按钮、引导线、警戒线与模态窗均在 `game.js` 中由统一绘制循环渲染与命中检测。

## 技术实现

- 6 子步圆形刚体碰撞与质量比例分离，减少堆叠穿透。
- 弹簧-阻尼系统实现合成、撞墙、落地时的挤压回弹。
- Canvas 统一输入命中检测，Pointer Events 同时支持鼠标和触屏。
- DPR 最高 3 倍高清画布缩放，并随横竖屏变化重布局。
- Python `generate_assets.py`（NumPy + Pillow）生成 512×512 2.5D 水果贴图。

## 运行

```bash
# 可选：重新生成贴图
pip install pillow numpy
python3 generate_assets.py

# 启动静态服务器
python3 -m http.server 8000
```

然后打开 `http://localhost:8000`。
