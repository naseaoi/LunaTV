// 此文件由 scripts/convert-changelog.js 自动生成
// 请勿手动编辑

export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.2.5',
    date: '2026-04-07',
    added: [
      // 无新增内容
    ],
    changed: [
      '优化 giri 多版本播放体验，改为在选集页内切换版本并精简选集分页展示',
      '优化点播播放器与代理链路，提升切源和缓冲恢复的稳定性',
    ],
    fixed: [
      '修复 giri 多版本混合导致的重复集数、错集和版本名异常问题',
      '修复播放中切换源站时“切换中”遮罩重复闪现的问题',
    ],
  },
  {
    version: '0.2.4',
    date: '2026-04-07',
    added: [
      // 无新增内容
    ],
    changed: [
      '优化播放记录保存链路，细化错误提示并增加重试、去重和保活处理',
      '优化播放页换源流程，点击其他源站时立即停止当前视频并续播到原时间点',
    ],
    fixed: [
      '修复播放中偶发提示数据库操作失败或保存进度失败的问题',
      '修复视频转圈时切换源站会被当前源阻塞的问题',
    ],
  },
  {
    version: '0.2.3',
    date: '2026-03-06',
    added: ['后台新增直播开关入口'],
    changed: ['优化首屏和列表页的加载速度'],
    fixed: ['修复源站加载和检测逻辑'],
  },
  {
    version: '0.2.2',
    date: '2026-02-27',
    added: [
      // 无新增内容
    ],
    changed: ['优化搜索和换源面板的体验', '全面优化封面处理逻辑'],
    fixed: ['修复换源面板的测速错误问题'],
  },
  {
    version: '0.2.1',
    date: '2026-02-26',
    added: [
      // 无新增内容
    ],
    changed: ['播放器前端样式优化', '去广告逻辑优化'],
    fixed: [
      // 无修复内容
    ],
  },
  {
    version: '0.2.0',
    date: '2026-02-26',
    added: [
      // 无新增内容
    ],
    changed: ['大幅优化前端样式'],
    fixed: [
      // 无修复内容
    ],
  },
  {
    version: '0.1.1',
    date: '2026-02-24',
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: ['修复去广告失效问题', '修复版本日志不显示问题'],
  },
  {
    version: '0.1.0',
    date: '2026-02-23',
    added: [
      // 无新增内容
    ],
    changed: ['优化部分动画，比如加载动画和交互动画等', '优化源站列表排序逻辑'],
    fixed: [
      // 无修复内容
    ],
  },
  {
    version: '0.0.3',
    date: '2025-10-27',
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: ['修复 webkit 下播放器控件的展示 bug'],
  },
  {
    version: '0.0.2',
    date: '2025-10-23',
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: ['修复 /api/search/resources 接口越权问题'],
  },
  {
    version: '0.0.1',
    date: '2025-09-25',
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
      '修复错误的环境变量 ADMIN_USERNAME',
      '修复 bangumi 数据中没有图片导致首页崩溃问题',
    ],
  },
];

export default changelog;
