const CURRENT_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || '100.0.3';

// 导出当前版本号供其他地方使用
export { CURRENT_VERSION };
