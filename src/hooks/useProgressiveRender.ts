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
    setVisibleCount(nextInitialCount);

    if (!enabled || items.length <= nextInitialCount) {
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
