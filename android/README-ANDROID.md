# Android ARM64 WebView 包装工程

此工程将根目录的离线 PixiJS + Matter.js 游戏资源置于 `app/src/main/assets/www/` 中，使用硬件加速 Android WebView 加载。

## 要求
- JDK 17
- Android SDK Platform 35
- Android Build Tools 35.0.0
- Android System WebView / Chrome（ARM64 设备）

## 构建
```bash
# 在 android/ 目录执行
./gradlew assembleDebug
# 输出：app/build/outputs/apk/debug/app-debug.apk

./gradlew assembleRelease
# 输出：app/build/outputs/apk/release/app-release-unsigned.apk
```

项目使用 `arm64-v8a` ABI 策略。由于游戏没有 JNI `.so`，生成的 WebView APK 本身没有原生库；它可直接运行于 ARM64 设备。若加入原生库，Gradle 会只打入 `arm64-v8a` 版本。

正式发布前请在 `app/build.gradle` 配置自己的 keystore 签名。

## GitHub Actions 云端打包（推荐）

仓库内已提供 `.github/workflows/android-apk.yml`。每次修改 Android 工程并推送到 `main`，或在 GitHub 的 **Actions → Build Android APK (ARM64) → Run workflow** 手动触发后，云端 Ubuntu Runner 会自动：

1. 安装 JDK 17、Android SDK API 35 / Build Tools 35；
2. 生成 `app-debug.apk`；
3. 生成未签名的 `app-release-unsigned.apk`；
4. 将两个 APK 上传为本次工作流的 Artifact（保留 30 天）。

在 Actions 的运行详情页底部 **Artifacts** 区下载 `suika-game-arm64-debug-apk`，解压即可得到测试安装包。正式发布包应在本地或 CI 中用私有 keystore 签名，切勿将 `.jks` 与密码提交到仓库。

## v1.0.2 渲染稳定性机制

- 默认使用 PixiJS WebGL GPU 渲染；
- 启动时探测 WebGL 能力。若 WebView/GPU 不支持，自动加载本地 `fallback.js` 的 Canvas 2D 引擎，游戏仍可完整游玩；
- 监听 `webglcontextlost`，后台恢复或驱动重置导致上下文丢失时自动切换到 Canvas 后备渲染；
- Matter 刚体与 Pixi Sprite 使用 `Map` 一对一索引，并使用幂等销毁，规避重复合成碰撞对引发的显示对象错误删除。
