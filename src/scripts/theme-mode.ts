/**
 * 站点深浅色模式（THEMES.md §6 契约：<html> 的 light/dark class 是唯一真值）
 *
 * class 由内核注入的内联脚本初始化并在 astro:after-swap 重应用，
 * 主题切换按钮直接改写——没有事件派发，观察 class 变化是主题无关的唯一可靠途径。
 */

export type SiteThemeMode = 'light' | 'dark';

/** 当前解析后的模式；未声明 darkMode 的单形态主题无 class，按 light 处理 */
export function getSiteThemeMode(): SiteThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

type ThemeModeListener = (mode: SiteThemeMode) => void;

const listeners = new Set<ThemeModeListener>();
let watching = false;

function notify(): void {
  const mode = getSiteThemeMode();
  listeners.forEach(listener => listener(mode));
}

/**
 * 订阅站点深浅色变化。观察器模块级单例、多订阅者共享；
 * 订阅者与页面同生命周期（静态站无卸载场景），不提供退订。
 */
export function onSiteThemeChange(listener: ThemeModeListener): void {
  listeners.add(listener);
  if (watching || typeof MutationObserver === 'undefined') return;
  watching = true;
  new MutationObserver(notify).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}
