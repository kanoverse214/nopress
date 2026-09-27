/**
 * NoPress Paper 主题配置
 *
 * 纸本学术排版：衬线正文、朱红章节编号、三线表、页边目录与 BibTeX 引用。
 * 适合长文、技术随笔与读书笔记。全功能路由：首页（分页）/ 文章 / 独立页面 / 标签 / 归档。
 */

export default {
  id: 'paper',
  name: 'NoPress Paper',
  version: '1.0.0',
  author: 'NoPress Team',
  description: '纸本学术排版主题：衬线正文、章节编号、页边目录',
  compatibleVersion: '^0.1.0',

  // 主题选项：宿主可用 NOPRESS_THEME_OPTIONS 覆盖默认值（docs/THEMES.md）
  options: {
    // darkMode 为保留选项：声明即声明为双模式主题，框架负责模式初始化
    darkMode: {
      type: 'boolean',
      default: true,
      label: '深色模式',
      description: '夜读配色；关闭后恒为纸色并隐藏切换按钮',
    },
    accentColor: {
      type: 'color',
      default: '#9b2226',
      label: '点缀色',
      description: '章节编号、链接与标记的颜色（深色模式自动提亮）',
    },
    numberedHeadings: {
      type: 'boolean',
      default: true,
      label: '章节编号',
      description: '正文标题按 1 / 1.1 / 1.1.1 编号，同时为带说明的图片与公式编号',
    },
    showCitation: {
      type: 'boolean',
      default: true,
      label: '引用本文',
      description: '文末提供可复制的 BibTeX 条目',
    },
    author: {
      type: 'string',
      default: '',
      label: '作者署名',
      description: '用于 BibTeX 引用条目，留空则使用站点名称',
    },
    showPostCover: {
      type: 'boolean',
      default: true,
      label: '文章封面',
      description: '在摘要下方以卷首插图形式展示封面（不影响分享用的 OG 图）',
    },
  },
};
