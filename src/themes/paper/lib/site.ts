/**
 * 站点外观小工具：菜单标题拆分、路径匹配、选项值校验
 */

// 覆盖国旗（区域指示符对）、肤色修饰、ZWJ 组合（U+200D）、变体选择符（U+FE0F）与键帽（U+20E3）
const LEADING_EMOJI =
  /^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}\u{20E3}])+\s*/u;

/**
 * 拆出菜单标题开头的 emoji（如 "🏠 首页" → { emoji: "🏠", label: "首页" }）
 * 纯 emoji 标题保持原样，避免拆成空标签
 */
export function splitLeadingEmoji(text: string): { emoji: string; label: string } {
  const match = text.match(LEADING_EMOJI);
  if (!match) return { emoji: '', label: text };
  const label = text.slice(match[0].length).trim();
  return label ? { emoji: match[0].trim(), label } : { emoji: '', label: text };
}

/** 去掉末尾斜杠并解码，便于比较当前路径与菜单链接 */
export function normalizePath(path: string): string {
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch {
    // 非法编码保持原样
  }
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded;
}

/** 菜单项是否对应当前页面（首页只做精确匹配，其余允许子路径） */
export function isCurrentPath(url: string, current: string): boolean {
  const target = normalizePath(url);
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

/**
 * 颜色选项写入 style 属性前做字符白名单校验（color 类型选项不经框架校验）
 * 允许 #hex、rgb()/hsl()/oklch() 与颜色关键字
 */
export function safeColor(value: string | undefined, fallback: string): string {
  return value && /^[#\w(),.%\s/-]+$/.test(value) ? value : fallback;
}
