/**
 * 环境变量读取的统一入口
 *
 * 优先级（两个阶段一致）：真实环境变量 > .env 文件
 *
 * 必须区分调用阶段：
 * - 配置期（astro.config.mjs / integration hooks）：早于 Vite 初始化，
 *   process.env 不含 .env 内容，须用 readEnv() 经 loadEnv 补读
 * - 渲染期（页面/数据层等 Vite 模块）：import.meta.env 已合并真实环境变量与 .env，
 *   用 readRuntimeEnv()；勿在配置期使用（此时 import.meta.env 不存在）
 */
import { loadEnv } from 'vite';

/**
 * 配置期读取单个环境变量
 * root 传 config.root 解析出的项目根，默认 process.cwd()
 */
export function readEnv(key: string, mode: string, root: string = process.cwd()): string | undefined {
  if (process.env[key]) {
    return process.env[key];
  }
  // loadEnv 第三参数按前缀过滤，可能连带读出同前缀变量，按 key 精确取值即可
  return loadEnv(mode, root, key)[key] || undefined;
}

/**
 * 渲染期读取单个环境变量（空值视为未设置）
 */
export function readRuntimeEnv(key: string): string | undefined {
  const raw = (import.meta.env as Record<string, unknown> | undefined)?.[key] ?? process.env?.[key];
  return raw === undefined || raw === null || raw === '' ? undefined : String(raw);
}

/**
 * 判断布尔开关是否被显式关闭（'false' / '0'），未设置或其他值视为开启
 */
export function isEnvDisabled(raw: string | undefined): boolean {
  return raw !== undefined && ['false', '0'].includes(raw.trim().toLowerCase());
}
