/**
 * /search-docs.json 数据端点
 *
 * 产物是搜索文档集（corpus）而非倒排索引：分词与建索引在浏览器端首次唤起
 * 搜索时进行，此处只做纯文本化与元数据装配。
 * 路由由 nopressSearchIntegration 按 SITE_ENABLE_SEARCH 条件注入（关闭时不生成），
 * 文件因此放在 lib 下而不是 src/pages——后者的文件会无条件成为路由
 */
import type { APIRoute } from 'astro';
import dataService from '@lib/notion/service';
import { buildSearchDocuments } from './documents';

export const GET: APIRoute = async () => {
  // 复用 all-posts / pages 既有缓存，不产生额外 Notion 请求
  const [posts, pages] = await Promise.all([
    dataService.getAllPosts(),
    dataService.getAllPages(),
  ]);

  return new Response(JSON.stringify(buildSearchDocuments(posts, pages)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
