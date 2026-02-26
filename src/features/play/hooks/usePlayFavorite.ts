import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';

import type Artplayer from 'artplayer';

import {
  deleteFavorite,
  isFavorited,
  saveFavorite,
  subscribeToDataUpdates,
  generateStorageKey,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

interface UsePlayFavoriteParams {
  currentSource: string;
  currentId: string;
  searchTitle: string;
  videoTitleRef: MutableRefObject<string>;
  detailRef: MutableRefObject<SearchResult | null>;
  currentSourceRef: MutableRefObject<string>;
  currentIdRef: MutableRefObject<string>;
  favorited: boolean;
  setFavorited: Dispatch<SetStateAction<boolean>>;
}

export function usePlayFavorite({
  currentSource,
  currentId,
  searchTitle,
  videoTitleRef,
  detailRef,
  currentSourceRef,
  currentIdRef,
  favorited,
  setFavorited,
}: UsePlayFavoriteParams) {
  // source/id 变化时检查收藏状态
  useEffect(() => {
    if (!currentSource || !currentId) return;
    (async () => {
      try {
        const fav = await isFavorited(currentSource, currentId);
        setFavorited(fav);
      } catch (err) {
        console.error('检查收藏状态失败:', err);
      }
    })();
  }, [currentSource, currentId]);

  // 监听收藏数据更新事件
  useEffect(() => {
    if (!currentSource || !currentId) return;

    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (favorites: Record<string, unknown>) => {
        const key = generateStorageKey(currentSource, currentId);
        const isFav = !!favorites[key];
        setFavorited(isFav);
      },
    );

    return unsubscribe;
  }, [currentSource, currentId]);

  // 切换收藏
  const handleToggleFavorite = async () => {
    if (
      !videoTitleRef.current ||
      !detailRef.current ||
      !currentSourceRef.current ||
      !currentIdRef.current
    )
      return;

    try {
      if (favorited) {
        await deleteFavorite(currentSourceRef.current, currentIdRef.current);
        setFavorited(false);
      } else {
        await saveFavorite(currentSourceRef.current, currentIdRef.current, {
          title: videoTitleRef.current,
          source_name: detailRef.current?.source_name || '',
          year: detailRef.current?.year,
          cover: detailRef.current?.poster || '',
          total_episodes: detailRef.current?.episodes.length || 1,
          save_time: Date.now(),
          search_title: searchTitle,
        });
        setFavorited(true);
      }
    } catch (err) {
      console.error('切换收藏失败:', err);
    }
  };

  return { handleToggleFavorite };
}
