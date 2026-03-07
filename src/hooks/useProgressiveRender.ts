'use client';

import { useEffect, useMemo, useState } from 'react';

interface UseProgressiveRenderOptions {
  enabled?: boolean;
  initialCount?: number;
  step?: number;
  delayMs?: number;
}

export function useProgressiveRender<T>(
  items: T[],
  options: UseProgressiveRenderOptions = {},
) {
  const {
    enabled = true,
    initialCount = 24,
    step = 18,
    delayMs = 16,
  } = options;

  const getInitialVisibleCount = () =>
    enabled ? Math.min(initialCount, items.length) : items.length;

  const [visibleCount, setVisibleCount] = useState(getInitialVisibleCount);

  useEffect(() => {
    const nextInitialCount = getInitialVisibleCount();
    // 追加数据时 visibleCount 不应回退，避免页面跳动
    setVisibleCount((prev) => Math.max(prev, nextInitialCount));

    if (!enabled || items.length <= nextInitialCount) {
      // 确保 items 减少时（如切换筛选器）visibleCount 不超过实际数量
      setVisibleCount((prev) => Math.min(prev, items.length));
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextChunk = () => {
      timerId = setTimeout(() => {
        if (cancelled) {
          return;
        }

        setVisibleCount((prev) => {
          const next = Math.min(prev + step, items.length);

          if (next < items.length) {
            scheduleNextChunk();
          }

          return next;
        });
      }, delayMs);
    };

    scheduleNextChunk();

    return () => {
      cancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
      }
    };
  }, [delayMs, enabled, initialCount, items, step]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  return {
    visibleCount,
    visibleItems,
    isFullyRendered: visibleCount >= items.length,
  };
}
