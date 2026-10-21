/**
 * RSS 子系统 Astro 集成
 *
 * 唯一职责：按 SITE_ENABLE_RSS 决定是否把 feed 端点注入为路由。
 * 关闭时路由不存在（dist 中无该文件），主题的 RSS 链接也随之隐藏
 */
import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'url';
import { readEnv, isEnvDisabled } from '../config/env';

export function nopressRssIntegration(): AstroIntegration {
  return {
    name: 'nopress-rss',
    hooks: {
      'astro:config:setup': ({ config, command, injectRoute }) => {
        const mode = command === 'dev' ? 'development' : 'production';
        const projectRoot = fileURLToPath(new URL('.', config.root));
        const raw = readEnv('SITE_ENABLE_RSS', mode, projectRoot);

        if (isEnvDisabled(raw)) {
          return;
        }

        injectRoute({
          pattern: '/rss/feed.xml',
          entrypoint: fileURLToPath(new URL('./endpoint.ts', import.meta.url)),
        });
      },
    },
  };
}
