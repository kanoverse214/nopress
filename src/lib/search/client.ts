/**
 * 无头搜索客户端（浏览器端）
 *
 * 职责：拉取文档集端点、懒建 minisearch 索引、查询、提取摘要片段；
 * 不触碰 DOM、不绑定事件——界面与交互完全由主题实现。
 *
 * 文档集与 minisearch 经动态 import 懒加载，仅在首次 await ready 时发生；
 * 实例状态随引用它的客户端模块存续，软导航（astro:page-load）后无需重建
 */
import type MiniSearch from 'minisearch';
import type { SearchClient, SearchClientOptions, SearchDocument, SearchItem, SearchResult } from './types';

export type {
  SearchClient,
  SearchClientOptions,
  SearchDocument,
  SearchItem,
  SearchResult,
} from './types';

/** NFKC 归一化（全角转半角）+ 小写折叠 */
function normalizeTerm(term: string): string {
  return term.normalize('NFKC').toLowerCase();
}

const CJK_CLASS = '\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff';
const CJK_RUN = new RegExp(`[${CJK_CLASS}]+`, 'g');
const NON_CJK_WORD = new RegExp(`[^${CJK_CLASS}\\s]+`, 'g');

/** Intl.Segmenter 不可用时的降级分词：CJK 二元组 + 拉丁/数字整词 */
function tokenizeByBigram(text: string): string[] {
  const terms: string[] = [];
  for (const run of text.match(CJK_RUN) ?? []) {
    if (run.length === 1) {
      terms.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) {
      terms.push(run.slice(i, i + 2));
    }
  }
  for (const word of text.match(NON_CJK_WORD) ?? []) {
    terms.push(word);
  }
  return terms;
}

function createTokenizer(): (text: string) => string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
    return text => {
      const terms: string[] = [];
      for (const segment of segmenter.segment(text)) {
        // 过滤标点与空白，保留词与数字
        if (segment.isWordLike) {
          terms.push(segment.segment);
        }
      }
      return terms;
    };
  }
  return tokenizeByBigram;
}

/**
 * 正文片段：最早命中的词前后各 radius 字符，越界侧补省略号
 */
export function buildSnippet(body: string, terms: string[], radius = 40): string {
  if (!body) {
    return '';
  }
  const lower = body.toLowerCase();
  let hitStart = -1;
  let hitLength = 0;
  for (const term of terms) {
    const needle = term.toLowerCase();
    if (!needle) {
      continue;
    }
    const index = lower.indexOf(needle);
    if (index !== -1 && (hitStart === -1 || index < hitStart)) {
      hitStart = index;
      hitLength = needle.length;
    }
  }
  if (hitStart === -1) {
    return body.slice(0, radius * 2);
  }
  const start = Math.max(0, hitStart - radius);
  const end = Math.min(body.length, hitStart + hitLength + radius);
  return `${start > 0 ? '…' : ''}${body.slice(start, end)}${end < body.length ? '…' : ''}`;
}

/**
 * 创建搜索客户端。构造无 IO，首次 await ready 才拉取索引并建库
 */
export function createSearchClient(options: SearchClientOptions = {}): SearchClient {
  const {
    endpoint = '/search-docs.json',
    boost = { title: 5, tags: 3, body: 1 },
    prefix = true,
    fuzzy = (term: string) => (term.length > 3 ? 0.2 : false),
    combineWith = 'AND',
    limit = 10,
    recentOnEmpty = true,
  } = options;

  const tokenize = createTokenizer();

  let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  let engine: MiniSearch<SearchDocument> | null = null;
  let docsById: Map<string, SearchDocument> | null = null;
  let readyPromise: Promise<boolean> | null = null;

  function ensureReady(): Promise<boolean> {
    if (!readyPromise) {
      state = 'loading';
      readyPromise = (async () => {
        try {
          const [response, minisearch] = await Promise.all([
            fetch(endpoint, { headers: { Accept: 'application/json' } }),
            import('minisearch'),
          ]);
          if (!response.ok) {
            throw new Error(`索引请求失败：${endpoint} → ${response.status}`);
          }
          const docs = (await response.json()) as SearchDocument[];

          engine = new minisearch.default({
            fields: ['title', 'body', 'tags'],
            searchOptions: { boost, prefix, fuzzy, combineWith },
            tokenize,
            processTerm: term => normalizeTerm(term) || null,
          });
          engine.addAll(docs);
          docsById = new Map(docs.map(doc => [doc.id, doc]));
          state = 'ready';
          return true;
        } catch (error) {
          // 端点被 SITE_ENABLE_SEARCH 关闭、部署缺文件或网络失败都归入不可用
          state = 'failed';
          console.error('[NoPress Search] 文档集加载失败：', error);
          return false;
        }
      })();
    }
    return readyPromise;
  }

  return {
    get ready() {
      return ensureReady();
    },

    query(rawQuery: string): SearchResult {
      if (state === 'failed') {
        return { status: 'unavailable' };
      }
      if (state !== 'ready' || !engine || !docsById) {
        return { status: 'loading' };
      }

      const query = rawQuery.trim();
      if (!query) {
        if (!recentOnEmpty) {
          return { status: 'ok', items: [] };
        }
        // 文档本身按日期降序，Map 保留插入顺序
        const recent = [...docsById.values()].slice(0, limit);
        return {
          status: 'ok',
          items: recent.map(doc => ({ doc, score: 0, terms: [], snippet: doc.excerpt })),
        };
      }

      const raw = engine.search(query);
      const items: SearchItem[] = [];
      const seen = new Set<string>();
      for (const result of raw) {
        if (items.length >= limit) {
          break;
        }
        const id = result.id as string;
        if (seen.has(id)) {
          continue;
        }
        const doc = docsById.get(id);
        if (!doc) {
          continue;
        }
        seen.add(id);
        const terms = result.terms ?? [];
        items.push({ doc, score: result.score, terms, snippet: buildSnippet(doc.body, terms) });
      }
      return { status: 'ok', items };
    },
  };
}
