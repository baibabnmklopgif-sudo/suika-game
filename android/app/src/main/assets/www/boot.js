/* Renderer bootstrap: prefer GPU WebGL; automatically keep the game playable with Canvas 2D fallback. */
(() => {
  'use strict';
  let started = false;
  window.__startCanvasFallback = function (reason) {
    if (started && window.__suikaFallback) return;
    window.__suikaFallback = true;
    // 保留原因以供调试；不向玩家暴露报错，后备游戏会直接启动。
    window.__suikaRendererReason = reason || 'WebGL unavailable';
    const old = document.getElementById('app-canvas');
    if (old) {
      const replacement = old.cloneNode(false);
      old.replaceWith(replacement); // 释放可能失效的 WebGL 上下文
    }
    const script = document.createElement('script');
    script.src = 'fallback.js';
    script.defer = true;
    document.head.appendChild(script);
  };
  function supportsWebGL() {
    try {
      const probe = document.createElement('canvas');
      return !!(probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || probe.getContext('webgl', { failIfMajorPerformanceCaveat: false }));
    } catch (_) { return false; }
  }
  if (!window.PIXI || !window.Matter || !supportsWebGL()) {
    window.__startCanvasFallback('WebGL unavailable');
    return;
  }
  started = true;
  const script = document.createElement('script');
  script.src = 'game.js';
  script.defer = true;
  script.onerror = () => window.__startCanvasFallback('WebGL engine load failed');
  document.head.appendChild(script);
  // 初始化期若渲染器抛异常，切换到稳定 Canvas 后备实现。
  window.addEventListener('error', event => {
    if (!window.__suikaFallback && /renderer|webgl|pixi/i.test(String(event.message || ''))) {
      window.__startCanvasFallback('WebGL renderer initialization failed');
    }
  }, { capture: true, once: true });
})();
