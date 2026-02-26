'use client';

import Image from 'next/image';
import React, { memo, useCallback, useMemo, useState } from 'react';

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
    // 简单淘汰：清空重建（低频操作，不值得引入 LRU）
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
  const processed = useMemo(
    () => (isEmpty ? '' : processImageUrl(src)),
    [src, isEmpty],
  );
  const cached = !isEmpty && isImageCached(src);

  const [loaded, setLoaded] = useState(cached);
  const [hasError, setHasError] = useState(false);

  const showFallback = isEmpty || hasError;

  const handleLoadComplete = useCallback(() => {
    setLoaded(true);
    markImageLoaded(src);
  }, [src]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!enableRetry) {
        setHasError(true);
        setLoaded(true);
        return;
      }
      const img = e.target as HTMLImageElement;
      if (!img.dataset.retried) {
        img.dataset.retried = 'true';
        const retryUrl = `${processed}${processed.includes('?') ? '&' : '?'}retry=${Date.now()}`;
        setTimeout(() => {
          img.src = retryUrl;
        }, 1200);
        return;
      }
      setHasError(true);
      setLoaded(true);
    },
    [enableRetry, processed],
  );

  if (showFallback) {
    return (
      <NoImageCover label={fallbackLabel} iconSize={34} iconStrokeWidth={1.5} />
    );
  }

  return (
    <>
      {!loaded && <ImagePlaceholder aspectRatio={aspectRatio} />}
      <Image
        src={processed}
        alt={alt}
        fill
        sizes={sizes}
        className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        referrerPolicy='no-referrer'
        loading='lazy'
        onLoadingComplete={handleLoadComplete}
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
