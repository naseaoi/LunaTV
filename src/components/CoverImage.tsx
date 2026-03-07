'use client';

import Image from 'next/image';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { imageScheduler } from '@/lib/image-scheduler';
import { processImageUrl } from '@/lib/utils';

import NoImageCover from '@/components/NoImageCover';

// ================================================================
// 封面图片内存缓存 + 跨实例通知
// ================================================================

const loadedImageCache = new Set<string>();
const CACHE_MAX_SIZE = 500;

/** 全局事件总线：某个实例加载成功后通知同 src 的其他实例 */
const imageLoadEmitter = new EventTarget();

function markImageLoaded(url: string) {
  if (!url) return;
  if (loadedImageCache.size >= CACHE_MAX_SIZE) {
    loadedImageCache.clear();
  }
  loadedImageCache.add(url);
  imageLoadEmitter.dispatchEvent(new CustomEvent('loaded', { detail: url }));
}

function isImageCached(url: string): boolean {
  return loadedImageCache.has(url);
}

/** 最大重试次数（首次加载不算，失败后最多再试 MAX_RETRIES 次） */
const MAX_RETRIES = 2;
/** 每次重试间隔 ms */
const RETRY_DELAY = 1200;

// ================================================================
// CoverImage 组件
// ================================================================

interface CoverImageProps {
  src: string;
  alt: string;
  /** 传给 Next.js Image 的 sizes，默认 '(max-width: 640px) 96px, 180px' */
  sizes?: string;
  /** object-fit 模式，默认 'cover' */
  fit?: 'cover' | 'contain';
  /** 骨架屏宽高比 class，默认 'aspect-[2/3]' */
  aspectRatio?: string;
  /** 加载失败后自动重试（最多 2 次），默认 true */
  enableRetry?: boolean;
  /** 无封面兜底文案 */
  fallbackLabel?: string;
}

/**
 * 统一封面图片组件：骨架屏 → 加载 → 重试(最多2次) → 兜底。
 * 内置内存缓存 + 跨实例同步（模态框加载成功后卡片立即显示）。
 * 外层容器需要 `position: relative` + 固定宽高。
 */
const CoverImage: React.FC<CoverImageProps> = memo(function CoverImage({
  src,
  alt,
  sizes = '(max-width: 640px) 96px, 180px',
  fit = 'cover',
  aspectRatio = 'aspect-[2/3]',
  enableRetry = true,
  fallbackLabel = '无封面',
}) {
  const isEmpty = !src || src.trim() === '';
  const [retryKey, setRetryKey] = useState(0);
  const retryCountRef = useRef(0);
  const releaseSlotRef = useRef<(() => void) | null>(null);

  const processed = useMemo(
    () => (isEmpty ? '' : processImageUrl(src)),
    [src, isEmpty],
  );

  const needsUnoptimized = useMemo(() => {
    if (!processed) return false;
    if (processed.startsWith('/')) return true;
    if (processed.includes('doubanio.com') && !processed.includes('cmliussss'))
      return true;
    return false;
  }, [processed]);

  const displaySrc = useMemo(
    () =>
      retryKey > 0
        ? `${processed}${processed.includes('?') ? '&' : '?'}retry=${retryKey}`
        : processed,
    [processed, retryKey],
  );

  const cached = !isEmpty && isImageCached(src);
  const [loaded, setLoaded] = useState(cached);
  const [hasError, setHasError] = useState(false);
  // 并发调度：是否已获得加载 slot（缓存命中则直接跳过排队）
  const [slotGranted, setSlotGranted] = useState(cached);

  // src 变化时重置所有状态（包括释放旧 slot）
  useEffect(() => {
    retryCountRef.current = 0;
    setRetryKey(0);
    setHasError(false);
    const isCached = isImageCached(src);
    setLoaded(isCached);
    setSlotGranted(isCached);

    // 释放旧 slot
    releaseSlotRef.current?.();
    releaseSlotRef.current = null;
  }, [src]);

  // 请求并发 slot（未缓存 & 未出错 & 尚未获得 slot 时排队）
  // 注意：不把 slotGranted 放在依赖中，避免获得 slot 后 cleanup 提前释放
  const needsSlot = !isEmpty && !slotGranted && !hasError;
  const needsSlotRef = useRef(needsSlot);
  needsSlotRef.current = needsSlot;

  useEffect(() => {
    if (!needsSlotRef.current) return;

    const release = imageScheduler.acquire(() => {
      setSlotGranted(true);
    });
    releaseSlotRef.current = release;

    return () => {
      release();
      releaseSlotRef.current = null;
    };
  }, [src]);

  // 跨实例同步：其他 CoverImage 实例加载了同一 src 时，立即标记已加载。
  // 典型场景：模态框加载成功 → 卡片立即显示，无需等待自身请求完成。
  useEffect(() => {
    if (loaded || hasError || isEmpty) return;

    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === src) {
        setLoaded(true);
        setRetryKey(0); // 停止可能进行中的重试
        // 跨实例同步成功 → 释放 slot（不再需要自己加载）
        releaseSlotRef.current?.();
        releaseSlotRef.current = null;
      }
    };

    imageLoadEmitter.addEventListener('loaded', handler);
    return () => imageLoadEmitter.removeEventListener('loaded', handler);
  }, [src, loaded, hasError, isEmpty]);

  const showFallback = isEmpty || hasError;

  const handleLoad = useCallback(() => {
    setLoaded(true);
    markImageLoaded(src);
    // 加载完成 → 释放 slot
    releaseSlotRef.current?.();
    releaseSlotRef.current = null;
  }, [src]);

  const handleError = useCallback(() => {
    if (!enableRetry || retryCountRef.current >= MAX_RETRIES) {
      setHasError(true);
      setLoaded(true);
      // 最终失败 → 释放 slot
      releaseSlotRef.current?.();
      releaseSlotRef.current = null;
      return;
    }
    // 重试期间保持加载态（显示转圈动画），避免闪现损坏图标
    // 不释放 slot——重试仍在使用同一个 slot
    setLoaded(false);
    retryCountRef.current += 1;
    setTimeout(() => {
      setRetryKey(Date.now());
    }, RETRY_DELAY);
  }, [enableRetry]);

  if (showFallback) {
    return (
      <NoImageCover label={fallbackLabel} iconSize={34} iconStrokeWidth={1.5} />
    );
  }

  return (
    <>
      {!loaded && (
        <div className='absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-200/60 dark:bg-gray-700/60'>
          <div className='h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500 dark:border-gray-600 dark:border-t-gray-400' />
        </div>
      )}
      {slotGranted && (
        <Image
          key={retryKey}
          src={displaySrc}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized={needsUnoptimized}
          className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          referrerPolicy='no-referrer'
          loading='lazy'
          onLoad={handleLoad}
          onError={handleError}
          style={
            {
              WebkitUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              pointerEvents: 'none',
            } as React.CSSProperties
          }
          onContextMenu={(e) => {
            e.preventDefault();
            return false;
          }}
          onDragStart={(e) => {
            e.preventDefault();
            return false;
          }}
        />
      )}
    </>
  );
});

export default CoverImage;
