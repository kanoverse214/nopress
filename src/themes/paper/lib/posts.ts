/**
 * 文章数据工具：发布列表、标签与年份分组
 *
 * 只依赖契约稳定 API（@lib/notion/service、@lib/types、@lib/utils/slug）。
 */
import dataService from '@lib/notion/service';
import type { Post } from '@lib/types';
import { isValidSlug } from '@lib/utils/slug';

export interface TagSummary {
  /** 路由参数（小写） */
  key: string;
  /** 展示名（保留首次出现时的大小写） */
  name: string;
  count: number;
  posts: Post[];
}

export interface YearGroup {
  year: string;
  posts: Post[];
}

/**
 * 可路由的已发布文章（按日期降序）
 * slug 无效的文章不会生成页面，列表中也一并跳过，避免死链
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await dataService.getAllPosts();
  return posts.filter(post => isValidSlug(post.slug));
}

/** 标签路由参数：沿用默认主题的小写规则，切换主题后标签链接保持不变 */
export function tagKey(tag: string): string {
  return tag.toLowerCase();
}

/** 标签能否生成静态路由：斜杠会被当作路径分隔，? # % 与 . / .. 会破坏 URL 解析 */
export function isRoutableTag(tag: string): boolean {
  const key = tagKey(tag).trim();
  return key !== '' && key !== '.' && key !== '..' && !/[\\/?#%]/.test(key);
}

export function tagHref(tag: string): string {
  return `/tag/${encodeURIComponent(tagKey(tag))}`;
}

/** 汇总标签：大小写不同的同名标签合并，按文章数降序、同数按名称排序 */
export function collectTags(posts: Post[]): TagSummary[] {
  const tags = new Map<string, TagSummary>();

  for (const post of posts) {
    for (const tag of post.tags) {
      if (!isRoutableTag(tag)) continue;
      const key = tagKey(tag);
      const entry = tags.get(key) ?? { key, name: tag, count: 0, posts: [] };
      if (!entry.posts.includes(post)) {
        entry.posts.push(post);
        entry.count++;
      }
      tags.set(key, entry);
    }
  }

  return [...tags.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'),
  );
}

/** 按年份分组（输入需已按日期降序） */
export function groupByYear(posts: Post[]): YearGroup[] {
  const groups: YearGroup[] = [];

  for (const post of posts) {
    const year = post.publishedAt.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) {
      last.posts.push(post);
    } else {
      groups.push({ year, posts: [post] });
    }
  }

  return groups;
}

/** 分页链接：第 1 页即首页 */
export function pageHref(page: number): string {
  return page <= 1 ? '/' : `/page/${page}`;
}

/** 更新日期与发布日期不在同一天时才值得展示 */
export function meaningfulUpdate(post: Post): string | null {
  if (!post.updatedAt) return null;
  return post.updatedAt.slice(0, 10) === post.publishedAt.slice(0, 10) ? null : post.updatedAt;
}
