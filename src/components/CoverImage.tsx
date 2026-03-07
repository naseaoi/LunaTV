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

import { processImageUrl } from '@/lib/utils';

import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import NoImageCover from '@/components/NoImageCover';

/**
 * 封面图片内存缓存：记录已成功加载的原始 URL，
 * 命中缓存时跳过骨架屏直接显示，避免重复加载动画。
 */
const loadedImageCache = new Set<string>();
const CACHE_MAX_SIZE = 500;

function markImageLoaded(url: string) {
  if (!url) return;
  if (loadedImageCache.size >= CACHE_MAX_SIZE) {
    loadedImageCache.clear();
  }
  loadedImageCache.add(url);
}

function isImageCached(url: string): boolean {
  return loadedImageCache.has(url);
}

interface CoverImageProps {
  src: string;
  alt: string;
  /** 传给 Next.js Image 的 sizes，默认 '(max-width: 640px) 96px, 180px' */
  sizes?: string;
  /** object-fit 模式，默认 'cover' */
  fit?: 'cover' | 'contain';
  /** 骨架屏宽高比 class，默认 'aspect-[2/3]' */
  aspectRatio?: string;
  /** 加载失败 1.2s 后自动重试一次，默认 true */
  enableRetry?: boolean;
  /** 无封面兜底文案 */
  fallbackLabel?: string;
}

/**
 * 统一封面图片组件：骨架屏 → 加载 → 重试 → 兜底，内置内存缓存。
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
  // retryKey 变化时触发 Next.js Image 重新渲染（走 /_next/image 代理），避免直接修改 img.src
  const [retryKey, setRetryKey] = useState(0);
  const retriedRef = useRef(false);

  const processed = useMemo(
    () => (isEmpty ? '' : processImageUrl(src)),
    [src, isEmpty],
  );

  // direct/img3/server 模式的 URL 不能走 Next.js Image 优化代理（/_next/image），
  // 否则豆瓣防盗链会返回 418。CDN 代理（cmliussss）的 URL 可以正常优化。
  const needsUnoptimized = useMemo(() => {
    if (!processed) return false;
    // server 模式：以 / 开头的本地路径（/api/image-proxy?url=...）
    if (processed.startsWith('/')) return true;
    // direct/img3 模式：仍然是 doubanio.com 域名但不含 cmliussss
    if (processed.includes('doubanio.com') && !processed.includes('cmliussss'))
      return true;
    return false;
  }, [processed]);
  // 重试时在 URL 上追加 cache-bust 参数，让 Next.js Image 代理重新请求上游
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

  // src 变化时重置状态
  useEffect(() => {
    retriedRef.current = false;
    setRetryKey(0);
    setHasError(false);
    setLoaded(isImageCached(src));
  }, [src]);

  const showFallback = isEmpty || hasError;

  const handleLoad = useCallback(() => {
    setLoaded(true);
    markImageLoaded(src);
  }, [src]);

  const handleError = useCallback(() => {
    if (!enableRetry || retriedRef.current) {
      setHasError(true);
      setLoaded(true);
      return;
    }
    // 通过 state 驱动重试，保持 Next.js Image 代理链路
    retriedRef.current = true;
    setTimeout(() => {
      setRetryKey(Date.now());
    }, 1200);
  }, [enableRetry]);

  if (showFallback) {
    return (
      <NoImageCover label={fallbackLabel} iconSize={34} iconStrokeWidth={1.5} />
    );
  }

  return (
    <>
      {!loaded && <ImagePlaceholder aspectRatio={aspectRatio} />}
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
    </>
  );
});

export default CoverImage;
