/**
 * 移动端 rem 自适应方案
 * 原理：根据屏幕宽度动态设置 html 的 font-size
 * 配合 postcss-pxtorem 自动将 px 转换为 rem
 */

function initFlexible() {
  const docEl = document.documentElement;
  // 设备像素比
  const dpr = window.devicePixelRatio || 1;

  // 设置 body 字体大小（固定 14px，不随 dpr 缩放）
  function setBodyFontSize() {
    if (document.body) {
      document.body.style.fontSize = '14px';
    } else {
      document.addEventListener('DOMContentLoaded', setBodyFontSize);
    }
  }
  setBodyFontSize();

  // 设置 html 的 font-size
  // 设计稿宽度 375px，分成 10 份，1rem = 37.5px
  function setRemUnit() {
    const width = docEl.clientWidth;
    // 限制最大宽度为 500px（避免在大屏设备上过大）
    const maxWidth = 500;
    // 限制最小宽度为 320px
    const minWidth = 320;
    const effectiveWidth = Math.max(Math.min(width, maxWidth), minWidth);
    // 1rem = effectiveWidth / 10
    const rem = effectiveWidth / 10;
    docEl.style.fontSize = rem + 'px';
    
    // 延迟输出日志，确保 vConsole 已初始化
    setTimeout(() => {
      console.log('[Flexible] 屏幕宽度:', width, ', 有效宽度:', effectiveWidth, ', rem:', rem, ', html font-size:', docEl.style.fontSize);
    }, 100);
  }
  setRemUnit();

  // 监听 resize 事件
  window.addEventListener('resize', setRemUnit);
  // 监听 pageshow 事件（处理页面从 bfcache 中恢复的情况）
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      setRemUnit();
    }
  });

  // 检测 0.5px 支持（处理 1px 边框问题）
  if (dpr >= 2) {
    const fakeBody = document.createElement('body');
    const testElement = document.createElement('div');
    testElement.style.border = '.5px solid transparent';
    fakeBody.appendChild(testElement);
    docEl.appendChild(fakeBody);
    if (testElement.offsetHeight === 1) {
      docEl.classList.add('hairlines');
    }
    docEl.removeChild(fakeBody);
  }
}

// 立即执行
initFlexible();

export { initFlexible };
export default initFlexible;
