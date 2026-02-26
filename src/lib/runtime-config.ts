/**
 * 全局 RUNTIME_CONFIG 类型定义与类型安全访问器。
 * layout.tsx 在服务端将配置序列化后通过 <script> 注入到 window.RUNTIME_CONFIG。
 */

export interface RuntimeConfig {
  STORAGE_TYPE: string;
  OPEN_REGISTER: boolean;
  UPDATE_REPOS: string;
  UPDATE_BRANCH: string;
  DOUBAN_PROXY_TYPE: string;
  DOUBAN_PROXY: string;
  DOUBAN_IMAGE_PROXY_TYPE: string;
  DOUBAN_IMAGE_PROXY: string;
  DISABLE_YELLOW_FILTER: boolean;
  CUSTOM_CATEGORIES: { name: string; type: 'movie' | 'tv'; query: string }[];
  FLUID_SEARCH: boolean;
}

declare global {
  interface Window {
    RUNTIME_CONFIG?: RuntimeConfig;
    __sidebarCollapsed?: boolean;
  }
}

/** 获取运行时配置（仅客户端可用）。服务端调用时返回 undefined。 */
export function getRuntimeConfig(): RuntimeConfig | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.RUNTIME_CONFIG;
}
