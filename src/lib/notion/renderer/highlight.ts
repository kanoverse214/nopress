/**
 * 构建期代码高亮（Shiki）
 *
 * 渲染器直接输出已着色的 HTML：共享一个自定义 Shiki 主题，把 textmate scope
 * 归类为固定语义类别，token 输出为 <span class="code-{类别}">，配色（亮/暗）
 * 由各主题 CSS 按类定义。未支持语言与高亮失败时保持纯转义文本（高亮是装饰，
 * 失败不阻塞渲染）。
 */

import { codeToTokens, type BundledLanguage, type ThemeRegistration } from 'shiki';
import { escapeHtml } from './rich-text';

/**
 * Notion 语言名 → Shiki 语言 id
 * 未列出的语言保持纯文本（如 plaintext、mermaid）
 */
const LANG_IDS: Record<string, BundledLanguage> = {
  html: 'html',
  svg: 'xml',
  xml: 'xml',
  css: 'css',
  scss: 'scss',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  c: 'c',
  'c++': 'cpp',
  cpp: 'cpp',
  'c#': 'csharp',
  csharp: 'csharp',
  go: 'go',
  golang: 'go',
  java: 'java',
  python: 'python',
  py: 'python',
  ruby: 'ruby',
  rust: 'rust',
  sql: 'sql',
  swift: 'swift',
  kotlin: 'kotlin',
  php: 'php',
  markdown: 'markdown',
  diff: 'diff',
  docker: 'docker',
  nginx: 'nginx',
  protobuf: 'protobuf',
  graphql: 'graphql',
};

/**
 * 共享高亮主题：textmate scope → 语义类别
 * 分类由 Shiki 的 textmate 选择器特异性匹配完成，token 的 foreground 即
 * 类别的哨兵色 var(--code-{类别})；类别：comment / keyword / operator /
 * string / function / number / variable / tag / property / punctuation /
 * builtin
 */
const NOPRESS_THEME: ThemeRegistration = {
  name: 'nopress',
  type: 'light',
  settings: [
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: 'var(--code-comment)' } },
    { scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'constant.language'], settings: { foreground: 'var(--code-keyword)' } },
    { scope: ['keyword.operator'], settings: { foreground: 'var(--code-operator)' } },
    { scope: ['string', 'markup.inserted'], settings: { foreground: 'var(--code-string)' } },
    { scope: ['string.regexp'], settings: { foreground: 'var(--code-variable)' } },
    { scope: ['markup.deleted'], settings: { foreground: 'var(--code-comment)' } },
    { scope: ['constant.numeric', 'support.constant'], settings: { foreground: 'var(--code-number)' } },
    { scope: ['entity.name.function', 'support.function', 'variable.function', 'entity.name.type', 'entity.name.class', 'support.class'], settings: { foreground: 'var(--code-function)' } },
    { scope: ['variable', 'support.variable', 'meta.definition.variable'], settings: { foreground: 'var(--code-variable)' } },
    { scope: ['entity.name.tag'], settings: { foreground: 'var(--code-tag)' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: 'var(--code-property)' } },
    { scope: ['punctuation'], settings: { foreground: 'var(--code-punctuation)' } },
    { scope: ['support.type', 'support.builtin'], settings: { foreground: 'var(--code-builtin)' } },
  ],
};

/** 命中类别的 token（哨兵色 var(--code-{类别})）输出对应类名 span，未命中的（空白、普通文本）输出裸转义文本 */
function emitToken(token: { content: string; color?: string }): string {
  const category = token.color?.startsWith('var(--code-') ? token.color.slice('var(--code-'.length, -1) : null;
  return category
    ? `<span class="code-${category}">${escapeHtml(token.content)}</span>`
    : escapeHtml(token.content);
}

/**
 * 高亮代码并返回 HTML 片段（已转义，用于 <code> inner HTML）
 * 不支持的语言返回纯转义文本
 */
export async function highlightCode(code: string, language: string): Promise<string> {
  const langId = LANG_IDS[language.trim().toLowerCase()];
  if (!langId) return escapeHtml(code);

  try {
    const { tokens } = await codeToTokens(code, { lang: langId, theme: NOPRESS_THEME });
    return tokens.map((line) => line.map(emitToken).join('')).join('\n');
  } catch (error) {
    console.warn(`[NotionRenderer] Code highlight failed for ${langId}, falling back to plain text:`, error);
    return escapeHtml(code);
  }
}
