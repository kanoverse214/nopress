/**
 * Giscus 评论系统集成
 * @see https://giscus.app
 *
 * 评论主题跟随站点深浅色（THEMES.md §6 的 html class 契约）：
 * 初始值在 iframe 创建时按当前模式写入，之后经 setConfig 消息热切，无需重载脚本
 *
 * Core 层提供的工具脚本，主题可以选择使用或自己实现
 */

import type { GiscusConfig } from '@lib/types';
import { getSiteThemeMode, onSiteThemeChange, type SiteThemeMode } from '../theme-mode';

export interface GiscusInitOptions {
  container: HTMLElement; // 评论容器元素
  slug: string;
  title: string;
  config: GiscusConfig;
}

/** 容器内是否已挂载 giscus（客户端导航会带来全新容器，不受模块级状态影响） */
function containerHasGiscus(container: HTMLElement): boolean {
  return !!container.querySelector('iframe.giscus-frame, #giscus-script');
}

/** 站点深浅色对应的 giscus 内置主题；深色用 transparent_dark 以融入站点自身底色 */
const GISCUS_THEME: Record<SiteThemeMode, string> = {
  light: 'light',
  dark: 'transparent_dark',
};

// 向已挂载的 giscus iframe 推送当前模式对应的主题（iframe 未就绪时为 no-op）
function pushGiscusTheme(): void {
  document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
    ?.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: GISCUS_THEME[getSiteThemeMode()] } } },
      'https://giscus.app',
    );
}

/**
 * 初始化 Giscus 评论系统
 * @param options.container - 评论容器 DOM 元素
 * @param options.slug - 页面 slug，用于映射评论
 * @param options.title - 页面标题
 * @param options.config - Giscus 配置
 */
export async function initGiscus(options: GiscusInitOptions): Promise<void> {
  if (containerHasGiscus(options.container)) {
    return;
  }

  // 站点深浅色变化时热切评论主题；Set 按引用去重，软导航重复 init 不会叠加订阅
  onSiteThemeChange(pushGiscusTheme);

  const { container, slug, config } = options;

  // 验证配置
  if (!config.repo || !config.repoId || !config.categoryId) {
    console.error('[Giscus] ❌ Missing required configuration', {
      repo: config.repo,
      repoId: config.repoId,
      categoryId: config.categoryId,
    });
    showErrorMessage(container, '评论系统配置不完整，请联系站点管理员');
    return;
  }

  try {
    // 动态加载 Giscus 脚本
    await loadGiscusScript(container, config, slug);

    console.log('[Giscus] ✅ Initialized successfully');
  } catch (error) {
    console.error('[Giscus] ❌ Failed to initialize:', error);

    // 显示错误提示
    showErrorMessage(container, '评论加载失败，请刷新页面重试');
  }
}

/**
 * 动态加载 Giscus 脚本
 * @param container - 评论容器 DOM 元素
 */
async function loadGiscusScript(
  container: HTMLElement,
  config: GiscusConfig,
  slug: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 移除旧的脚本（如果存在）
    const existingScript = document.querySelector('#giscus-script');
    if (existingScript) {
      existingScript.remove();
    }

    // 创建 script 标签
    const script = document.createElement('script');
    script.id = 'giscus-script';
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.defer = true;

    // 设置 Giscus 配置属性
    script.setAttribute('data-repo', config.repo);
    script.setAttribute('data-repo-id', config.repoId);
    script.setAttribute('data-category', config.category);
    script.setAttribute('data-category-id', config.categoryId);
    script.setAttribute('data-mapping', config.mapping);
    script.setAttribute('data-strict', config.strict);
    script.setAttribute('data-reactions-enabled', config.reactionsEnabled);
    script.setAttribute('data-emit-metadata', config.emitMetadata);
    script.setAttribute('data-input-position', config.inputPosition);
    script.setAttribute('data-lang', config.lang);
    script.setAttribute('data-lazy', config.lazy.toString());

    // 主题跟随站点深浅色：初始值在 iframe 创建时读取，后续变化经 setConfig 热切
    script.setAttribute('data-theme', GISCUS_THEME[getSiteThemeMode()]);

    // 设置页面映射（使用 pathname）
    script.setAttribute('data-term', slug);

    // 加载完成回调
    script.onload = () => {
      // 隐藏加载提示
      const loading = container.querySelector('.comments-loading');
      if (loading) {
        loading.remove();
      }
      // client.js 执行到 iframe 建立之间的模式切换在此兜底纠正；iframe 未建立时为 no-op
      pushGiscusTheme();
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Giscus script'));
    };

    // 插入到容器
    container.appendChild(script);
  });
}

/**
 * 显示错误消息
 * @param container - 评论容器 DOM 元素
 * @param message - 错误消息
 */
function showErrorMessage(container: HTMLElement, message: string): void {
  container.innerHTML = `
    <div class="comments-error" style="
      padding: 1rem;
      text-align: center;
      color: var(--color-text-secondary, #666);
      border: 1px solid var(--color-border, #e0e0e0);
      border-radius: 0.5rem;
      background: var(--color-surface, #f5f5f5);
    ">
      <p style="margin: 0;">${message}</p>
      <p style="
        font-size: 0.85em;
        margin: 0.5em 0 0 0;
        color: var(--color-text-tertiary, #999);
      ">
        如果问题持续存在，请检查控制台获取更多信息
      </p>
    </div>
  `;
}
