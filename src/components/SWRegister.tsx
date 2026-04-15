'use client';

import { useEffect } from 'react';

/** 在客户端注册 Service Worker */
export function SWRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW 注册失败:', err);
      });
    }
  }, []);

  return null;
}
