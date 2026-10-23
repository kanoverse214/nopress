/**
 * 构建期数学公式渲染（KaTeX）
 *
 * 渲染器直接输出 KaTeX HTML（含无障碍 MathML），原始 TeX 由调用方保存在
 * 容器 data-tex 属性上，供 .md 端点与搜索索引使用；KaTeX 样式由主题布局
 * 全局引入。渲染失败回退为带定界符的转义 TeX 文本，不阻塞渲染。
 */

import katex from 'katex';

const KATEX_OPTIONS = {
  throwOnError: false,
  errorColor: '#cc0000',
  strict: 'warn' as const,
};

/** 回退路径专用，与 rich-text.escapeHtml 同规则（独立实现避免模块循环依赖） */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * 渲染 TeX 为 KaTeX HTML 片段
 * 失败时返回带 $$/$ 定界符的转义文本（错误不外抛）
 */
export function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode });
  } catch (error) {
    console.warn(`[NotionRenderer] KaTeX render failed, falling back to raw TeX:`, error);
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}
