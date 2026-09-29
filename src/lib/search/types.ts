/**
 * 搜索子系统类型
 *
 * SearchDocument 是 /search-docs.json 端点的产物契约，
 * 其余类型描述无头客户端 @lib/search/client 的调用面
 */

/** 端点中的单条文档（正文为纯文本，代码块已剔除） */
export interface SearchDocument {
  /** = slug，站内唯一 */
  id: string;
  /** /post/{slug} 或 /{slug} */
  url: string;
  type: 'post' | 'page';
  title: string;
  /** page 为空数组 */
  tags: string[];
  /** description 或正文截断，空查询时作为摘要展示 */
  excerpt: string;
  /** 全文纯文本，索引与摘要片段提取共用 */
  body: string;
  /** publishedAt（ISO 格式） */
  date: string;
}

/** 单条搜索结果 */
export interface SearchItem {
  doc: SearchDocument;
  score: number;
  /** 命中词（已归一化），主题据此自行决定高亮方式 */
  terms: string[];
  /** 正文首个命中前后的纯文本片段，不含任何标记 */
  snippet: string;
}

export type SearchResult =
  | { status: 'ok'; items: SearchItem[] }
  | { status: 'loading' }
  | { status: 'unavailable' };

export interface SearchClientOptions {
  /** 文档集端点，默认 /search-docs.json */
  endpoint?: string;
  /** 字段权重，默认 { title: 5, tags: 3, body: 1 } */
  boost?: { title?: number; tags?: number; body?: number };
  /** 前缀匹配，默认开启 */
  prefix?: boolean;
  /** 模糊匹配；默认词长大于 3 时编辑距离 0.2 */
  fuzzy?: number | false | ((term: string) => number | false);
  /** 多词组合方式；默认 AND（中文查询被切成多词后，要求全部命中以免高频单字淹没结果） */
  combineWith?: 'AND' | 'OR';
  /** 结果数上限，默认 10 */
  limit?: number;
  /** 空查询时返回最近发布，默认开启 */
  recentOnEmpty?: boolean;
}

export interface SearchClient {
  /** 首次 await 才拉取索引并建库；失败 resolve false（不抛错，之后恒为 unavailable） */
  readonly ready: Promise<boolean>;
  /** 索引未就绪时返回 loading */
  query(query: string): SearchResult;
}
