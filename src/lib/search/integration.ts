/**
 * 搜索子系统 Astro 集成
 *
 * 唯一职责：按 SITE_ENABLE_SEARCH 决定是否把文档集端点注入为路由。
 * 关闭时路由不存在（dist 中无该文件），主题搜索界面随之降级为不可用态
 */
import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'url';
import { readEnv } from '../config/env';

export function nopressSearchIntegration(): AstroIntegration {
  return {
    name: 'nopress-search',
    hooks: {
      'astro:config:setup': ({ config, command, injectRoute }) => {
        const mode = command === 'dev' ? 'development' : 'production';
        const projectRoot = fileURLToPath(new URL('.', config.root));
        const raw = readEnv('SITE_ENABLE_SEARCH', mode, projectRoot);
        const disabled =
          raw !== undefined && ['false', '0'].includes(raw.trim().toLowerCase());

        if (disabled) {
          return;
        }

        injectRoute({
          pattern: '/search-docs.json',
          entrypoint: fileURLToPath(new URL('./endpoint.ts', import.meta.url)),
        });
      },
    },
  };
}
