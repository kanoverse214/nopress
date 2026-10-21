import { MemoryCache } from './memory-cache';
import { FileCache } from './file-cache';
import { getDataLayerVersion } from './code-version';
import { readRuntimeEnv } from '../config/env';
import crypto from 'crypto';
import type { Cache, CacheConfig, FileCacheConfig } from './types';

/**
 * 缓存策略类型
 */
export type CacheStrategy = 'memory' | 'file' | 'auto';

/**
 * 缓存管理器配置
 */
export interface CacheManagerConfig {
  /** 缓存策略 */
  strategy?: CacheStrategy;
  /** 内存缓存配置 */
  memoryConfig?: CacheConfig;
  /** 文件缓存配置 */
  fileConfig?: FileCacheConfig;
}

/**
 * 缓存管理器
 * 根据环境和配置自动选择合适的缓存实现
 */
export class CacheManager {
  private cache: Cache;
  private strategy: CacheStrategy;

  constructor(config: CacheManagerConfig = {}) {
    this.strategy = config.strategy ?? 'auto';

    // 根据策略选择缓存实现
    if (this.strategy === 'auto') {
      // 开发环境使用内存缓存，生产环境使用文件缓存
      const isDevelopment = process.env.NODE_ENV === 'development' ||
                          import.meta.env?.MODE === 'development';
      this.strategy = isDevelopment ? 'memory' : 'file';
    }

    if (this.strategy === 'memory') {
      this.cache = new MemoryCache(config.memoryConfig);
    } else {
      this.cache = new FileCache(config.fileConfig);
    }
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    return await this.cache.get<T>(key);
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl);
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<void> {
    await this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    await this.cache.clear();
    console.log('🧹 Cache CLEARED');
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * 获取缓存统计信息
   */
  async getStats() {
    if (this.cache instanceof MemoryCache) {
      return this.cache.getStats();
    } else if (this.cache instanceof FileCache) {
      return await this.cache.getStats();
    }
    return null;
  }

  /**
   * 清理过期缓存
   */
  async cleanup() {
    if (this.cache instanceof FileCache) {
      return await this.cache.cleanup();
    }
    return 0;
  }

  /**
   * 获取当前使用的缓存策略
   */
  getStrategy(): CacheStrategy {
    return this.strategy;
  }
}

/**
 * 数据源标识：NOTION_DATABASE_ID 的 sha256 前 8 位
 * 掺入 namespace 后更换数据源即自动 miss，不同数据源的缓存文件并存互不污染；
 * token 不参与——db id 已足够区分站点
 */
function getDataSourceVersion(): string {
  const databaseId = readRuntimeEnv('NOTION_DATABASE_ID');
  if (!databaseId) return 'no-database';
  return crypto.createHash('sha256').update(databaseId).digest('hex').slice(0, 8);
}

/**
 * 创建 Notion 专用缓存实例
 * namespace 掺入两个失效维度，旧缓存文件由 TTL 过期后 cleanup() 回收：
 * - 数据层代码版本：notion/ cache/ utils/ types.ts 变更后自动失效
 * - 数据源标识：NOTION_DATABASE_ID 变更（更换数据源）后自动失效
 */
export function createNotionCache(config: CacheManagerConfig = {}): CacheManager {
  const notionNamespace = `notion:v${getDataLayerVersion()}:${getDataSourceVersion()}`;

  return new CacheManager({
    ...config,
    memoryConfig: {
      namespace: notionNamespace,
      defaultTTL: 5 * 60 * 1000, // 开发环境：5 分钟
      ...config.memoryConfig,
    },
    fileConfig: {
      namespace: notionNamespace,
      defaultTTL: 60 * 60 * 1000, // 生产环境：1 小时
      compress: true,
      ...config.fileConfig,
    },
  });
}

// 导出类型和工具
export * from './types';
export { MemoryCache } from './memory-cache';
export { FileCache } from './file-cache';

// 创建默认缓存实例
export const notionCache = createNotionCache();
