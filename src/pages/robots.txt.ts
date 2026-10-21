import type { APIRoute } from 'astro';
import { readRuntimeEnv, isEnvDisabled } from '@lib/config/env';

export const GET: APIRoute = ({ site }) => {
  const lines: string[] = ['User-agent: *', 'Allow: /'];

  // Sitemap 行与 sitemap 集成同受 SITE_ENABLE_SITEMAP 控制，关闭时不输出死链
  if (!isEnvDisabled(readRuntimeEnv('SITE_ENABLE_SITEMAP'))) {
    lines.push('', `Sitemap: ${new URL('sitemap-index.xml', site).href}`);
  }

  return new Response(lines.join('\n') + '\n');
};
