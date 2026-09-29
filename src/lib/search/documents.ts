/**
 * 搜索文档集装配：Notion 内容 → SearchDocument[]（/search-docs.json 的产物）
 *
 * 只做纯文本化与元数据整形，不做分词——minisearch 在浏览器端建库时才分词
 */
import type { Post } from '@lib/types';
import { extractPlainText, generateExcerpt } from '@lib/utils/format';
import { isValidSlug } from '@lib/utils/slug';
import type { SearchDocument } from './types';

/**
 * 常见 HTML 实体解码
 *
 * extractPlainText 只剥标签不解码实体，直接沿用会让索引正文残留
 * `&amp;` 等字面量（污染展示与 "&" 查询），此处在装配层补齐
 */
function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '—', ndash: '–', hellip: '…', middot: '·', bull: '•',
    ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»',
    times: '×', divide: '÷', deg: '°', plusmn: '±', prime: '′',
    copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥', cent: '¢',
    para: '§', sect: '§', dagger: '†', szlig: 'ß',
  };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (_, name: string) => named[name] ?? `&${name};`);
}

function toSearchDocument(item: Post, type: 'post' | 'page'): SearchDocument | null {
  // 与路由生成同口径：无效 slug 的条目不产生页面，也不应被搜到
  if (!isValidSlug(item.slug)) {
    return null;
  }

  const description = (item.description || '').trim();
  const excerpt = description || generateExcerpt(item.content, 160);

  return {
    id: item.slug,
    url: type === 'post' ? `/post/${item.slug}` : `/${item.slug}`,
    type,
    title: item.title,
    tags: item.tags ?? [],
    excerpt: decodeHtmlEntities(excerpt),
    body: decodeHtmlEntities(extractPlainText(item.content)),
    date: item.publishedAt,
  };
}

/**
 * 装配索引文档，输出全局按发布日期降序（空查询的“最近发布”直接取前 N）
 */
export function buildSearchDocuments(posts: Post[], pages: Post[]): SearchDocument[] {
  return [
    ...posts.map(post => toSearchDocument(post, 'post')),
    ...pages.map(page => toSearchDocument(page, 'page')),
  ]
    .filter((doc): doc is SearchDocument => doc !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
