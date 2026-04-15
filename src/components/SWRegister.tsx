'use client';

import { useEffect } from 'react';

/** 生产环境注册 SW；开发环境自动注销残留的旧 SW，避免缓存干扰调试 */
export function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW 注册失败:', err);
      });
    } else {
      // 开发模式：注销所有残留 SW，防止缓存旧页面
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);

  return null;
}
