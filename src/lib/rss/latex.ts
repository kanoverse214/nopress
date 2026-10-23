/**
 * RSS 公式降级：KaTeX 渲染标记 → 原始 TeX 文本
 *
 * feed 阅读器没有 KaTeX 样式，渲染标记在无 CSS 环境下不可读；
 * 与客户端渲染时代的 feed 形态对齐，公式以 $…$ / $$…$$ 文本输出。
 * data-tex 中的值本就是 HTML 转义后的 TeX，直接作为转义文本回填。
 */

/** 块级公式容器（内部只有 span，无嵌套 div，惰性闭合安全） */
const BLOCK_EQ = /<div[^>]*notion-equation-block[^>]*data-tex="([^"]*)"[^>]*>[\s\S]*?<\/div>/g;
/** 行内公式（内部只有 span，无嵌套 code，惰性闭合安全） */
const INLINE_EQ = /<code[^>]*notion-equation[^>]*data-tex="([^"]*)"[^>]*>[\s\S]*?<\/code>/g;

/** 公式块替换为 $$…$$ 段落，行内替换为 $…$；未匹配内容原样保留 */
export function replaceKatexWithTex(content: string): string {
  return content
    .replace(BLOCK_EQ, (_, tex: string) => `<p>$$${tex}$$</p>`)
    .replace(INLINE_EQ, (_, tex: string) => `$${tex}$`);
}
