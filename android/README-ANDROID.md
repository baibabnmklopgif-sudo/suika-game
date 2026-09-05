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
