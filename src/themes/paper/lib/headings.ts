/**
 * 正文标题处理：补齐锚点 id、提取目录、生成章节编号
 *
 * 渲染器按 \w 生成标题 id，纯中文标题会得到 id=""，同名标题还会重复。
 * 这里沿用 table-of-contents 脚本的补 id 规则（扩展到全部 Unicode 字母数字）并去重，
 * 构建期即可产出可用的目录锚点；渲染器已给出的非空 id 原样保留，跨主题锚点一致。
 */

export interface Heading {
  /** 锚点 id（已去重） */
  id: string;
  /** 纯文本标题 */
  text: string;
  /** 原始层级 1-3 */
  level: number;
  /** 相对正文最高层级的深度（0 起） */
  depth: number;
  /** 章节编号，如 "2.1" */
  number: string;
}

export interface ProcessedContent {
  html: string;
  headings: Heading[];
}

const HEADING_RE = /<h([1-3])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  '#039': "'",
  nbsp: ' ',
};

function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#0?39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param numbered 为 true 时在标题前插入 <span class="sec-num">，编号与目录一致
 */
export function processHeadings(html: string, numbered = false): ProcessedContent {
  const levels = Array.from(html.matchAll(/<h([1-3])[\s>]/g), match => Number(match[1]));
  if (levels.length === 0) return { html, headings: [] };

  const minLevel = Math.min(...levels);
  const used = new Set<string>();
  const counters = [0, 0, 0];
  const headings: Heading[] = [];

  const output = html.replace(
    HEADING_RE,
    (_match, levelText: string, attrs: string | undefined, inner: string) => {
      const level = Number(levelText);
      const depth = level - minLevel;
      const text = toPlainText(inner);

      const existing = attrs?.match(/\sid="([^"]*)"/)?.[1] ?? '';
      const base = existing || slugifyHeading(text) || `heading-${headings.length + 1}`;
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);

      counters[depth]++;
      counters.fill(0, depth + 1);
      const number = counters.slice(0, depth + 1).join('.');

      headings.push({ id, text, level, depth, number });

      const rest = (attrs ?? '').replace(/\sid="[^"]*"/, '');
      const prefix = numbered ? `<span class="sec-num">${number}</span>` : '';
      return `<h${level} id="${id}"${rest}>${prefix}${inner}</h${level}>`;
    },
  );

  return { html: output, headings };
}
