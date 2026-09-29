/**
 * default 主题搜索交互
 *
 * 查询引擎来自内核 @lib/search/client（无头）；本文件负责全部 DOM 与交互：
 * 唤起（按钮 / Ctrl+K / 非输入态 /）、IME 组合期抑制查询、结果渲染与高亮、键盘导航。
 *
 * 客户端模块只执行一次，client 实例与已加载索引跨软导航存续；
 * dialog 在 body 中，软导航会被替换，故每次 astro:page-load 重绑（AbortController 撤销上一轮）
 */
import { createSearchClient } from '@lib/search/client';
import type { SearchItem, SearchResult } from '@lib/search/client';

const search = createSearchClient();

const DIALOG_SELECTOR = 'dialog.search-dialog';

let lifecycle: AbortController | null = null;
let items: SearchItem[] = [];
let activeIndex = -1;
let composing = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let lastTrigger: HTMLElement | null = null;

document.addEventListener('astro:page-load', setupSearch);

function setupSearch(): void {
  lifecycle?.abort();
  lifecycle = new AbortController();
  const { signal } = lifecycle;

  const dialog = document.querySelector<HTMLDialogElement>(DIALOG_SELECTOR);
  if (!dialog) {
    return;
  }

  const trigger = document.querySelector<HTMLElement>('.search-trigger');
  const input = dialog.querySelector<HTMLInputElement>('.search-input');

  trigger?.addEventListener('click', () => openSearch(), { signal });

  window.addEventListener(
    'keydown',
    event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        openSearch();
      }
    },
    { signal },
  );

  if (!input) {
    return;
  }

  // IME 组合期（拼音未上屏）不查询，组合结束立即查询
  input.addEventListener('compositionstart', () => {
    composing = true;
  }, { signal });
  input.addEventListener(
    'compositionend',
    () => {
      composing = false;
      scheduleQuery(input);
    },
    { signal },
  );
  input.addEventListener('input', () => scheduleQuery(input), { signal });

  // 键盘导航：dialog 打开时焦点始终在输入框
  input.addEventListener(
    'keydown',
    event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter') {
        // 走锚点点击，与站内链接一致由 ClientRouter 软导航接管
        const active = document.querySelector<HTMLAnchorElement>(
          `${DIALOG_SELECTOR} .search-result.active`,
        );
        if (active) {
          event.preventDefault();
          active.click();
        }
      }
    },
    { signal },
  );

  dialog.addEventListener(
    'close',
    () => {
      document.body.classList.remove('search-lock');
      lastTrigger?.focus();
      lastTrigger = null;
    },
    { signal },
  );

  // 点击遮罩（事件目标为 dialog 自身）关闭；移动端全屏无遮罩区域，关闭走顶栏 ✕
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      dialog.close();
    }
  }, { signal });

  dialog.querySelector('.search-close')?.addEventListener('click', () => dialog.close(), { signal });
}

async function openSearch(): Promise<void> {
  const dialog = document.querySelector<HTMLDialogElement>(DIALOG_SELECTOR);
  const input = dialog?.querySelector<HTMLInputElement>('.search-input');
  if (!dialog || !input) {
    return;
  }

  lastTrigger ??= document.querySelector<HTMLElement>('.search-trigger');
  if (!dialog.open) {
    dialog.showModal();
    document.body.classList.add('search-lock');
  }
  input.focus();
  input.select();

  // 索引未就绪时先渲染 loading 态
  render(search.query(input.value));

  const ok = await search.ready;
  if (!ok) {
    render({ status: 'unavailable' });
    return;
  }
  // 等待期间用户可能已输入，补一次查询
  scheduleQuery(input, 0);
}

function scheduleQuery(input: HTMLInputElement, delay = 120): void {
  if (composing) {
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => render(search.query(input.value)), delay);
}

function render(result: SearchResult): void {
  const container = document.querySelector<HTMLElement>(`${DIALOG_SELECTOR} .search-results`);
  if (!container) {
    return;
  }

  if (result.status !== 'ok') {
    items = [];
    activeIndex = -1;
    container.innerHTML =
      result.status === 'loading'
        ? '<div class="search-status">正在准备搜索…</div>'
        : '<div class="search-status">搜索暂不可用</div>';
    return;
  }

  items = result.items;
  activeIndex = items.length > 0 ? 0 : -1;

  if (items.length === 0) {
    container.innerHTML = '<div class="search-status">没有找到相关内容</div>';
    return;
  }

  container.innerHTML = items.map((item, index) => resultItemHtml(item, index)).join('');
}

function resultItemHtml(item: SearchItem, index: number): string {
  const { doc } = item;
  const date = new Date(doc.date)
    .toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '.');
  const meta = [doc.type === 'page' ? '页面' : '文章', doc.tags.join(' / '), date]
    .filter(Boolean)
    .join(' · ');

  return `<a class="search-result${index === activeIndex ? ' active' : ''}" href="${escapeHtml(doc.url)}" role="option">
  <span class="search-result-title">${highlight(doc.title, item.terms)}</span>
  <span class="search-result-snippet">${highlight(item.snippet, item.terms)}</span>
  <span class="search-result-meta">${escapeHtml(meta)}</span>
</a>`;
}

function moveActive(delta: number): void {
  if (items.length === 0) {
    return;
  }
  activeIndex = (activeIndex + delta + items.length) % items.length;
  const links = document.querySelectorAll<HTMLAnchorElement>(
    `${DIALOG_SELECTOR} .search-result`,
  );
  links.forEach((link, index) => link.classList.toggle('active', index === activeIndex));
  links[activeIndex]?.scrollIntoView({ block: 'nearest' });
}

/** 命中词包裹 <mark>，其余部分 HTML 转义；无命中词时纯转义 */
function highlight(text: string, terms: string[]): string {
  const needles = terms.filter(Boolean).sort((a, b) => b.length - a.length);
  if (needles.length === 0) {
    return escapeHtml(text);
  }
  const pattern = new RegExp(`(${needles.map(escapeRegExp).join('|')})`, 'gi');
  return text
    .split(pattern)
    .filter(chunk => chunk !== '')
    .map(chunk => {
      const isHit = needles.some(needle => needle.toLowerCase() === chunk.toLowerCase());
      return isHit ? `<mark>${escapeHtml(chunk)}</mark>` : escapeHtml(chunk);
    })
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `/` 快捷键在输入场景（输入框/文本域/可编辑区）不触发 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}
