/**
 * Mermaid 图表渲染脚本（Pele 渲染器）
 * 识别 `pre code.language-mermaid` 代码块，替换为 Pele 渲染的 SVG。
 * 经 pele/lazy 按用到的图类型懒加载；深浅色配色由主题的 --pele-* CSS 变量控制，切换无需重渲染。
 */

import type { Mounted } from 'pele';

let mounted: Mounted[] = [];

/**
 * 将页面上的 mermaid 代码块替换为图表容器并渲染
 */
async function renderMermaidDiagrams(blocks: NodeListOf<Element>) {
  const { mountAsync } = await import('pele/lazy');

  for (const codeBlock of blocks) {
    const pre = codeBlock.parentElement;
    if (!pre) continue;

    const code = codeBlock.textContent || '';

    const container = document.createElement('div');
    container.className = 'mermaid-diagram';

    const target = document.createElement('div');
    target.className = 'mermaid';
    container.appendChild(target);

    pre.replaceWith(container);

    try {
      mounted.push(await mountAsync(target, code));
    } catch (error) {
      // 语法错误由 Pele 直接显示在容器内，这里只兜底 chunk 加载等异常
      console.error('Mermaid render error:', error);
    }
  }
}

/**
 * 初始化 Mermaid 渲染
 */
export async function initMermaidRendering() {
  // 先检查页面是否存在 Mermaid 代码块，避免无图表页面加载渲染器 chunk
  const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
  if (mermaidBlocks.length === 0) return;

  await renderMermaidDiagrams(mermaidBlocks);
}

function destroyMermaidDiagrams() {
  for (const diagram of mounted) diagram.destroy();
  mounted = [];
}

// astro:page-load 在首次加载与每次客户端导航后都会触发（依赖布局中的 <ClientRouter />）；
// requestIdleCallback 延迟执行避免阻塞首屏渲染
if (typeof window !== 'undefined') {
  document.addEventListener('astro:page-load', () => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => initMermaidRendering(), { timeout: 3000 });
    } else {
      setTimeout(() => initMermaidRendering(), 200);
    }
  });

  // 软导航替换 DOM 前销毁实例，释放 mount() 的容器尺寸监听
  document.addEventListener('astro:before-swap', destroyMermaidDiagrams);
}
