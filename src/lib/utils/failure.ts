/**
 * 内容渲染失败策略
 *
 * 默认严失败：站点内容不完整时直接抛出，避免残缺页面静默发布。
 * NOPRESS_STRICT=false 降级为告警 + 回退，由调用方决定回退值。
 * 只约束「重试后仍失败的站点内容」；第三方装饰（OG/oEmbed 等）始终降级。
 */

export interface FailureContext {
  pageId?: string;
  blockId?: string;
  blockType?: string;
  slug?: string;
}

export class ContentRenderError extends Error {
  constructor(what: string, context: FailureContext, cause?: unknown) {
    super(`${what} failed${describe(context)}${causeText(cause)}`, { cause });
    this.name = 'ContentRenderError';
  }
}

function describe(context: FailureContext): string {
  const parts = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

function causeText(cause: unknown): string {
  if (cause instanceof Error && cause.message) return `: ${cause.message}`;
  return cause === undefined ? '' : `: ${String(cause)}`;
}

export function isStrictMode(): boolean {
  const raw = import.meta.env?.NOPRESS_STRICT ?? process.env?.NOPRESS_STRICT;
  if (raw === undefined || raw === null || raw === '') return true;
  return !/^(false|0|no|off)$/i.test(String(raw).trim());
}

/** 已是 ContentRenderError 则原样返回，避免递归包装丢失内层上下文 */
export function wrapContentError(what: string, context: FailureContext, error: unknown): Error {
  return error instanceof ContentRenderError ? error : new ContentRenderError(what, context, error);
}

export function handleContentFailure(what: string, context: FailureContext, error: unknown): void {
  if (isStrictMode()) {
    throw wrapContentError(what, context, error);
  }
  console.warn(`[NoPress] ${what} failed${describe(context)}, continuing (NOPRESS_STRICT=false):`, error);
}
